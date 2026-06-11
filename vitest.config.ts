import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        setupFiles: ["./vitest.setup.ts"],
        environmentMatchGlobs: [
            ["packages/editor/src/**/*.test.ts", "happy-dom"],
            ["packages/editor/src/**/*.test.tsx", "happy-dom"],
        ],
        coverage: {
            // The untested-files crawl must not wander into build output or
            // ungated scratch harnesses: examples/react-demo's vite build
            // emits assets with dangling sourceMappingURL comments (copied
            // worker-boot.js without its .map) that hard-error the v8
            // coverage provider.
            exclude: [
                "**/node_modules/**",
                "**/dist/**",
                "**/coverage/**",
                "docs/**",
                "scripts/**",
                "examples/react-demo/**",
                "examples/canvas2d-adapter/playground/**",
                "examples/canvas2d-adapter/e2e-smoke.ts",
                "parity-smoke.mts",
                "**/*.config.*",
                "**/vitest.setup.ts",
            ],
        },
    },
});
