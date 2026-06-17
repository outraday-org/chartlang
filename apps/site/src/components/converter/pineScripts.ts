// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Sample Pine Script v6 sources for the converter playground. Inlined as
// strings (the converter's own `fixtures/` are package-internal and not an
// export) and chosen to exercise the documented reachable surface: Camp A
// single-handle, Camp B bounded ring, a table dashboard, inputs + control
// flow, a future-bar anchor (the bar-interval flow), and a hard reject.

/** A selectable Pine sample. */
export type PineScript = Readonly<{
    id: string;
    label: string;
    description: string;
    source: string;
}>;

const CAMP_A_LINE = `//@version=6
indicator("Tracking Line", overlay = true)

// Camp A: one persistent line handle, created on the first bar and
// extended on every bar after it.
var line trail = na
if barstate.isfirst
    trail := line.new(bar_index, close, bar_index, close, color = color.aqua, width = 2)
else
    line.set_xy2(trail, bar_index, close)
`;

const CAMP_B_PIVOTS = `//@version=6
indicator("Pivot Lines", overlay = true, max_lines_count = 50)

// Camp B: a bounded collection of lines filled by array.push with FIFO
// eviction once it exceeds the cap. The converter folds this into a ring.
var array<line> pivots = array.new<line>()

if bar_index % 25 == 0
    array.push(pivots, line.new(bar_index, high, bar_index, high, color = color.red))
    if array.size(pivots) > 20
        line.delete(array.shift(pivots))
`;

const TABLE_DASHBOARD = `//@version=6
indicator("Dashboard", overlay = true)

// A single table handle rebuilt on the last bar.
var table dash = table.new(position.top_right, 2, 2, border_width = 1)
if barstate.islast
    table.cell(dash, 0, 0, "Close", text_color = color.white)
    table.cell(dash, 1, 0, str.tostring(close), text_color = color.white)
    table.cell(dash, 0, 1, "High", text_color = color.white)
    table.cell(dash, 1, 1, str.tostring(high), text_color = color.white)
`;

const INPUTS_CONTROL_FLOW = `//@version=6
indicator("Basis Line", overlay = true)

len = input.int(20, "Length", minval = 1)
src = input.source(close, "Source")

basis = ta.sma(src, len)
var line mid = na
if barstate.isfirst
    mid := line.new(bar_index, basis, bar_index, basis, color = color.orange, width = 2)
else
    line.set_xy2(mid, bar_index, basis)
`;

const FUTURE_BAR = `//@version=6
indicator("Projection Ray", overlay = true)

// Uses a future bar_index + N anchor. chartlang anchors are (time, price)
// only, so the converter needs a bar interval (ms) to project the future
// point — set "Bar interval" to e.g. 60000 to resolve it.
var line ray = na
if barstate.isfirst
    ray := line.new(bar_index, close, bar_index + 20, close, color = color.green, width = 2)
else
    line.set_xy1(ray, bar_index, close)
    line.set_xy2(ray, bar_index + 20, close)
`;

const REJECT_FOR_IN = `//@version=6
indicator("Recolour Lines", overlay = true)

// Hard reject: chartlang forbids \`for ... in\` iteration over a collection
// of handles. The converter refuses it with a structured diagnostic and a
// suggested manual rewrite rather than emitting wrong output.
var array<line> store = array.new<line>()
if bar_index % 20 == 0
    array.push(store, line.new(bar_index, close, bar_index, close))

for ln in store
    line.set_color(ln, color.red)
`;

export const PINE_SCRIPTS: ReadonlyArray<PineScript> = [
    {
        id: "camp-a-line",
        label: "Tracking line (Camp A)",
        description:
            "A single persistent line handle created once and extended each bar — the simplest drawing idiom.",
        source: CAMP_A_LINE,
    },
    {
        id: "camp-b-pivots",
        label: "Pivot ring (Camp B)",
        description:
            "A bounded array of lines with FIFO eviction, folded into a chartlang ring buffer.",
        source: CAMP_B_PIVOTS,
    },
    {
        id: "table-dashboard",
        label: "Table dashboard",
        description: "A table handle rebuilt on the last bar — lowered to draw.table cells.",
        source: TABLE_DASHBOARD,
    },
    {
        id: "inputs-control-flow",
        label: "Inputs + control flow",
        description:
            "input.int / input.source plus an if/else, showing the surfaced inputs in the manifest.",
        source: INPUTS_CONTROL_FLOW,
    },
    {
        id: "future-bar",
        label: "Future-bar projection",
        description:
            "A bar_index + N future anchor — needs a bar interval (ms) to resolve. Try the control.",
        source: FUTURE_BAR,
    },
    {
        id: "reject-for-in",
        label: "Hard reject (for…in)",
        description:
            "A for…in loop over a handle collection — refused with a structured diagnostic, not wrong output.",
        source: REJECT_FOR_IN,
    },
];
