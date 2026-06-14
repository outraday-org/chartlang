// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { DrawingDocInput } from "../packages/cli/src/commands/extractDrawingPages";
import type { PrimitiveDocInput } from "../packages/cli/src/commands/genDocs";

import {
    AUTO_HEADER,
    OUT_OF_DATE_MESSAGE,
    crossCheckTa,
    renderReference,
} from "./generate-skills-reference";

const TA_FIXTURE: PrimitiveDocInput = {
    id: "ema",
    signature:
        "function ema(slotId: string, source: Series<number>, length: number): Series<number>;",
    description: "Exponential moving average.",
    formula: "out = α·src + (1−α)·prev",
    warmup: "length − 1",
    since: "0.1",
    stability: "stable",
    params: [],
    returns: "Series<number>",
    example: "// ta.ema(bar.close, 20)",
    sourceUrl: "https://example.invalid/ema.ts",
};

const DRAW_FIXTURE: DrawingDocInput = {
    camelKind: "line",
    kebabKind: "line",
    signature: "function line(slotId: string, a: WorldPoint, b: WorldPoint): DrawingHandle;",
    description: "Draw a straight line between two world anchors.",
    anchors: "`a`, `b` — two `WorldPoint`s",
    anchorCount: "2",
    bucket: "lines",
    since: "0.3",
    stability: "stable",
    example: "// draw.line(a, b)",
    sourceUrl: "https://example.invalid/line.ts",
};

describe("renderReference", () => {
    it("emits the auto-header as the first line", () => {
        const md = renderReference([TA_FIXTURE], [DRAW_FIXTURE]);
        expect(md.split("\n")[0]).toBe(AUTO_HEADER);
    });

    it("renders a ta.* block with signature, formula, warmup, since/stability", () => {
        const md = renderReference([TA_FIXTURE], []);
        expect(md).toContain("### ta.ema");
        expect(md).toContain(TA_FIXTURE.signature);
        expect(md).toContain("Exponential moving average.");
        expect(md).toContain("**Formula:** out = α·src + (1−α)·prev");
        expect(md).toContain("**Warmup:** length − 1");
        expect(md).toContain("**Since:** 0.1 · stable");
    });

    it("renders a draw.* block with signature, anchors, since/stability", () => {
        const md = renderReference([], [DRAW_FIXTURE]);
        expect(md).toContain("### draw.line");
        expect(md).toContain(DRAW_FIXTURE.signature);
        expect(md).toContain("**Anchors:** `a`, `b` — two `WorldPoint`s");
        expect(md).toContain("**Since:** 0.3 · stable");
    });
});

describe("crossCheckTa", () => {
    it("passes when every registry ta.* id is present", () => {
        const registry = new Set([{ name: "ta.ema" }, { name: "plot" }, { name: "draw.line" }]);
        expect(() => crossCheckTa(["ema"], registry)).not.toThrow();
    });

    it("hard-errors when a registry ta.* primitive has no parsed JSDoc", () => {
        const registry = new Set([{ name: "ta.ema" }, { name: "ta.sma" }]);
        expect(() => crossCheckTa(["ema"], registry)).toThrowError(/ta\.sma/);
    });
});

describe("OUT_OF_DATE_MESSAGE", () => {
    it("names the file and the regenerate command", () => {
        expect(OUT_OF_DATE_MESSAGE).toContain("skills/chartlang-coding/references/primitives.md");
        expect(OUT_OF_DATE_MESSAGE).toContain("pnpm skills:generate");
    });
});
