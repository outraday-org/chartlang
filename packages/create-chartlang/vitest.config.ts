import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        coverage: {
            provider: "v8",
            reporter: ["text", "html", "json-summary", "lcov"],
            thresholds: { lines: 100, statements: 100, branches: 100, functions: 100 },
            include: ["src/**/*.ts"],
            exclude: [
                "src/**/*.test.ts",
                "src/**/*.bench.test.ts",
                "src/**/__fixtures__/**",
                "src/**/index.ts",
                "src/**/types.ts",
                // `index.ts` is the shebang `bin` entry: it wires the real
                // process streams + giget into `runCreateChartlang` and invokes
                // it at import time (same precedent as the CLI's `bin.ts`). The
                // testable logic lives in `createApp.ts` + the pure helpers.
            ],
        },
    },
});
