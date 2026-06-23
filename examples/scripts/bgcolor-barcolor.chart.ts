// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { barcolor, bgcolor, defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Bg + Bar Color",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot, bgcolor, barcolor }) {
        // `barcolor` tints each CANDLE by its own direction — blue on an
        // up-close, orange on a down-close. Deliberately NOT the usual
        // green/red candle colors, so the recolor is plainly visible. The
        // Pine-ergonomic alias replaces the verbose
        // `plot(NaN, { style: { kind: "bar-color", color } })` form; the
        // color expression is evaluated every bar, so the tint flips as the
        // condition does, and `barcolor` carries no transparency.
        barcolor(bar.close.current > bar.open.current ? "#2962ff" : "#ff6d00");

        // `bgcolor` washes the whole PANE BACKGROUND by trend regime: a
        // faint green while price holds above its EMA(50), a faint red
        // below. `transp` (0 opaque … 100 fully transparent) keeps the wash
        // subtle so the candles stay readable on top of it.
        const trend = ta.ema(bar.close, 50);
        plot(trend, { color: "#90caf9", title: "EMA(50)" });
        bgcolor(bar.close.current > trend.current ? "#26a69a" : "#ef5350", { transp: 85 });
    },
});
