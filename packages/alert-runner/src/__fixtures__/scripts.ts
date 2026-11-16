// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { compile } from "@invinite-org/chartlang-compiler";

import type { AlertBar, AlertRunnerCompiledScript } from "../types.js";

const cache = new Map<string, Promise<AlertRunnerCompiledScript>>();

/** Compile (once per source) a test script through the real compiler. */
export function compiled(
    source: string,
    sourcePath = "fixture.chart.ts",
): Promise<AlertRunnerCompiledScript> {
    const cacheKey = `${sourcePath}\n${source}`;
    let pending = cache.get(cacheKey);
    if (pending === undefined) {
        pending = compile(source, { apiVersion: 1, sourcePath }).then((c) => ({
            moduleSource: c.moduleSource,
            manifest: c.manifest,
        }));
        cache.set(cacheKey, pending);
    }
    return pending;
}

export const HOUR = 3_600_000;
export const T0 = 1_700_000_000_000 - (1_700_000_000_000 % HOUR);

/** Deterministic pseudo-random walk of hourly bars. */
export function walk(count: number, start = 0, interval = HOUR): AlertBar[] {
    const bars: AlertBar[] = [];
    let seed = 7;
    let close = 100;
    for (let i = 0; i < start + count; i += 1) {
        seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
        const open = close;
        close = Math.round((open + (seed / 2_147_483_648 - 0.5) * 4) * 100) / 100;
        if (i < start) continue;
        bars.push({
            time: T0 + i * interval,
            open,
            high: Math.max(open, close) + 0.5,
            low: Math.min(open, close) - 0.5,
            close,
            volume: 1_000 + (seed % 500),
        });
    }
    return bars;
}

/** Alerts on every bar whose close is above its open; carries the close. */
export const UP_BAR_ALERT = `import { defineIndicator } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Up bar",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, alert }) {
        const fast = ta.ema(bar.close, 5);
        if (bar.close > bar.open) {
            alert("up " + bar.close, { severity: "warning", meta: { close: bar.close, fast: fast.current } });
        }
    },
});
`;

/** Two conditions; \`up\` fires on up bars, \`never\` never fires. */
export const CONDITIONS = `import { defineAlertCondition } from "@invinite-org/chartlang-core";

export default defineAlertCondition({
    name: "Conditions",
    apiVersion: 1,
    conditions: {
        up: { title: "Up", description: "Close above open.", defaultMessage: "{{ticker}} up" },
        never: { title: "Never", description: "Never fires.", defaultMessage: "never" },
    },
    compute({ bar, signal }) {
        signal?.("up", bar.close > bar.open);
        signal?.("never", false);
    },
});
`;

/** An int input with bounds, an enum and a source input. */
export const WITH_INPUTS = `import { defineIndicator, input } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Inputs",
    apiVersion: 1,
    overlay: true,
    inputs: {
        length: input.int(3, { min: 1, max: 50 }),
        mode: input.enum("above", ["above", "below"]),
        src: input.source("close"),
    },
    compute({ bar, ta, alert, inputs }) {
        const avg = ta.sma(bar.close, inputs.length);
        if (inputs.mode === "above" ? bar.close > avg.current : bar.close < avg.current) {
            alert("cross " + inputs.mode);
        }
    },
});
`;

/** Loops forever on the bar after \`time\`. */
export function heavyAfter(time: number): string {
    return `import { defineIndicator } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Heavy",
    apiVersion: 1,
    overlay: true,
    compute({ bar, alert }) {
        let s = 0;
        if (bar.time > ${time}) {
            for (let i = 0; i < 100000000; i++) { s += i; }
        }
        if (s > 0) alert("never");
    },
});
`;
}

/** Reads a daily secondary stream through \`request.security\`. */
export const MTF = `import { defineIndicator } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "MTF",
    apiVersion: 1,
    overlay: true,
    compute({ bar, request, alert }) {
        const daily = request.security({ interval: "1D" });
        if (bar.close > daily.close.current) alert("above daily close " + daily.close.current);
    },
});
`;

/** An EMA cross through `ta.crossover`, whose state a snapshot does not carry. */
export const CROSS = `import { defineIndicator } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Cross",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, alert }) {
        const fast = ta.ema(bar.close, 3);
        const slow = ta.ema(bar.close, 8);
        if (ta.crossover(fast, slow).current) alert("cross up");
        if (ta.crossunder(fast, slow).current) alert("cross down");
    },
});
`;
