// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Sample Pine Script v6 sources for the converter playground. Inlined as
// strings (the converter's own `fixtures/` are package-internal and not an
// export) and grouped into categories so the "Browse examples" dialog can
// show a sidebar of sections (mirroring the live demo's ExampleBrowser).
// The set is curated from the converter's golden-tested fixture corpus so
// every entry converts deterministically with the diagnostics shown:
//
//   • TA indicators   — the classic TradingView indicators (EMA cross,
//                        MACD, Bollinger, Keltner, ATR, RSI, nested ta.*).
//   • Drawings        — Camp A single handles (line/label/box), the Camp B
//                        bounded ring, polylines, plot fills, tables, and a
//                        real-world support/resistance script.
//   • Inputs          — input.int/source/string(enum)/timeframe/bool plus
//                        plot display toggles and an if/else.
//   • State & coll.   — var array<float> windows, array reductions, a
//                        float→float map, and var bool/string slots.
//   • Multi-symbol    — request.security with explicit symbols and tuple
//                        (OHLCV / expression) forms.
//   • Colors          — color.rgb / color.new transparency + dynamic bases.
//   • Namespaces/lang — math.* / str.* / time.* helpers, bgcolor/barcolor,
//                        switch multi-assign, and a pure user function.
//   • Rejections      — intentional hard rejects (for…in over a handle
//                        collection, an unbounded Camp C set, a recursive
//                        UDF) that surface a structured diagnostic instead
//                        of emitting wrong output.
//
// `for … in` and the unbounded Camp C handle set stay hard rejects BY
// DESIGN, not pending work (per the mutable-drawing-handles RFC,
// `docs/rfcs/0001-mutable-drawing-handles.md`): chartlang's bounded
// determinism means an unbounded Pine handle set has no faithful target.

/** The category a sample belongs to — drives the browser dialog sidebar. */
export type PineCategory =
    | "ta"
    | "drawings"
    | "inputs"
    | "state"
    | "multi-symbol"
    | "colors"
    | "language"
    | "rejects";

/** Human labels for each category, shown as the sidebar section name. */
export const CATEGORY_LABELS: Record<PineCategory, string> = {
    ta: "TA indicators",
    drawings: "Drawings",
    inputs: "Inputs",
    state: "State & collections",
    "multi-symbol": "Multi-symbol",
    colors: "Colors",
    language: "Namespaces & language",
    rejects: "Rejections",
};

/** Sidebar order — TA indicators first, intentional rejects last. */
export const CATEGORY_ORDER: ReadonlyArray<PineCategory> = [
    "ta",
    "drawings",
    "inputs",
    "state",
    "multi-symbol",
    "colors",
    "language",
    "rejects",
];

/** A selectable Pine sample. */
export type PineScript = Readonly<{
    id: string;
    label: string;
    description: string;
    category: PineCategory;
    source: string;
}>;

// ── TA indicators ──────────────────────────────────────────────────────

const EMA_CROSS = `//@version=6
indicator("EMA cross", overlay=true)

// The canonical fast/slow EMA cross: two ta.ema lines plus a plotshape
// triangle at each ta.crossover (lowered to a chartlang shape-style plot).
fast = ta.ema(close, 12)
slow = ta.ema(close, 26)
plot(fast, "Fast", color=color.green)
plot(slow, "Slow", color=color.red)
plotshape(ta.crossover(fast, slow), style=shape.triangleup, color=color.green)
`;

const MACD = `//@version=6
indicator("MACD", overlay=false)

// Multi-return TA: the [macd, signal, hist] tuple destructure lowers to a
// single ta.macd(...) result object whose fields feed three pane plots.
fast = input.int(12, "Fast")
slow = input.int(26, "Slow")
sig = input.int(9, "Signal")
[macdLine, signalLine, histLine] = ta.macd(close, fast, slow, sig)
plot(macdLine, "MACD", color=color.blue)
plot(signalLine, "Signal", color=color.orange)
plot(histLine, "Histogram", color=color.gray)
`;

const BOLLINGER_BANDS = `//@version=6
indicator("Bollinger Bands", overlay=true)

// ta.bb destructured into basis / upper / lower — the three-field result
// object overlaid on price with the input length + stddev multiplier.
length = input.int(20, "Length")
mult = input.float(2.0, "StdDev")
[middle, upper, lower] = ta.bb(close, length, mult)
plot(middle, "Basis", color=color.orange)
plot(upper, "Upper", color=color.blue)
plot(lower, "Lower", color=color.blue)
`;

const KELTNER = `//@version=6
indicator("Keltner Channels", overlay=true)

// ta.kc (Keltner) destructured into mid / upper / lower. Pine's optional
// fourth arg has no chartlang analogue, so a multi-return-arg-dropped info
// flags it — the three core bands convert cleanly.
[kcMid, kcUpper, kcLower] = ta.kc(close, 20, 2)
plot(kcMid, "Middle", color=color.gray)
plot(kcUpper, "Upper", color=color.teal)
plot(kcLower, "Lower", color=color.teal)
`;

const ATR_PANE = `//@version=6
indicator("ATR", overlay=false)

// A single-output ta.atr in its own pane (overlay=false) driven by an
// input length — the simplest "indicator in a sub-pane" shape.
length = input.int(14, "ATR Length")
a = ta.atr(length)
plot(a, "ATR", color=color.red)
`;

const RSI_BANDS = `//@version=6
indicator("RSI", overlay=false)

// ta.rsi with static overbought / oversold hlines — the classic momentum
// oscillator with its 70 / 30 reference levels.
length = input.int(14, "Length")
r = ta.rsi(close, length)
plot(r, "RSI", color=color.purple)
hline(70, "Overbought", color=color.gray)
hline(30, "Oversold", color=color.gray)
`;

const NESTED_TA_ARITH = `//@version=6
indicator("Nested ta arithmetic", overlay=false)

// ta.* calls inside arithmetic, ternaries, and as arguments to other ta.*
// calls. Each nested call is hoisted to its own slot (a nested-ta-lowered
// info notes the rewrite) so the result stays per-bar correct.
scale = input.float(0.1, "Scale", step=0.02)
r = ta.rsi(close, 14) * scale
w = ta.wma((high + low) / 2, 5) * 2 + 1
s = close > open ? ta.ema(close, 8) : ta.sma(close, 8)
y = ta.sma(ta.atr(14), 5)
plot(r)
plot(w)
plot(s)
plot(y)
`;

// ── Drawings ───────────────────────────────────────────────────────────

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

const CAMP_A_LABEL = `//@version=6
indicator("Camp A label", overlay=true)

// A single label handle created on the last bar and re-textualised — the
// Camp A pattern for a label.new (a drawing-only-script info flags that the
// script renders no plot series).
var label lbl = na
if barstate.islast
    lbl := label.new(bar_index, high, "Top", style=label.style_label_down, color=color.blue)
    label.set_text(lbl, "High here")
`;

const CAMP_A_BOX = `//@version=6
indicator("Camp A box", overlay=true)

// A single box handle (box.new → draw.rectangle) on the last bar, with
// set_top / set_bottom / set_bgcolor setters. Pine's set_bgcolor over a
// box has no per-side chartlang setter, so a set-path-unsupported info
// flags each of those calls — the box geometry converts cleanly.
var box bx = na
if barstate.islast
    bx := box.new(bar_index, high, bar_index, low, border_color=color.green)
    box.set_top(bx, high * 1.01)
    box.set_bottom(bx, low * 0.99)
    box.set_bgcolor(bx, color.new(color.green, 80))
`;

const POLYLINE_LITERAL = `//@version=6
indicator("Polyline curve", overlay=true)

// A literal-list polyline: chart.point values pushed into a local array and
// drawn once on the last bar (polyline.new → draw.polyline, curved=true).
// A bounded literal point list is convertible; a DYNAMIC point list is not.
var pts = array.new<chart.point>()
if barstate.islast
    array.push(pts, chart.point.from_index(bar_index, low))
    array.push(pts, chart.point.from_index(bar_index, high))
    array.push(pts, chart.point.from_index(bar_index, close))
    polyline.new(pts, curved=true, line_color=color.purple)
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

const FILL_PLOT_BAND = `//@version=6
indicator("Series Band", overlay=true)

// fill() between two plot handles — the high/low envelope shaded with a
// translucent fill. Pine's color transparency has no exact chartlang RGBA
// match, so a color-transp-approximated info notes the nearest fill alpha.
upper = plot(high)
lower = plot(low)
fill(upper, lower, color=color.new(color.blue, 80))
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

const REAL_WORLD_SR = `//@version=6
indicator("Support / Resistance", overlay=true, max_lines_count=20)

// A real-world script: pivot-high/low levels pushed into a bounded line ring
// (FIFO eviction), a last-bar label, and a stats table — composing inputs,
// ta.pivothigh/pivotlow (a ta-signature-divergence note flags the field
// rename), a Camp B ring, and a draw.table in one indicator.
lookback = input.int(5, "Pivot lookback")
showTable = input.bool(true, "Show dashboard")
lineColor = input.color(#FF9800, "Level color")

var levels = array.new_line()
var label lastLbl = na
var table stats = na

ph = ta.pivothigh(lookback, lookback)
pl = ta.pivotlow(lookback, lookback)

if not na(ph)
    array.push(levels, line.new(bar_index, ph, bar_index, ph, color=lineColor, width=2))
if not na(pl)
    array.push(levels, line.new(bar_index, pl, bar_index, pl, color=lineColor, width=2))
if array.size(levels) > 20
    line.delete(array.shift(levels))

if barstate.islast
    lastLbl := label.new(bar_index, close, "Last close", style=label.style_label_left)
    label.set_text(lastLbl, "Close " + str.tostring(close))
    stats := table.new(position.top_right, 2, 2)
    table.cell(stats, 0, 0, "Levels")
    table.cell(stats, 1, 0, str.tostring(array.size(levels)))
    table.cell(stats, 0, 1, "Last close")
    table.cell(stats, 1, 1, str.tostring(close))
`;

// ── Inputs ─────────────────────────────────────────────────────────────

const INPUTS_CONTROL_FLOW = `//@version=6
indicator("Basis Line", overlay = true)

// input.int / input.source plus an if/else, showing the surfaced inputs.
len = input.int(20, "Length", minval = 1)
src = input.source(close, "Source")

basis = ta.sma(src, len)
var line mid = na
if barstate.isfirst
    mid := line.new(bar_index, basis, bar_index, basis, color = color.orange, width = 2)
else
    line.set_xy2(mid, bar_index, basis)
`;

const INPUT_STRING_ENUM = `//@version=6
indicator("MA Type Select", overlay=true)

// input.string with an options list lowers to a chartlang input.enum. The
// "Mismatch" input's default isn't in its own options, so an
// input-string-options-default-mismatch info flags that.
ma_type = input.string("EMA", "MA Type", options = ["SMA", "EMA"])
preset = input.string("Fast", options = ["Fast", "Slow"])
mismatch = input.string("Mid", "Mismatch", options = ["Low", "High"])
src = ma_type == "EMA" ? close : open
plot(preset == "Fast" ? src : close)
plot(mismatch == "Low" ? high : low)
`;

const INPUT_TIMEFRAME = `//@version=6
indicator("Timeframe input", overlay=true)

// input.timeframe surfaces a resolution string input (lowered to a
// chartlang interval input).
tf = input.timeframe("60", "Resolution")
plot(close)
`;

const PLOT_DISPLAY_TOGGLE = `//@version=6
indicator("Plot display toggle", overlay=true)

// Pine's plot display = ... argument (display.all / .none / .data_window,
// optionally toggled by a bool input). chartlang has a coarser visibility
// model, so a plot-display-approximated warning notes the nearest mapping.
show = input.bool(true)
hide = input.bool(false)
plot(ta.sma(close, 20), display = show ? display.all : display.none)
plot(ta.ema(close, 20), display = hide ? display.none : display.all)
plot(close, display = display.none)
plot(open, display = display.all)
plot(volume, display = display.data_window)
`;

// ── State & collections ────────────────────────────────────────────────

const STATE_ARRAY_WINDOW = `//@version=6
indicator("Rolling Window Array", overlay = true)

// var array<float>: a 20-bar rolling window of closes folded into a chartlang
// state.array ring (the capacity is inferred from the size guard). The
// explicit FIFO shift becomes implicit. array.last reads the newest value;
// array.get(win, 0) reads the oldest still in the window — note the
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

const ARRAY_REDUCTIONS = `//@version=6
indicator("Array reductions", overlay=true)

// A 20-bar state.array ring fed through the full reduction surface:
// avg / sum / stdev / variance / median / range / percentile / max-min /
// includes / indexof. array.sort returns a sorted COPY in chartlang (an
// array-sort-returns-copy info flags the non-mutating semantics).
var array<float> win = array.new<float>()
array.push(win, close)
if array.size(win) > 20
    array.shift(win)
array.sort(win, order.descending)
plot(array.avg(win))
plot(array.sum(win))
plot(array.stdev(win))
plot(array.variance(win))
plot(array.median(win))
plot(array.range(win))
plot(array.percentile_linear_interpolation(win, 90))
plot(array.max(win) - array.min(win))
plot(array.includes(win, close) ? 1 : 0)
plot(array.indexof(win, close))
`;

const MAP_VOLUME_BY_LEVEL = `//@version=6
indicator("Volume by level", overlay=true)

// A float→float map accumulating volume by rounded price level
// (map.new / map.get / map.put → chartlang state.map slot methods). Pine
// maps are unbounded, so a map-capacity-synthesized info notes the
// inferred chartlang capacity.
var map<float, float> levels = map.new<float, float>()
key = math.round(close)
prior = map.get(levels, key)
map.put(levels, key, (na(prior) ? 0 : prior) + volume)
plot(map.get(levels, key))
plot(map.size(levels))
`;

const VAR_BOOL_HISTORY = `//@version=6
indicator("Var Bool History")

// A var bool slot read at history offsets ([1], [2]). chartlang series
// history is numeric, so a history-on-non-series warning notes that the
// boolean history is approximated per access.
var bool active = false
active := close > open
wasActive = active[1]
wasActive2 = active[2]
plot(wasActive and not wasActive2 ? 1 : 0, "JustActivated")
`;

const VAR_STRING_HISTORY = `//@version=6
indicator("Var String History")

// A var string slot read at a history offset ([1]) — the converter keeps a
// scalar state.string and warns (history-on-non-series) that string history
// has no exact chartlang series form.
var string phase = "-"
phase := close > open ? "up" : "down"
prevPhase = phase[1]
plot(prevPhase == "up" ? 1 : 0, "PrevUp")
`;

// ── Multi-symbol ───────────────────────────────────────────────────────

const MULTI_SYMBOL_SECURITY = `//@version=6
indicator("Multi-Symbol Security", overlay = true)

// request.security with an EXPLICIT symbol: each foreign-symbol request
// lowers to request.security({ symbol, interval }).close. A
// syminfo.tickerid argument drops the symbol field (the chart's own
// symbol), so the two requests resolve to different feeds.
aapl = request.security("NASDAQ:AAPL", "D", close)
self = request.security(syminfo.tickerid, "D", close)
plot(aapl, "AAPL daily close", color = color.aqua)
plot(self, "Chart daily close", color = color.gray)
`;

const SECURITY_TUPLE_OHLCV = `//@version=6
indicator("Tuple security OHLCV", overlay=true)

// request.security with a TUPLE expression: [high, low] from the chart's own
// symbol at the daily timeframe, destructured into two series, one of which
// then feeds a local ta.sma.
[src_hi, src_lo] = request.security(syminfo.tickerid, "D", [high, low])
plot(src_hi)
plot(src_lo)
plot(ta.sma(src_hi, 5))
`;

const SECURITY_TUPLE_EXPR = `//@version=6
indicator("Tuple security expr", overlay=true)

// A tuple request from a DIFFERENT symbol (NASDAQ:QQQ, weekly) whose third
// element is itself a ta.sma expression evaluated on the foreign feed. The
// discarded middle element uses Pine's _ placeholder. A
// request-security-different-symbol info notes the cross-symbol request.
[wk_hi, _, wk_trend] = request.security("NASDAQ:QQQ", "W", [high, low, ta.sma(close, 20)])
plot(wk_hi)
plot(wk_trend)
`;

// ── Colors ─────────────────────────────────────────────────────────────

const COLOR_RGB_TRANSP = `//@version=6
indicator("Color Literal Transp", overlay=true)

// color.rgb(...) with an alpha and color.new(base, transp) — Pine's 0–100
// transparency scale is approximated to chartlang's RGBA alpha (a
// color-transp-approximated info flags each conversion).
plot(close, "MA", color=color.rgb(255, 153, 0, 60))
hline(0.0, "Zero", color=color.new(color.white, 50))
`;

const COLOR_DYNAMIC_BASE = `//@version=6
indicator("Color Dynamic Base", overlay=true)

// A per-bar dynamic color: a ternary picks the base color, then
// color.new(base, transp) applies transparency over the runtime value. The
// color.rgb form also takes a per-bar channel expression.
trendCol = close > open ? color.green : color.red
plot(close, "Trend", color=color.new(trendCol, 50))
plot(open, "RGB", color=color.rgb(close > open ? 0 : 255, 153, 0))
`;

// ── Namespaces & language ──────────────────────────────────────────────

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

const SWITCH_MULTI_ASSIGN = `//@version=6
indicator("Preset selector", overlay=false)

// A switch STATEMENT whose arms assign multiple var slots at once
// ("X" => a := 8, b := 21). chartlang lowers the switch to if/else-if and
// the comma-assign to sequential assignments.
var int a = na
var int b = na
sel = input.string("X", "Preset")
switch sel
    "X" => a := 8, b := 21
    "Y" => a := 4, b := 10
plot(a)
plot(b)
`;

const UDF_PURE_LIMIT = `//@version=6
indicator("UDF pure limit", overlay=false)

// A pure user-defined function (no series state) called with two different
// argument sets — emitted as a real chartlang function (a udf-emitted-function
// info notes it), not inlined per call site.
cf_limit(input_val, upper_limit, lower_limit) => math.max(math.min(input_val, upper_limit), lower_limit)
clamped_close = cf_limit(close, 100, 0)
clamped_open = cf_limit(open, 50, 10)
plot(clamped_close)
plot(clamped_open)
`;

// ── Rejections (intentional hard rejects) ──────────────────────────────

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

const REJECT_UNBOUNDED = `//@version=6
indicator("Camp C unbounded", overlay=true)

// Hard reject (Camp C): a line collection pushed to on every up-bar with NO
// size cap. An unbounded Pine handle set has no faithful bounded-determinism
// target, so the converter refuses it with an unbounded-handle-collection
// error rather than guessing a cap.
if barstate.isfirst
    var lvls = array.new_line()
if close > open
    array.push(lvls, line.new(bar_index, high, bar_index, high))
`;

const REJECT_RECURSIVE_UDF = `//@version=6
indicator("UDF recursive rejected", overlay=false)

// Hard reject: a self-referential user function. chartlang has no recursive
// UDF form, so the converter refuses it with a udf-recursive-rejected error
// (and suggests an iterative rewrite) instead of emitting non-terminating
// output.
cf_countdown(n) => n <= 0 ? 0 : cf_countdown(n - 1)
steps = cf_countdown(5)
plot(steps)
`;

export const PINE_SCRIPTS: ReadonlyArray<PineScript> = [
    // ── TA indicators ──
    {
        id: "ema-cross",
        label: "EMA cross",
        description:
            "The canonical fast/slow EMA cross with a plotshape triangle at each ta.crossover — two ta.ema lines plus a shape-style plot.",
        category: "ta",
        source: EMA_CROSS,
    },
    {
        id: "macd",
        label: "MACD (tuple destructure)",
        description:
            "A [macd, signal, hist] tuple destructure lowered to one ta.macd(...) result object, with three input-driven pane plots.",
        category: "ta",
        source: MACD,
    },
    {
        id: "bollinger-bands",
        label: "Bollinger Bands",
        description:
            "ta.bb destructured into basis / upper / lower and overlaid on price, driven by an input length and stddev multiplier.",
        category: "ta",
        source: BOLLINGER_BANDS,
    },
    {
        id: "keltner",
        label: "Keltner Channels",
        description:
            "ta.kc destructured into mid / upper / lower — Pine's extra arg has no chartlang analogue (a multi-return-arg-dropped info flags it).",
        category: "ta",
        source: KELTNER,
    },
    {
        id: "atr-pane",
        label: "ATR (pane)",
        description:
            "A single-output ta.atr in its own sub-pane (overlay=false), driven by an input length — the simplest indicator-in-a-pane shape.",
        category: "ta",
        source: ATR_PANE,
    },
    {
        id: "rsi-bands",
        label: "RSI + bands",
        description:
            "ta.rsi with static 70 / 30 overbought / oversold hlines — the classic momentum oscillator with its reference levels.",
        category: "ta",
        source: RSI_BANDS,
    },
    {
        id: "nested-ta-arith",
        label: "Nested ta.* arithmetic",
        description:
            "ta.* calls inside arithmetic, ternaries, and as arguments to other ta.* calls — each nested call hoisted to its own slot (a nested-ta-lowered info notes the rewrite).",
        category: "ta",
        source: NESTED_TA_ARITH,
    },
    // ── Drawings ──
    {
        id: "camp-a-line",
        label: "Highest High Line",
        description:
            "A single persistent line handle anchored at the bar of the highest high over the last 100 bars (via ta.highestbars) and extended to the current bar — the dynamic offset lowers to chartlang's bar.point(hbar, …).",
        category: "drawings",
        source: CAMP_A_LINE,
    },
    {
        id: "camp-a-label",
        label: "Label handle",
        description:
            "A single label.new handle created on the last bar and re-textualised — the Camp A pattern for a label (a drawing-only-script info notes there is no plot series).",
        category: "drawings",
        source: CAMP_A_LABEL,
    },
    {
        id: "camp-a-box",
        label: "Box handle",
        description:
            "A single box.new (→ draw.rectangle) handle with set_top / set_bottom / set_bgcolor — the box geometry converts cleanly; set_bgcolor has no chartlang setter (a set-path-unsupported info flags it).",
        category: "drawings",
        source: CAMP_A_BOX,
    },
    {
        id: "polyline-literal",
        label: "Polyline curve",
        description:
            "A literal-list polyline: chart.point values pushed into a local array and drawn once (polyline.new → draw.polyline, curved). A bounded literal point list is convertible.",
        category: "drawings",
        source: POLYLINE_LITERAL,
    },
    {
        id: "camp-b-pivots",
        label: "Pivot ring (Camp B)",
        description:
            "A bounded array of lines with FIFO eviction, folded into a chartlang ring buffer.",
        category: "drawings",
        source: CAMP_B_PIVOTS,
    },
    {
        id: "fill-plot-band",
        label: "Fill between plots",
        description:
            "fill() between two plot handles — a translucent high/low envelope. Pine's transparency is approximated to chartlang's RGBA alpha (a color-transp-approximated info notes it).",
        category: "drawings",
        source: FILL_PLOT_BAND,
    },
    {
        id: "table-dashboard",
        label: "Table dashboard",
        description: "A table handle rebuilt on the last bar — lowered to draw.table cells.",
        category: "drawings",
        source: TABLE_DASHBOARD,
    },
    {
        id: "future-bar",
        label: "Future-bar projection",
        description:
            "A bar_index + N future anchor — needs a bar interval (ms) to resolve. Try the control.",
        category: "drawings",
        source: FUTURE_BAR,
    },
    {
        id: "real-world-sr",
        label: "Support / Resistance (real-world)",
        description:
            "A real-world script composing inputs, ta.pivothigh/pivotlow (a ta-signature-divergence note flags the field rename), a Camp B line ring with FIFO eviction, a last-bar label, and a stats draw.table.",
        category: "drawings",
        source: REAL_WORLD_SR,
    },
    // ── Inputs ──
    {
        id: "inputs-control-flow",
        label: "Inputs + control flow",
        description:
            "input.int / input.source plus an if/else, showing the surfaced inputs in the manifest.",
        category: "inputs",
        source: INPUTS_CONTROL_FLOW,
    },
    {
        id: "input-string-enum",
        label: "input.string → enum",
        description:
            "input.string with an options list lowered to a chartlang input.enum — one input's default isn't in its own options (an input-string-options-default-mismatch info flags it).",
        category: "inputs",
        source: INPUT_STRING_ENUM,
    },
    {
        id: "input-timeframe",
        label: "input.timeframe",
        description:
            "input.timeframe surfaces a resolution-string input, lowered to a chartlang interval input.",
        category: "inputs",
        source: INPUT_TIMEFRAME,
    },
    {
        id: "plot-display-toggle",
        label: "Plot display toggle",
        description:
            "Pine's plot display = display.all / .none / .data_window argument (optionally toggled by a bool input) — chartlang's coarser visibility model is the nearest mapping (a plot-display-approximated warning notes it).",
        category: "inputs",
        source: PLOT_DISPLAY_TOGGLE,
    },
    // ── State & collections ──
    {
        id: "state-array-window",
        label: "var array<float> window",
        description:
            "A 20-bar var array<float> rolling window folded into a chartlang state.array ring — array.push / array.last / array.get with implicit FIFO eviction. Plots the newest vs. the oldest close in the window (both prices, so they overlay the candles).",
        category: "state",
        source: STATE_ARRAY_WINDOW,
    },
    {
        id: "array-reductions",
        label: "Array reductions",
        description:
            "A 20-bar state.array ring fed through the full reduction surface — avg / sum / stdev / variance / median / range / percentile / includes / indexof (array.sort returns a sorted copy; an info flags the non-mutating semantics).",
        category: "state",
        source: ARRAY_REDUCTIONS,
    },
    {
        id: "map-volume-by-level",
        label: "Map: volume by level",
        description:
            "A float→float map accumulating volume by rounded price level (map.new / get / put → state.map slot methods). Unbounded Pine maps get a synthesized chartlang capacity (an info notes it).",
        category: "state",
        source: MAP_VOLUME_BY_LEVEL,
    },
    {
        id: "var-bool-history",
        label: "var bool slot",
        description:
            "A var bool slot read at history offsets ([1], [2]) — chartlang series history is numeric, so a history-on-non-series warning notes the boolean history is approximated per access.",
        category: "state",
        source: VAR_BOOL_HISTORY,
    },
    {
        id: "var-string-history",
        label: "var string slot",
        description:
            "A var string slot read at a history offset ([1]) — kept as a scalar state.string with a history-on-non-series warning (string history has no exact chartlang series form).",
        category: "state",
        source: VAR_STRING_HISTORY,
    },
    // ── Multi-symbol ──
    {
        id: "multi-symbol-security",
        label: "Multi-symbol security",
        description:
            "request.security with an explicit foreign symbol (NASDAQ:AAPL) plus a syminfo.tickerid self-request — lowered to request.security({ symbol, interval }).close.",
        category: "multi-symbol",
        source: MULTI_SYMBOL_SECURITY,
    },
    {
        id: "security-tuple-ohlcv",
        label: "Security tuple (OHLCV)",
        description:
            "request.security with a [high, low] tuple from the chart's own symbol at the daily timeframe, destructured into two series — one of which then feeds a local ta.sma.",
        category: "multi-symbol",
        source: SECURITY_TUPLE_OHLCV,
    },
    {
        id: "security-tuple-expr",
        label: "Security tuple (expr)",
        description:
            "A tuple request from a different symbol (NASDAQ:QQQ, weekly) whose third element is a ta.sma evaluated on the foreign feed, with Pine's _ placeholder discarding the middle element (a request-security-different-symbol info notes the cross-symbol request).",
        category: "multi-symbol",
        source: SECURITY_TUPLE_EXPR,
    },
    // ── Colors ──
    {
        id: "color-rgb-transp",
        label: "color.rgb + transparency",
        description:
            "color.rgb(...) with an alpha and color.new(base, transp) — Pine's 0–100 transparency scale approximated to chartlang's RGBA alpha (a color-transp-approximated info flags each conversion).",
        category: "colors",
        source: COLOR_RGB_TRANSP,
    },
    {
        id: "color-dynamic-base",
        label: "Dynamic color base",
        description:
            "A per-bar dynamic color: a ternary picks the base color, then color.new(base, transp) applies transparency; the color.rgb form also takes a per-bar channel expression.",
        category: "colors",
        source: COLOR_DYNAMIC_BASE,
    },
    // ── Namespaces & language ──
    {
        id: "math-round-mintick",
        label: "math.* tick snapping",
        description:
            "math.round_to_mintick over a support/resistance band — the converter injects the explicit syminfo.mintick step (math.roundToMintick). Bare Math.* stays on Math.",
        category: "language",
        source: MATH_ROUND_MINTICK,
    },
    {
        id: "str-formatted-hud",
        label: "str.* formatted HUD",
        description:
            "str.format / str.upper / str.tostring(x, \"#.##\") building a draw.table HUD — fixed-precision, locale-free string formatting feeding table cells.",
        category: "language",
        source: STR_FORMATTED_HUD,
    },
    {
        id: "bgcolor-barcolor",
        label: "bgcolor + barcolor",
        description:
            "The Pine-ergonomic bgcolor / barcolor emitters with a per-bar color expression, lowered to chartlang's bgcolor() / barcolor() holes.",
        category: "language",
        source: BGCOLOR_BARCOLOR,
    },
    {
        id: "calendar-session",
        label: "Calendar + session",
        description:
            "input.session plus dayofweek / time() / time_close() — the calendar/session helpers lowering to the chartlang time.* namespace.",
        category: "language",
        source: CALENDAR_SESSION,
    },
    {
        id: "switch-multi-assign",
        label: "switch → multi-assign",
        description:
            "A switch statement whose arms assign multiple var slots at once — lowered to if/else-if with sequential assignments.",
        category: "language",
        source: SWITCH_MULTI_ASSIGN,
    },
    {
        id: "udf-pure-limit",
        label: "Pure user function",
        description:
            "A pure user-defined function (no series state) called with two argument sets — emitted as a real chartlang function (a udf-emitted-function info notes it), not inlined per call site.",
        category: "language",
        source: UDF_PURE_LIMIT,
    },
    // ── Rejections ──
    {
        id: "reject-for-in",
        label: "for…in over handles",
        description:
            "A for…in loop over a handle collection — refused with a structured diagnostic, not wrong output.",
        category: "rejects",
        source: REJECT_FOR_IN,
    },
    {
        id: "reject-unbounded",
        label: "Unbounded handle set",
        description:
            "A Camp C line collection pushed to with no size cap — refused with an unbounded-handle-collection error rather than guessing a cap (bounded determinism has no faithful target).",
        category: "rejects",
        source: REJECT_UNBOUNDED,
    },
    {
        id: "reject-recursive-udf",
        label: "Recursive user function",
        description:
            "A self-referential user function — refused with a udf-recursive-rejected error (with an iterative-rewrite suggestion), since chartlang has no recursive UDF form.",
        category: "rejects",
        source: REJECT_RECURSIVE_UDF,
    },
];
