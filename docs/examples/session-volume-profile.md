# Session Volume Profile

ta.sessionVolumeProfile — bucketizes the current session's volume by price and plots the session POC, resetting on each session boundary (UTC-day fallback when syminfo.session is absent).

[Try it live](https://chartlang.invinite.com/?script=session-volume-profile#demo)

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Session Volume Profile",
    apiVersion: 1,
    overlay: true,
    compute({ plot, ta }) {
        // Bucketize the current session's volume by price and plot the session
        // POC; with no syminfo.session the runtime warns once and falls back to
        // UTC-day windows (NaN until a window has positive volume).
        const vp = ta.sessionVolumeProfile({ rowSize: 24 });
        plot(vp.poc, { color: "#ab47bc", title: "Session POC" });
    },
});
```
