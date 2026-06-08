import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "happy-dom",
        coverage: {
            provider: "v8",
            reporter: ["text", "html", "json-summary", "lcov"],
            thresholds: { lines: 100, statements: 100, branches: 100, functions: 100 },
            include: ["src/**/*.{ts,tsx}"],
            exclude: [
                "src/**/*.test.ts",
                "src/**/*.test.tsx",
                "src/**/*.bench.test.ts",
                "src/**/__fixtures__/**",
                "src/**/index.ts",
                "src/**/types.ts",
            ],
        },
    },
});
