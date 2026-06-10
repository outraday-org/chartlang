// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve as resolvePath } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
    PHASE4_DOC_ENTRIES,
    generatePhase4DocsPage,
    parsePhase4DocEntry,
    runGenPhase4Docs,
} from "./genPhase4Docs.js";
import type { Phase4DocInput } from "./genPhase4Docs.js";
import { AUTO_GENERATED_HEADER } from "./genDocs.js";

const REPO_ROOT = resolvePath(__dirname, "../../..", "..");

const SAMPLE_DOC: Phase4DocInput = {
    entry: {
        title: "input.int",
        sourceRelPath: "packages/core/src/input/input.ts",
        symbolPath: ["input", "int"],
        outRelPath: "docs/primitives/input/int.md",
        seeAlso: "`input.*` namespace",
    },
    description: "Build an integer input descriptor.",
    since: "0.4",
    stability: "stable",
    example: "const length = input.int(20);",
    signature: "int(defaultValue: number): IntDescriptor",
    sourceUrl: "https://example.invalid/input.ts",
};

describe("generatePhase4DocsPage", () => {
    it("renders the generated-doc sentinel, metadata, signature, example, and links", () => {
        const md = generatePhase4DocsPage(SAMPLE_DOC);
        expect(md.split("\n")[0]).toBe(AUTO_GENERATED_HEADER);
        expect(md).toContain("# `input.int`");
        expect(md).toContain("> **Stability:** stable");
        expect(md).toContain("> **Since:** 0.4");
        expect(md).toContain("Build an integer input descriptor.");
        expect(md).toContain("```ts\nint(defaultValue: number): IntDescriptor\n```");
        expect(md).toContain("```ts\nconst length = input.int(20);\n```");
        expect(md).toContain("- `input.*` namespace");
        expect(md).toContain("- [Source on GitHub](https://example.invalid/input.ts)");
    });

    it("omits the description block when the source JSDoc has no description", () => {
        const md = generatePhase4DocsPage({ ...SAMPLE_DOC, description: "" });
        expect(md).toContain("> **Since:** 0.4\n\n## Signature");
    });
});

describe("parsePhase4DocEntry", () => {
    let workspace: string;

    beforeEach(async () => {
        workspace = await mkdtemp(join(tmpdir(), "chartlang-phase4-docs-"));
        await mkdir(join(workspace, "packages/cli"), { recursive: true });
        await writeFile(
            join(workspace, "packages/cli/package.json"),
            JSON.stringify({ repository: { url: "https://github.com/acme/chartlang.git" } }),
            "utf8",
        );
    });

    afterEach(async () => {
        await rm(workspace, { recursive: true, force: true });
    });

    async function writeCoreSource(rel: string, body: string): Promise<void> {
        const path = join(workspace, rel);
        await mkdir(resolvePath(path, ".."), { recursive: true });
        await writeFile(path, body, "utf8");
    }

    it("parses object-literal members from core JSDoc", async () => {
        const rel = "packages/core/src/input/input.ts";
        await writeCoreSource(
            rel,
            `export const input = Object.freeze({
                /**
                 * Build an integer input descriptor.
                 *
                 * @since 0.4
                 * @stable
                 * @example
                 *     const length = input.int(20);
                 */
                int(defaultValue: number): unknown { return defaultValue; },
            });`,
        );
        const parsed = await parsePhase4DocEntry(workspace, {
            title: "input.int",
            sourceRelPath: rel,
            symbolPath: ["input", "int"],
            outRelPath: "docs/primitives/input/int.md",
            seeAlso: "`input.*` namespace",
        });
        expect(parsed.description).toBe("Build an integer input descriptor.");
        expect(parsed.since).toBe("0.4");
        expect(parsed.stability).toBe("stable");
        expect(parsed.example).toContain("input.int");
        expect(parsed.signature).toContain("int(defaultValue: number): unknown");
        expect(parsed.sourceUrl).toBe(
            "https://github.com/acme/chartlang/blob/main/packages/core/src/input/input.ts",
        );
    });

    it("parses string-literal member names and falls back to the default repo URL", async () => {
        await writeFile(join(workspace, "packages/cli/package.json"), JSON.stringify({}), "utf8");
        const rel = "packages/core/src/input/input.ts";
        await writeCoreSource(
            rel,
            `export const input = Object.freeze({
                /**
                 * Build an integer input descriptor.
                 * @since 0.4
                 * @stable
                 * @example
                 *     const length = input.int(20);
                 */
                "int"(): unknown { return {}; },
            });`,
        );
        const parsed = await parsePhase4DocEntry(workspace, {
            title: "input.int",
            sourceRelPath: rel,
            symbolPath: ["input", "int"],
            outRelPath: "docs/primitives/input/int.md",
            seeAlso: "`input.*` namespace",
        });
        expect(parsed.sourceUrl).toBe(
            "https://github.com/outraday-org/chartlang/blob/main/packages/core/src/input/input.ts",
        );
    });

    it("inherits tags from the nearest documented ancestor for nested members", async () => {
        const rel = "packages/core/src/state/state.ts";
        await writeCoreSource(
            rel,
            `export const state = Object.freeze({
                /**
                 * Tick-persistent slots.
                 *
                 * @since 0.4
                 * @stable
                 * @example
                 *     const fn = state.tick.float;
                 */
                tick: Object.freeze({
                    float(init: number): unknown { return init; },
                }),
            });`,
        );
        const parsed = await parsePhase4DocEntry(workspace, {
            title: "state.tick.float",
            sourceRelPath: rel,
            symbolPath: ["state", "tick", "float"],
            outRelPath: "docs/primitives/state/tick-float.md",
            seeAlso: "`state.tick.*` namespace",
        });
        expect(parsed.description).toBe("Tick-persistent slots.");
        expect(parsed.since).toBe("0.4");
        expect(parsed.signature).toContain("float(init: number): unknown");
    });

    it("parses properties from Readonly type aliases", async () => {
        const rel = "packages/core/src/define/overrides.ts";
        await writeCoreSource(
            rel,
            `/**
              * Overrides.
              * @since 0.4
              * @stable
              * @example
              *     const o: ScriptOverrides = {};
              */
             export type ScriptOverrides = Readonly<{
                /**
                 * Max bars.
                 * @since 0.4
                 * @example
                 *     const v: ScriptOverrides["maxBarsBack"] = 100;
                 */
                maxBarsBack?: number;
             }>;`,
        );
        const parsed = await parsePhase4DocEntry(workspace, {
            title: "defineIndicator.maxBarsBack",
            sourceRelPath: rel,
            symbolPath: ["ScriptOverrides", "maxBarsBack"],
            outRelPath: "docs/primitives/define/maxBarsBack.md",
            seeAlso: "`defineIndicator` overrides",
        });
        expect(parsed.description).toBe("Max bars.");
        expect(parsed.stability).toBe("stable");
        expect(parsed.signature).toContain("maxBarsBack?: number;");
    });

    it("throws a structured error when a configured symbol is missing", async () => {
        const rel = "packages/core/src/input/input.ts";
        await writeCoreSource(rel, "export const input = Object.freeze({});");
        await expect(
            parsePhase4DocEntry(workspace, {
                title: "input.int",
                sourceRelPath: rel,
                symbolPath: ["input", "int"],
                outRelPath: "docs/primitives/input/int.md",
                seeAlso: "`input.*` namespace",
            }),
        ).rejects.toMatchObject({ code: "missing-symbol" });
    });

    it("throws when a configured path descends through a leaf node", async () => {
        const rel = "packages/core/src/input/input.ts";
        await writeCoreSource(
            rel,
            `export const input = Object.freeze({
                /** Build an integer input descriptor. @since 0.4 @stable @example const v = input.int(1); */
                int(): unknown { return {}; },
            });`,
        );
        await expect(
            parsePhase4DocEntry(workspace, {
                title: "input.int.nope",
                sourceRelPath: rel,
                symbolPath: ["input", "int", "nope"],
                outRelPath: "docs/primitives/input/nope.md",
                seeAlso: "`input.*` namespace",
            }),
        ).rejects.toMatchObject({ code: "missing-symbol" });
    });

    it("throws a structured error when required tags are missing", async () => {
        const rel = "packages/core/src/input/input.ts";
        await writeCoreSource(
            rel,
            `export const input = Object.freeze({
                /** Build an integer input descriptor. */
                int(defaultValue: number): unknown { return defaultValue; },
            });`,
        );
        await expect(
            parsePhase4DocEntry(workspace, {
                title: "input.int",
                sourceRelPath: rel,
                symbolPath: ["input", "int"],
                outRelPath: "docs/primitives/input/int.md",
                seeAlso: "`input.*` namespace",
            }),
        ).rejects.toMatchObject({ code: "missing-since" });
    });

    it("throws structured errors for missing example and stability tags", async () => {
        const rel = "packages/core/src/input/input.ts";
        const entry = {
            title: "input.int",
            sourceRelPath: rel,
            symbolPath: ["input", "int"],
            outRelPath: "docs/primitives/input/int.md",
            seeAlso: "`input.*` namespace",
        };
        await writeCoreSource(
            rel,
            `export const input = Object.freeze({
                /**
                 * Build an integer input descriptor.
                 * @since 0.4
                 * @stable
                 */
                int(defaultValue: number): unknown { return defaultValue; },
            });`,
        );
        await expect(parsePhase4DocEntry(workspace, entry)).rejects.toMatchObject({
            code: "missing-example",
        });
        await writeCoreSource(
            rel,
            `export const input = Object.freeze({
                /**
                 * Build an integer input descriptor.
                 * @since 0.4
                 * @example
                 *     const length = input.int(20);
                 */
                int(defaultValue: number): unknown { return defaultValue; },
            });`,
        );
        await expect(parsePhase4DocEntry(workspace, entry)).rejects.toMatchObject({
            code: "missing-stability",
        });
    });

    it("rejects an empty configured symbol path", async () => {
        const rel = "packages/core/src/input/input.ts";
        await writeCoreSource(rel, "export const input = Object.freeze({});");
        await expect(
            parsePhase4DocEntry(workspace, {
                title: "empty",
                sourceRelPath: rel,
                symbolPath: [],
                outRelPath: "docs/primitives/input/empty.md",
                seeAlso: "empty",
            }),
        ).rejects.toMatchObject({ code: "missing-symbol" });
    });

    it("parses frozen stability and plain type-literal aliases", async () => {
        const rel = "packages/core/src/define/overrides.ts";
        await writeCoreSource(
            rel,
            `export type ScriptOverrides = {
                /**
                 * Short name.
                 * @since 0.4
                 * @frozen
                 * @example
                 *     const v: ScriptOverrides["shortName"] = "EMA";
                 */
                shortName?: string;
             };`,
        );
        const parsed = await parsePhase4DocEntry(workspace, {
            title: "defineIndicator.shortName",
            sourceRelPath: rel,
            symbolPath: ["ScriptOverrides", "shortName"],
            outRelPath: "docs/primitives/define/shortName.md",
            seeAlso: "`defineIndicator` overrides",
        });
        expect(parsed.stability).toBe("frozen");
    });
});

describe("runGenPhase4Docs", () => {
    let outRoot: string;

    beforeEach(async () => {
        outRoot = await mkdtemp(join(tmpdir(), "chartlang-phase4-docs-out-"));
    });

    afterEach(async () => {
        await rm(outRoot, { recursive: true, force: true });
    });

    it("writes one page for every configured Phase-4 docs entry", async () => {
        const result = await runGenPhase4Docs({ repoRoot: REPO_ROOT, outRoot });
        expect(result.written).toHaveLength(PHASE4_DOC_ENTRIES.length);
        const intPage = await readFile(join(outRoot, "docs/primitives/input/int.md"), "utf8");
        const tickPage = await readFile(
            join(outRoot, "docs/primitives/state/tick-float.md"),
            "utf8",
        );
        expect(intPage).toContain("# `input.int`");
        expect(tickPage).toContain("# `state.tick.float`");
    });
});
