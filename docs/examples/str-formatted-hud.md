# Formatted OHLC HUD

String namespace: a draw.table HUD whose cells are built with str.*. str.tostring(value, "#.##") formats each OHLC price to a fixed-precision Pine mask (host-independent, no Intl/locale) and str.format("{0} · {1}", str.upper(bar.symbol), bar.interval) composes the header. str is a module-scope import (not a compute field); it emits no new wire primitive — the text rides the existing draw.table hole.

[Try it live](https://chartlang.invinite.com/?script=str-formatted-hud#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Headline `str.*` example: a draw.table HUD whose cells are built with the
// string namespace. `str.tostring(value, "#.##")` formats each OHLC field to a
// fixed-precision Pine mask (host-independent, no locale) and `str.format` /
// `str.upper` compose the header — the dynamic text the already-shipped
// draw.table hole consumes, with no new wire primitive and no capability.

import { defineIndicator, str } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Formatted OHLC HUD",
    apiVersion: 1,
    overlay: true,
    compute({ bar, draw }) {
        // `str` is a module-scope import (not a `compute` field). Round each
        // price to two decimals once, then drop the strings straight into the
        // table cells.
        const price = (value: number): string => str.tostring(value, "#.##");
        draw.table({
            position: "top-right",
            cells: [
                [
                    {
                        text: str.format("{0} · {1}", str.upper(bar.symbol), bar.interval),
                        bgColor: "#0f172a",
                        textColor: "#f8fafc",
                    },
                    {
                        text: price(bar.close),
                        bgColor: "#0f172a",
                        textColor: "#f8fafc",
                        textHalign: "right",
                    },
                ],
                [
                    { text: "O", textColor: "#94a3b8" },
                    { text: price(bar.open), textColor: "#0f172a", textHalign: "right" },
                ],
                [
                    { text: "H", textColor: "#94a3b8" },
                    { text: price(bar.high), textColor: "#22c55e", textHalign: "right" },
                ],
                [
                    { text: "L", textColor: "#94a3b8" },
                    { text: price(bar.low), textColor: "#ef4444", textHalign: "right" },
                ],
            ],
            borderColor: "#94a3b8",
            borderWidth: 1,
        });
    },
});
```
