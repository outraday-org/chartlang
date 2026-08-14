// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

const MAX_MINUTE_OF_DAY = 1440;

/**
 * One exchange-calendar exception day, addressed by the `"YYYY-MM-DD"` local
 * day key (the {@link nyDayKey} shape).
 *
 * A `"closed"` day has no session at all. A `"halfDay"` carries the early
 * close as `closeMinutes` — **local exchange minute-of-day**, never UTC:
 * `sessionBoundaries.ts` already converts a local wall clock to an instant
 * through `zonedTimeToUtcMs`, so a UTC minute here would re-introduce the DST
 * problem that module has already solved.
 *
 * The union is discriminated rather than carrying an optional
 * `closeMinutes?`, so a `"halfDay"` without a close time is unrepresentable
 * for a typed producer; {@link createSessionCalendar} rejects it for the
 * untyped (JSON-over-the-host-membrane) one.
 *
 * The shape is JSON-clean by construction, so an array of these survives
 * `structuredClone`, `JSON.stringify`, and the QuickJS membrane — which is why
 * the WIRE form is rows and the {@link SessionCalendar} interface is built on
 * the far side.
 *
 * @since 1.11
 * @stable
 * @example
 *     const thanksgiving: SessionCalendarDay = { dayKey: "2024-11-28", kind: "closed" };
 *     const blackFriday: SessionCalendarDay = {
 *         dayKey: "2024-11-29",
 *         kind: "halfDay",
 *         closeMinutes: 13 * 60,
 *     };
 *     void thanksgiving;
 *     void blackFriday;
 */
export type SessionCalendarDay =
    | Readonly<{ dayKey: string; kind: "closed" }>
    | Readonly<{ dayKey: string; kind: "halfDay"; closeMinutes: number }>;

/**
 * O(1) exchange-calendar lookup handed to the session predicates.
 *
 * `lookup` returns `null` for any day the calendar says nothing about, which
 * is the fail-open case: the predicate then behaves exactly as it does with no
 * calendar at all. The calendar is always an explicit argument — never module
 * state — so every helper stays pure over its inputs.
 *
 * @since 1.11
 * @stable
 * @example
 *     const calendar: SessionCalendar = createSessionCalendar([
 *         { dayKey: "2024-11-28", kind: "closed" },
 *     ]);
 *     void calendar.lookup("2024-11-28");
 */
export type SessionCalendar = Readonly<{
    lookup(dayKey: string): SessionCalendarDay | null;
}>;

/**
 * Build a {@link SessionCalendar} from the consumer-supplied rows.
 *
 * chartlang is data-source-neutral: it owns the interface and the predicate
 * integration, the consumer owns the rows. The `Map` is built once here
 * because `lookup` runs inside per-bar predicates. A later row for a `dayKey`
 * already present wins.
 *
 * Throws when a `"halfDay"` row's `closeMinutes` is not an integer in
 * `[0, 1440]` — rejecting at construction is cheaper to debug than a
 * fail-open row, and the rows come from one trusted producer.
 *
 * @since 1.11
 * @stable
 * @example
 *     const calendar = createSessionCalendar([
 *         { dayKey: "2024-11-29", kind: "halfDay", closeMinutes: 780 },
 *     ]);
 *     void calendar.lookup("2024-11-29");
 */
export function createSessionCalendar(days: ReadonlyArray<SessionCalendarDay>): SessionCalendar {
    const byDayKey = new Map<string, SessionCalendarDay>();
    for (const day of days) {
        if (day.kind === "halfDay") {
            const close = day.closeMinutes;
            if (!Number.isInteger(close) || close < 0 || close > MAX_MINUTE_OF_DAY) {
                throw new Error(
                    `session calendar: half-day ${day.dayKey} needs an integer closeMinutes in [0, ${MAX_MINUTE_OF_DAY}], got ${String(close)}`,
                );
            }
        }
        byDayKey.set(day.dayKey, day);
    }
    return Object.freeze({
        lookup(dayKey: string): SessionCalendarDay | null {
            return byDayKey.get(dayKey) ?? null;
        },
    });
}
