# String Label Builder

Comprehensive str.*: a draw.table watchlist HUD whose rows are sanitized and formatted entirely with the string namespace — str.split the comma list, str.trim each token, str.replace a leading hash, str.substring + str.upper for a 3-char code, str.startsWith / str.contains to flag, and str.repeat for a bullet divider. The companion to str-formatted-hud (which shows only tostring / format / upper); str is a module-scope import and .split(...).map(...) is plain JS array work, not a loop-restricted primitive.

[Try it live](https://chartlang.invinite.com/?script=str-label-builder#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Comprehensive `str.*` example: a `draw.table` watchlist HUD whose rows are
// sanitized and formatted entirely with the string namespace — `split`,
// `trim`, `replace`, `substring`, `upper`, `startsWith`, `contains`, and
// `repeat`. It is the companion to `str-formatted-hud.chart.ts`, which
// demonstrates only `tostring` / `format` / `upper`. `str` is a module-scope
// import (never a `compute` field).

import { defineIndicator, input, str } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "String Label Builder",
    apiVersion: 1,
    overlay: true,
    inputs: {
        // `input.string(defaultValue, opts?)` — the first arg IS the default;
        // the `inputs:`-block key names it and `compute` reads `inputs.tags`.
        tags: input.string("btc, eth ,#sol", { title: "Watchlist" }),
    },
    compute({ draw, inputs }) {
        // Split the comma-separated watchlist into one sanitized table row per
        // ticker. `.split(...).map(...)` is plain JS array work — only stateful
        // `ta.*` / `draw.*` calls are loop-restricted — so every `str.*` step
        // runs freely inside the callback.
        const raw = inputs.tags as string;
        const rows = str.split(raw, ",").map((token) => {
            const tag = str.trim(token); // drop the stray spaces around each token
            const clean = str.replace(tag, "#", ""); // strip a leading hash (first occurrence)
            const code = str.upper(str.substring(clean, 0, 3)); // first three chars, upper-cased
            const flagged = str.startsWith(tag, "#") || str.contains(tag, "btc");
            return [
                { text: code, textColor: flagged ? "#22c55e" : "#0f172a" },
                { text: flagged ? "watch" : "hold", textColor: "#94a3b8" },
            ];
        });

        draw.table({
            position: "top-right",
            cells: [
                [
                    {
                        // `repeat` builds a bullet divider sized to the ticker count.
                        text: str.format("WATCHLIST {0}", str.repeat("•", rows.length)),
                        bgColor: "#0f172a",
                        textColor: "#f8fafc",
                    },
                    { text: "", bgColor: "#0f172a" },
                ],
                ...rows,
            ],
            borderColor: "#94a3b8",
            borderWidth: 1,
        });
    },
});
```
