// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { STATEFUL_PRIMITIVES } from "@invinite-org/chartlang-core";
import { TA_REGISTRY } from "@invinite-org/chartlang-runtime";
import { describe, expect, it } from "vitest";

import { PHASE_2_INDICATORS, PHASE_5_DEFERRED } from "./phase2Inventory.js";

const PHASE_1_INDICATORS: ReadonlyArray<string> = Object.freeze([
    "sma",
    "ema",
    "stdev",
    "bb",
    "rsi",
    "macd",
    "atr",
    "crossover",
    "crossunder",
] as const);

const PHASE_5_TA_ADDITIONS: ReadonlyArray<string> = Object.freeze([
    "anchoredVolumeProfile",
    "fixedRangeVolumeProfile",
    "sessionVolumeProfile",
    "visibleRangeVolumeProfile",
] as const);

const PHASE_5_STATEFUL_ADDITIONS: ReadonlyArray<Readonly<{ name: string; slot: boolean }>> =
    Object.freeze([
        { name: "ta.anchoredVolumeProfile", slot: true },
        { name: "ta.fixedRangeVolumeProfile", slot: true },
        { name: "ta.sessionVolumeProfile", slot: true },
        { name: "ta.visibleRangeVolumeProfile", slot: true },
        { name: "draw.table", slot: true },
        { name: "defineAlertCondition.signal", slot: false },
        { name: "runtime.log", slot: false },
        { name: "runtime.error", slot: false },
    ] as const);

const PHASE_6_STATEFUL_ADDITIONS: ReadonlyArray<Readonly<{ name: string; slot: boolean }>> =
    Object.freeze([{ name: "request.lowerTf", slot: true }] as const);

// `ta.highestbars` / `ta.lowestbars` — the offset-returning argmax/argmin
// primitives added alongside the Pine-converter real passthrough.
const HIGHEST_LOWEST_BARS_TA_ADDITIONS: ReadonlyArray<string> = Object.freeze([
    "highestbars",
    "lowestbars",
] as const);

const HIGHEST_LOWEST_BARS_STATEFUL_ADDITIONS: ReadonlyArray<
    Readonly<{ name: string; slot: boolean }>
> = Object.freeze([
    { name: "ta.highestbars", slot: true },
    { name: "ta.lowestbars", slot: true },
] as const);

// `draw.fillBetween` — the filled-ribbon drawing kind added alongside the
// "fill-between" DrawingKind (the native Pine `linefill.new` / `fill`
// analogue).
const FILL_BETWEEN_STATEFUL_ADDITIONS: ReadonlyArray<Readonly<{ name: string; slot: boolean }>> =
    Object.freeze([{ name: "draw.fillBetween", slot: true }] as const);

// `state.series` — the writable, indexable user series slot. A new
// STATEFUL_PRIMITIVES entry alongside `state.float`/`int`/`bool`/`string`.
const STATE_SERIES_STATEFUL_ADDITIONS: ReadonlyArray<Readonly<{ name: string; slot: boolean }>> =
    Object.freeze([{ name: "state.series", slot: true }] as const);

// `state.array` — the persistent, bounded FIFO collection slot. A new
// STATEFUL_PRIMITIVES entry alongside `state.series` (the allocation callsite
// is `{ slot: true }`; `push`/`get`/`last`/`clear` are handle methods, not
// registry callsites).
const STATE_ARRAY_STATEFUL_ADDITIONS: ReadonlyArray<Readonly<{ name: string; slot: boolean }>> =
    Object.freeze([{ name: "state.array", slot: true }] as const);

// `bgcolor` / `barcolor` — the Pine-ergonomic top-level aliases for the
// `bg-color` / `bar-color` plot styles. Each callsite is slot-injected (a
// stable slotId + a `manifest.plots` entry), so both are STATEFUL_PRIMITIVES
// entries alongside `plot` / `hline`.
const BGCOLOR_BARCOLOR_STATEFUL_ADDITIONS: ReadonlyArray<
    Readonly<{ name: string; slot: boolean }>
> = Object.freeze([
    { name: "bgcolor", slot: true },
    { name: "barcolor", slot: true },
] as const);

// `time.*` calendar accessors + `session.isOpen` — stateless `slot: false`
// namespaces (like `ta.nz`): pure functions of an explicit `Time` + optional
// `tz`, so no callsite-id injection. `time.timeClose` is the one that closes
// over per-bar mount data (`t + timeframe.inSeconds`) but is still a
// no-slot registry entry. All ten are stateless.
const CALENDAR_SESSION_STATEFUL_ADDITIONS: ReadonlyArray<
    Readonly<{ name: string; slot: boolean }>
> = Object.freeze([
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
] as const);

const PHASE_2_TA_CARDINALITY = PHASE_1_INDICATORS.length + PHASE_2_INDICATORS.length;
const PHASE_4_STATEFUL_CARDINALITY = 163;

describe("Phase 2 surface", () => {
    it("every PLAN §9.2 indicator has a ta.* primitive", () => {
        for (const id of PHASE_2_INDICATORS) {
            expect(TA_REGISTRY).toHaveProperty(id);
        }
    });

    it("every Phase-1 ta.* primitive is still present (no regressions)", () => {
        for (const id of PHASE_1_INDICATORS) {
            expect(TA_REGISTRY).toHaveProperty(id);
        }
    });

    it("TA_REGISTRY keeps the 90-entry Phase-2 baseline plus explicit Phase-5 VP + highest/lowest-bars additions", () => {
        expect(PHASE_2_TA_CARDINALITY).toBe(90);
        for (const id of [...PHASE_5_TA_ADDITIONS, ...HIGHEST_LOWEST_BARS_TA_ADDITIONS]) {
            expect(TA_REGISTRY).toHaveProperty(id);
        }
        expect(Object.keys(TA_REGISTRY).length).toBe(
            PHASE_2_TA_CARDINALITY +
                PHASE_5_TA_ADDITIONS.length +
                HIGHEST_LOWEST_BARS_TA_ADDITIONS.length,
        );
    });

    it("STATEFUL_PRIMITIVES keeps the Phase-4 baseline plus explicit Phase-5/6 and highest/lowest-bars entries", () => {
        expect(STATEFUL_PRIMITIVES.size).toBe(
            PHASE_4_STATEFUL_CARDINALITY +
                PHASE_5_STATEFUL_ADDITIONS.length +
                PHASE_6_STATEFUL_ADDITIONS.length +
                HIGHEST_LOWEST_BARS_STATEFUL_ADDITIONS.length +
                FILL_BETWEEN_STATEFUL_ADDITIONS.length +
                STATE_SERIES_STATEFUL_ADDITIONS.length +
                STATE_ARRAY_STATEFUL_ADDITIONS.length +
                BGCOLOR_BARCOLOR_STATEFUL_ADDITIONS.length +
                CALENDAR_SESSION_STATEFUL_ADDITIONS.length,
        );
        for (const expected of [
            ...PHASE_5_STATEFUL_ADDITIONS,
            ...PHASE_6_STATEFUL_ADDITIONS,
            ...HIGHEST_LOWEST_BARS_STATEFUL_ADDITIONS,
            ...FILL_BETWEEN_STATEFUL_ADDITIONS,
            ...STATE_SERIES_STATEFUL_ADDITIONS,
            ...STATE_ARRAY_STATEFUL_ADDITIONS,
            ...BGCOLOR_BARCOLOR_STATEFUL_ADDITIONS,
            ...CALENDAR_SESSION_STATEFUL_ADDITIONS,
        ]) {
            expect(STATEFUL_PRIMITIVES).toContainEqual(expected);
        }
    });

    it("slot:false entries are ta.nz, the Phase-5 diagnostics primitives, and the calendar/session accessors", () => {
        const stateless = [...STATEFUL_PRIMITIVES]
            .filter((e) => e.slot === false)
            .map((e) => e.name)
            .sort();
        expect(stateless).toEqual(
            [
                "defineAlertCondition.signal",
                "runtime.error",
                "runtime.log",
                "ta.nz",
                ...CALENDAR_SESSION_STATEFUL_ADDITIONS.map((e) => e.name),
            ].sort(),
        );
    });

    it("no still-deferred Phase-5 primitive leaked into the registry", () => {
        const allowedPhase5 = new Set(PHASE_5_TA_ADDITIONS);
        for (const id of PHASE_5_DEFERRED.filter((candidate) => !allowedPhase5.has(candidate))) {
            expect(TA_REGISTRY).not.toHaveProperty(id);
        }
    });

    it("the registry contains no extras beyond Phase-1 + Phase-2 + explicit Phase-5 additions", () => {
        const known = new Set([
            ...PHASE_1_INDICATORS,
            ...PHASE_2_INDICATORS,
            ...PHASE_5_TA_ADDITIONS,
            ...HIGHEST_LOWEST_BARS_TA_ADDITIONS,
        ]);
        const extras = Object.keys(TA_REGISTRY).filter((k) => !known.has(k));
        expect(extras).toEqual([]);
    });
});
