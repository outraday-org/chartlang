// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

// Conformance through `@invinite-org/chartlang-alert-runner`: every bundled
// scenario that raises alerts runs through the runner (QuickJS, warm-up then
// bar closes) and must deliver, under `every_time`, exactly the alerts and
// fired conditions the in-process runtime drains for the same bars; and the
// frequency scenarios pin what each frequency delivers.
import { createAlertRunner } from "@invinite-org/chartlang-alert-runner";
import type { AlertBar, AlertRunnerEvent } from "@invinite-org/chartlang-alert-runner";
import { compile } from "@invinite-org/chartlang-compiler";
import { describe, expect, it } from "vitest";

import {
    INTERVAL,
    SYMBOL,
    comparable,
    comparableDrains,
    compileScenario,
    isRunnerEligible,
    loadGoldenBars,
    planRun,
    referenceEmissions,
    runnerEvents,
    scenarioMentionsAlerts,
    scenarioUsesAlerts,
} from "./__fixtures__/alertRunnerHarness.js";
import { FREQUENCY_SCENARIOS } from "./__fixtures__/alertRunnerFrequencyScenarios.js";
import { ALL_SCENARIOS } from "./scenarios/index.js";

const BARS = 200;
const WARM = 100;

/**
 * Scenarios the QuickJS host cannot load today: a bundle with private
 * `const` dependencies compiles to `export { x as default, … }`, which
 * `moduleSourceToScript` does not recognise ("compiled module did not declare
 * an export default") — a host-quickjs gap, not an alert-runner one. Pinned
 * so a fix shows up here.
 */
const QUICKJS_UNLOADABLE = [
    "dep-crossover-gate",
    "dep-diamond",
    "dep-error-halts-parent",
    "dep-multi-export",
    "dep-private-single-file",
];

describe("alert runner pass", () => {
    it("every_time equals the runtime drain on every scenario the QuickJS host loads", async () => {
        const bars = (await loadGoldenBars()).slice(0, BARS);
        let compared = 0;
        let alerting = 0;
        let events = 0;
        const mismatches: string[] = [];
        const unloadable: string[] = [];
        for (const scenario of ALL_SCENARIOS.filter(isRunnerEligible)) {
            if (!(await scenarioMentionsAlerts(scenario))) continue;
            const compiled = await compileScenario(scenario);
            if (scenarioUsesAlerts(compiled)) alerting += 1;
            const plan = planRun(
                scenario,
                bars,
                Math.min(WARM, Math.floor((scenario.candleLimit ?? BARS) / 2)),
            );
            let actual: Record<string, unknown>[];
            try {
                actual = (await runnerEvents(compiled, plan)).map(comparable);
            } catch (err) {
                if ((err as { code?: unknown }).code !== "load-failed") throw err;
                unloadable.push(scenario.id);
                continue;
            }
            const expected = comparableDrains(await referenceEmissions(compiled, plan));
            if (JSON.stringify(actual) !== JSON.stringify(expected)) {
                mismatches.push(
                    `${scenario.id}: runner ${actual.length} events, runtime ${expected.length}`,
                );
            }
            compared += 1;
            events += actual.length;
        }
        expect(mismatches).toEqual([]);
        expect(unloadable.filter((id) => !QUICKJS_UNLOADABLE.includes(id))).toEqual([]);
        expect(compared).toBeGreaterThanOrEqual(5);
        expect(alerting).toBeGreaterThanOrEqual(5);
        expect(events).toBeGreaterThan(0);
    }, 300_000);
});

describe("alert runner and the QuickJS host", () => {
    it("still cannot load private-dependency bundles", async () => {
        const failing: string[] = [];
        for (const id of QUICKJS_UNLOADABLE) {
            const scenario = ALL_SCENARIOS.find((s) => s.id === id);
            if (scenario === undefined) continue;
            const compiled = await compileScenario(scenario);
            const failure = await createAlertRunner({
                compiled,
                interval: INTERVAL,
                frequency: "every_time",
            }).then(
                (runner) => {
                    runner.dispose();
                    return null;
                },
                (err: unknown) => err,
            );
            if ((failure as { code?: unknown } | null)?.code === "load-failed") failing.push(id);
        }
        // A host fix makes this list shrink: drop the id from QUICKJS_UNLOADABLE.
        expect(failing).toEqual(QUICKJS_UNLOADABLE);
    }, 120_000);
});

describe("alert runner frequency scenarios", () => {
    for (const scenario of FREQUENCY_SCENARIOS) {
        it(`${scenario.id}: ${scenario.title}`, async () => {
            const bars = (await loadGoldenBars()).slice(0, 200);
            const compiled = await compile(scenario.inlineSource, {
                apiVersion: 1,
                sourcePath: `<inline:${scenario.id}>.chart.ts`,
            });
            const runner = await createAlertRunner({
                compiled,
                interval: INTERVAL,
                symInfo: { ticker: SYMBOL },
                frequency: scenario.frequency,
                limits: { maxStepMs: 60_000 },
                ...(scenario.cooldownBars === undefined
                    ? {}
                    : { cooldownBars: scenario.cooldownBars }),
            });
            await runner.warmUp(bars.slice(0, 100));
            const delivered: AlertRunnerEvent[] = [];
            for (const bar of bars.slice(100) as AlertBar[]) {
                if (scenario.preClose)
                    delivered.push(...(await runner.onPreClose(bar, 60_000)).events);
                delivered.push(...(await runner.onBarClose(bar)));
            }
            runner.dispose();

            const count = (phase: "close" | "preClose") =>
                delivered.filter((e) => e.phase === phase).length;
            expect({ close: count("close"), preClose: count("preClose") }).toEqual(
                scenario.expected,
            );
            expect(new Set(delivered.map((e) => e.dedupeKey)).size).toBe(delivered.length);
        }, 120_000);
    }
});
