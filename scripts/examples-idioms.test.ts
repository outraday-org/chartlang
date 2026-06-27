// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
    analyze,
    collectCoveredIds,
    collectLanguagePages,
    collectRepresentedPages,
    collectTargetIds,
    parseManifest,
} from "./examples-idioms";

const VALID_MANIFEST = JSON.stringify({
    _note: "ignored",
    idioms: [
        { id: "lang.seriesIndex", page: "language/series-and-indexing" },
        { id: "lang.paneRouting", page: "spec/emissions" },
    ],
    unrepresentedPages: [{ page: "forbidden-constructs", reason: "negative surface" }],
});

describe("parseManifest", () => {
    it("parses a well-formed manifest", () => {
        const manifest = parseManifest(VALID_MANIFEST);
        expect(manifest.idioms).toHaveLength(2);
        expect(manifest.unrepresentedPages[0]?.page).toBe("forbidden-constructs");
    });

    it("throws on a non-object root", () => {
        expect(() => parseManifest("null")).toThrow(/expected a JSON object/);
        expect(() => parseManifest("[]")).toThrow(/idioms/);
    });

    it("throws on a malformed `idioms` array", () => {
        expect(() => parseManifest(JSON.stringify({ idioms: [{ id: "x" }] }))).toThrow(/idioms/);
        expect(() => parseManifest(JSON.stringify({ idioms: "nope" }))).toThrow(/idioms/);
    });

    it("throws on a malformed `unrepresentedPages` array", () => {
        expect(() =>
            parseManifest(JSON.stringify({ idioms: [], unrepresentedPages: [{ page: "x" }] })),
        ).toThrow(/unrepresentedPages/);
        expect(() => parseManifest(JSON.stringify({ idioms: [], unrepresentedPages: 7 }))).toThrow(
            /unrepresentedPages/,
        );
    });
});

describe("collectTargetIds", () => {
    it("collects every manifest idiom id", () => {
        const ids = collectTargetIds(parseManifest(VALID_MANIFEST));
        expect([...ids].sort()).toEqual(["lang.paneRouting", "lang.seriesIndex"]);
    });
});

describe("collectCoveredIds", () => {
    it("unions every `idioms` credit and ignores entries without one", () => {
        const covered = collectCoveredIds([
            {
                id: "a",
                label: "A",
                description: "",
                category: "language",
                primitives: [],
                idioms: ["lang.a"],
            },
            {
                id: "b",
                label: "B",
                description: "",
                category: "ta-momentum",
                primitives: ["ta.rsi"],
            },
            {
                id: "c",
                label: "C",
                description: "",
                category: "language",
                primitives: [],
                idioms: ["lang.a", "lang.c"],
            },
        ]);
        expect([...covered].sort()).toEqual(["lang.a", "lang.c"]);
    });
});

describe("collectRepresentedPages", () => {
    it("maps only `language/`-prefixed idiom pages to bare page ids", () => {
        const pages = collectRepresentedPages(parseManifest(VALID_MANIFEST));
        // `spec/emissions` is NOT a language page, so it is excluded.
        expect([...pages]).toEqual(["series-and-indexing"]);
    });
});

describe("collectLanguagePages", () => {
    let dir: string;
    beforeAll(async () => {
        dir = await mkdtemp(join(tmpdir(), "examples-idioms-"));
        await writeFile(join(dir, "series-and-indexing.md"), "# x\n");
        await writeFile(join(dir, "overview.md"), "# x\n");
        await writeFile(join(dir, "index.md"), "# index\n"); // excluded
        await writeFile(join(dir, "notes.txt"), "ignored\n"); // non-md
    });
    afterAll(async () => {
        await rm(dir, { recursive: true, force: true });
    });

    it("collects *.md basenames, excluding index.md and non-md", async () => {
        const pages = await collectLanguagePages(dir);
        expect([...pages].sort()).toEqual(["overview", "series-and-indexing"]);
    });
});

describe("analyze", () => {
    const targetIds = new Set(["lang.a", "lang.b"]);
    const languagePages = new Set(["series-and-indexing", "forbidden-constructs"]);
    const representedPages = new Set(["series-and-indexing"]);

    it("passes when every idiom is covered and every page is represented or allow-listed", () => {
        const report = analyze({
            targetIds,
            coveredIds: new Set(["lang.a", "lang.b"]),
            languagePages,
            representedPages,
            allowlistPages: ["forbidden-constructs"],
        });
        expect(report).toEqual({ missing: [], unknown: [], unrepresentedPages: [] });
    });

    it("flags MISSING for an uncovered manifest idiom", () => {
        const report = analyze({
            targetIds,
            coveredIds: new Set(["lang.a"]),
            languagePages,
            representedPages,
            allowlistPages: ["forbidden-constructs"],
        });
        expect(report.missing).toEqual(["lang.b"]);
    });

    it("flags UNKNOWN for a catalogue idiom not in the manifest", () => {
        const report = analyze({
            targetIds,
            coveredIds: new Set(["lang.a", "lang.b", "lang.bogus"]),
            languagePages,
            representedPages,
            allowlistPages: ["forbidden-constructs"],
        });
        expect(report.unknown).toEqual(["lang.bogus"]);
    });

    it("flags UNREPRESENTED_PAGE for a language page neither represented nor allow-listed", () => {
        const report = analyze({
            targetIds,
            coveredIds: new Set(["lang.a", "lang.b"]),
            languagePages,
            representedPages,
            allowlistPages: [],
        });
        expect(report.unrepresentedPages).toEqual(["forbidden-constructs"]);
    });
});
