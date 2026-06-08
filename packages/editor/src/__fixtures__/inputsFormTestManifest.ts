// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { ScriptManifest } from "@invinite-org/chartlang-core";

export const inputsFormTestManifest: ScriptManifest = {
    apiVersion: 1,
    kind: "indicator",
    name: "Inputs",
    inputs: {
        length: { kind: "int", defaultValue: 14, title: "Length", min: 1, max: 200, step: 1 },
        ratio: { kind: "float", defaultValue: 2.5, min: 0.5, max: 5, step: 0.5 },
        enabled: { kind: "bool", defaultValue: true },
        note: { kind: "string", defaultValue: "demo", multiline: true },
        mode: { kind: "enum", defaultValue: "fast", options: ["fast", "slow"] },
        tint: { kind: "color", defaultValue: "#26a69a" },
        source: { kind: "source", defaultValue: "close" },
        anchor: { kind: "time", defaultValue: 1_700_000_000_000 },
        level: { kind: "price", defaultValue: 101.25 },
        symbol: { kind: "symbol", defaultValue: "AAPL" },
        interval: { kind: "interval", defaultValue: "1D" },
        earnings: {
            kind: "external-series",
            name: "earnings",
            schema: { kind: "external-series-schema" },
        },
    },
    capabilities: ["indicators"],
    requestedIntervals: [],
    userPickableInterval: true,
    seriesCapacities: {},
    maxLookback: 0,
};
