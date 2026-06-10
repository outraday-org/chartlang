// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { benchHotLoop } from "./__fixtures__/benchHotLoop.js";
import { psar } from "./psar.js";

// THRESHOLD_MS — ceil(median × 3) on local Apple-silicon. PSAR runs
// O(1) per bar (closed-form recurrence with no scans); pair with
// `aroon` / `change` / `highest` baseline at 300ms.
const THRESHOLD_MS = 1500;

describe("ta.psar threshold", () => {
    it("runs 10 000 bars under threshold", () => {
        const start = performance.now();
        const sink = benchHotLoop(10_000, 1, () => psar("slot").sar.current);
        const elapsed = performance.now() - start;
        expect(Number.isFinite(sink)).toBe(true);
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
