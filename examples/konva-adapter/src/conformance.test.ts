// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { runConformanceSuite } from "@invinite-org/chartlang-conformance";
import { describe, expect, it } from "vitest";

import { DEFAULT_ADAPTER } from "./defaultAdapter.js";

// The conformance suite reads `adapter.capabilities` only (it owns the
// candle iteration + emission buffer), so the headless capabilities-only
// `DEFAULT_ADAPTER` is the surface under test — no Konva stage is spun up.
// Every scenario must pass against the full Konva capability bag.
//
// The suite compiles + runs every bundled scenario through the real runtime
// (~35s), so it carries a generous per-test timeout well above vitest's 5s
// default — matching the sibling adapters' conformance tests.
describe("konva adapter conformance", () => {
    it("passes every scenario against the default adapter's capabilities", async () => {
        const report = await runConformanceSuite(DEFAULT_ADAPTER);
        expect(report.failed).toBe(0);
    }, 300_000);
});
