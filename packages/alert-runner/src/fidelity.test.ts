// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import { createQuickJsHost } from "@invinite-org/chartlang-host-quickjs";
import { describe, expect, it } from "vitest";

import {
    CONDITIONS,
    CROSS,
    MTF,
    UP_BAR_ALERT,
    WITH_INPUTS,
    compiled,
    walk,
} from "./__fixtures__/scripts.js";
import { toRuntimeBar } from "./bar.js";
import { snapshotFidelityOf } from "./fidelity.js";

const script = (
    body: string,
    imports = "defineIndicator",
) => `import { ${imports} } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Fidelity",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, state, plot, alert, request, draw }) {
        ${body}
    },
});
`;

// Each case compiles real scripts through esbuild; give them room.
const COMPILE_TIMEOUT = 60_000;

describe("snapshotFidelityOf", () => {
    it(
        "is exact for scripts whose state the snapshot carries",
        async () => {
            for (const source of [UP_BAR_ALERT, CONDITIONS, WITH_INPUTS, MTF]) {
                expect(snapshotFidelityOf(await compiled(source))).toBe("exact");
            }
            const persisted = script(`
            const s = state.float(0);
            s.value = s.value + 1;
            const r = ta.rsi(bar.close, 14);
            plot(ta.sma(bar.close, 5));
            if (r.current > 70) alert("hot " + s.value);
        `);
            expect(snapshotFidelityOf(await compiled(persisted, "persisted.chart.ts"))).toBe(
                "exact",
            );
        },
        COMPILE_TIMEOUT,
    );

    it(
        "is lossy whenever the runner feeds external series",
        async () => {
            const exact = await compiled(UP_BAR_ALERT);
            expect(snapshotFidelityOf(exact, { externalSeries: false })).toBe("exact");
            expect(snapshotFidelityOf(exact, { externalSeries: true })).toBe("lossy");
        },
        COMPILE_TIMEOUT,
    );

    it(
        "is lossy for any other slot-bearing primitive",
        async () => {
            expect(snapshotFidelityOf(await compiled(CROSS))).toBe("lossy");
            for (const body of [
                "if (ta.atr(14).current > 1) alert('wide');",
                "if (ta.highest(bar.high, 10).current > 0) alert('high');",
                "draw.line({ time: bar.time, price: bar.low }, { time: bar.time, price: bar.high });",
            ]) {
                expect(
                    snapshotFidelityOf(
                        await compiled(script(body), `lossy-${body.length}.chart.ts`),
                    ),
                ).toBe("lossy");
            }
        },
        COMPILE_TIMEOUT,
    );

    it(
        "is lossy for an expression-form request.security",
        async () => {
            const source = script(`
            const htf = request.security({ interval: "1D" }, (b) => b.close);
            if (bar.close > htf.current) alert("above");
        `);
            expect(snapshotFidelityOf(await compiled(source, "expr.chart.ts"))).toBe("lossy");
        },
        COMPILE_TIMEOUT,
    );

    it(
        "matches the TA kinds a real runtime snapshot carries",
        async () => {
            // Pins the persisted ta.* subset against the runtime: if the runtime
            // starts persisting another kind, this fails and the set in
            // fidelity.ts can grow.
            const c = await compiled(
                script(`
                plot(ta.sma(bar.close, 3));
                plot(ta.ema(bar.close, 3));
                plot(ta.rsi(bar.close, 3));
                plot(ta.wma(bar.close, 3));
                plot(ta.atr(3));
                plot(ta.highest(bar.high, 3));
            `),
                "kinds.chart.ts",
            );
            const caps: Capabilities = {
                plots: capabilities.allPhase5Plots(),
                drawings: new Set(),
                alerts: new Set(),
                alertConditions: false,
                logs: false,
                orders: false,
                inputs: new Set(),
                intervals: [],
                multiTimeframe: false,
                multiSymbol: false,
                subPanes: 10,
                symInfoFields: new Set(),
                maxDrawingsPerScript: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
                maxLookback: 100,
                maxTickHz: 1,
            };
            const host = createQuickJsHost({ capabilities: caps });
            await host.load(c);
            for (const bar of walk(10))
                await host.push({ kind: "close", bar: toRuntimeBar(bar, "X", "1h") });
            await host.drain();
            const exported = await host.exportSnapshot();
            host.dispose();
            const kinds = Object.entries(exported?.snapshot.primary.slots ?? {})
                .filter(([slotKey]) => slotKey.startsWith("ta:"))
                .map(([, value]) => (value as { kind: string }).kind)
                .sort();
            expect(kinds).toEqual(["ta.ema", "ta.rsi", "ta.sma"]);
        },
        COMPILE_TIMEOUT,
    );
});
