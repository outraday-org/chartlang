import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        setupFiles: ["./vitest.setup.ts"],
        // Keep vitest's default test-file exclude (node_modules, dist, …) and
        // add apps/**: apps/site ships a Playwright suite (*.spec.ts under
        // apps/site/tests/) whose test() calls throw if collected by vitest.
        // Apps run their own Playwright runner, not the workspace vitest.
        exclude: [...configDefaults.exclude, "apps/**"],
        environmentMatchGlobs: [
            ["packages/editor/src/**/*.test.ts", "happy-dom"],
            ["packages/editor/src/**/*.test.tsx", "happy-dom"],
        ],
        coverage: {
            // The untested-files crawl must not wander into build output or
            // ungated scratch harnesses: the apps/site vite build emits
            // assets with dangling sourceMappingURL comments that hard-error
            // the v8 coverage provider, so apps/** is excluded wholesale.
            exclude: [
                "**/node_modules/**",
                "**/dist/**",
                "**/coverage/**",
                "docs/**",
                "scripts/**",
                "apps/**",
                "examples/canvas2d-adapter/playground/**",
                "examples/canvas2d-adapter/e2e-smoke.ts",
                "parity-smoke.mts",
                "**/*.config.*",
                "**/vitest.setup.ts",
            ],
        },
    },
});
