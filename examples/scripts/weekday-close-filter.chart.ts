// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Calendar accessor demo: plot the close only on weekdays (Mon–Fri),
// else NaN, so the line breaks across every weekend. Exercises the
// `time.*` calendar accessors — `time.dayofweek(bar.time)` (Pine's
// `1=Sun..7=Sat` convention) — derived from `bar.time` (UTC ms epoch),
// never `Date`/`Intl` (both forbidden on the author path).
//
// The sibling `session.isOpen` / `input.session` accessors live in the
// same namespace but need INTRADAY bars to discriminate: this demo's
// daily candles all share one time-of-day, so any session window is
// trivially all-open or all-closed. Those are exercised by the
// conformance scenarios (`calendarSession`, `taSessionVolumeProfile`),
// not here.

import { defineIndicator, plot, time } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Weekday Close Filter",
    apiVersion: 1,
    overlay: true,
    compute({ bar, time, plot }) {
        const dow = time.dayofweek(bar.time); // 1=Sun .. 7=Sat (Pine convention)
        const isWeekday = dow >= 2 && dow <= 6;
        // A bright, thick line so the weekday segments — and the 2-bar break
        // across every weekend (the NaN gaps) — read clearly on top of the
        // green/red candles, which the plotted close value would otherwise
        // blend into.
        plot(isWeekday ? bar.close : Number.NaN, {
            color: "#f59e0b",
            lineWidth: 2,
            title: "Weekday close",
        });
    },
});
