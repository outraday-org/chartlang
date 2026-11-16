// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { ScriptManifest } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { DEFAULT_ALERT_RUNNER_MAX_LOOKBACK, alertRunnerCapabilities } from "./capabilities.js";

const manifest = (requestedIntervals: ReadonlyArray<string>): ScriptManifest =>
    ({ requestedIntervals }) as unknown as ScriptManifest;

describe("alertRunnerCapabilities", () => {
    it("declares the headless alert bag", () => {
        const caps = alertRunnerCapabilities({
            manifest: manifest([]),
            interval: "1h",
            maxLookback: 10,
        });
        expect(Object.isFrozen(caps)).toBe(true);
        expect(caps.alertConditions).toBe(true);
        expect([...caps.alerts].sort()).toEqual([
            "email",
            "log",
            "push",
            "sms",
            "toast",
            "webhook",
        ]);
        expect(caps.drawings.size).toBe(0);
        expect(caps.logs).toBe(false);
        expect(caps.orders).toBe(false);
        expect(caps.inputs.has("external-series")).toBe(false);
        expect(caps.inputs.has("int")).toBe(true);
        expect(caps.symInfoFields.has("ticker")).toBe(true);
        expect(caps.intervals).toEqual([{ value: "1h", label: "1h", group: "alert" }]);
        expect(caps.maxLookback).toBe(DEFAULT_ALERT_RUNNER_MAX_LOOKBACK);
    });

    it("adds requested intervals once and raises the ring floor", () => {
        const caps = alertRunnerCapabilities({
            manifest: manifest(["1D", "1h"]),
            interval: "1h",
            maxLookback: 8_000,
        });
        expect(caps.intervals.map((i) => i.value)).toEqual(["1h", "1D"]);
        expect(caps.maxLookback).toBe(8_000);
    });
});
