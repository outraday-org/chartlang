// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { DrawingDocInput } from "../packages/cli/src/commands/extractDrawingPages";
import type { PrimitiveDocInput } from "../packages/cli/src/commands/genDocs";
import type { Phase4DocInput } from "../packages/cli/src/commands/genPhase4Docs";

import {
    AUTO_HEADER,
    OUT_OF_DATE_MESSAGE,
    type PlotDocInput,
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

const PLOT_FIXTURE: PlotDocInput = {
    name: "bgcolor",
    signature: "function bgcolor(_color: Color, _opts?: BgColorOpts): void;",
    description: "Paint the pane background for the current bar.",
    since: "1.4",
    stability: "stable",
};

const MATH_FIXTURE: Phase4DocInput = {
    entry: {
        title: "math",
        sourceRelPath: "packages/core/src/math/index.ts",
        symbolPath: ["math"],
        outRelPath: "docs/primitives/math.md",
        seeAlso: "`math.*` namespace",
    },
    description: "",
    since: "1.4",
    stability: "stable",
    example: "const price = math.roundToMintick(rawPrice, syminfo.mintick);",
    signature: "math = Object.freeze({\n    roundToMintick,\n    sum,\n})",
    sourceUrl: "https://example.invalid/math.ts",
};

const STR_FIXTURE: Phase4DocInput = {
    entry: {
        title: "str",
        sourceRelPath: "packages/core/src/str/index.ts",
        symbolPath: ["str"],
        outRelPath: "docs/primitives/str.md",
        seeAlso: "`str.*` namespace",
    },
    description: "",
    since: "1.4",
    stability: "stable",
    example: 'const label = str.format("{0}", str.upper("eth"));',
    signature: "str = Object.freeze({\n    upper: (s: string): string => s.toUpperCase(),\n})",
    sourceUrl: "https://example.invalid/str.ts",
};

describe("renderReference", () => {
    it("emits the auto-header as the first line", () => {
        const md = renderReference(
            [TA_FIXTURE],
            [DRAW_FIXTURE],
            [PLOT_FIXTURE],
            MATH_FIXTURE,
            STR_FIXTURE,
        );
        expect(md.split("\n")[0]).toBe(AUTO_HEADER);
    });

    it("renders a ta.* block with signature, formula, warmup, since/stability", () => {
        const md = renderReference([TA_FIXTURE], [], [], MATH_FIXTURE, STR_FIXTURE);
        expect(md).toContain("### ta.ema");
        expect(md).toContain(TA_FIXTURE.signature);
        expect(md).toContain("Exponential moving average.");
        expect(md).toContain("**Formula:** out = α·src + (1−α)·prev");
        expect(md).toContain("**Warmup:** length − 1");
        expect(md).toContain("**Since:** 0.1 · stable");
    });

    it("renders a draw.* block with signature, anchors, since/stability", () => {
        const md = renderReference([], [DRAW_FIXTURE], [], MATH_FIXTURE, STR_FIXTURE);
        expect(md).toContain("### draw.line");
        expect(md).toContain(DRAW_FIXTURE.signature);
        expect(md).toContain("**Anchors:** `a`, `b` — two `WorldPoint`s");
        expect(md).toContain("**Since:** 0.3 · stable");
    });

    it("renders a plot-family block under a ## plot family section", () => {
        const md = renderReference([], [], [PLOT_FIXTURE], MATH_FIXTURE, STR_FIXTURE);
        expect(md).toContain("## plot family");
        expect(md).toContain("### bgcolor");
        expect(md).toContain(PLOT_FIXTURE.signature);
        expect(md).toContain("Paint the pane background for the current bar.");
        expect(md).toContain("**Since:** 1.4 · stable");
    });

    it("renders consolidated ## math.* / ## str.* namespace blocks", () => {
        const md = renderReference([], [], [], MATH_FIXTURE, STR_FIXTURE);
        expect(md).toContain("## math.*");
        expect(md).toContain(MATH_FIXTURE.signature);
        expect(md).toContain(`**Example:** \`${MATH_FIXTURE.example}\``);
        expect(md).toContain("## str.*");
        expect(md).toContain(STR_FIXTURE.signature);
        expect(md).toContain(`**Example:** \`${STR_FIXTURE.example}\``);
        expect(md).toContain("**Since:** 1.4 · stable");
        // math.* renders after the plot family, str.* after math.*.
        expect(md.indexOf("## plot family")).toBeLessThan(md.indexOf("## math.*"));
        expect(md.indexOf("## math.*")).toBeLessThan(md.indexOf("## str.*"));
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
