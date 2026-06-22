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
 * adapter-kit + host-worker for adapter authoring, plus the public
 * conformance package for local adapter certification.
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
            "conformance:report": "tsx scripts/conformance-report.ts",
        },
        dependencies: {
            "@invinite-org/chartlang-adapter-kit": "^1.0.0",
            "@invinite-org/chartlang-host-worker": "^1.0.0",
        },
        devDependencies: {
            "@invinite-org/chartlang-conformance": "^1.0.0",
            "@types/node": "^20.0.0",
            tsx: "^4.19.0",
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
 * adapter-kit and exports a headless adapter calling `defineAdapter`
 * with a reference-shaped conformance capability bag. Consumers edit
 * this file to wire their renderer + data source and narrow the bag
 * to the chart features they actually support.
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
import type {
    AdapterSymInfo,
    Capabilities,
    DrawingKind,
    InputKind,
} from "@invinite-org/chartlang-adapter-kit";

const STARTER_INTERVALS = [
    { value: "15s", label: "15 seconds", group: "second" },
    { value: "30s", label: "30 seconds", group: "second" },
    { value: "1m", label: "1 minute", group: "minute" },
    { value: "5m", label: "5 minutes", group: "minute" },
    { value: "15m", label: "15 minutes", group: "minute" },
    { value: "1h", label: "1 hour", group: "hour" },
    { value: "1D", label: "1 day", group: "daily" },
    { value: "1W", label: "1 week", group: "weekly" },
] as const;

const STARTER_DRAWING_KINDS: ReadonlySet<DrawingKind> = new Set([
    ...capabilities.allPhase3Drawings(),
    "table",
]);

export const starterCapabilities: Capabilities = Object.freeze({
    plots: capabilities.allPhase5Plots(),
    drawings: STARTER_DRAWING_KINDS,
    alerts: capabilities.alerts("log", "toast"),
    inputs: new Set<InputKind>(),
    maxLookback: 1000,
    maxTickHz: 30,
    ...capabilities.intervals(STARTER_INTERVALS),
    ...capabilities.multiTimeframe(true),
    // Tag a different-symbol secondary stream's \`CandleEvent.streamKey\` with the
    // composite feed key \`feedKey(symbol, interval)\` (e.g. "AMEX:SPY@1D"); a
    // chart-symbol stream uses the bare interval ("1D"). Set false if your data
    // source cannot fetch instruments other than the chart's own symbol.
    ...capabilities.multiSymbol(true),
    ...capabilities.subPanes(Number.MAX_SAFE_INTEGER),
    ...capabilities.symInfoFields([
        "ticker",
        "type",
        "mintick",
        "currency",
        "basecurrency",
        "exchange",
        "timezone",
        "session",
        "meta",
    ]),
    ...capabilities.maxDrawingsPerScript({
        lines: 200,
        labels: 200,
        boxes: 100,
        polylines: 100,
        other: 100,
    }),
    ...capabilities.alertConditions(true),
    ...capabilities.logs(true),
});

export const starterSymInfo: AdapterSymInfo = Object.freeze({
    ticker: "DEMO",
    type: "equity",
    mintick: 0.01,
    currency: "USD",
    basecurrency: "USD",
    exchange: "CHARTLANG",
    timezone: "Etc/UTC",
    session: "regular",
    meta: Object.freeze({
        vendor: "starter-adapter",
    }),
});

export const adapter = defineAdapter({
    id: "${name}",
    name: "${display}",
    capabilities: starterCapabilities,
    symInfo: starterSymInfo,
    resolveInputs: () => {
        return {};
    },
    candles: () => mockCandleSource([]),
    onEmissions: () => {
        // Connect this callback to your chart canvas / DOM target.
    },
});

export default adapter;
`;
}

/**
 * Render the generated adapter's `src/index.test.ts`. Placeholder
 * vitest assertion that confirms the adapter is defined with the
 * expected id. The scaffold also writes `src/conformance.test.ts`,
 * which runs the public adapter conformance suite.
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
 * Render the generated adapter's `src/conformance.test.ts`. The test
 * imports the scaffolded adapter and requires the public conformance
 * suite to pass with zero failed scenarios.
 *
 * @since 1.0
 * @example
 *     import { CONFORMANCE_TEST_TS } from "@invinite-org/chartlang-cli";
 *     CONFORMANCE_TEST_TS.includes("runConformanceSuite");
 */
export const CONFORMANCE_TEST_TS: string = `import { runConformanceSuite } from "@invinite-org/chartlang-conformance";
import { describe, expect, it } from "vitest";

import adapter from "./index.js";

describe("conformance", () => {
    it("passes the full chartlang conformance suite", async () => {
        const report = await runConformanceSuite(adapter);
        expect(report.failures).toEqual([]);
        expect(report.failed).toBe(0);
    }, 60_000);
});
`;

/**
 * Render the generated adapter's `scripts/conformance-report.ts`.
 * The script runs the same public conformance suite and writes the
 * deterministic Markdown + JSON report pair at the package root.
 *
 * @since 1.0
 * @example
 *     import { CONFORMANCE_REPORT_TS } from "@invinite-org/chartlang-cli";
 *     CONFORMANCE_REPORT_TS.includes("CONFORMANCE.md");
 */
export const CONFORMANCE_REPORT_TS: string = `import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
    renderConformanceJson,
    renderConformanceMarkdown,
    runConformanceSuite,
} from "@invinite-org/chartlang-conformance";
import conformancePkg from "@invinite-org/chartlang-conformance/package.json" with { type: "json" };

import adapter from "../src/index.js";

const GENERATED_BY = \`\${conformancePkg.name}@\${conformancePkg.version}\`;

async function main(): Promise<void> {
    const report = await runConformanceSuite(adapter);
    const meta = {
        adapterName: adapter.name,
        generatedBy: GENERATED_BY,
    };

    await Promise.all([
        writeFile(join(process.cwd(), "CONFORMANCE.md"), renderConformanceMarkdown(report, meta)),
        writeFile(
            join(process.cwd(), "conformance-report.json"),
            renderConformanceJson(report, meta),
        ),
    ]);

    if (report.failed > 0) {
        process.exitCode = 1;
    }
}

main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
});
`;

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

\`stable\`

chartlang adapter — ${display}. Scaffolded on ${date} by
\`chartlang scaffold-adapter\`.

## Install

\`\`\`bash
pnpm add chartlang-adapter-${name}
\`\`\`

## Public surface

Exports a single \`adapter\` constructed via \`defineAdapter\` from
\`@invinite-org/chartlang-adapter-kit\`. The scaffold starts with a
headless conformance capability bag; narrow it to the chart features
your adapter really renders before publishing.

## Minimum-viable API call

\`\`\`ts
import { adapter } from "chartlang-adapter-${name}";
console.log(adapter.id); // "${name}"
\`\`\`

## Docs

Run the generated conformance test before publishing:

\`\`\`bash
pnpm test
\`\`\`

Generate the public conformance report:

\`\`\`bash
pnpm conformance:report
\`\`\`

The report command writes \`CONFORMANCE.md\` and
\`conformance-report.json\` at the package root. Check both files into
your adapter repository. If your CI needs drift checking, compare those
files after running the same command.

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
