// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Typed-string `na` end to end: convert → assert the emitted predicate →
 * compile it.
 *
 * The defect this pins is silent, which is why the assertion is on the
 * PREDICATE and not on "the fixture regenerated". `na(x)` used to lower
 * through the numeric `!Number.isFinite(x)` arm for every receiver, and
 * `Number.isFinite("")` is `false` for EVERY string — so
 * `if not na(alert_msg)` became `if (!!Number.isFinite(alert_msg))`, which is
 * `false` on every bar. A MASM-shaped script converted cleanly, compiled
 * cleanly, ran cleanly, and never fired.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { compile } from "@invinite-org/chartlang-compiler";
import { describe, expect, it } from "vitest";

import { convert } from "../index.js";

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "fixtures");

// The MASM alert block reduced to its load-bearing idiom: a typed string `na`,
// a conditional JSON assignment, and the `not na(...)` fire gate. The token is
// an inert placeholder — never a real credential, here or in any fixture.
const MINIMAL = `//@version=6
indicator("string na", overlay=true)
api_token = input.string("PASTE API KEY HERE", "API KEY")
string alert_msg = na
if close > open
    alert_msg := '{"action": "buy", "apiKey": "' + api_token + '"}'
else if close < open
    alert_msg := '{"action": "sell", "apiKey": "' + api_token + '"}'
if not na(alert_msg)
    alert(alert_msg, alert.freq_all)
plot(close)
`;

describe("typed string `na`", () => {
    it("declares the empty-string sentinel and tests that same sentinel", () => {
        const result = convert(MINIMAL, {});
        const source = result.output ?? "";
        expect(source).toContain('let alert_msg = "";');
        expect(source).toContain('if (!(alert_msg === "")) { alert(alert_msg); }');
        // The numeric arm must be gone for this receiver specifically.
        expect(source).not.toContain("Number.isFinite(alert_msg)");
        expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    });

    it("compiles the converted string-`na` script", async () => {
        const result = convert(MINIMAL, {});
        const compiled = await compile(result.output ?? "", {
            apiVersion: 1,
            sourcePath: "stringNa.chart.ts",
        });
        expect(compiled.moduleSource.length).toBeGreaterThan(0);
        expect(compiled.manifest.name).toBe("string na");
    });

    it("emits the empty-string sentinel for a `:= na` reset of a typed string", () => {
        const source =
            convert(
                `//@version=6
indicator("reset", overlay=true)
var string kept = na
if close > open
    kept := "hit"
else
    kept := na
plot(close)
`,
                {},
            ).output ?? "";
        // Both the declaration and the reset stay strings — a `Number.NaN` in
        // either position is a TS2322 against the other.
        expect(source).toContain('let kept = "";');
        expect(source).toContain('kept = "";');
        expect(source).not.toContain("Number.NaN");
    });
});

describe("99-masm-strat-full golden", () => {
    const golden = readFileSync(
        join(FIXTURES_DIR, "99-masm-strat-full.expected.chart.ts"),
        "utf-8",
    );

    it("gates the alert on the string sentinel, not on numeric finiteness", () => {
        expect(golden).toContain('let alert_msg = "";');
        expect(golden).toContain('if (!(alert_msg === ""))');
        expect(golden).not.toContain("Number.isFinite(alert_msg)");
    });

    it("compiles", async () => {
        const compiled = await compile(golden, {
            apiVersion: 1,
            sourcePath: "masmStratFull.chart.ts",
        });
        expect(compiled.moduleSource.length).toBeGreaterThan(0);
    });
});
