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
                // Declaration-only module (no runtime code): the lexer token/
                // diagnostic types. Same category as a `types.ts` barrel.
                "src/lexer/tokens.ts",
                // Declaration-only AST node modules (pure `export type`, no
                // runtime). Same category as a `types.ts` barrel — `ast/types.ts`
                // is already covered by the `**/types.ts` glob above.
                "src/ast/spans.ts",
                "src/ast/expressions.ts",
                "src/ast/statements.ts",
                "src/ast/script.ts",
            ],
        },
    },
});
