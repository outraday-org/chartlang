// Manual end-user smoke test: compile examples/scripts/ema-cross.chart.ts,
// run it through createScriptRunner with synthetic bars, verify emissions.
// Run: pnpm tsx examples/canvas2d-adapter/e2e-smoke.ts

import { randomBytes } from "node:crypto";
import { readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { compile } from "@invinite-org/chartlang-compiler";
import type { Bar } from "@invinite-org/chartlang-core";
import { createScriptRunner } from "@invinite-org/chartlang-runtime";

import { CANVAS2D_CAPABILITIES, CANVAS2D_SYM_INFO } from "./src/capabilities";

const ROOT = resolve(import.meta.dirname, "../..");

function makeBar(time: number, open: number, close: number): Bar {
    const high = Math.max(open, close) + 0.5;
    const low = Math.min(open, close) - 0.5;
    return {
        time,
        open,
        high,
        low,
        close,
        hl2: (high + low) / 2,
        hlc3: (high + low + close) / 3,
        ohlc4: (open + high + low + close) / 4,
        hlcc4: (high + low + close + close) / 4,
        volume: 1_000,
        symbol: "TEST",
        interval: "1D",
        point: (offset, price) => ({ time: offset === 0 ? time : Number.NaN, price }),
    };
}

// 200 bars: downtrend then uptrend so EMA(12)/EMA(26) cross both ways.
const bars: Bar[] = [];
let price = 100;
for (let i = 0; i < 200; i++) {
    const drift = i < 60 ? 0.6 : i < 130 ? -0.6 : 0.8;
    const next = price + drift + Math.sin(i / 5) * 0.8;
    bars.push(makeBar(1_700_000_000_000 + i * 86_400_000, price, next));
    price = next;
}

const source = await readFile(resolve(ROOT, "examples/scripts/ema-cross.chart.ts"), "utf8");
const compiled = await compile(source, { apiVersion: 1, sourcePath: "ema-cross.chart.ts" });

const tmpPath = resolve(import.meta.dirname, `e2e-${randomBytes(4).toString("hex")}.mjs`);
await writeFile(tmpPath, compiled.moduleSource, "utf8");
let scriptObj: { readonly default: object };
try {
    scriptObj = (await import(pathToFileURL(tmpPath).href)) as { readonly default: object };
} finally {
    await rm(tmpPath, { force: true });
}

const runner = createScriptRunner({
    compiled: Object.freeze({ ...scriptObj.default, manifest: compiled.manifest }),
    capabilities: CANVAS2D_CAPABILITIES,
    symInfo: CANVAS2D_SYM_INFO,
});

const plotsByTitle = new Map<string, number[]>();
const alerts: Array<{ message: string; barIndex: number }> = [];

for (const bar of bars) {
    await runner.push({ kind: "close", bar });
    const drained = runner.drain();
    for (const p of drained.plots) {
        const list = plotsByTitle.get(p.title) ?? [];
        if (p.value !== null) list.push(p.value);
        plotsByTitle.set(p.title, list);
    }
    for (const a of drained.alerts) {
        alerts.push({ message: a.message, barIndex: alerts.length });
    }
    if (drained.diagnostics.length > 0) {
        console.error("DIAGNOSTICS:", drained.diagnostics);
    }
}
await runner.dispose();

let failures = 0;
function check(label: string, ok: boolean, detail = ""): void {
    console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
    if (!ok) failures++;
}

const fast = plotsByTitle.get("EMA(12)") ?? [];
const slow = plotsByTitle.get("EMA(26)") ?? [];
// EMA(n) warms up for n-1 bars (null values), then emits every bar.
check("EMA(12) plotted after 11-bar warmup", fast.length === bars.length - 11, `${fast.length}/${bars.length - 11}`);
check("EMA(26) plotted after 25-bar warmup", slow.length === bars.length - 25, `${slow.length}/${bars.length - 25}`);
check(
    "EMA values finite after warmup",
    fast.slice(30).every(Number.isFinite) && slow.slice(30).every(Number.isFinite),
);
const lastClose = bars[bars.length - 1].close;
check(
    "EMA(12) tracks price",
    Math.abs(fast[fast.length - 1] - lastClose) < 10,
    `ema=${fast[fast.length - 1]?.toFixed(2)} close=${lastClose.toFixed(2)}`,
);
const crossUp = alerts.filter((a) => a.message.includes("above"));
const crossDown = alerts.filter((a) => a.message.includes("below"));
check("crossover alert fired", crossUp.length >= 1, `${crossUp.length} up alerts`);
check("crossunder alert fired", crossDown.length >= 1, `${crossDown.length} down alerts`);
// In a downtrend-then-uptrend, fast EMA must end above slow EMA.
check(
    "fast EMA above slow EMA at end of uptrend",
    fast[fast.length - 1] > slow[slow.length - 1],
);

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
