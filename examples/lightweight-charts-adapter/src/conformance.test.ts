// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { runConformanceSuite } from "@invinite-org/chartlang-conformance";
import { describe, expect, it } from "vitest";

import defaultAdapter from "./index.js";

// The conformance harness reads `adapter.capabilities` only and drives the
// runtime itself, so the capabilities-only default export is the subject — the
// full lightweight-charts drawing/plot surface (declared in Task 5) must
// satisfy every scenario's capability requirement with zero failures.
// The full suite compiles + runs 200+ scenarios through esbuild and the
// runtime; ~37 s standalone, but under the package's `--coverage` run the v8
// instrumentation roughly doubles it — well past the 5 s default, so allow a
// wide margin.
const SUITE_TIMEOUT_MS = 300_000;

describe("lightweight-charts adapter conformance", () => {
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
