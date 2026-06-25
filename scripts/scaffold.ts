#!/usr/bin/env tsx
/**
 * One-shot scaffolding for @invinite-org/chartlang-* packages.
 * Idempotent — existing files are not overwritten.
 * Usage:  pnpm tsx scripts/scaffold.ts
 */
import { existsSync } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const ROOT = process.cwd();
const OWNER = "outraday-org";

const PACKAGE_DIRS = [
    "packages/core",
    "packages/compiler",
    "packages/pine-converter",
    "packages/runtime",
    "packages/host-worker",
    "packages/host-quickjs",
    "packages/adapter-kit",
    "packages/language-service",
    "packages/editor",
    "packages/cli",
    "packages/conformance",
    "examples/canvas2d-adapter",
    "examples/echarts-adapter",
    "examples/konva-adapter",
    "examples/lightweight-charts-adapter",
    "examples/uplot-adapter",
    "examples/webgl-adapter",
];

const DESCRIPTIONS: Record<string, string> = {
    "packages/core": "Types and primitives for chartlang scripts",
    "packages/compiler": "TypeScript transformer + bundler for .chart.ts files",
    "packages/pine-converter":
        "Pine Script v6 → chartlang source-to-source converter (drawings v1)",
    "packages/runtime": "Execution engine, Series ring buffers, ta.* math primitives",
    "packages/host-worker": "Web Worker ScriptHost for the browser",
    "packages/host-quickjs": "QuickJS-WASM ScriptHost for untrusted / server-side execution",
    "packages/adapter-kit": "SDK for writing chartlang adapters in consumer repos",
    "packages/language-service":
        "Headless editor intelligence — hover, completions, diagnostics, signature help",
    "packages/editor":
        "CodeMirror 6 reference editor over @invinite-org/chartlang-language-service",
    "packages/cli": "chartlang CLI — compile, lint, bench, scaffold-adapter",
    "packages/conformance": "Adapter conformance test suite",
    "examples/canvas2d-adapter": "Reference adapter — renders to a <canvas> element",
    "examples/echarts-adapter": "Example adapter — renders chartlang to Apache ECharts",
    "examples/konva-adapter": "Example adapter — renders chartlang to a Konva scene-graph",
    "examples/lightweight-charts-adapter":
        "Example adapter — renders chartlang to TradingView lightweight-charts",
    "examples/uplot-adapter": "Example adapter — renders chartlang to uPlot",
    "examples/webgl-adapter":
        "Example adapter — renders chartlang to a raw WebGL2 GPU renderer (zero dependencies)",
};

const PUBLIC_SURFACE: Record<string, string> = {
    "packages/core":
        "`defineIndicator`, `defineDrawing`, `defineAlert`; primitives `ta.*`, `plot`, `draw.*`, `alert`, `input.*`, `color.*`, `style.*`; types `Series<T>`, `Bar`, `Time`, `Price`.",
    "packages/compiler":
        "`compile(source, opts) → CompiledScript`, `compileFile`, `compileProject`.",
    "packages/pine-converter":
        "`convert(source, opts)` → `ConvertResult` (output `.chart.ts` string + structured diagnostics); types `ConvertOpts`, `Diagnostic`, `SourceSpan`, `ConvertManifest`.",
    "packages/runtime":
        "`createScriptRunner(compiled, ctx) → ScriptRunner`; types for `ScriptHost`, `Adapter`, `Capabilities`.",
    "packages/host-worker": "`createWorkerHost() → ScriptHost`.",
    "packages/host-quickjs": "`createQuickJsHost() → ScriptHost`.",
    "packages/adapter-kit":
        "`defineAdapter(opts) → Adapter`; types `Adapter`, `Capabilities`, `CandleEvent`; capability builders (`capabilities.line()`, `capabilities.histogram()`, …); `validateEmission`, `decodeDrawing`; mock candle sources; base classes `PassThroughAdapter`, `BufferingAdapter`.",
    "packages/language-service":
        "`getHoverDoc`, `getCompletions`, `compileToDiagnostics`, `getSignatureHelp`, `getDefinition`.",
    "packages/editor": "`createChartlangEditor(opts)`, `<ChartlangEditor />` React component.",
    "packages/cli":
        "Commands: `chartlang compile`, `chartlang lint`, `chartlang bench`, `chartlang scaffold-adapter`, `chartlang docs`.",
    "packages/conformance": "`runConformanceSuite(adapter) → Report`.",
    "examples/canvas2d-adapter":
        "Reference adapter rendering to `<canvas>`. Not exported as a package surface — copy from this folder when writing your own adapter.",
    "examples/echarts-adapter":
        "Example adapter rendering to Apache ECharts. Not exported as a package surface — copy from this folder when writing your own adapter.",
    "examples/konva-adapter":
        "Example adapter rendering to a Konva scene-graph. Not exported as a package surface — copy from this folder when writing your own adapter.",
    "examples/lightweight-charts-adapter":
        "Example adapter rendering to TradingView lightweight-charts. Not exported as a package surface — copy from this folder when writing your own adapter.",
    "examples/uplot-adapter":
        "Example adapter rendering to uPlot. Not exported as a package surface — copy from this folder when writing your own adapter.",
    "examples/webgl-adapter":
        "Example adapter rendering to a raw WebGL2 GPU renderer (zero dependencies). Not exported as a package surface — copy from this folder when writing your own adapter.",
};

const DOCS_LINKS: Record<string, string> = {
    "packages/core": "docs/language/overview.md",
    "packages/compiler": "docs/spec/grammar.md",
    "packages/pine-converter": "docs/converter/",
    "packages/runtime": "docs/spec/semantics.md",
    "packages/host-worker": "docs/hosts/worker.md",
    "packages/host-quickjs": "docs/hosts/quickjs.md",
    "packages/adapter-kit": "docs/adapters/contract.md",
    "packages/language-service": "docs/reference/",
    "packages/editor": "docs/getting-started/embed-in-our-chart.md",
    "packages/cli": "docs/reference/",
    "packages/conformance": "docs/adapters/conformance.md",
    "examples/canvas2d-adapter": "docs/adapters/writing-an-adapter.md",
    "examples/echarts-adapter": "docs/adapters/reference/echarts.md",
    "examples/konva-adapter": "docs/adapters/reference/konva.md",
    "examples/lightweight-charts-adapter": "docs/adapters/reference/lightweight-charts.md",
    "examples/uplot-adapter": "docs/adapters/reference/uplot.md",
    "examples/webgl-adapter": "docs/adapters/reference/webgl.md",
};

// Per-package subpath exports appended after the "." entry. The scaffold is
// idempotent, so these only materialise on regeneration — but the map keeps
// scaffold.ts the source of truth for every package.json exports shape.
type SubpathExport = { types: string; import: string } | string;

const SUBPATH_EXPORTS: Record<string, Record<string, SubpathExport>> = {
    "packages/core": {
        "./time": {
            types: "./dist/time/index.d.ts",
            import: "./dist/time/index.js",
        },
    },
    // Forward reservation for Task 17/18 (`./diagnostics` formatter surface);
    // the placeholder `src/diagnostics/index.ts` ships empty in Task 1.
    "packages/pine-converter": {
        "./diagnostics": {
            types: "./dist/diagnostics/index.d.ts",
            import: "./dist/diagnostics/index.js",
        },
    },
    "packages/conformance": {
        "./package.json": "./package.json",
    },
};

const MIT_HEADER =
    "// Copyright (c) 2026 Invinite. Licensed under the MIT License.\n" +
    "// See the LICENSE file in the repo root for full license text.\n";

async function write(path: string, content: string): Promise<void> {
    if (existsSync(path)) return;
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, "utf8");
    console.log(`  wrote ${path}`);
}

async function removeGitkeep(srcDir: string): Promise<void> {
    const keep = join(srcDir, ".gitkeep");
    if (!existsSync(keep)) return;
    await unlink(keep);
    console.log(`  removed ${keep}`);
}

function pkgJson(dir: string, name: string, description: string): string {
    if (dir.startsWith("examples/")) {
        const body = {
            name: `chartlang-example-${name}`,
            private: true,
            version: "0.0.0",
            type: "module",
            license: "MIT",
            description,
            main: "./dist/index.js",
            types: "./dist/index.d.ts",
            exports: {
                ".": {
                    types: "./dist/index.d.ts",
                    import: "./dist/index.js",
                },
            },
            files: ["dist", "README.md", "CHANGELOG.md"],
            scripts: {
                build: "tsc -p tsconfig.json",
                typecheck: "tsc -p tsconfig.json --noEmit",
                test: "vitest run --coverage",
            },
            engines: { node: ">=20" },
            repository: {
                type: "git",
                url: `https://github.com/${OWNER}/chartlang.git`,
            },
        };
        return `${JSON.stringify(body, null, 4)}\n`;
    }
    const body = {
        name: `@invinite-org/chartlang-${name}`,
        version: "0.0.0",
        type: "module",
        license: "MIT",
        description,
        main: "./dist/index.js",
        types: "./dist/index.d.ts",
        exports: {
            ".": {
                types: "./dist/index.d.ts",
                import: "./dist/index.js",
            },
            ...SUBPATH_EXPORTS[dir],
        },
        files: ["dist", "README.md", "CHANGELOG.md"],
        scripts: {
            build: "tsc -p tsconfig.json",
            typecheck: "tsc -p tsconfig.json --noEmit",
            test: "vitest run --coverage",
        },
        publishConfig: { access: "public" },
        engines: { node: ">=20" },
        repository: {
            type: "git",
            url: `https://github.com/${OWNER}/chartlang.git`,
            directory: dir,
        },
    };
    return `${JSON.stringify(body, null, 4)}\n`;
}

function tsconfigJson(): string {
    const body = {
        extends: "../../tsconfig.base.json",
        compilerOptions: {
            outDir: "./dist",
            rootDir: "./src",
        },
        include: ["src/**/*"],
        exclude: ["**/*.test.ts", "**/*.bench.test.ts", "**/__fixtures__/**"],
    };
    return `${JSON.stringify(body, null, 4)}\n`;
}

function vitestConfigTs(): string {
    return `import { defineConfig } from "vitest/config";

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
            ],
        },
    },
});
`;
}

function readmeMd(dir: string, name: string, description: string): string {
    const isExample = dir.startsWith("examples/");
    const pkgName = isExample ? `chartlang-example-${name}` : `@invinite-org/chartlang-${name}`;
    const title = `# ${pkgName}`;
    const installLine = isExample
        ? "Not published — copy from `examples/canvas2d-adapter/`."
        : `\`\`\`bash\npnpm add ${pkgName}\n\`\`\``;
    const surface = PUBLIC_SURFACE[dir];
    const docsLink = DOCS_LINKS[dir];
    const exampleNote = isExample
        ? "\n<!-- Real exports land in the phase that ships them. -->"
        : "";
    return `${title}

\`experimental\`

${description}.

## Install

${installLine}

## Public surface

Planned (Phase 1+): ${surface}

## Minimum-viable API call

\`\`\`ts
import { PACKAGE_VERSION } from "${pkgName}";
console.log(PACKAGE_VERSION); // "0.0.0"
\`\`\`${exampleNote}

## Docs

See [\`${docsLink}\`](../../${docsLink}).

## License

MIT
`;
}

function indexTs(): string {
    return `${MIT_HEADER}\nexport const PACKAGE_VERSION = "0.0.0";\n`;
}

function indexTestTs(): string {
    return `${MIT_HEADER}\nimport { describe, expect, it } from "vitest";

import * as publicSurface from "./index.js";

describe("public surface", () => {
    it("loads the package barrel", () => {
        expect(publicSurface).toBeDefined();
    });
});
`;
}

async function scaffold(dir: string): Promise<void> {
    const rel = dir.replace(`${ROOT}/`, "");
    const name = rel.replace(/^packages\//, "").replace(/^examples\//, "");
    const pkgName = rel.startsWith("examples/")
        ? `chartlang-example-${name}`
        : `@invinite-org/chartlang-${name}`;
    const description = DESCRIPTIONS[rel];
    if (!description) throw new Error(`Missing description for ${rel}`);

    console.log(`\n→ ${pkgName}`);
    await write(join(dir, "package.json"), pkgJson(rel, name, description));
    await write(join(dir, "tsconfig.json"), tsconfigJson());
    await write(join(dir, "vitest.config.ts"), vitestConfigTs());
    await write(join(dir, "README.md"), readmeMd(rel, name, description));
    await write(join(dir, "src/index.ts"), indexTs());
    await write(join(dir, "src/index.test.ts"), indexTestTs());
    await removeGitkeep(join(dir, "src"));
}

for (const dir of PACKAGE_DIRS) {
    await scaffold(join(ROOT, dir));
}
console.log("\nScaffolding complete.");
