// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { readFileSync, readdirSync, realpathSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import netlify from "@netlify/vite-plugin-tanstack-start"
import * as esbuild from "esbuild"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import tailwindcss from "@tailwindcss/vite"
import viteReact from "@vitejs/plugin-react"
import { type Plugin, defineConfig } from "vite"

const ESBUILD_BROWSER_STUB = fileURLToPath(
  new URL("./src/lib/browser-stubs/esbuildStub.ts", import.meta.url),
)
const NODE_BUILTIN_STUB = fileURLToPath(
  new URL("./src/lib/browser-stubs/nodeBuiltinStub.ts", import.meta.url),
)

const NODE_BUILTIN_RE = /^node:(crypto|fs\/promises|path|url|os)$/

/**
 * Redirect `esbuild` and the `node:*` builtins the chartlang language
 * service touches to browser stubs — but ONLY in the client graph.
 *
 * This is the load-bearing invariant of the demo: the language service
 * is importable in the browser (for hover / completions / signature
 * help), yet its esbuild + node:* call paths must never execute there.
 * The real compile runs in the `/api/compile` server route, whose
 * server-graph bundle MUST keep the real esbuild + node builtins.
 *
 * A plain `resolve.alias` would rewrite both graphs and break the
 * server compiler, so the alias is scoped via `applyToEnvironment` to
 * the `client` environment only.
 */
function clientBrowserStubs(): Plugin {
  return {
    name: "chartlang-client-browser-stubs",
    applyToEnvironment: (environment) => environment.name === "client",
    enforce: "pre",
    resolveId(id) {
      if (id === "esbuild") return ESBUILD_BROWSER_STUB
      if (NODE_BUILTIN_RE.test(id)) return NODE_BUILTIN_STUB
      return null
    },
  }
}

const TS_DEFAULT_LIBS_ID = "virtual:ts-default-libs"

/**
 * Embed TypeScript's ES-lib `.d.ts` files into the server bundle as a
 * `{ [basename]: contents }` map.
 *
 * The `/api/compile` route runs the real compiler, whose in-memory
 * `ts.Program` loads its default lib (`lib.es2022.d.ts` + the ES closure)
 * from disk at runtime via `ts.sys.getExecutingFilePath()` →
 * `node_modules/typescript/lib`. Netlify's function bundler does NOT ship
 * those data files (esbuild/nft only traces `typescript.js`), so on the
 * deployed site the lib read fails; with `skipLibCheck` the failure is
 * silent and the ambient core shim's `Readonly`/`Record` collapse to
 * `any`, making every valid `compute({ bar, ta, … })` destructure emit a
 * spurious TS7031. Bundling the lib text in and serving it from `ts.sys`
 * (see `src/lib/server/tsDefaultLibs.ts`) makes the compiler
 * host-filesystem-independent. Only the ES + decorators libs are embedded
 * (~630 KB) — the compiler pins `lib: ["lib.es2022.d.ts"]` (no DOM), so the
 * 3 MB of DOM/WebWorker libs are never requested.
 */
function tsDefaultLibs(): Plugin {
  return {
    name: "chartlang-ts-default-libs",
    resolveId(id) {
      return id === TS_DEFAULT_LIBS_ID ? `\0${TS_DEFAULT_LIBS_ID}` : null
    },
    load(id) {
      if (id !== `\0${TS_DEFAULT_LIBS_ID}`) return null
      const require = createRequire(import.meta.url)
      const libDir = dirname(require.resolve("typescript"))
      const libs: Record<string, string> = {}
      for (const file of readdirSync(libDir)) {
        if (/^lib\.(es|decorators).*\.d\.ts$/.test(file)) {
          libs[file] = readFileSync(join(libDir, file), "utf8")
        }
      }
      return `export default ${JSON.stringify(libs)}`
    },
  }
}

const CORE_BUNDLES_ID = "virtual:chartlang-core-bundles"

/**
 * Pre-bundle `@invinite-org/chartlang-core` (+ its `/time` subpath) into
 * self-contained ESM strings and expose them as a
 * `{ [specifier]: source }` map for `virtual:chartlang-core-bundles`.
 *
 * The `/api/compile` route runs the real compiler, whose esbuild step
 * (`bundle: true`) resolves the user script's
 * `import … from "@invinite-org/chartlang-core"` against the filesystem.
 * The Netlify function inlines the workspace package into the server
 * bundle but does NOT install it as a resolvable `node_modules` package,
 * so on the deployed site esbuild fails with "Could not resolve
 * @invinite-org/chartlang-core" and the compile 500s (a blank chart with
 * no gutter error). Passing these pre-bundled sources to `compile`'s
 * `inMemoryModules` seam makes the bundler resolve core from memory
 * instead of disk. Built here (at `vite build`, where the workspace dist
 * IS present) and embedded in the server bundle.
 */
function chartlangCoreBundles(): Plugin {
  return {
    name: "chartlang-core-bundles",
    resolveId(id) {
      return id === CORE_BUNDLES_ID ? `\0${CORE_BUNDLES_ID}` : null
    },
    async load(id) {
      if (id !== `\0${CORE_BUNDLES_ID}`) return null
      // The core package exposes only the `import` condition, so CJS
      // `require.resolve` of it (or its package.json) throws. Resolve the
      // workspace symlink under this app's node_modules instead.
      const appDir = dirname(fileURLToPath(import.meta.url))
      const coreRoot = realpathSync(
        join(appDir, "node_modules/@invinite-org/chartlang-core"),
      )
      const bundleEntry = async (relPath: string): Promise<string> => {
        const result = await esbuild.build({
          entryPoints: [join(coreRoot, relPath)],
          bundle: true,
          format: "esm",
          platform: "neutral",
          target: "es2022",
          treeShaking: true,
          write: false,
        })
        return result.outputFiles[0]?.text ?? ""
      }
      const modules: Record<string, string> = {
        "@invinite-org/chartlang-core": await bundleEntry("dist/index.js"),
        "@invinite-org/chartlang-core/time": await bundleEntry("dist/time/index.js"),
      }
      return `export default ${JSON.stringify(modules)}`
    },
  }
}

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  optimizeDeps: { exclude: ["esbuild"] },
  environments: {
    // The compiler runs in the server graph and calls into `esbuild`,
    // whose JS API cannot be bundled — it locates a native binary via a
    // path relative to its own package and throws "__filename is not
    // defined" once bundled into an ESM server file. Keep it external so
    // the function runtime loads it from node_modules. Mirrors the
    // Netlify `external_node_modules = ["esbuild"]` directive (Task 5).
    //
    // `typescript` is left to Vite's default SSR externalisation. Its
    // default-lib `.d.ts` files are NOT shipped to the Netlify function,
    // so the compiler's lib reads are served in-memory by the
    // `tsDefaultLibs` plugin + `src/lib/server/tsDefaultLibs.ts` instead
    // of the function filesystem. See DEPLOYMENT.md.
    ssr: {
      build: {
        rollupOptions: {
          external: ["esbuild"],
        },
      },
    },
  },
  plugins: [
    clientBrowserStubs(),
    tsDefaultLibs(),
    chartlangCoreBundles(),
    devtools(),
    tailwindcss(),
    tanstackStart(),
    netlify(),
    viteReact(),
  ],
})

export default config
