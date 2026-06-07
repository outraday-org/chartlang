// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve as resolvePath } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
    generateDrawingDocsPage,
    parseDrawingSource,
    runGenDrawingDocs,
} from "./extractDrawingPages";
import type { DrawingDocInput } from "./extractDrawingPages";
import { AUTO_GENERATED_HEADER, GenDocsError } from "./genDocs";

const MINIMAL_LINE = `/**
 * Draw a straight line between two world anchors.
 *
 * @anchors \`a\`, \`b\` — two \`WorldPoint\`s
 * @anchorCount 2
 * @bucket lines
 * @since 0.3
 * @experimental
 * @example
 *     // draw.line(a, b)
 */
export function line(slotId: string, a: { time: number; price: number }, b: { time: number; price: number }): { id: string };
`;

const RANGE_PATH = `/**
 * Draw an open polyline.
 *
 * @anchors anchors — N points
 * @anchorCount 2..20
 * @bucket polylines
 * @since 0.3
 * @experimental
 * @example
 *     // draw.path([])
 */
export function path(slotId: string, anchors: ReadonlyArray<unknown>): { id: string };
`;

const BUCKET_MISMATCH = `/**
 * @anchors x
 * @anchorCount 2
 * @bucket boxes
 * @since 0.3
 * @experimental
 * @example
 *     // x
 */
export function line(slotId: string): { id: string };
`;

const UNKNOWN_KIND = `/**
 * @anchors x
 * @anchorCount 1
 * @bucket lines
 * @since 0.3
 * @experimental
 * @example
 *     // x
 */
export function notAKnownKind(slotId: string): { id: string };
`;

const SAMPLE_INPUT: DrawingDocInput = {
    camelKind: "line",
    kebabKind: "line",
    signature: "function line(a: WorldPoint, b: WorldPoint, opts?: LineDrawStyle): DrawingHandle;",
    description: "Draw a straight line.",
    anchors: "`a`, `b` — two `WorldPoint`s",
    anchorCount: "2",
    bucket: "lines",
    since: "0.3",
    stability: "experimental",
    example: "// draw.line(a, b)",
    sourceUrl: "https://example.invalid/blob/main/line.ts",
};

const PARSE_OPTS = {
    repoUrl: "https://github.com/outraday-org/chartlang.git",
    runtimeRelPath: "packages/runtime/src/emit/draw/lines/line.ts",
} as const;

describe("generateDrawingDocsPage", () => {
    it("emits the AUTO-GENERATED sentinel as the first line", () => {
        const md = generateDrawingDocsPage(SAMPLE_INPUT);
        expect(md.split("\n")[0]).toBe(AUTO_GENERATED_HEADER);
    });

    it("renders the Stability / Since / Bucket / Wire-kind header block", () => {
        const md = generateDrawingDocsPage(SAMPLE_INPUT);
        expect(md).toMatch(/> \*\*Stability:\*\* experimental/);
        expect(md).toMatch(/> \*\*Since:\*\* 0\.3/);
        expect(md).toMatch(/> \*\*Bucket:\*\* `lines`/);
        expect(md).toMatch(/> \*\*Wire kind:\*\* `line`/);
    });

    it("emits Anchors, anchor-count line, Signature, Example, See also", () => {
        const md = generateDrawingDocsPage(SAMPLE_INPUT);
        expect(md).toMatch(/## Anchors\n\n`a`, `b`/);
        expect(md).toMatch(/Anchor count: 2\./);
        expect(md).toMatch(/## Signature\n\n```ts\nfunction line/);
        expect(md).toMatch(/## Example\n\n```ts\n\/\/ draw\.line/);
        expect(md).toMatch(/## See also/);
        expect(md).toMatch(
            /\[Source on GitHub\]\(https:\/\/example\.invalid\/blob\/main\/line\.ts\)/,
        );
        expect(md).toMatch(/\[`draw\.\*` namespace index\]\(\.\/index\.md\)/);
    });

    it("renders the slotId helper note under the signature", () => {
        const md = generateDrawingDocsPage(SAMPLE_INPUT);
        expect(md).toMatch(/`slotId: string`.*compiler at every callsite/);
    });

    it("omits the leading description block when empty", () => {
        const md = generateDrawingDocsPage({ ...SAMPLE_INPUT, description: "" });
        expect(md).toMatch(/Wire kind:\*\* `line`\n\n## Anchors/);
    });

    it("accepts a range anchor-count and prints it verbatim", () => {
        const md = generateDrawingDocsPage({ ...SAMPLE_INPUT, anchorCount: "2..20" });
        expect(md).toMatch(/Anchor count: 2\.\.20\./);
    });
});

describe("parseDrawingSource", () => {
    let workspace: string;

    beforeEach(async () => {
        workspace = await mkdtemp(join(tmpdir(), "chartlang-cli-drawpages-"));
    });

    afterEach(async () => {
        await rm(workspace, { recursive: true, force: true });
    });

    async function writeSrc(name: string, body: string): Promise<string> {
        const path = join(workspace, `${name}.ts`);
        await writeFile(path, body, "utf8");
        return path;
    }

    it("parses a minimal valid drawing source", async () => {
        const path = await writeSrc("line", MINIMAL_LINE);
        const input = await parseDrawingSource(path, PARSE_OPTS);
        expect(input.camelKind).toBe("line");
        expect(input.kebabKind).toBe("line");
        expect(input.anchors).toContain("`a`, `b`");
        expect(input.anchorCount).toBe("2");
        expect(input.bucket).toBe("lines");
        expect(input.stability).toBe("experimental");
        expect(input.since).toBe("0.3");
        expect(input.example).toContain("draw.line");
        expect(input.sourceUrl).toBe(
            "https://github.com/outraday-org/chartlang/blob/main/packages/runtime/src/emit/draw/lines/line.ts",
        );
    });

    it("accepts a range anchor-count (e.g. `2..20`)", async () => {
        const path = await writeSrc("path", RANGE_PATH);
        const input = await parseDrawingSource(path, {
            ...PARSE_OPTS,
            runtimeRelPath: "packages/runtime/src/emit/draw/boxes/path.ts",
        });
        expect(input.anchorCount).toBe("2..20");
    });

    it("recognises a @stable marker", async () => {
        const src = MINIMAL_LINE.replace("@experimental", "@stable");
        const path = await writeSrc("line", src);
        const input = await parseDrawingSource(path, PARSE_OPTS);
        expect(input.stability).toBe("stable");
    });

    it("recognises a @frozen marker", async () => {
        const src = MINIMAL_LINE.replace("@experimental", "@frozen");
        const path = await writeSrc("line", src);
        const input = await parseDrawingSource(path, PARSE_OPTS);
        expect(input.stability).toBe("frozen");
    });

    it("rejects an unknown camelKind basename", async () => {
        const path = await writeSrc("notAKnownKind", UNKNOWN_KIND);
        await expect(parseDrawingSource(path, PARSE_OPTS)).rejects.toMatchObject({
            code: "unknown-camel-kind",
            name: "GenDocsError",
        });
    });

    it("rejects a source missing @anchors", async () => {
        const src = MINIMAL_LINE.replace(/\* @anchors[^\n]+\n/, "");
        const path = await writeSrc("line", src);
        await expect(parseDrawingSource(path, PARSE_OPTS)).rejects.toMatchObject({
            code: "missing-export",
        });
    });

    it("rejects a source missing @anchorCount", async () => {
        const src = MINIMAL_LINE.replace(/\* @anchorCount[^\n]+\n/, "");
        const path = await writeSrc("line", src);
        await expect(parseDrawingSource(path, PARSE_OPTS)).rejects.toMatchObject({
            code: "missing-anchor-count",
        });
    });

    it("rejects an empty @anchorCount tag", async () => {
        const src = MINIMAL_LINE.replace("@anchorCount 2", "@anchorCount");
        const path = await writeSrc("line", src);
        await expect(parseDrawingSource(path, PARSE_OPTS)).rejects.toMatchObject({
            code: "missing-anchor-count",
        });
    });

    it("rejects a source missing @bucket", async () => {
        const src = MINIMAL_LINE.replace(/\* @bucket[^\n]+\n/, "");
        const path = await writeSrc("line", src);
        await expect(parseDrawingSource(path, PARSE_OPTS)).rejects.toMatchObject({
            code: "missing-bucket",
        });
    });

    it("rejects a source missing @since", async () => {
        const src = MINIMAL_LINE.replace(/\* @since[^\n]+\n/, "");
        const path = await writeSrc("line", src);
        await expect(parseDrawingSource(path, PARSE_OPTS)).rejects.toMatchObject({
            code: "missing-since",
        });
    });

    it("rejects a source missing @example", async () => {
        const src = MINIMAL_LINE.replace(/\* @example\n \*[^\n]*\n/, "");
        const path = await writeSrc("line", src);
        await expect(parseDrawingSource(path, PARSE_OPTS)).rejects.toMatchObject({
            code: "missing-example",
        });
    });

    it("rejects a source missing a stability marker", async () => {
        const src = MINIMAL_LINE.replace("@experimental", "");
        const path = await writeSrc("line", src);
        await expect(parseDrawingSource(path, PARSE_OPTS)).rejects.toMatchObject({
            code: "missing-stability",
        });
    });

    it("rejects a source whose @bucket disagrees with the canonical KIND_BUCKET", async () => {
        const path = await writeSrc("line", BUCKET_MISMATCH);
        await expect(parseDrawingSource(path, PARSE_OPTS)).rejects.toMatchObject({
            code: "bucket-mismatch",
        });
    });

    it("rejects a source whose basename matches a kind but no matching exported function exists", async () => {
        const src = `/**
 * @anchors x
 * @anchorCount 2
 * @bucket lines
 * @since 0.3
 * @experimental
 * @example
 *     // x
 */
function line(): number { return 1; }
`;
        const path = await writeSrc("line", src);
        await expect(parseDrawingSource(path, PARSE_OPTS)).rejects.toMatchObject({
            code: "missing-export",
        });
    });

    it("skips non-function declarations when scanning the source file", async () => {
        // Mix a top-level const + a differently-named export ahead of
        // the real export — the picker walks past both before landing
        // on the matching declaration.
        const src = `export const helper = 1;\nexport function other(): number { return 1; }\n${MINIMAL_LINE}`;
        const path = await writeSrc("line", src);
        const input = await parseDrawingSource(path, PARSE_OPTS);
        expect(input.camelKind).toBe("line");
    });

    it("skips non-exported function declarations matching the basename", async () => {
        const src = `function line(): number { return 1; }\n${MINIMAL_LINE}`;
        const path = await writeSrc("line", src);
        const input = await parseDrawingSource(path, PARSE_OPTS);
        expect(input.camelKind).toBe("line");
    });
});

describe("runGenDrawingDocs", () => {
    let repoRoot: string;
    let sourceDir: string;
    let outDir: string;
    const writes = new Map<string, string>();

    beforeEach(async () => {
        repoRoot = await mkdtemp(join(tmpdir(), "chartlang-cli-rundraw-"));
        sourceDir = join(repoRoot, "packages", "runtime", "src", "emit", "draw");
        outDir = join(repoRoot, "docs", "primitives", "draw");
        await mkdir(sourceDir, { recursive: true });
        await mkdir(outDir, { recursive: true });
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

    it("walks one level of category subdirs and writes one page per kind", async () => {
        const linesDir = join(sourceDir, "lines");
        await mkdir(linesDir, { recursive: true });
        await writeFile(join(linesDir, "line.ts"), MINIMAL_LINE, "utf8");

        const result = await runGenDrawingDocs({
            sourceDir,
            outDir,
            repoRoot,
            writeFile: captureWrite,
        });

        expect(result.written).toHaveLength(1);
        const expectedPath = resolvePath(outDir, "line.md");
        expect(result.written[0]).toBe(expectedPath);
        expect(writes.get(expectedPath)?.startsWith(AUTO_GENERATED_HEADER)).toBe(true);
        expect(writes.get(expectedPath)).toContain("# `draw.line`");
    });

    it("is idempotent — second run yields the same content per file", async () => {
        const linesDir = join(sourceDir, "lines");
        await mkdir(linesDir, { recursive: true });
        await writeFile(join(linesDir, "line.ts"), MINIMAL_LINE, "utf8");

        const first = new Map<string, string>();
        const second = new Map<string, string>();
        await runGenDrawingDocs({
            sourceDir,
            outDir,
            repoRoot,
            writeFile: async (p, c) => {
                first.set(p, c);
            },
        });
        await runGenDrawingDocs({
            sourceDir,
            outDir,
            repoRoot,
            writeFile: async (p, c) => {
                second.set(p, c);
            },
        });
        expect(Array.from(first.entries())).toEqual(Array.from(second.entries()));
    });

    it("skips infra files (handle.ts / pushDrawing.ts / namespace.ts / etc.) plus tests/benches", async () => {
        const linesDir = join(sourceDir, "lines");
        await mkdir(linesDir, { recursive: true });
        await writeFile(join(linesDir, "line.ts"), MINIMAL_LINE, "utf8");
        await writeFile(join(linesDir, "line.test.ts"), "// test", "utf8");
        await writeFile(join(linesDir, "line.bench.ts"), "// bench", "utf8");
        await writeFile(join(linesDir, "line.bench.test.ts"), "// bench-test", "utf8");
        await writeFile(join(linesDir, "line.golden.test.ts"), "// golden", "utf8");
        await writeFile(join(linesDir, "line.property.test.ts"), "// property", "utf8");
        await writeFile(join(linesDir, "line.types.test.ts"), "// types", "utf8");
        await writeFile(join(sourceDir, "handle.ts"), "// infra", "utf8");
        await writeFile(join(sourceDir, "pushDrawing.ts"), "// infra", "utf8");
        await writeFile(join(sourceDir, "subIdAllocator.ts"), "// infra", "utf8");
        await writeFile(join(sourceDir, "index.ts"), "// barrel", "utf8");
        await writeFile(join(sourceDir, "namespace.ts"), "// namespace", "utf8");

        const result = await runGenDrawingDocs({
            sourceDir,
            outDir,
            repoRoot,
            writeFile: captureWrite,
        });

        expect(result.written).toHaveLength(1);
        expect(result.written[0]?.endsWith("/line.md")).toBe(true);
        // 5 top-level skip basenames + 6 subdir test/bench files = 11
        expect(result.skipped.length).toBeGreaterThanOrEqual(11);
    });

    it("picks up top-level per-kind files (no category subdir required)", async () => {
        // line.ts placed directly at sourceDir (no `lines/` subdir).
        await writeFile(join(sourceDir, "line.ts"), MINIMAL_LINE, "utf8");

        const result = await runGenDrawingDocs({
            sourceDir,
            outDir,
            repoRoot,
            writeFile: captureWrite,
        });

        expect(result.written).toHaveLength(1);
        expect(result.written[0]?.endsWith("/line.md")).toBe(true);
    });

    it("ignores non-.ts files (e.g. README.md) at top level and inside subdirs", async () => {
        const linesDir = join(sourceDir, "lines");
        await mkdir(linesDir, { recursive: true });
        await writeFile(join(linesDir, "line.ts"), MINIMAL_LINE, "utf8");
        await writeFile(join(sourceDir, "README.md"), "# notes", "utf8");
        await writeFile(join(linesDir, "NOTES.md"), "# notes", "utf8");

        const result = await runGenDrawingDocs({
            sourceDir,
            outDir,
            repoRoot,
            writeFile: captureWrite,
        });

        expect(result.written).toHaveLength(1);
    });

    it("defaults to fs/promises.writeFile when writeFile is not injected", async () => {
        const linesDir = join(sourceDir, "lines");
        await mkdir(linesDir, { recursive: true });
        await writeFile(join(linesDir, "line.ts"), MINIMAL_LINE, "utf8");

        const result = await runGenDrawingDocs({ sourceDir, outDir, repoRoot });

        expect(result.written).toHaveLength(1);
        const content = await readFile(resolvePath(outDir, "line.md"), "utf8");
        expect(content.startsWith(AUTO_GENERATED_HEADER)).toBe(true);
    });

    it("falls back to a default repository URL when package.json lacks one", async () => {
        const linesDir = join(sourceDir, "lines");
        await mkdir(linesDir, { recursive: true });
        await writeFile(join(linesDir, "line.ts"), MINIMAL_LINE, "utf8");
        await writeFile(
            join(repoRoot, "packages", "cli", "package.json"),
            JSON.stringify({ name: "@invinite-org/chartlang-cli" }),
            "utf8",
        );

        await runGenDrawingDocs({
            sourceDir,
            outDir,
            repoRoot,
            writeFile: captureWrite,
        });

        const expectedPath = resolvePath(outDir, "line.md");
        const content = writes.get(expectedPath) ?? "";
        expect(content).toContain("github.com/outraday-org/chartlang");
    });

    it("uses the absolute path as runtimeRelPath when the file is outside repoRoot", async () => {
        const outsideDir = await mkdtemp(join(tmpdir(), "chartlang-cli-drawoutside-"));
        try {
            const linesDir = join(outsideDir, "lines");
            await mkdir(linesDir, { recursive: true });
            await writeFile(join(linesDir, "line.ts"), MINIMAL_LINE, "utf8");
            await runGenDrawingDocs({
                sourceDir: outsideDir,
                outDir,
                repoRoot,
                writeFile: captureWrite,
            });
            const expectedPath = resolvePath(outDir, "line.md");
            const content = writes.get(expectedPath) ?? "";
            expect(content).toMatch(/\[Source on GitHub\]\(https:\/\/.*\/lines\/line\.ts\)/);
        } finally {
            await rm(outsideDir, { recursive: true, force: true });
        }
    });

    it("propagates GenDocsError from parseDrawingSource (e.g. unknown camelKind)", async () => {
        await writeFile(join(sourceDir, "notAKnownKind.ts"), UNKNOWN_KIND, "utf8");

        await expect(
            runGenDrawingDocs({
                sourceDir,
                outDir,
                repoRoot,
                writeFile: captureWrite,
            }),
        ).rejects.toBeInstanceOf(GenDocsError);
    });

    it("ignores nested subdirs and non-file entries inside a category dir", async () => {
        const linesDir = join(sourceDir, "lines");
        await mkdir(linesDir, { recursive: true });
        await mkdir(join(linesDir, "deeper"), { recursive: true });
        await writeFile(join(linesDir, "line.ts"), MINIMAL_LINE, "utf8");

        const result = await runGenDrawingDocs({
            sourceDir,
            outDir,
            repoRoot,
            writeFile: captureWrite,
        });

        expect(result.written).toHaveLength(1);
        expect(result.written[0]?.endsWith("/line.md")).toBe(true);
    });

    it("ignores nested subdirs at the top level", async () => {
        // A nested-empty top-level dir means the inner-readdir loop runs
        // with no .ts files; the outer loop's `if (!e.isFile()) continue`
        // branch fires for any non-file, non-directory entry we
        // simulate by leaving a dot-prefixed marker dir.
        await mkdir(join(sourceDir, ".empty-marker"), { recursive: true });
        await writeFile(join(sourceDir, "line.ts"), MINIMAL_LINE, "utf8");

        const result = await runGenDrawingDocs({
            sourceDir,
            outDir,
            repoRoot,
            writeFile: captureWrite,
        });

        expect(result.written).toHaveLength(1);
    });
});
