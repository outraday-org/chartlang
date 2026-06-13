// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import type { ScriptManifest } from "@invinite-org/chartlang-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    type CompileProducerCallback,
    type CompiledProducerArtefacts,
    createProducerResolver,
    hashSourcePath,
    rewriteProducerSource,
} from "./resolveProducer.js";

const MANIFEST: ScriptManifest = Object.freeze({
    apiVersion: 1,
    kind: "indicator",
    name: "Base",
    inputs: Object.freeze({}),
    capabilities: Object.freeze(["indicators"]),
    requestedIntervals: Object.freeze([]),
    userPickableInterval: false,
    seriesCapacities: Object.freeze({}),
    maxLookback: 0,
});

function fixedArtefacts(
    extras: Partial<CompiledProducerArtefacts> = {},
): CompiledProducerArtefacts {
    return Object.freeze({
        moduleSource: "/* compiled */",
        transformedSource: "export default 1;",
        manifest: MANIFEST,
        siblings: Object.freeze([]),
        ...extras,
    });
}

describe("rewriteProducerSource", () => {
    it("wraps the producer in an IIFE returning the default export expression", () => {
        const out = rewriteProducerSource('export default { name: "x" };\n', "abc123");
        expect(out).toContain("const __producer_abc123__default = (() => {");
        expect(out).toContain('return { name: "x" };');
        expect(out).toContain("})();");
    });

    it("lowers `export const X = <expr>` inside the IIFE", () => {
        const out = rewriteProducerSource("export const foo = 7;\nexport default 0;\n", "abc123");
        expect(out).toContain("const __producer_abc123__foo = 7;");
        expect(out).toContain("return 0;");
    });

    it("hoists @invinite-org/chartlang-core imports above the IIFE so esbuild dedupes them against the consumer's imports", () => {
        // Stripping was the Phase-1 behaviour; it was wrong because the
        // producer's body still references the hoisted symbols
        // (`input.int(...)`, `ta.ema(...)`). The dep-cross-file
        // conformance scenario broke at load time when the consumer
        // didn't import those names. Hoisting lifts the import to
        // module-top — esbuild's resolver then pulls every symbol the
        // producer actually uses into the bundle, deduped against the
        // consumer's own imports.
        const out = rewriteProducerSource(
            'import { defineIndicator, input } from "@invinite-org/chartlang-core";\nexport default 1;\n',
            "abc123",
        );
        expect(out).toContain(
            'import { defineIndicator, input } from "@invinite-org/chartlang-core";',
        );
        // The hoisted line lands above the IIFE, not inside it.
        const hoistedIdx = out.indexOf(
            'import { defineIndicator, input } from "@invinite-org/chartlang-core";',
        );
        const iifeIdx = out.indexOf("const __producer_abc123__default = (() => {");
        expect(hoistedIdx).toBeGreaterThanOrEqual(0);
        expect(iifeIdx).toBeGreaterThan(hoistedIdx);
        expect(out).toContain("return 1;");
    });

    it("rewrites cross-file `.chart` import to nested producer const", () => {
        const specifierToHash = new Map([["./base.chart", "basehash"]]);
        const out = rewriteProducerSource(
            'import base from "./base.chart";\nexport default base;\n',
            "abc123",
            specifierToHash,
        );
        expect(out).toContain("const base = __producer_basehash__default;");
    });

    it("strips top-level export declarations (`export { foo };`)", () => {
        const out = rewriteProducerSource(
            "const foo = 1;\nexport { foo };\nexport default foo;\n",
            "abc123",
        );
        expect(out).toContain("const foo = 1");
        expect(out).not.toContain("export {");
    });

    it("passes through non-export statements untouched", () => {
        const out = rewriteProducerSource("const helper = 10;\nexport default helper;\n", "h");
        expect(out).toContain("const helper = 10;");
        expect(out).toContain("return helper;");
    });

    it("ignores variable statements without an initializer in `export let`", () => {
        const out = rewriteProducerSource("export let x;\n", "abc");
        expect(out).not.toContain("__producer_abc__x");
    });

    it("ignores variable declarations whose names are not identifiers", () => {
        const out = rewriteProducerSource("export const { a, b } = { a: 1, b: 2 };\n", "abc");
        expect(out).not.toContain("__producer_abc__a");
    });

    it("emits `return undefined;` when the source has no default export", () => {
        const out = rewriteProducerSource("const x = 1;\n", "abc");
        expect(out).toContain("return undefined;");
    });
});

describe("hashSourcePath", () => {
    it("yields a stable 12-char hex string", () => {
        const a = hashSourcePath("/repo/src/base.chart.ts");
        const b = hashSourcePath("/repo/src/base.chart.ts");
        expect(a).toEqual(b);
        expect(a).toHaveLength(12);
        expect(a).toMatch(/^[0-9a-f]+$/);
    });

    it("differs across distinct paths", () => {
        const a = hashSourcePath("/repo/src/base.chart.ts");
        const b = hashSourcePath("/repo/src/other.chart.ts");
        expect(a).not.toEqual(b);
    });

    it("normalises backslashes for cross-platform parity", () => {
        const a = hashSourcePath("C:\\repo\\src\\base.chart.ts");
        const b = hashSourcePath("C:/repo/src/base.chart.ts");
        expect(a).toEqual(b);
    });
});

describe("createProducerResolver", () => {
    let dir = "";

    beforeEach(async () => {
        dir = await mkdtemp(join(tmpdir(), "resolveProducer-"));
    });

    afterEach(async () => {
        await rm(dir, { recursive: true, force: true });
    });

    it("returns null when the import path is not `.chart.ts`", async () => {
        const compileMock = vi.fn();
        const resolve = createProducerResolver({ rootDir: dir }, compileMock);
        const fromPath = join(dir, "consumer.chart.ts");
        expect(await resolve("./not-a-chart", fromPath)).toBeNull();
        expect(compileMock).not.toHaveBeenCalled();
    });

    it("returns null when the file is outside `rootDir`", async () => {
        const compileMock = vi.fn();
        const resolve = createProducerResolver({ rootDir: dir }, compileMock);
        const fromPath = join(dir, "consumer.chart.ts");
        expect(await resolve("../escape.chart", fromPath)).toBeNull();
        expect(compileMock).not.toHaveBeenCalled();
    });

    it("returns null when the file does not exist on disk", async () => {
        const compileMock = vi.fn();
        const resolve = createProducerResolver({ rootDir: dir }, compileMock);
        const fromPath = join(dir, "consumer.chart.ts");
        expect(await resolve("./missing.chart", fromPath)).toBeNull();
        expect(compileMock).not.toHaveBeenCalled();
    });

    it("compiles, caches, and returns the same Promise across calls", async () => {
        await writeFile(join(dir, "base.chart.ts"), "export default 1;\n", "utf8");
        const compileMock: CompileProducerCallback = vi.fn(async () => fixedArtefacts());
        const resolve = createProducerResolver({ rootDir: dir }, compileMock);
        const fromPath = join(dir, "consumer.chart.ts");

        const a = resolve("./base.chart", fromPath);
        const b = resolve("./base.chart", fromPath);

        // Same promise — cache identity preserved.
        expect(a).toBe(b);

        const compiled = await a;
        expect(compiled).not.toBeNull();
        expect(compiled?.hash).toHaveLength(12);
        expect(compiled?.rewrittenSource).toContain("__producer_");
        expect(compileMock).toHaveBeenCalledTimes(1);
    });

    it("returns null when the compile callback yields null", async () => {
        await writeFile(join(dir, "base.chart.ts"), "export default 1;\n", "utf8");
        const compileMock: CompileProducerCallback = vi.fn(async () => null);
        const resolve = createProducerResolver({ rootDir: dir }, compileMock);
        const fromPath = join(dir, "consumer.chart.ts");
        expect(await resolve("./base.chart", fromPath)).toBeNull();
    });

    it("detects cycles via the in-progress ancestry guard", async () => {
        await writeFile(join(dir, "a.chart.ts"), "export default 1;\n", "utf8");

        let nestedResult: unknown = "unset";
        const compileMock: CompileProducerCallback = vi.fn(async (_source, sourcePath) => {
            // Simulate the recursive walk: while compiling `a`, ask the
            // resolver to resolve `a` again from `a`'s own source path.
            // Cycle: a → a.
            nestedResult = await resolveRef("./a.chart", sourcePath);
            return fixedArtefacts();
        });
        const resolve = createProducerResolver({ rootDir: dir }, compileMock);
        const resolveRef = resolve;
        const fromPath = join(dir, "consumer.chart.ts");

        const compiled = await resolve("./a.chart", fromPath);
        expect(compiled).not.toBeNull();
        expect(nestedResult).toBeNull();
    });

    it("populates drawnByExportName for multi-export producers", async () => {
        await writeFile(join(dir, "multi.chart.ts"), "export default 1;\n", "utf8");
        const sibling: ScriptManifest = Object.freeze({
            ...MANIFEST,
            name: "Sibling",
            exportName: "sibling",
            isDrawn: true,
        });
        const compileMock: CompileProducerCallback = vi.fn(async () =>
            fixedArtefacts({ siblings: Object.freeze([sibling]) }),
        );
        const resolve = createProducerResolver({ rootDir: dir }, compileMock);
        const fromPath = join(dir, "consumer.chart.ts");

        const compiled = await resolve("./multi.chart", fromPath);
        expect(compiled).not.toBeNull();
        expect(compiled?.drawnByExportName.get("default")?.name).toBe("Base");
        expect(compiled?.drawnByExportName.get("sibling")?.name).toBe("Sibling");
    });

    it("treats `.chart.ts` paths the same as `.chart`", async () => {
        await writeFile(join(dir, "base.chart.ts"), "export default 1;\n", "utf8");
        const compileMock: CompileProducerCallback = vi.fn(async () => fixedArtefacts());
        const resolve = createProducerResolver({ rootDir: dir }, compileMock);
        const fromPath = join(dir, "consumer.chart.ts");
        const compiled = await resolve("./base.chart.ts", fromPath);
        expect(compiled).not.toBeNull();
    });

    it("evicts older entries past the LRU limit", async () => {
        await writeFile(join(dir, "a.chart.ts"), "export default 1;\n", "utf8");
        const compileMock: CompileProducerCallback = vi.fn(async () => fixedArtefacts());
        const resolve = createProducerResolver({ rootDir: dir }, compileMock);
        const fromPath = join(dir, "consumer.chart.ts");
        // Stuff the cache via repeated unique-import paths.
        for (let i = 0; i < 300; i++) {
            const name = `p${i}.chart.ts`;
            await writeFile(join(dir, name), "export default 1;\n", "utf8");
            await resolve(`./${name}`, fromPath);
        }
        // We don't assert specific eviction behaviour — only that the
        // resolver kept compiling past the cap (i.e. the eviction loop
        // didn't crash).
        expect(compileMock).toHaveBeenCalledTimes(300);
    }, 30_000);

    it("resolves a relative `rootDir` against the process cwd", async () => {
        const cwd = process.cwd();
        try {
            // Place the producer under a relative subdir of cwd so a
            // `rootDir: <subdir>` resolves to a path inside cwd.
            const realCwd = await realpath(cwd);
            const localDir = await mkdtemp(join(realCwd, "resolveProducer-rel-"));
            try {
                await writeFile(join(localDir, "base.chart.ts"), "export default 1;\n", "utf8");
                const compileMock: CompileProducerCallback = vi.fn(async () => fixedArtefacts());
                const relRoot = relative(realCwd, localDir);
                const resolve = createProducerResolver({ rootDir: relRoot }, compileMock);
                const fromPath = join(localDir, "consumer.chart.ts");
                const compiled = await resolve("./base.chart", fromPath);
                expect(compiled).not.toBeNull();
            } finally {
                await rm(localDir, { recursive: true, force: true });
            }
        } finally {
            process.chdir(cwd);
        }
    });

    it("works with absolute import paths inside rootDir", async () => {
        await mkdir(join(dir, "nested"), { recursive: true });
        await writeFile(join(dir, "nested", "base.chart.ts"), "export default 1;\n", "utf8");
        const compileMock: CompileProducerCallback = vi.fn(async () => fixedArtefacts());
        const resolve = createProducerResolver({ rootDir: dir }, compileMock);
        const fromPath = join(dir, "consumer.chart.ts");
        const compiled = await resolve(join(dir, "nested", "base.chart.ts"), fromPath);
        expect(compiled).not.toBeNull();
    });

    it("accepts a relative `fromSourcePath` (compileProject posix-relative form)", async () => {
        // Drives both the import-path resolution (line 407) and the
        // ancestry-guard fromAbsolute resolution (line 186) through the
        // process.cwd() / rootAbsolute relative-resolve branches.
        const cwd = process.cwd();
        const realCwd = await realpath(cwd);
        const localDir = await mkdtemp(join(realCwd, "resolveProducer-relfrom-"));
        try {
            await writeFile(join(localDir, "base.chart.ts"), "export default 1;\n", "utf8");
            const compileMock: CompileProducerCallback = vi.fn(async () => fixedArtefacts());
            const resolve = createProducerResolver({ rootDir: localDir }, compileMock);
            const relFromPath = relative(realCwd, join(localDir, "consumer.chart.ts"));
            const compiled = await resolve("./base.chart", relFromPath);
            expect(compiled).not.toBeNull();
        } finally {
            await rm(localDir, { recursive: true, force: true });
        }
    });
});
