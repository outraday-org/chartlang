# Idiom · Bar Series Indexing

Indexing the price series directly (`bar.close[1]`) plus the raw-number coercion caveat — `+bar.close` for the scalar a comparison or `state.*` slot needs.

[Try it live](https://chartlang.invinite.com/?script=idiom-bar-series-index#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Idiom · Bar Series Indexing",
    apiVersion: 1,
    overlay: false,
    compute({ bar, plot }) {
        // Idiom: index the price series DIRECTLY — `bar.close` is both a scalar
        // and a Series<Price>, so `bar.close[1]` is the prior close with no
        // moving average in between (docs/language/series-and-indexing.md §
        // "The Series<T> shape"). The raw-number caveat: `bar.close` is an
        // object, so use `+bar.close` (or `.current`) when a number is required —
        // here the momentum is `+bar.close − bar.close[1]`.
        const momentum = bar.close.length >= 2 ? +bar.close - bar.close[1] : Number.NaN;
        plot(momentum, { title: "Close momentum", color: "#ef5350" });
    },
});
```
