// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { analyze, collectCoveredIds, collectTargetIds, mapPageToId } from "./examples-coverage";

describe("mapPageToId", () => {
    it("maps top-level single-page namespaces to a bare id", () => {
        expect(mapPageToId("math.md")).toBe("math");
        expect(mapPageToId("syminfo.md")).toBe("syminfo");
    });

    it("maps each namespaced directory per the §1 scheme", () => {
        expect(mapPageToId("ta/rsi.md")).toBe("ta.rsi");
        expect(mapPageToId("draw/fib-retracement.md")).toBe("draw.fibRetracement");
        expect(mapPageToId("draw/horizontal-ray.md")).toBe("draw.horizontalRay");
        expect(mapPageToId("draw/line.md")).toBe("draw.line");
        expect(mapPageToId("input/externalSeries.md")).toBe("input.externalSeries");
        expect(mapPageToId("state/array.md")).toBe("state.array");
        expect(mapPageToId("state/tick-bool.md")).toBe("state.tick.bool");
        expect(mapPageToId("request/security.md")).toBe("request.security");
        expect(mapPageToId("define/maxBarsBack.md")).toBe("define.maxBarsBack");
        expect(mapPageToId("plot/plot.md")).toBe("plot");
        expect(mapPageToId("plot/hline.md")).toBe("hline");
        expect(mapPageToId("alert/alert.md")).toBe("alert");
    });

    it("throws on an unrecognised primitive directory", () => {
        expect(() => mapPageToId("mystery/thing.md")).toThrow(/unmapped/);
    });
});

describe("collectTargetIds", () => {
    let dir: string;
    beforeAll(async () => {
        dir = await mkdtemp(join(tmpdir(), "examples-coverage-"));
        await mkdir(join(dir, "ta"), { recursive: true });
        await mkdir(join(dir, "draw"), { recursive: true });
        await writeFile(join(dir, "math.md"), "# math\n");
        await writeFile(join(dir, "ta", "rsi.md"), "# rsi\n");
        await writeFile(join(dir, "ta", "index.md"), "# index\n"); // excluded
        await writeFile(join(dir, "draw", "fib-retracement.md"), "# fib\n");
        await writeFile(join(dir, "ta", "notes.txt"), "ignored\n"); // non-md
    });
    afterAll(async () => {
        await rm(dir, { recursive: true, force: true });
    });

    it("walks the tree, excludes index.md + non-md, and maps ids", async () => {
        const ids = await collectTargetIds(dir);
        expect([...ids].sort()).toEqual(["draw.fibRetracement", "math", "ta.rsi"]);
    });
});

describe("collectCoveredIds", () => {
    it("unions every primitives credit", () => {
        const covered = collectCoveredIds([
            { id: "a", label: "A", description: "", category: "math", primitives: ["math"] },
            { id: "b", label: "B", description: "", category: "complex", primitives: [] },
            {
                id: "c",
                label: "C",
                description: "",
                category: "complex",
                primitives: ["ta.rsi", "math"],
            },
        ]);
        expect([...covered].sort()).toEqual(["math", "ta.rsi"]);
    });
});

describe("analyze", () => {
    const targetIds = new Set(["ta.ema", "ta.rsi", "math"]);

    it("passes when every target is covered (fully enforcing, no allowlist)", () => {
        const report = analyze({
            targetIds,
            coveredIds: new Set(["ta.ema", "ta.rsi", "math"]),
        });
        expect(report).toEqual({ missing: [], unknown: [] });
    });

    it("flags MISSING for any uncovered target — the gate now enforces target ⊆ covered", () => {
        // With the allowlist removed (Task 22), an uncovered primitive page is
        // a hard failure: a deliberately removed example makes the gate fail.
        const report = analyze({
            targetIds,
            coveredIds: new Set(["ta.ema"]),
        });
        expect(report.missing).toEqual(["math", "ta.rsi"]);
    });

    it("flags UNKNOWN for a credit with no primitive page", () => {
        const report = analyze({
            targetIds,
            coveredIds: new Set(["ta.ema", "ta.rsi", "math", "ta.bogus"]),
        });
        expect(report.unknown).toEqual(["ta.bogus"]);
    });
});
