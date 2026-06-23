// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Per-entry shape of {@link STATEFUL_PRIMITIVES}. `name` is the
 * fully-qualified call (`ta.ema`, `plot`, `hline`, `alert`); `slot`
 * is `true` for every primitive whose call site needs a compiler-
 * injected slot id, `false` for the stateless helpers that ride along
 * in the set for in-loop diagnostics (currently only `ta.nz`).
 *
 * @since 0.1
 * @stable
 * @example
 *     const entry: StatefulPrimitiveEntry = { name: "ta.nz", slot: false };
 */
export type StatefulPrimitiveEntry = Readonly<{ name: string; slot: boolean }>;

const STATEFUL_PRIMITIVE_ENTRIES: ReadonlyArray<StatefulPrimitiveEntry> = [
    { name: "ta.sma", slot: true },
    { name: "ta.ema", slot: true },
    { name: "ta.stdev", slot: true },
    { name: "ta.bb", slot: true },
    { name: "ta.rsi", slot: true },
    { name: "ta.macd", slot: true },
    { name: "ta.atr", slot: true },
    { name: "ta.crossover", slot: true },
    { name: "ta.crossunder", slot: true },
    { name: "ta.highest", slot: true },
    { name: "ta.lowest", slot: true },
    { name: "ta.highestbars", slot: true },
    { name: "ta.lowestbars", slot: true },
    { name: "ta.change", slot: true },
    { name: "ta.valuewhen", slot: true },
    { name: "ta.barssince", slot: true },
    { name: "ta.wma", slot: true },
    { name: "ta.vwma", slot: true },
    { name: "ta.hma", slot: true },
    { name: "ta.smma", slot: true },
    { name: "ta.dema", slot: true },
    { name: "ta.tema", slot: true },
    { name: "ta.kama", slot: true },
    { name: "ta.alma", slot: true },
    { name: "ta.lsma", slot: true },
    { name: "ta.mcginley", slot: true },
    { name: "ta.maRibbon", slot: true },
    { name: "ta.cci", slot: true },
    { name: "ta.stoch", slot: true },
    { name: "ta.williamsR", slot: true },
    { name: "ta.stochRsi", slot: true },
    { name: "ta.ultimateOsc", slot: true },
    { name: "ta.coppock", slot: true },
    { name: "ta.ppo", slot: true },
    { name: "ta.dpo", slot: true },
    { name: "ta.connorsRsi", slot: true },
    { name: "ta.kst", slot: true },
    { name: "ta.fisher", slot: true },
    { name: "ta.klinger", slot: true },
    { name: "ta.rvgi", slot: true },
    { name: "ta.ao", slot: true },
    { name: "ta.cmo", slot: true },
    { name: "ta.momentum", slot: true },
    { name: "ta.roc", slot: true },
    { name: "ta.pmo", slot: true },
    { name: "ta.smi", slot: true },
    { name: "ta.tsi", slot: true },
    { name: "ta.aroon", slot: true },
    { name: "ta.aroonOsc", slot: true },
    { name: "ta.adx", slot: true },
    { name: "ta.dmi", slot: true },
    { name: "ta.trix", slot: true },
    { name: "ta.vortex", slot: true },
    { name: "ta.trendStrengthIndex", slot: true },
    { name: "ta.ichimoku", slot: true },
    { name: "ta.vol", slot: true },
    { name: "ta.vwap", slot: true },
    { name: "ta.anchoredVwap", slot: true },
    { name: "ta.obv", slot: true },
    { name: "ta.adl", slot: true },
    { name: "ta.bop", slot: true },
    { name: "ta.cmf", slot: true },
    { name: "ta.chaikinOsc", slot: true },
    { name: "ta.mfi", slot: true },
    { name: "ta.netVolume", slot: true },
    { name: "ta.pvo", slot: true },
    { name: "ta.pvt", slot: true },
    { name: "ta.eom", slot: true },
    { name: "ta.nvi", slot: true },
    { name: "ta.pvi", slot: true },
    { name: "ta.visibleRangeVolumeProfile", slot: true },
    { name: "ta.anchoredVolumeProfile", slot: true },
    { name: "ta.sessionVolumeProfile", slot: true },
    { name: "ta.fixedRangeVolumeProfile", slot: true },
    { name: "ta.median", slot: true },
    { name: "ta.adr", slot: true },
    { name: "ta.ulcerIndex", slot: true },
    { name: "ta.bbPercentB", slot: true },
    { name: "ta.bbw", slot: true },
    { name: "ta.donchian", slot: true },
    { name: "ta.keltner", slot: true },
    { name: "ta.envelope", slot: true },
    { name: "ta.chop", slot: true },
    { name: "ta.historicalVolatility", slot: true },
    { name: "ta.rvi", slot: true },
    { name: "ta.massIndex", slot: true },
    { name: "ta.psar", slot: true },
    { name: "ta.supertrend", slot: true },
    { name: "ta.chandelier", slot: true },
    { name: "ta.chandeKrollStop", slot: true },
    { name: "ta.williamsFractal", slot: true },
    { name: "ta.zigZag", slot: true },
    { name: "ta.pivotsHighLow", slot: true },
    { name: "ta.pivotsStandard", slot: true },
    { name: "ta.volatilityStop", slot: true },
    { name: "ta.nz", slot: false },
    { name: "plot", slot: true },
    { name: "hline", slot: true },
    // Pine-ergonomic aliases lowering to the `bg-color` / `bar-color` plot
    // styles. Slot-injected like `plot`/`hline` so each callsite gets a
    // stable slot id and is listed in `manifest.plots` with its kind.
    { name: "bgcolor", slot: true },
    { name: "barcolor", slot: true },
    { name: "alert", slot: true },
    // Phase 3 — draw.* namespace. One entry per kind in DRAWING_KINDS
    // order. Names are camelCase (`draw.<kindCamelCase>`); the wire
    // format keeps the kebab-case `DrawingKind`.
    { name: "draw.line", slot: true },
    { name: "draw.horizontalLine", slot: true },
    { name: "draw.horizontalRay", slot: true },
    { name: "draw.verticalLine", slot: true },
    { name: "draw.crossLine", slot: true },
    { name: "draw.trendAngle", slot: true },
    { name: "draw.rectangle", slot: true },
    { name: "draw.rotatedRectangle", slot: true },
    { name: "draw.triangle", slot: true },
    { name: "draw.polyline", slot: true },
    { name: "draw.circle", slot: true },
    { name: "draw.ellipse", slot: true },
    { name: "draw.path", slot: true },
    { name: "draw.fillBetween", slot: true },
    { name: "draw.marker", slot: true },
    { name: "draw.arc", slot: true },
    { name: "draw.curve", slot: true },
    { name: "draw.doubleCurve", slot: true },
    { name: "draw.pen", slot: true },
    { name: "draw.highlighter", slot: true },
    { name: "draw.brush", slot: true },
    { name: "draw.text", slot: true },
    { name: "draw.arrow", slot: true },
    { name: "draw.arrowMarker", slot: true },
    { name: "draw.arrowMarkUp", slot: true },
    { name: "draw.arrowMarkDown", slot: true },
    { name: "draw.trendChannel", slot: true },
    { name: "draw.flatTopBottom", slot: true },
    { name: "draw.disjointChannel", slot: true },
    { name: "draw.regressionTrend", slot: true },
    { name: "draw.fibRetracement", slot: true },
    { name: "draw.fibTrendExtension", slot: true },
    { name: "draw.fibChannel", slot: true },
    { name: "draw.fibTimeZone", slot: true },
    { name: "draw.fibWedge", slot: true },
    { name: "draw.fibSpeedFan", slot: true },
    { name: "draw.fibSpeedArcs", slot: true },
    { name: "draw.fibSpiral", slot: true },
    { name: "draw.fibCircles", slot: true },
    { name: "draw.fibTrendTime", slot: true },
    { name: "draw.gannBox", slot: true },
    { name: "draw.gannSquareFixed", slot: true },
    { name: "draw.gannSquare", slot: true },
    { name: "draw.gannFan", slot: true },
    { name: "draw.pitchfork", slot: true },
    { name: "draw.pitchfan", slot: true },
    { name: "draw.xabcdPattern", slot: true },
    { name: "draw.cypherPattern", slot: true },
    { name: "draw.headAndShoulders", slot: true },
    { name: "draw.abcdPattern", slot: true },
    { name: "draw.trianglePattern", slot: true },
    { name: "draw.threeDrivesPattern", slot: true },
    { name: "draw.elliottImpulseWave", slot: true },
    { name: "draw.elliottCorrectionWave", slot: true },
    { name: "draw.elliottTriangleWave", slot: true },
    { name: "draw.elliottDoubleCombo", slot: true },
    { name: "draw.elliottTripleCombo", slot: true },
    { name: "draw.cyclicLines", slot: true },
    { name: "draw.timeCycles", slot: true },
    { name: "draw.sineLine", slot: true },
    { name: "draw.group", slot: true },
    { name: "draw.frame", slot: true },
    { name: "draw.table", slot: true },
    { name: "state.float", slot: true },
    { name: "state.int", slot: true },
    { name: "state.bool", slot: true },
    { name: "state.string", slot: true },
    { name: "state.series", slot: true },
    { name: "state.tick.float", slot: true },
    { name: "state.tick.int", slot: true },
    { name: "state.tick.bool", slot: true },
    { name: "state.tick.string", slot: true },
    { name: "state.array", slot: true },
    // Both the data form `request.security({ interval })` and the expression
    // form `request.security({ interval }, (bar) => …)` route through this one
    // entry: `slot: true` injects the slot id as the first argument regardless
    // of the optional second (callback) argument.
    { name: "request.security", slot: true },
    { name: "request.lowerTf", slot: true },
    // Calendar / session accessors — stateless (slot: false). Like `ta.nz`,
    // they ride the registry for the `stateful-call-inside-loop` diagnostic
    // (Pine-parity) but take NO injected slot id: the runtime function
    // receives the author's arguments directly.
    { name: "time.year", slot: false },
    { name: "time.month", slot: false },
    { name: "time.dayofmonth", slot: false },
    { name: "time.dayofweek", slot: false },
    { name: "time.hour", slot: false },
    { name: "time.minute", slot: false },
    { name: "time.second", slot: false },
    { name: "time.timestamp", slot: false },
    { name: "time.timeClose", slot: false },
    { name: "session.isOpen", slot: false },
    { name: "defineAlertCondition.signal", slot: false },
    { name: "runtime.log", slot: false },
    { name: "runtime.error", slot: false },
];

/**
 * Frozen set of every fully-qualified call name the compiler tracks for
 * static-analysis (`stateful-call-inside-loop`) and slot-id injection
 *. Each entry carries a `slot` flag: `slot: true`
 * primitives allocate per-callsite hidden state and get a string-literal
 * slot id injected as their first argument; `slot: false` primitives are
 * pure helpers that ride along in the set because Pine still forbids
 * them inside loops (e.g. `ta.nz`).
 *
 * Phase 1 shipped 12 `slot: true` entries. Phase 2 widens the shape to
 * `{ name, slot }` so `ta.nz` (the only stateless Phase-2 cross-functional
 * primitive) can opt out of slot-id injection without losing the
 * in-loop diagnostic. Subsequent Phase-2 batch tasks (Tasks 6–28) each
 * append `slot: true` entries; Phase 3 appends 61 `draw.<camelKind>`
 * entries (all `slot: true`), and Phase 4 appends 8 `state.*` /
 * `state.tick.*` entries plus request primitives. Phase 5 appends alert-condition signalling plus runtime
 * logging/error as stateless loop-diagnostic entries plus `draw.table`
 * as a slot-backed viewport drawing.
 *
 * Additive within `apiVersion: 1` (currently 189 entries): new entries MAY
 * be appended in a `1.x` release (a new call name is additive — new callsites
 * only, no change to any existing script). Removing or renaming an entry, or
 * flipping its `slot`, is a language change and requires `apiVersion: 2` — see
 * `docs/spec/versioning.md`.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { STATEFUL_PRIMITIVES } from "@invinite-org/chartlang-core";
 *     for (const entry of STATEFUL_PRIMITIVES) {
 *         if (entry.name === "ta.ema" && entry.slot) {
 *             // compiler injects an id here
 *         }
 *     }
 */
export const STATEFUL_PRIMITIVES: ReadonlySet<StatefulPrimitiveEntry> = Object.freeze(
    new Set<StatefulPrimitiveEntry>(STATEFUL_PRIMITIVE_ENTRIES),
);

/**
 * Name → entry index of {@link STATEFUL_PRIMITIVES}. The compiler's
 * `callsiteIdInjection` and `statefulCallInLoop` passes consult this map
 * by callee name once per call site — O(1) lookup instead of an O(n) scan
 * over the 179-entry set on every visited call. The map is derived from
 * the same canonical entry list as {@link STATEFUL_PRIMITIVES} so adding
 * a primitive to the set adds it here automatically.
 *
 * Additive within `apiVersion: 1` (currently 189 entries): new entries MAY
 * be appended in a `1.x` release (a new call name is additive — new callsites
 * only, no change to any existing script). Removing or renaming an entry, or
 * flipping its `slot`, is a language change and requires `apiVersion: 2` — see
 * `docs/spec/versioning.md`.
 *
 * @since 0.2
 * @stable
 * @example
 *     import { STATEFUL_PRIMITIVES_BY_NAME } from "@invinite-org/chartlang-core";
 *     const entry = STATEFUL_PRIMITIVES_BY_NAME.get("ta.ema");
 *     // entry is { name: "ta.ema", slot: true } | undefined
 */
export const STATEFUL_PRIMITIVES_BY_NAME: ReadonlyMap<string, StatefulPrimitiveEntry> = new Map<
    string,
    StatefulPrimitiveEntry
>(STATEFUL_PRIMITIVE_ENTRIES.map((entry) => [entry.name, entry]));
