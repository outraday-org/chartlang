# Idiom · withInputs Override

Override a dependency's input defaults without forking via `<dep>.withInputs({ length })`, then read its output.

[Try it live](https://chartlang.invinite.com/?script=idiom-with-inputs#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot } from "@invinite-org/chartlang-core";
import baseTrend from "./base-trend.chart";

// Idiom: override a dependency's input defaults WITHOUT forking the source via
// `<dep>.withInputs({ key: value })` (docs/language/indicator-composition.md §
// "`.withInputs({...})` overrides"). The override keys must exist on the
// producer's `inputs` schema (here `base-trend.chart` declares
// `length: input.int(50, …)`); the compiler statically validates the chain
// (`dep-invalid-input-override`) and the runtime never sees the call.
const slowTrend = baseTrend.withInputs({ length: 100 });

export default defineIndicator({
    name: "Idiom · withInputs Override",
    apiVersion: 1,
    overlay: true,
    compute({ plot }) {
        plot(slowTrend.output("line").current, { title: "EMA(100) override", color: "#9ca3af" });
    },
});
```
