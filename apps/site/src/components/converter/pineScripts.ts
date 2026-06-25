// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Sample Pine Script v6 sources for the converter playground. Inlined as
// strings (the converter's own `fixtures/` are package-internal and not an
// export) and chosen to exercise the documented reachable surface: Camp A
// single-handle, Camp B bounded ring, a table dashboard, inputs + control
// flow, a future-bar anchor (the bar-interval flow), the plot-family +
// pivot lowering (plotshape over ta.pivothigh/pivotlow), the namespace
// lowerings shipped by the `X-*` tasks (math.round_to_mintick, the str.*
// family, bgcolor/barcolor, the calendar/session helpers, multi-symbol
// request.security, and a `var array<float>` window → state.array), and a
// hard reject. The `for … in` over a handle collection stays a hard reject
// BY DESIGN, not pending work: `for … in` is unsupported at the parser level,
// and the unbounded handle set is Camp C — and per the mutable-drawing-handles
// RFC (`docs/rfcs/0001-mutable-drawing-handles.md`, the output of
// `tasks/future/X-drawing-handles`) the converter stays verification-only and
// Camp C remains a permanent reject ("chartlang's bounded determinism means an
// unbounded Pine handle set still has no faithful target"). The follow-up impl
// task only improves the already-converting BOUNDED Camp B case.

/** A selectable Pine sample. */
export type PineScript = Readonly<{
    id: string;
    label: string;
    description: string;
    source: string;
}>;

const CAMP_A_LINE = `//@version=6
indicator("Highest High Line", overlay = true)

// Camp A: one persistent line handle, re-anchored every bar. It marks the
// highest high of the last 100 bars, anchored AT the bar that made the high
// (ta.highestbars returns its bar offset) and extended to the current bar —
// the dynamic offset lowers to chartlang's bar.point(hbar, …), which the
// runtime resolves to that historical bar's real timestamp.
hh = ta.highest(high, 100)
hbar = ta.highestbars(high, 100)
var line trail = na
if barstate.isfirst
    trail := line.new(bar_index + hbar, hh, bar_index, hh, color = color.aqua, width = 2)
else
    line.set_xy1(trail, bar_index + hbar, hh)
    line.set_xy2(trail, bar_index, hh)
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

const PLOTSHAPE_PIVOTS = `//@version=6
indicator("Pivot Markers", overlay = true)

// The plot family + pivot lowering: \`plotshape\` becomes a chartlang shape-
// style \`plot\`, and \`ta.pivothigh\` / \`ta.pivotlow\` fold into
// \`ta.pivotsHighLow({ leftLength, rightLength }).high\` / \`.low\` (an
// informative ta-signature-divergence warning flags the field rename).
len = input.int(5, "Pivot lookback", minval = 1)

ph = ta.pivothigh(len, len)
pl = ta.pivotlow(len, len)

plot(ta.sma(close, 20), "SMA(20)", color = color.aqua)
plotshape(not na(ph), "Swing high", style = shape.triangledown, color = color.red, location = location.abovebar)
plotshape(not na(pl), "Swing low", style = shape.triangleup, color = color.green, location = location.belowbar)
`;

const MATH_ROUND_MINTICK = `//@version=6
indicator("Tick-Snapped Levels", overlay = true)

// math.* namespace: \`math.round_to_mintick\` snaps each band edge to the
// symbol's tick grid. The converter injects the explicit \`syminfo.mintick\`
// step, so \`math.round_to_mintick(x)\` lowers to
// \`math.roundToMintick(x, syminfo.mintick)\` (bare \`Math.*\` is unchanged).
band = input.float(1.5, "Band (%)", minval = 0.1)
frac = band / 100
resistance = math.round_to_mintick(close * (1 + frac))
support = math.round_to_mintick(close * (1 - frac))

hline(resistance, "Resistance", color = color.red)
hline(support, "Support", color = color.green)
plot((resistance + support) / 2, "Mid")
`;

const STR_FORMATTED_HUD = `//@version=6
indicator("Formatted HUD", overlay = true)

// str.* namespace: \`str.format\` / \`str.upper\` compose the header and
// \`str.tostring(x, "#.##")\` formats each price to a fixed-precision mask
// (host-independent, no locale). The string cells feed a draw.table.
var table hud = table.new(position.top_right, 2, 4, border_width = 1)
if barstate.islast
    table.cell(hud, 0, 0, str.format("{0} OHLC", str.upper(syminfo.ticker)), text_color = color.white)
    table.cell(hud, 0, 1, "Close", text_color = color.gray)
    table.cell(hud, 1, 1, str.tostring(close, "#.##"), text_color = color.white)
    table.cell(hud, 0, 2, "High", text_color = color.gray)
    table.cell(hud, 1, 2, str.tostring(high, "#.##"), text_color = color.green)
    table.cell(hud, 0, 3, "Low", text_color = color.gray)
    table.cell(hud, 1, 3, str.tostring(low, "#.##"), text_color = color.red)
`;

const BGCOLOR_BARCOLOR = `//@version=6
indicator("Bgcolor + Barcolor", overlay = true)

// The Pine-ergonomic \`bgcolor\` / \`barcolor\` emitters: each evaluates a
// per-bar color expression. The converter lowers them to chartlang's own
// \`bgcolor()\` / \`barcolor()\` holes (the same emission as the verbose
// \`plot(NaN, { style: { kind: "bg-color" | "bar-color" } })\`).
bgcolor(close > open ? color.green : color.red, transp = 80)
barcolor(close > open ? color.green : color.red)
`;

const CALENDAR_SESSION = `//@version=6
indicator("Calendar + Session", overlay = true)

// Calendar / session helpers: \`input.session\` surfaces a session-string
// input, and \`dayofweek\` / \`time()\` / \`time_close()\` lower to the
// chartlang \`time.*\` namespace (time.dayofweek, bar.time, time.timeClose).
sess = input.session("0930-1600", "Session")
dow = dayofweek(time)
openTime = time()
closeTime = time_close()
isWeekday = dow >= 2 and dow <= 6
plot(isWeekday ? close : na, "Weekday close", color = color.blue)
plot(openTime, "Bar open time")
plot(closeTime, "Bar close time")
plot(dow, "Day of week")
`;

const MULTI_SYMBOL_SECURITY = `//@version=6
indicator("Multi-Symbol Security", overlay = true)

// request.security with an EXPLICIT symbol: each foreign-symbol request
// lowers to \`request.security({ symbol, interval }).close\`. A
// \`syminfo.tickerid\` argument drops the symbol field (the chart's own
// symbol), so the two requests resolve to different feeds.
aapl = request.security("NASDAQ:AAPL", "D", close)
self = request.security(syminfo.tickerid, "D", close)
plot(aapl, "AAPL daily close", color = color.aqua)
plot(self, "Chart daily close", color = color.gray)
`;

const STATE_ARRAY_WINDOW = `//@version=6
indicator("Rolling Window Array", overlay = true)

// var array<float>: a 20-bar rolling window of closes folded into a chartlang
// \`state.array\` ring (the capacity is inferred from the size guard). The
// explicit FIFO shift becomes implicit. \`array.last\` reads the newest value;
// \`array.get(win, 0)\` reads the oldest still in the window — note the
// converter rewrites the index because state.array indexes from the NEWEST
// (n = 0), the opposite of Pine. Both are prices, so they overlay the candles.
var array<float> win = array.new<float>()
array.push(win, close)
if array.size(win) > 20
    array.shift(win)

newest = array.last(win)
oldest = array.get(win, 0)
plot(newest, "Newest close", color = color.aqua)
plot(oldest, "Close ~20 bars ago", color = color.orange, linewidth = 2)
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
        label: "Highest High Line",
        description:
            "A single persistent line handle anchored at the bar of the highest high over the last 100 bars (via ta.highestbars) and extended to the current bar — the dynamic offset lowers to chartlang's bar.point(hbar, …).",
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
        id: "plotshape-pivots",
        label: "Plot shapes + pivots",
        description:
            "plotshape over ta.pivothigh / ta.pivotlow — the plot-family + pivot lowering, with an SMA(20) line and triangle markers at each swing.",
        source: PLOTSHAPE_PIVOTS,
    },
    {
        id: "math-round-mintick",
        label: "math.* tick snapping",
        description:
            "math.round_to_mintick over a support/resistance band — the converter injects the explicit syminfo.mintick step (math.roundToMintick). Bare Math.* stays on Math.",
        source: MATH_ROUND_MINTICK,
    },
    {
        id: "str-formatted-hud",
        label: "str.* formatted HUD",
        description:
            "str.format / str.upper / str.tostring(x, \"#.##\") building a draw.table HUD — fixed-precision, locale-free string formatting feeding table cells.",
        source: STR_FORMATTED_HUD,
    },
    {
        id: "bgcolor-barcolor",
        label: "bgcolor + barcolor",
        description:
            "The Pine-ergonomic bgcolor / barcolor emitters with a per-bar color expression, lowered to chartlang's bgcolor() / barcolor() holes.",
        source: BGCOLOR_BARCOLOR,
    },
    {
        id: "calendar-session",
        label: "Calendar + session",
        description:
            "input.session plus dayofweek / time() / time_close() — the calendar/session helpers lowering to the chartlang time.* namespace.",
        source: CALENDAR_SESSION,
    },
    {
        id: "multi-symbol-security",
        label: "Multi-symbol security",
        description:
            "request.security with an explicit foreign symbol (NASDAQ:AAPL) plus a syminfo.tickerid self-request — lowered to request.security({ symbol, interval }).close.",
        source: MULTI_SYMBOL_SECURITY,
    },
    {
        id: "state-array-window",
        label: "var array<float> window",
        description:
            "A 20-bar var array<float> rolling window folded into a chartlang state.array ring — array.push / array.last / array.get with implicit FIFO eviction. Plots the newest vs. the oldest close in the window (both prices, so they overlay the candles).",
        source: STATE_ARRAY_WINDOW,
    },
    {
        id: "reject-for-in",
        label: "Hard reject (for…in)",
        description:
            "A for…in loop over a handle collection — refused with a structured diagnostic, not wrong output.",
        source: REJECT_FOR_IN,
    },
];
