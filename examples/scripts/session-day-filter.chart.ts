// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Calendar + session demo: plot the close only during a configurable
// intraday session window on weekdays (Mon–Fri), else NaN. Exercises the
// `time.*` / `session.*` accessors and the `input.session` kind — calendar
// fields come from `bar.time` (UTC ms epoch), never `Date`/`Intl`.

import { defineIndicator, input, plot, session, time } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Session Day Filter",
    apiVersion: 1,
    overlay: true,
    inputs: {
        window: input.session("0930-1600", { title: "Session window" }),
    },
    compute({ bar, time, session, inputs, plot }) {
        const dow = time.dayofweek(bar.time); // 1=Sun .. 7=Sat (Pine convention)
        const isWeekday = dow >= 2 && dow <= 6;
        const inSession = session.isOpen(bar.time, inputs.window as string);
        plot(isWeekday && inSession ? bar.close : Number.NaN, { title: "RTH close" });
    },
});
