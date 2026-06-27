# Input · Time Anchor

input.time(...) anchors a vertical guide line; the default is the demo's first-bar time, marking the series start.

[Try it live](https://chartlang.invinite.com/?script=input-time-anchor#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// `input.time` example: a timestamp input anchors a vertical guide line. The
// default (1_700_000_000_000) is the demo's first-bar time, so the line marks
// the start of the series.

import { defineIndicator, draw, input } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Input · Time Anchor",
    apiVersion: 1,
    overlay: true,
    inputs: {
        anchor: input.time(1_700_000_000_000, { title: "Anchor time", pickFromChart: true }),
    },
    compute({ draw, inputs }) {
        const anchor = inputs.anchor as number;
        draw.verticalLine(anchor, { color: "#f59e0b", lineStyle: "dashed" });
    },
});
```
