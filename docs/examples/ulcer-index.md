# Ulcer Index

Ulcer Index(14) — a drawdown-based downside-risk volatility oscillator that is always non-negative.

[Try it live](https://chartlang.invinite.com/?script=ulcer-index#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Ulcer Index",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot }) {
        // Ulcer Index(14): drawdown-based downside-risk volatility (always non-negative).
        plot(ta.ulcerIndex(bar.close, 14), { color: "#2962ff", title: "Ulcer Index(14)" });
    },
});
```
