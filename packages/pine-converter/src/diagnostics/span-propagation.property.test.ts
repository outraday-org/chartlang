// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { convert } from "../index.js";

// 30+ representative fixtures spanning the lex/parse/semantic/transform stages.
// Each is a complete Pine v6 script; many deliberately trip a diagnostic so the
// property exercises span propagation across every stage. The property: NO
// emitted diagnostic carries a zero span (`startLine === 0 || startColumn === 0`
// would mean a synthesized diagnostic lost its source location).
const HEADER = "//@version=6\n";
const FIXTURES: readonly string[] = [
    `${HEADER}indicator("ok")\nplot(close)`,
    `${HEADER}indicator("ok")\nl = line.new(bar_index, close, bar_index + 5, open)`,
    `${HEADER}indicator("ok")\nvar l = line.new(bar_index, close, bar_index, open)\nplot(close)`,
    `${HEADER}strategy("s")\nplot(close)`,
    `${HEADER}indicator("ok")\nx = input.enum(Foo.A)\nplot(close)`,
    `${HEADER}indicator("ok")\nx = input.source(close + 1)\nplot(close)`,
    `${HEADER}indicator("ok")\nx = input.int(close)\nplot(close)`,
    `${HEADER}indicator("ok")\nlen = ta.ema(close, input.int(20))\nplot(len)`,
    `${HEADER}indicator("ok", max_lines_count=600)\nvar ls = array.new_line()\narray.push(ls, line.new(bar_index, close, bar_index, open))\nplot(close)`,
    `${HEADER}indicator("ok")\nvar a = array.new_line()\nvar b = array.new_line()\nlf = linefill.new(array.get(a, 0), array.get(b, 0), color.red)\nplot(close)`,
    `${HEADER}indicator("ok")\nv = ta.kcw(close)\nplot(v)`,
    `${HEADER}indicator("ok")\nv = math.random()\nplot(v)`,
    `${HEADER}indicator("ok")\nv = str.format("{0}", close)\nplot(close)`,
    `${HEADER}indicator("ok")\nfill(plot(close), plot(open))`,
    `${HEADER}indicator("ok")\nfor i = 0 to close\n    plot(close)`,
    `${HEADER}indicator("ok")\nv = close[open]\nplot(v)`,
    `${HEADER}indicator("ok")\nvar t = table.new(position.top_right, 1, 1)\ntable.cell(t, 0, 0, "hi")\nplot(close)`,
    `${HEADER}indicator("ok")\nvar t = table.new(position.top_right, 1, 1)\ntable.cell(t, 5, 5, "hi")\nplot(close)`,
    `${HEADER}indicator("ok")\nvar t = table.new(position.top_right, 2, 2)\nfor i = 0 to close\n    table.cell(t, 0, 0, "x")\nplot(close)`,
    `${HEADER}indicator("ok")\np = polyline.new(closed=true)\nplot(close)`,
    `${HEADER}indicator("ok")\nvar l = line.new(bar_index, close, bar_index, open)\nline.set_x1(l, bar_index)\nplot(close)`,
    `${HEADER}indicator("ok")\nvar l = label.new(bar_index, high, "hi", style=label.style_diamond)\nplot(close)`,
    `${HEADER}indicator("ok")\nvar l = label.new(bar_index, high, "hi", yloc=yloc.abovebar)\nplot(close)`,
    `${HEADER}indicator("ok")\nx = 1\nif close > open\n    x := 2\nplot(x)`,
    `${HEADER}indicator("ok")\nvarip n = 0\nn := n + 1\nplot(n)`,
    `${HEADER}indicator("ok")\nv = request.security(syminfo.tickerid, "60", close)\nplot(v)`,
    `${HEADER}indicator("ok")\nv = request.security("AAPL", "60", close)\nplot(v)`,
    `${HEADER}indicator("ok")\nx = close ? open : high ? low : close\nplot(x)`,
    `${HEADER}indicator("ok", max_boxes_count=99999)\nvar bs = array.new_box()\narray.push(bs, box.new(bar_index, high, bar_index, low))\nif array.size(bs) > 10\n    box.delete(array.shift(bs))\nplot(close)`,
    `${HEADER}indicator("ok")\nc = color.new(color.gray, 80)\nplot(close, color=c)`,
    `${HEADER}indicator("ok")\nfor i = 0 to 3\n    plot(close[i])`,
    `${HEADER}indicator("ok")\nm = close == open\nplot(m ? 1 : 0)`,
];

function hasZeroSpan(startLine: number, startColumn: number): boolean {
    return startLine === 0 || startColumn === 0;
}

describe("span propagation property", () => {
    it("covers at least 30 representative fixtures", () => {
        expect(FIXTURES.length).toBeGreaterThanOrEqual(30);
    });

    it("never emits a diagnostic with a zero start span", () => {
        fc.assert(
            fc.property(fc.constantFrom(...FIXTURES), (source) => {
                for (const diagnostic of convert(source).diagnostics) {
                    expect(
                        hasZeroSpan(diagnostic.span.startLine, diagnostic.span.startColumn),
                    ).toBe(false);
                }
            }),
            { numRuns: FIXTURES.length },
        );
    });

    it("emits at least one diagnostic across the fixture set (the property is not vacuous)", () => {
        const total = FIXTURES.reduce((sum, source) => sum + convert(source).diagnostics.length, 0);
        expect(total).toBeGreaterThan(0);
    });
});
