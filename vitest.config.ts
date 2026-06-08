import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environmentMatchGlobs: [
            ["packages/editor/src/**/*.test.ts", "happy-dom"],
            ["packages/editor/src/**/*.test.tsx", "happy-dom"],
        ],
    },
});
