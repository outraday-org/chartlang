// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { ExampleMeta } from "../catalogue";

const entries: ReadonlyArray<ExampleMeta> = [
    {
        id: "anchored-volume-profile",
        label: "Anchored Volume Profile",
        description:
            "ta.anchoredVolumeProfile — bucketizes volume from a picked time anchor forward (input.time, pickFromChart) and plots the point of control, the price level holding the most volume.",
        category: "ta-volume-profile",
        primitives: ["ta.anchoredVolumeProfile"],
    },
    {
        id: "fixed-range-volume-profile",
        label: "Fixed Range Volume Profile",
        description:
            "ta.fixedRangeVolumeProfile — bucketizes volume across a fixed [from, to] time window (two input.time anchors) and plots the POC plus the value-area high/low band.",
        category: "ta-volume-profile",
        primitives: ["ta.fixedRangeVolumeProfile"],
    },
    {
        id: "session-volume-profile",
        label: "Session Volume Profile",
        description:
            "ta.sessionVolumeProfile — bucketizes the current session's volume by price and plots the session POC, resetting on each session boundary (UTC-day fallback when syminfo.session is absent).",
        category: "ta-volume-profile",
        primitives: ["ta.sessionVolumeProfile"],
    },
    {
        id: "visible-range-volume-profile",
        label: "Visible Range Volume Profile",
        description:
            "ta.visibleRangeVolumeProfile — bucketizes the visible range's volume by price (the latest 100 bars via bar.viewport) and plots the POC.",
        category: "ta-volume-profile",
        primitives: ["ta.visibleRangeVolumeProfile"],
    },
];

export default entries;
