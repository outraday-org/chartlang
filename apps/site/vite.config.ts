// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { fileURLToPath } from "node:url"
import netlify from "@netlify/vite-plugin-tanstack-start"
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
    devtools(),
    tailwindcss(),
    tanstackStart(),
    netlify(),
    viteReact(),
  ],
})

export default config
