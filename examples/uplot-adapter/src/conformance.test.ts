// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { ALL_SCENARIOS, runConformanceSuite } from "@invinite-org/chartlang-conformance";
import { describe, expect, it } from "vitest";

import { DEFAULT_ADAPTER } from "./defaultAdapter.js";

// The conformance suite reads `adapter.capabilities` only — it compiles
// each scenario and drives the RUNTIME directly, never a real uPlot. The
// headless `DEFAULT_ADAPTER` (the package's `default` export) declares the
// full surface (all 63 drawing kinds + every plot kind), so every scenario
// must pass. This is the in-package counterpart to `scripts/run-conformance`
// (Task 13 wires the multi-adapter runner).
describe("uplot adapter conformance", () => {
    // The suite compiles + runs all 242 scenarios end-to-end. That is slow
    // on its own (~30s) and ~4x slower under the package's v8 coverage
    // instrumentation, so it carries a generous per-test timeout well above
    // vitest's 5s default.
    it("passes every scenario against the default capability bag", async () => {
        const report = await runConformanceSuite(DEFAULT_ADAPTER);
        expect(report.failed).toBe(0);
        expect(report.passed).toBe(ALL_SCENARIOS.length);
    }, 300_000);
});
