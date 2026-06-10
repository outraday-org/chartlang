// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import { chartlangCompilePlugin } from "./server/compilePlugin";

const ESBUILD_BROWSER_STUB = fileURLToPath(new URL("./src/esbuildStub.ts", import.meta.url));
const NODE_BUILTIN_STUB = fileURLToPath(new URL("./src/nodeBuiltinStub.ts", import.meta.url));

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
        ],
    },
    optimizeDeps: {
        exclude: ["esbuild"],
    },
    server: {
        port: 5173,
    },
});
