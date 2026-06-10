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
                "src/**/*.bench.ts",
                "src/**/*.bench.test.ts",
                "src/**/__fixtures__/**",
                // dispatcher.ts is the guest-realm entry: top-level globals hardening (deletes `eval` + `Function`) and `globalThis.__chartlang_*` writes would corrupt the Node test realm. Logic lives in `dispatcherCore.ts` (covered).
                "src/dispatcher.ts",
                "src/protocol.ts",
                "src/**/index.ts",
                "src/**/types.ts",
            ],
        },
    },
});
