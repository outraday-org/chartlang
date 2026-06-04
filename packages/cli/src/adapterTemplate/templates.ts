// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Capitalise the first letter of a kebab-case adapter name for
 * embedding into the generated adapter's display name. The kebab
 * source stays unchanged elsewhere — only the human-readable `Name`
 * surface in `package.json` / `README` uses this. Pure helper.
 *
 * @since 0.1
 * @example
 *     import { titleCase } from "@invinite-org/chartlang-cli";
 *     // titleCase("my-trading-chart") === "My-trading-chart"
 */
export function titleCase(name: string): string {
    if (name.length === 0) return name;
    return `${name.charAt(0).toUpperCase()}${name.slice(1)}`;
}

/**
 * Render the generated adapter's `package.json` contents. Unscoped
 * `chartlang-adapter-<NAME>` name marked `private: true` so consumers
 * opt-in to publishing by editing the file. Depends on the chartlang
 * adapter-kit + host-worker for adapter authoring.
 *
 * @since 0.1
 * @example
 *     import { PACKAGE_JSON } from "@invinite-org/chartlang-cli";
 *     const text = PACKAGE_JSON("demo", "2026-06-04");
 *     JSON.parse(text).name === "chartlang-adapter-demo";
 */
export function PACKAGE_JSON(name: string, date: string): string {
    const body = {
        name: `chartlang-adapter-${name}`,
        version: "0.0.0",
        private: true,
        type: "module",
        license: "MIT",
        description: `chartlang adapter — ${titleCase(name)} (scaffolded ${date})`,
        main: "./dist/index.js",
        types: "./dist/index.d.ts",
        exports: {
            ".": {
                types: "./dist/index.d.ts",
                import: "./dist/index.js",
            },
        },
        files: ["dist", "README.md"],
        scripts: {
            build: "tsc -p tsconfig.json",
            typecheck: "tsc -p tsconfig.json --noEmit",
            test: "vitest run",
        },
        dependencies: {
            "@invinite-org/chartlang-adapter-kit": "^0.1.0",
            "@invinite-org/chartlang-host-worker": "^0.1.0",
        },
        devDependencies: {
            "@types/node": "^20.0.0",
            typescript: "^5.6.0",
            vitest: "^2.1.0",
        },
        engines: { node: ">=20" },
    };
    return `${JSON.stringify(body, null, 4)}\n`;
}

/**
 * Render the generated adapter's `tsconfig.json`. Stands alone — no
 * `extends` clause, so the scaffold target works without a workspace
 * base config. Matches the chartlang workspace's strict settings.
 *
 * @since 0.1
 * @example
 *     import { TSCONFIG } from "@invinite-org/chartlang-cli";
 *     JSON.parse(TSCONFIG).compilerOptions.strict === true;
 */
export const TSCONFIG: string = `${JSON.stringify(
    {
        compilerOptions: {
            target: "ES2022",
            module: "ESNext",
            moduleResolution: "Bundler",
            lib: ["ES2022", "DOM", "DOM.Iterable"],
            strict: true,
            isolatedModules: true,
            esModuleInterop: true,
            verbatimModuleSyntax: true,
            declaration: true,
            outDir: "./dist",
            rootDir: "./src",
        },
        include: ["src/**/*"],
        exclude: ["**/*.test.ts"],
    },
    null,
    4,
)}\n`;

/**
 * Render the generated adapter's `src/index.ts`. Imports
 * `defineAdapter`, `capabilities`, and `mockCandleSource` from
 * adapter-kit and exports a minimal adapter calling `defineAdapter`
 * with a TODO capability bag. Consumers edit this file to wire their
 * renderer + data source.
 *
 * @since 0.1
 * @example
 *     import { INDEX_TS } from "@invinite-org/chartlang-cli";
 *     INDEX_TS("demo").includes('id: "demo"');
 */
export function INDEX_TS(name: string): string {
    const display = titleCase(name);
    return `import {
    capabilities,
    defineAdapter,
    mockCandleSource,
} from "@invinite-org/chartlang-adapter-kit";

export const adapter = defineAdapter({
    id: "${name}",
    name: "${display}",
    capabilities: {
        plots: capabilities.line(),
        drawings: new Set(),
        alerts: new Set(),
        alertConditions: false,
        logs: false,
        inputs: new Set(),
        intervals: [],
        multiTimeframe: false,
        subPanes: 0,
        symInfoFields: new Set(),
        maxDrawingsPerScript: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
        maxLookback: 5000,
        maxTickHz: 10,
    },
    candles: () => mockCandleSource([]),
    onEmissions: () => {
        // TODO: render the emissions to your chart canvas / DOM target.
    },
});
`;
}

/**
 * Render the generated adapter's `src/index.test.ts`. Placeholder
 * vitest assertion that confirms the adapter is defined with the
 * expected id. Consumers extend this with real adapter contract tests
 * (or import `runConformanceSuite` from `@invinite-org/chartlang-conformance`
 * once it ships).
 *
 * @since 0.1
 * @example
 *     import { INDEX_TEST_TS } from "@invinite-org/chartlang-cli";
 *     INDEX_TEST_TS("demo").includes("adapter.id");
 */
export function INDEX_TEST_TS(name: string): string {
    return `import { describe, expect, it } from "vitest";

import { adapter } from "./index";

describe("chartlang-adapter-${name}", () => {
    it("defines an adapter with the expected id", () => {
        expect(adapter.id).toBe("${name}");
    });
});
`;
}

/**
 * Render the generated adapter's `README.md`. ≤100 lines, structured
 * per chartlang's §17.1 README convention (title, stability,
 * description, install, public surface, MV API call, docs link,
 * license).
 *
 * @since 0.1
 * @example
 *     import { README_MD } from "@invinite-org/chartlang-cli";
 *     README_MD("demo", "2026-06-04").startsWith("# chartlang-adapter-demo");
 */
export function README_MD(name: string, date: string): string {
    const display = titleCase(name);
    return `# chartlang-adapter-${name}

\`experimental\`

chartlang adapter — ${display}. Scaffolded on ${date} by
\`chartlang scaffold-adapter\`.

## Install

\`\`\`bash
pnpm add chartlang-adapter-${name}
\`\`\`

## Public surface

Exports a single \`adapter\` constructed via \`defineAdapter\` from
\`@invinite-org/chartlang-adapter-kit\`.

## Minimum-viable API call

\`\`\`ts
import { adapter } from "chartlang-adapter-${name}";
console.log(adapter.id); // "${name}"
\`\`\`

## Docs

See the chartlang adapter contract docs and the conformance suite for
the full Adapter / Capabilities / CandleEvent surface.

## License

MIT
`;
}

/**
 * The generated adapter's `.gitignore` — excludes build / coverage /
 * `node_modules` output from version control. Matches the chartlang
 * workspace's per-package gitignore convention.
 *
 * @since 0.1
 * @example
 *     import { GITIGNORE } from "@invinite-org/chartlang-cli";
 *     GITIGNORE.includes("node_modules/");
 */
export const GITIGNORE: string = "node_modules/\ndist/\ncoverage/\n";
