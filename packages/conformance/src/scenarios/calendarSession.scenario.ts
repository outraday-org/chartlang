// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

/**
 * Inline source: `time.*` calendar fields + `session.isOpen` membership over a
 * FIXED UTC fixture. Each golden bar is a daily candle at the same 22:13:20 UTC
 * time-of-day (`START_TIME % MS_PER_DAY`), so `time.hour`/`minute`/`second` are
 * constant while `time.year`/`month`/`dayofmonth`/`dayofweek` advance one
 * civil day per bar. The session window `"2000-2300"` (half-open `[1200, 1380)`
 * minutes) CONTAINS 22:13:20 (= minute 1333), so `session.isOpen` is `true`
 * every bar — the open branch (which depends on the per-bar-varying
 * `dayofweek`) is the one that emits, proving the whole calendar + session
 * path end-to-end. Both `tz` args are the explicit `"UTC"` so the script never
 * touches the deferred DST path. Both plots are on overlay.
 */
const SOURCE = `import { defineIndicator, plot } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Calendar session",
    apiVersion: 1,
    overlay: true,
    compute({ bar, time, session, plot }) {
        const t = bar.time;
        const dow = time.dayofweek(t, "UTC");
        const hh = time.hour(t, "UTC");
        const open = session.isOpen(t, "2000-2300", "UTC");
        plot(open ? bar.close + dow * 100 + hh : bar.close, { title: "Calendar" });
        plot(time.month(t, "UTC"), { title: "Month" });
    },
});
`;

// The "Calendar" plot folds the per-bar `dayofweek` (1=Sun..7=Sat) and the
// constant hour (22) into the close while the session is open (always, on this
// fixed-time-of-day fixture); the "Month" plot is the bare `time.month` 1..12.
// Both series are finite from bar 0 (no warmup) and deterministic over the
// shared golden bars, so each pins to its own SHA-256. The scenario's value is
// the end-to-end proof that `time.*` / `session.isOpen` compile (as
// `slot: false` accessors with no callsite-id injection), run through the
// buffer-free stateless path, and emit a stable finite series. Re-pin via the
// runner's "expected vs actual" message if the golden bars change.
const CALENDAR_HASH = "2dac8fb7e5181b38e9724f665678c4491e0a81618d45027fd9464be578af30be";
const MONTH_HASH = "79a9fd0cc809c27ebc86edc00251a2ea8d026349082aaa8a65d89a56f0a82a12";

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "plot-hash",
        slotId: "<inline:calendar-session>.chart.ts:12:9#0",
        sha256: CALENDAR_HASH,
    },
    {
        kind: "plot-hash",
        slotId: "<inline:calendar-session>.chart.ts:13:9#0",
        sha256: MONTH_HASH,
    },
    // The script resolves `"UTC"` explicitly, so the DST fallback never fires.
    { kind: "diagnostic-code-absent", code: "tz-dst-unsupported" },
    // No `time.*` / `session.*` buffering, so no lookback sizing is involved.
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
]);

/**
 * Calendar + session conformance scenario. Proves `time.*` calendar accessors
 * and `session.isOpen` membership compile + run + emit a stable finite series
 * over the fixed UTC golden fixture: the "Calendar" plot folds the per-bar
 * `time.dayofweek` (Pine `1=Sun..7=Sat`) and `time.hour` into the close while
 * `session.isOpen(t, "2000-2300", "UTC")` is open, and the "Month" plot is the
 * bare `time.month`. Each plot pins to its own SHA-256; `tz-dst-unsupported`
 * and `lookback-exceeded` are asserted absent (the `"UTC"` tz never touches the
 * DST path and the accessors do no buffering).
 *
 * @since 1.5
 * @stable
 * @example
 *     import { CALENDAR_SESSION_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     // CALENDAR_SESSION_SCENARIO.id === "calendar-session"
 *     void CALENDAR_SESSION_SCENARIO;
 */
export const CALENDAR_SESSION_SCENARIO: Scenario = Object.freeze({
    id: "calendar-session",
    title: "time.* calendar fields + session.isOpen emit a stable finite series",
    inlineSource: SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
