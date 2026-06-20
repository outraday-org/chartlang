// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { runConformanceSuite } from "@invinite-org/chartlang-conformance";
import { describe, expect, it } from "vitest";

import defaultAdapter from "./index.js";

// The conformance harness reads `adapter.capabilities` only and drives the
// runtime itself, so the capabilities-only default export is the subject — the
// full ECharts drawing/plot surface (declared in Task 9) must satisfy every
// scenario's capability requirement with zero failures.
//
// The full suite compiles + runs 200+ scenarios through esbuild and the
// runtime; under v8 coverage instrumentation it runs far past vitest's 5 s
// default, so allow a generous per-test ceiling.
const SUITE_TIMEOUT_MS = 300_000;

describe("echarts adapter conformance", () => {
    it(
        "passes the full default scenario suite (failed === 0)",
        async () => {
            const report = await runConformanceSuite(defaultAdapter);
            // Surface every failure in the message if the gate trips.
            expect(report.failures.map((f) => `${f.scenarioId}: ${f.message}`)).toEqual([]);
            expect(report.failed).toBe(0);
            expect(report.passed).toBeGreaterThan(0);
        },
        SUITE_TIMEOUT_MS,
    );
});
