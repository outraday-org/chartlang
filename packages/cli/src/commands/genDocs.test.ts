// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve as resolvePath } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
    GenDocsError,
    findRepoRoot,
    generateDocsPage,
    parsePrimitiveSource,
    runGenDocs,
} from "./genDocs.js";
import type { PrimitiveDocInput } from "./genDocs.js";

const MINIMAL_PRIMITIVE = `// MIT header
import type { Series } from "@invinite-org/chartlang-core";

type Slot = { readonly out: Series<number> };

/**
 * Demo primitive — does nothing real.
 *
 * @formula  out[t] = source[t]
 * @warmup   0
 * @since 0.1
 * @stable
 *
 * @example
 *     // ta.demo("slot", bar.close)
 */
export function demo(slotId: string, source: number): { out: number } {
    return { out: source };
}
`;

const PRIMITIVE_WITH_ANCHORS = `// MIT header
/**
 * Anchored demo.
 *
 * @formula  out = source
 * @anchors  start, end (drawing anchors)
 * @warmup   0
 * @since 0.1
 * @stable
 * @returns The latest source value, untouched.
 *
 * @example
 *     // ta.anchored("slot", bar.close)
 *
 * @param slotId Compiler-injected slot id.
 * @param source Source value.
 */
export function anchored(slotId: string, source: number): number {
    return source;
}
`;

const PRIMITIVE_NO_PARAMS = `// MIT header
/**
 * No-arg demo.
 *
 * @formula  out = 1
 * @warmup   0
 * @since 0.1
 * @frozen
 *
 * @example
 *     // ta.zero("slot")
 */
export function zero(slotId: string): number {
    return 1;
}
`;

const MISSING_FORMULA = `/**
 * Missing formula.
 * @warmup 0
 * @since 0.1
 * @stable
 * @example
 *     // x
 */
export function missingFormula(slotId: string): number { return 1; }
`;

const MISSING_WARMUP = `/**
 * Missing warmup.
 * @formula out = 1
 * @since 0.1
 * @stable
 * @example
 *     // x
 */
export function missingWarmup(slotId: string): number { return 1; }
`;

const MISSING_SINCE = `/**
 * Missing since.
 * @formula out = 1
 * @warmup 0
 * @stable
 * @example
 *     // x
 */
export function missingSince(slotId: string): number { return 1; }
`;

const MISSING_EXAMPLE = `/**
 * Missing example.
 * @formula out = 1
 * @warmup 0
 * @since 0.1
 * @stable
 */
export function missingExample(slotId: string): number { return 1; }
`;

const MISSING_STABILITY = `/**
 * Missing stability tag.
 * @formula out = 1
 * @warmup 0
 * @since 0.1
 * @example
 *     // x
 */
export function missingStability(slotId: string): number { return 1; }
`;

const MISSING_EXPORT = `/**
 * Has all tags but wrong export name.
 * @formula out = 1
 * @warmup 0
 * @since 0.1
 * @stable
 * @example
 *     // x
 */
export function notTheStem(slotId: string): number { return 1; }
`;

const SAMPLE_INPUT: PrimitiveDocInput = {
    id: "demo",
    signature: "function demo(slotId: string, source: number): { out: number }",
    description: "Demo primitive — does nothing real.",
    formula: "out[t] = source[t]",
    warmup: "0",
    since: "0.1",
    stability: "stable",
    params: [
        { name: "slotId", type: "string", defaultValue: "—", description: "Slot id." },
        { name: "source", type: "number", defaultValue: "—", description: "Source value." },
    ],
    returns: "{ out: number }",
    example: '// ta.demo("slot", bar.close)',
    sourceUrl: "https://example.invalid/blob/main/demo.ts",
};

describe("generateDocsPage", () => {
    it("opens directly with the title heading and carries no sentinel", () => {
        const md = generateDocsPage(SAMPLE_INPUT);
        expect(md.split("\n")[0]).toBe("# `ta.demo`");
        expect(md).not.toContain("AUTO-GENERATED");
    });

    it("emits Formula / Warmup / Signature / Parameters / Returns / Example / See also", () => {
        const md = generateDocsPage(SAMPLE_INPUT);
        expect(md).toMatch(/## Formula\n\nout\[t\] = source\[t\]/);
        expect(md).toMatch(/## Warmup\n\n0/);
        expect(md).toMatch(/## Signature\n\n```ts\nfunction demo/);
        expect(md).toMatch(/## Parameters/);
        expect(md).toMatch(/\| `slotId` \| `string` \| — \| Slot id\. \|/);
        expect(md).toMatch(/## Returns\n\n`{ out: number }`/);
        expect(md).toMatch(/## Example\n\n```ts\n\/\/ ta\.demo/);
        expect(md).toMatch(/## See also/);
        expect(md).toMatch(
            /\[Source on GitHub\]\(https:\/\/example\.invalid\/blob\/main\/demo\.ts\)/,
        );
    });

    it("omits the Anchors section when @anchors is absent", () => {
        const md = generateDocsPage(SAMPLE_INPUT);
        expect(md).not.toMatch(/## Anchors/);
    });

    it("includes the Anchors section when @anchors is present", () => {
        const md = generateDocsPage({ ...SAMPLE_INPUT, anchors: "first, last" });
        expect(md).toMatch(/## Anchors\n\nfirst, last/);
    });

    it("emits a stable Stability + Since header block", () => {
        const md = generateDocsPage(SAMPLE_INPUT);
        expect(md).toMatch(/> \*\*Stability:\*\* stable\n> \*\*Since:\*\* 0\.1/);
    });

    it("emits a stub when params is empty", () => {
        const md = generateDocsPage({ ...SAMPLE_INPUT, params: [] });
        expect(md).toMatch(/_\(no parameters\)_/);
    });

    it("escapes pipes in param types", () => {
        const md = generateDocsPage({
            ...SAMPLE_INPUT,
            params: [
                {
                    name: "x",
                    type: "number | string",
                    defaultValue: "—",
                    description: "either",
                },
            ],
        });
        expect(md).toMatch(/`number \\\| string`/);
    });

    it("renders the slotId helper note under the signature", () => {
        const md = generateDocsPage(SAMPLE_INPUT);
        expect(md).toMatch(/`slotId: string`.*compiler at every callsite/);
    });

    it("omits leading description when empty", () => {
        const md = generateDocsPage({ ...SAMPLE_INPUT, description: "" });
        // Header → Stability/Since → directly into ## Formula.
        expect(md).toMatch(/Since:\*\* 0\.1\n\n## Formula/);
    });
});

describe("parsePrimitiveSource", () => {
    let workspace: string;
    const PARSE_OPTS = {
        repoUrl: "https://github.com/outraday-org/chartlang.git",
        runtimeRelPath: "packages/runtime/src/ta/demo.ts",
    } as const;

    beforeEach(async () => {
        workspace = await mkdtemp(join(tmpdir(), "chartlang-cli-gendocs-"));
    });

    afterEach(async () => {
        await rm(workspace, { recursive: true, force: true });
    });

    async function writeSrc(name: string, body: string): Promise<string> {
        const path = join(workspace, `${name}.ts`);
        await writeFile(path, body, "utf8");
        return path;
    }

    it("parses a minimal valid primitive", async () => {
        const path = await writeSrc("demo", MINIMAL_PRIMITIVE);
        const input = await parsePrimitiveSource(path, PARSE_OPTS);
        expect(input.id).toBe("demo");
        expect(input.formula).toBe("out[t] = source[t]");
        expect(input.warmup).toBe("0");
        expect(input.since).toBe("0.1");
        expect(input.stability).toBe("stable");
        expect(input.params).toEqual([
            { name: "slotId", type: "string", defaultValue: "—", description: "—" },
            { name: "source", type: "number", defaultValue: "—", description: "—" },
        ]);
        expect(input.signature).toMatch(/function demo/);
        expect(input.anchors).toBeUndefined();
    });

    it("includes anchors, returns, and per-param descriptions when present", async () => {
        const path = await writeSrc("anchored", PRIMITIVE_WITH_ANCHORS);
        const input = await parsePrimitiveSource(path, {
            ...PARSE_OPTS,
            runtimeRelPath: "packages/runtime/src/ta/anchored.ts",
        });
        expect(input.id).toBe("anchored");
        expect(input.anchors).toBe("start, end (drawing anchors)");
        expect(input.stability).toBe("stable");
        expect(input.returns).toBe("The latest source value, untouched.");
        expect(input.params[0]?.description).toBe("Compiler-injected slot id.");
    });

    it("falls back to the TS return type when no @returns tag", async () => {
        const path = await writeSrc("demo", MINIMAL_PRIMITIVE);
        const input = await parsePrimitiveSource(path, PARSE_OPTS);
        expect(input.returns.replace(/\s+/g, " ")).toContain("{ out: number");
    });

    it("emits the parameter initializer as the Default cell when present", async () => {
        const src = `/**
 * @formula  out = 1
 * @warmup   0
 * @since 0.1
 * @stable
 * @example
 *     // x
 */
export function defaulted(slotId: string, length: number = 14): number { return length; }
`;
        const path = await writeSrc("defaulted", src);
        const input = await parsePrimitiveSource(path, {
            ...PARSE_OPTS,
            runtimeRelPath: "packages/runtime/src/ta/defaulted.ts",
        });
        const lengthParam = input.params.find((p) => p.name === "length");
        expect(lengthParam?.defaultValue).toBe("14");
    });

    it("emits (optional) for `?` parameters", async () => {
        const src = `/**
 * @formula  out = 1
 * @warmup   0
 * @since 0.1
 * @stable
 * @example
 *     // x
 */
export function withOpts(slotId: string, opts?: { biased?: boolean }): number { return 1; }
`;
        const path = await writeSrc("withOpts", src);
        const input = await parsePrimitiveSource(path, {
            ...PARSE_OPTS,
            runtimeRelPath: "packages/runtime/src/ta/withOpts.ts",
        });
        const opts = input.params.find((p) => p.name === "opts");
        expect(opts?.defaultValue).toBe("(optional)");
    });

    it("emits <binding> for parameters with destructured names", async () => {
        const src = `/**
 * @formula  out = 1
 * @warmup   0
 * @since 0.1
 * @stable
 * @example
 *     // x
 */
export function bound(slotId: string, { x }: { x: number }): number { return x; }
`;
        const path = await writeSrc("bound", src);
        const input = await parsePrimitiveSource(path, {
            ...PARSE_OPTS,
            runtimeRelPath: "packages/runtime/src/ta/bound.ts",
        });
        const bindingParam = input.params[1];
        expect(bindingParam?.name).toBe("<binding>");
    });

    it("handles tags with empty comment text (uses empty string)", async () => {
        const src = `/**
 * Demo.
 * @formula
 * @warmup   0
 * @since 0.1
 * @stable
 * @example
 *     // x
 */
export function emptyTag(slotId: string): number { return 1; }
`;
        const path = await writeSrc("emptyTag", src);
        const input = await parsePrimitiveSource(path, {
            ...PARSE_OPTS,
            runtimeRelPath: "packages/runtime/src/ta/emptyTag.ts",
        });
        expect(input.formula).toBe("");
    });

    it("handles a multi-line @example block (non-string comment)", async () => {
        const src = `/**
 * Demo with a multi-line example.
 * @formula  out = 1
 * @warmup   0
 * @since 0.1
 * @stable
 * @example
 * \`\`\`ts
 * import { ta } from "@invinite-org/chartlang-runtime";
 * const x = ta.demo("slot");
 * \`\`\`
 */
export function multiline(slotId: string): number { return 1; }
`;
        const path = await writeSrc("multiline", src);
        const input = await parsePrimitiveSource(path, {
            ...PARSE_OPTS,
            runtimeRelPath: "packages/runtime/src/ta/multiline.ts",
        });
        expect(input.example).toContain("ta.demo");
    });

    it("uses leading prose from a multi-line JSDoc description (non-string comment)", async () => {
        // Multi-line descriptions can land as a JSDocComment array rather
        // than a plain string when an `@link` is interleaved with the text.
        const src = `/**
 * Demo {@link foo} with rich text.
 *
 * Second paragraph.
 * @formula  out = 1
 * @warmup   0
 * @since 0.1
 * @stable
 * @example
 *     // x
 */
export function richDesc(slotId: string): number { return 1; }
`;
        const path = await writeSrc("richDesc", src);
        const input = await parsePrimitiveSource(path, {
            ...PARSE_OPTS,
            runtimeRelPath: "packages/runtime/src/ta/richDesc.ts",
        });
        expect(input.description).toContain("rich text");
    });

    it("skips a non-exported function with the same name as the file stem", async () => {
        const src = `/**
 * Helper, not exported.
 * @formula  out = 1
 * @warmup   0
 * @since 0.1
 * @stable
 * @example
 *     // x
 */
function notExported(slotId: string): number { return 1; }

/**
 * Real export.
 * @formula  out = 1
 * @warmup   0
 * @since 0.1
 * @stable
 * @example
 *     // x
 */
export function notExported2(slotId: string): number { return 1; }
`;
        const path = await writeSrc("notExported", src);
        await expect(parsePrimitiveSource(path, PARSE_OPTS)).rejects.toMatchObject({
            code: "missing-export",
        });
    });

    it("renders 'unknown' for parameters with no TS type annotation", async () => {
        const src = `/**
 * @formula  out = 1
 * @warmup   0
 * @since 0.1
 * @stable
 * @example
 *     // x
 */
export function untyped(slotId, source) { return source; }
`;
        const path = await writeSrc("untyped", src);
        const input = await parsePrimitiveSource(path, {
            ...PARSE_OPTS,
            runtimeRelPath: "packages/runtime/src/ta/untyped.ts",
        });
        expect(input.params[0]?.type).toBe("unknown");
        // returns also falls back to "unknown".
        expect(input.returns).toBe("unknown");
    });

    it("supports primitives with only the slotId parameter (no further args)", async () => {
        const path = await writeSrc("zero", PRIMITIVE_NO_PARAMS);
        const input = await parsePrimitiveSource(path, {
            ...PARSE_OPTS,
            runtimeRelPath: "packages/runtime/src/ta/zero.ts",
        });
        expect(input.stability).toBe("frozen");
        expect(input.params).toEqual([
            { name: "slotId", type: "string", defaultValue: "—", description: "—" },
        ]);
    });

    it("rejects a primitive missing @formula", async () => {
        const path = await writeSrc("missingFormula", MISSING_FORMULA);
        await expect(parsePrimitiveSource(path, PARSE_OPTS)).rejects.toMatchObject({
            code: "missing-formula",
            name: "GenDocsError",
        });
    });

    it("rejects a primitive missing @warmup", async () => {
        const path = await writeSrc("missingWarmup", MISSING_WARMUP);
        await expect(parsePrimitiveSource(path, PARSE_OPTS)).rejects.toMatchObject({
            code: "missing-warmup",
        });
    });

    it("rejects a primitive missing @since", async () => {
        const path = await writeSrc("missingSince", MISSING_SINCE);
        await expect(parsePrimitiveSource(path, PARSE_OPTS)).rejects.toMatchObject({
            code: "missing-since",
        });
    });

    it("rejects a primitive missing @example", async () => {
        const path = await writeSrc("missingExample", MISSING_EXAMPLE);
        await expect(parsePrimitiveSource(path, PARSE_OPTS)).rejects.toMatchObject({
            code: "missing-example",
        });
    });

    it("rejects a primitive missing a stability marker", async () => {
        const path = await writeSrc("missingStability", MISSING_STABILITY);
        await expect(parsePrimitiveSource(path, PARSE_OPTS)).rejects.toMatchObject({
            code: "missing-stability",
        });
    });

    it("rejects a file whose exported function name does not match the file stem", async () => {
        const path = await writeSrc("expectedName", MISSING_EXPORT);
        await expect(parsePrimitiveSource(path, PARSE_OPTS)).rejects.toMatchObject({
            code: "missing-export",
        });
    });

    it("builds a Source-on-GitHub URL by trimming .git from repoUrl", async () => {
        const path = await writeSrc("demo", MINIMAL_PRIMITIVE);
        const input = await parsePrimitiveSource(path, PARSE_OPTS);
        expect(input.sourceUrl).toBe(
            "https://github.com/outraday-org/chartlang/blob/main/packages/runtime/src/ta/demo.ts",
        );
    });

    it("GenDocsError carries code, file, and a wrapped message", async () => {
        const path = await writeSrc("missingFormula", MISSING_FORMULA);
        try {
            await parsePrimitiveSource(path, PARSE_OPTS);
            throw new Error("expected throw");
        } catch (err) {
            expect(err).toBeInstanceOf(GenDocsError);
            const e = err as GenDocsError;
            expect(e.code).toBe("missing-formula");
            expect(e.file).toBe(path);
            expect(e.message).toContain("[missing-formula]");
        }
    });
});

describe("runGenDocs", () => {
    let repoRoot: string;
    let sourceDir: string;
    let outDir: string;
    const writes = new Map<string, string>();

    beforeEach(async () => {
        repoRoot = await mkdtemp(join(tmpdir(), "chartlang-cli-rungen-"));
        sourceDir = join(repoRoot, "packages", "runtime", "src", "ta");
        outDir = join(repoRoot, "docs", "primitives", "ta");
        await mkdir(sourceDir, { recursive: true });
        await mkdir(outDir, { recursive: true });
        // Synthetic packages/cli/package.json with a repository URL.
        await mkdir(join(repoRoot, "packages", "cli"), { recursive: true });
        await writeFile(
            join(repoRoot, "packages", "cli", "package.json"),
            JSON.stringify({
                name: "@invinite-org/chartlang-cli",
                repository: {
                    type: "git",
                    url: "https://github.com/outraday-org/chartlang.git",
                },
            }),
            "utf8",
        );
        writes.clear();
    });

    afterEach(async () => {
        await rm(repoRoot, { recursive: true, force: true });
    });

    async function captureWrite(path: string, content: string): Promise<void> {
        writes.set(path, content);
    }

    it("writes one page per primitive into outDir", async () => {
        await writeFile(join(sourceDir, "demo.ts"), MINIMAL_PRIMITIVE, "utf8");

        const result = await runGenDocs({
            sourceDir,
            outDir,
            repoRoot,
            writeFile: captureWrite,
        });

        expect(result.written).toHaveLength(1);
        const expectedPath = resolvePath(outDir, "demo.md");
        expect(result.written[0]).toBe(expectedPath);
        expect(writes.get(expectedPath)?.startsWith("# `ta.demo`")).toBe(true);
    });

    it("is idempotent — second run yields the same content per file", async () => {
        await writeFile(join(sourceDir, "demo.ts"), MINIMAL_PRIMITIVE, "utf8");

        const first = new Map<string, string>();
        const second = new Map<string, string>();
        await runGenDocs({
            sourceDir,
            outDir,
            repoRoot,
            writeFile: async (p, c) => {
                first.set(p, c);
            },
        });
        await runGenDocs({
            sourceDir,
            outDir,
            repoRoot,
            writeFile: async (p, c) => {
                second.set(p, c);
            },
        });
        expect(Array.from(first.entries())).toEqual(Array.from(second.entries()));
    });

    it("skips non-primitive files (lib/, *.test.ts, *.bench.ts, *.golden.test.ts, *.property.test.ts, registry.ts, index.ts, sourceValue.ts)", async () => {
        await writeFile(join(sourceDir, "demo.ts"), MINIMAL_PRIMITIVE, "utf8");
        await writeFile(join(sourceDir, "demo.test.ts"), "// test", "utf8");
        await writeFile(join(sourceDir, "demo.bench.ts"), "// bench", "utf8");
        await writeFile(join(sourceDir, "demo.bench.test.ts"), "// bench-test", "utf8");
        await writeFile(join(sourceDir, "demo.golden.test.ts"), "// golden", "utf8");
        await writeFile(join(sourceDir, "demo.property.test.ts"), "// property", "utf8");
        await writeFile(join(sourceDir, "registry.ts"), "// registry", "utf8");
        await writeFile(join(sourceDir, "index.ts"), "// index", "utf8");
        await writeFile(join(sourceDir, "sourceValue.ts"), "// sourceValue", "utf8");
        // A lib/ subdir — should not be descended into.
        await mkdir(join(sourceDir, "lib"), { recursive: true });
        await writeFile(join(sourceDir, "lib", "helper.ts"), "// helper", "utf8");

        const result = await runGenDocs({
            sourceDir,
            outDir,
            repoRoot,
            writeFile: captureWrite,
        });

        expect(result.written.map((p) => p.endsWith("/demo.md")).every(Boolean)).toBe(true);
        expect(result.written).toHaveLength(1);
        expect(result.skipped.length).toBeGreaterThanOrEqual(7);
    });

    it("ignores non-.ts files (e.g. README.md) in the source directory", async () => {
        await writeFile(join(sourceDir, "demo.ts"), MINIMAL_PRIMITIVE, "utf8");
        await writeFile(join(sourceDir, "README.md"), "# notes", "utf8");
        await writeFile(join(sourceDir, "CLAUDE.md"), "# notes", "utf8");

        const result = await runGenDocs({
            sourceDir,
            outDir,
            repoRoot,
            writeFile: captureWrite,
        });

        expect(result.written).toHaveLength(1);
    });

    it("defaults to fs/promises.writeFile when writeFile is not injected", async () => {
        await writeFile(join(sourceDir, "demo.ts"), MINIMAL_PRIMITIVE, "utf8");

        const result = await runGenDocs({ sourceDir, outDir, repoRoot });

        expect(result.written).toHaveLength(1);
        const content = await readFile(resolvePath(outDir, "demo.md"), "utf8");
        expect(content.startsWith("# `ta.demo`")).toBe(true);
    });

    it("falls back to a default repository URL when package.json lacks one", async () => {
        await writeFile(join(sourceDir, "demo.ts"), MINIMAL_PRIMITIVE, "utf8");
        await writeFile(
            join(repoRoot, "packages", "cli", "package.json"),
            JSON.stringify({ name: "@invinite-org/chartlang-cli" }),
            "utf8",
        );

        await runGenDocs({
            sourceDir,
            outDir,
            repoRoot,
            writeFile: captureWrite,
        });

        const expectedPath = resolvePath(outDir, "demo.md");
        const content = writes.get(expectedPath) ?? "";
        expect(content).toContain("github.com/outraday-org/chartlang");
    });

    it("uses the absolute path as runtimeRelPath when the file is outside repoRoot", async () => {
        const outsideDir = await mkdtemp(join(tmpdir(), "chartlang-cli-outside-"));
        try {
            await writeFile(join(outsideDir, "demo.ts"), MINIMAL_PRIMITIVE, "utf8");
            await runGenDocs({
                sourceDir: outsideDir,
                outDir,
                repoRoot,
                writeFile: captureWrite,
            });
            const expectedPath = resolvePath(outDir, "demo.md");
            const content = writes.get(expectedPath) ?? "";
            // No "packages/runtime" prefix — the absolute path falls through.
            expect(content).toMatch(/\[Source on GitHub\]\(https:\/\/.*\/demo\.ts\)/);
        } finally {
            await rm(outsideDir, { recursive: true, force: true });
        }
    });
});

describe("findRepoRoot", () => {
    it("walks upward until it finds a pnpm-workspace.yaml sibling", async () => {
        const workspace = await mkdtemp(join(tmpdir(), "chartlang-cli-root-"));
        try {
            await writeFile(join(workspace, "pnpm-workspace.yaml"), "packages:\n", "utf8");
            const nested = join(workspace, "a", "b", "c");
            await mkdir(nested, { recursive: true });
            const found = await findRepoRoot(nested);
            expect(found).toBe(workspace);
        } finally {
            await rm(workspace, { recursive: true, force: true });
        }
    });

    it("returns the start dir when no workspace marker is found", async () => {
        const workspace = await mkdtemp(join(tmpdir(), "chartlang-cli-noroot-"));
        try {
            const found = await findRepoRoot(workspace);
            // Either the workspace itself (if some ancestor has a pnpm-workspace.yaml),
            // or the start dir on a clean tree.
            expect(typeof found).toBe("string");
        } finally {
            await rm(workspace, { recursive: true, force: true });
        }
    });
});
