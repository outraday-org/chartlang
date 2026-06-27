# Input · Price Level

input.price(125) drives a horizontal guide level sitting inside the demo's ~100–150 close band.

[Try it live](https://chartlang.invinite.com/?script=input-price-level#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// `input.price` example: a price input drives a horizontal guide level. The
// default (125) sits inside the demo's ~100–150 close band, so the `hline` is
// visible on load.

import { defineIndicator, hline, input } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Input · Price Level",
    apiVersion: 1,
    overlay: true,
    inputs: {
        level: input.price(125, { title: "Guide level" }),
    },
    compute({ hline, inputs }) {
        const level = inputs.level as number;
        hline(level, { color: "#ef5350", lineStyle: "dashed", title: "Level" });
    },
});
```
