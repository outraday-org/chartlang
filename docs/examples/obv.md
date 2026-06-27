# On-Balance Volume

On-Balance Volume via ta.obv — a cumulative line that adds volume on up closes and subtracts it on down closes.

[Try it live](https://chartlang.invinite.com/?script=obv#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "On-Balance Volume",
    apiVersion: 1,
    overlay: false,
    compute({ ta, plot }) {
        // OBV adds the bar's volume on an up close and subtracts it on a
        // down close, so the running line tracks cumulative buying pressure.
        plot(ta.obv(), { color: "#26a69a", title: "OBV" });
    },
});
```
