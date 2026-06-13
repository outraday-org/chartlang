// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import { chartlangCompilePlugin } from "./server/compilePlugin";

const ESBUILD_BROWSER_STUB = fileURLToPath(new URL("./src/esbuildStub.ts", import.meta.url));
const NODE_BUILTIN_STUB = fileURLToPath(new URL("./src/nodeBuiltinStub.ts", import.meta.url));
// Serve the canvas2d reference adapter from its TypeScript source rather
// than its built `dist/`. Vite resolves the `.js` import specifiers in the
// adapter source to the matching `.ts` files, so edits to the renderer
// (pane layout, y-axis, palette, …) hot-reload instantly without a
// `pnpm --filter chartlang-example-canvas2d-adapter build` step.
const CANVAS2D_ADAPTER_SRC = fileURLToPath(
    new URL("../canvas2d-adapter/src/index.ts", import.meta.url),
);

export default defineConfig({
    plugins: [react(), chartlangCompilePlugin()],
    resolve: {
        alias: [
            // esbuild ships a native launcher that can't run in the
            // browser. The demo compiles server-side via the
            // `/api/compile` middleware, so the browser-side language
            // service never reaches the real esbuild. Alias is scoped
            // to client-side resolves only — `compilePlugin.ts` runs in
            // node and imports the real compiler / language-service,
            // which Vite does not pass through the alias graph.
            { find: "esbuild", replacement: ESBUILD_BROWSER_STUB },
            // The compiler also imports node builtins at module scope
            // (fs/path/url/crypto/os) for its node-only compileFile /
            // compileProject paths. Same deal: importable, not callable.
            { find: /^node:(crypto|fs\/promises|path|url|os)$/, replacement: NODE_BUILTIN_STUB },
            // Adapter source over dist (see CANVAS2D_ADAPTER_SRC above).
            // Exact-match so the `./testing` subpath still resolves to dist.
            { find: "chartlang-example-canvas2d-adapter", replacement: CANVAS2D_ADAPTER_SRC },
        ],
    },
    optimizeDeps: {
        // Excluded so Vite serves the adapter as live source modules
        // (HMR) instead of a pre-bundled, dist-derived chunk that only
        // re-optimises on lockfile changes.
        exclude: ["esbuild", "chartlang-example-canvas2d-adapter"],
    },
    server: {
        port: 5173,
    },
});
