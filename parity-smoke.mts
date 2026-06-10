// Manual cross-host parity smoke test (end-user testing, not CI).
// Runs the compiled ema-cross script through: (A) in-process ScriptRunner,
// (B) host-worker via MessageChannel WorkerLike, (C) host-quickjs (real WASM).
// Run: pnpm tsx parity-smoke.mts

import { readFile } from "node:fs/promises";

import { CANVAS2D_CAPABILITIES } from "./examples/canvas2d-adapter/src/capabilities";
import { compile } from "./packages/compiler/src/index";
import type { Bar } from "./packages/core/src/index";
import { createQuickJsHost } from "./packages/host-quickjs/src/index";
import {
    createWorkerBoot,
    createWorkerHost,
    type WorkerBootScope,
} from "./packages/host-worker/src/index";
import type { WorkerLike } from "./packages/host-worker/src/types";
import { createScriptRunner } from "./packages/runtime/src/index";

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
    };
}

const bars: Bar[] = [];
let price = 100;
for (let i = 0; i < 150; i++) {
    const drift = i < 50 ? 0.6 : i < 100 ? -0.6 : 0.8;
    const next = price + drift + Math.sin(i / 5) * 0.8;
    bars.push(makeBar(1_700_000_000_000 + i * 86_400_000, price, next));
    price = next;
}

const source = await readFile("examples/scripts/ema-cross.chart.ts", "utf8");
const compiled = await compile(source, { apiVersion: 1, sourcePath: "ema-cross.chart.ts" });

type Snap = { plots: string[]; alerts: string[] };

function snapOf(plots: Array<{ slotId: string; bar: number; value: number | null }>, alerts: Array<{ slotId: string; bar: number; message: string }>): Snap {
    return {
        plots: plots.map((p) => `${p.slotId}|${p.bar}|${p.value === null ? "null" : p.value.toFixed(10)}`),
        alerts: alerts.map((a) => `${a.slotId}|${a.bar}|${a.message}`),
    };
}

async function runInProcess(): Promise<Snap> {
    const mod = (await import(
        `data:text/javascript;charset=utf-8,${encodeURIComponent(compiled.moduleSource)}`
    )) as { default: object };
    const runner = createScriptRunner({
        compiled: Object.freeze({ ...mod.default, manifest: compiled.manifest }),
        capabilities: CANVAS2D_CAPABILITIES,
    });
    const plots: Array<{ slotId: string; bar: number; value: number | null }> = [];
    const alerts: Array<{ slotId: string; bar: number; message: string }> = [];
    for (const bar of bars) {
        await runner.push({ kind: "close", bar });
        const d = runner.drain();
        plots.push(...d.plots);
        alerts.push(...d.alerts);
    }
    await runner.dispose();
    return snapOf(plots, alerts);
}

function pair(): { worker: WorkerLike; scope: WorkerBootScope } {
    const ch = new MessageChannel();
    ch.port1.start();
    ch.port2.start();
    const worker: WorkerLike = {
        addEventListener(_type, listener) {
            ch.port1.addEventListener("message", (ev) => listener(ev as MessageEvent<unknown>));
        },
        postMessage(msg) {
            ch.port1.postMessage(msg);
        },
        terminate() {
            ch.port1.close();
            ch.port2.close();
        },
    };
    const scope: WorkerBootScope = {
        addEventListener(_type, listener) {
            ch.port2.addEventListener("message", (ev) => void listener(ev as MessageEvent<never>));
        },
        postMessage(msg) {
            ch.port2.postMessage(msg);
        },
    };
    return { worker, scope };
}

async function runWorkerHost(): Promise<Snap> {
    const { worker, scope } = pair();
    createWorkerBoot(scope);
    const host = createWorkerHost({ capabilities: CANVAS2D_CAPABILITIES, workerLike: worker });
    await host.load({ moduleSource: compiled.moduleSource, manifest: compiled.manifest });
    const plots: Array<{ slotId: string; bar: number; value: number | null }> = [];
    const alerts: Array<{ slotId: string; bar: number; message: string }> = [];
    for (const bar of bars) {
        await host.push({ kind: "close", bar });
        const d = await host.drain();
        plots.push(...d.plots);
        alerts.push(...d.alerts);
    }
    host.dispose();
    return snapOf(plots, alerts);
}

async function runQuickJsHost(): Promise<Snap> {
    const host = createQuickJsHost({ capabilities: CANVAS2D_CAPABILITIES });
    await host.load({ moduleSource: compiled.moduleSource, manifest: compiled.manifest });
    const plots: Array<{ slotId: string; bar: number; value: number | null }> = [];
    const alerts: Array<{ slotId: string; bar: number; message: string }> = [];
    for (const bar of bars) {
        await host.push({ kind: "close", bar });
        const d = await host.drain();
        plots.push(...d.plots);
        alerts.push(...d.alerts);
    }
    host.dispose();
    return snapOf(plots, alerts);
}

function compare(label: string, a: Snap, b: Snap): boolean {
    const pa = a.plots.join("\n");
    const pb = b.plots.join("\n");
    const aa = a.alerts.join("\n");
    const ab = b.alerts.join("\n");
    if (pa === pb && aa === ab) {
        console.log(`PASS  ${label} — ${a.plots.length} plots, ${a.alerts.length} alerts identical`);
        return true;
    }
    console.log(`FAIL  ${label}`);
    if (pa !== pb) {
        const la = a.plots;
        const lb = b.plots;
        console.log(`  plot counts: ${la.length} vs ${lb.length}`);
        for (let i = 0; i < Math.max(la.length, lb.length); i++) {
            if (la[i] !== lb[i]) {
                console.log(`  first divergence at plot[${i}]:\n    A: ${la[i]}\n    B: ${lb[i]}`);
                break;
            }
        }
    }
    if (aa !== ab) console.log(`  alerts differ:\n    A: ${aa}\n    B: ${ab}`);
    return false;
}

const inProcess = await runInProcess();
console.log(`in-process: ${inProcess.plots.length} plots, ${inProcess.alerts.length} alerts`);
const workerSnap = await runWorkerHost();
console.log(`host-worker: ${workerSnap.plots.length} plots, ${workerSnap.alerts.length} alerts`);
const quickjsSnap = await runQuickJsHost();
console.log(`host-quickjs: ${quickjsSnap.plots.length} plots, ${quickjsSnap.alerts.length} alerts`);

let ok = true;
ok = compare("in-process vs host-worker", inProcess, workerSnap) && ok;
ok = compare("in-process vs host-quickjs", inProcess, quickjsSnap) && ok;
console.log(ok ? "\nPARITY: ALL HOSTS IDENTICAL" : "\nPARITY FAILURES FOUND");
process.exit(ok ? 0 : 1);
