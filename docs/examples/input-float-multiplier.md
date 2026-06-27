# Input · Float Multiplier

input.float(2.0) sets the width of a standard-deviation band around an SMA — a ±2σ envelope at the default.

[Try it live](https://chartlang.invinite.com/?script=input-float-multiplier#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// `input.float` example: a floating-point multiplier sets the width of a
// standard-deviation band around an SMA. At the default (2.0) the demo plots a
// ±2σ envelope.

import { defineIndicator, input, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Input · Float Multiplier",
    apiVersion: 1,
    overlay: true,
    inputs: {
        mult: input.float(2.0, { min: 0.5, max: 5, step: 0.5, title: "Band width (σ)" }),
    },
    compute({ bar, ta, plot, inputs }) {
        // `ta.*` returns a `Series<number>` (not number-coercible), so the band
        // arithmetic reads each series' `.current` scalar.
        const mult = inputs.mult as number;
        const basis = ta.sma(bar.close, 20);
        const dev = ta.stdev(bar.close, 20);
        plot(basis, { color: "#90caf9", title: "Basis", lineWidth: 2 });
        plot(basis.current + mult * dev.current, { color: "#cccccc", title: "Upper" });
        plot(basis.current - mult * dev.current, { color: "#cccccc", title: "Lower" });
    },
});
```
