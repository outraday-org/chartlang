// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { HOVER_REGISTRY } from "./hoverRegistry.generated.js";

describe("HOVER_REGISTRY", () => {
    it("contains the apiVersion 1 language-service symbol set", () => {
        expect(Object.keys(HOVER_REGISTRY)).toHaveLength(514);
    });

    it("contains core hover entries required by editor tier 1", () => {
        expect(HOVER_REGISTRY["ta.ema"]).toMatchObject({
            fqn: "ta.ema",
            kind: "function",
            title: "ta.ema(source, length, opts?)",
            since: "0.1",
        });
        expect(HOVER_REGISTRY["state.float"]).toMatchObject({
            fqn: "state.float",
            kind: "function",
            since: "0.4",
            stability: "stable",
        });
        expect(HOVER_REGISTRY["input.interval"]).toMatchObject({
            fqn: "input.interval",
            title: "input.interval(defaultValue, opts?)",
        });
        expect(HOVER_REGISTRY["request.security"]).toMatchObject({
            fqn: "request.security",
            title: "request.security(_opts)",
        });
    });
});
