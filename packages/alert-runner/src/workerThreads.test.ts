// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";

import { describe, expect, it, vi } from "vitest";

import { UP_BAR_ALERT, compiled, walk } from "./__fixtures__/scripts.js";
import { createAlertRunner } from "./runner.js";
import type { AlertRunnerEvent, AlertRunnerSnapshot } from "./types.js";

// Real scripts compile through esbuild and run in QuickJS; a loaded CI box
// needs more than the default 5 s.
vi.setConfig({ testTimeout: 60_000 });

type WorkerResult = { events: AlertRunnerEvent[]; snapshot: AlertRunnerSnapshot };

const WORKER = new URL("./__fixtures__/alertRunnerWorker.mjs", import.meta.url);
const DIST = fileURLToPath(new URL("../dist/index.js", import.meta.url));
const BARS = walk(150);

function inWorker(workerData: Record<string, unknown>): Promise<WorkerResult> {
    return new Promise((resolve, reject) => {
        const worker = new Worker(WORKER, { workerData });
        worker.once("message", (message: WorkerResult) => {
            resolve(message);
            void worker.terminate();
        });
        worker.once("error", reject);
    });
}

describe("node:worker_threads", () => {
    it("needs the built package", () => {
        // The worker imports `dist/` like a consumer would; `pnpm build` first.
        expect(existsSync(DIST)).toBe(true);
    });

    it("loads the WASM and runs a script inside Workers, matching the main thread", async () => {
        const script = await compiled(UP_BAR_ALERT);
        const history = BARS.slice(0, 100);
        const live = BARS.slice(100);

        const main = await createAlertRunner({
            compiled: script,
            interval: "1h",
            frequency: "every_time",
            symInfo: { ticker: "TEST" },
        });
        await main.warmUp(history);
        const expected: AlertRunnerEvent[] = [];
        for (const bar of live) expected.push(...(await main.onBarClose(bar)));
        main.dispose();
        expect(expected.length).toBeGreaterThan(0);

        // A WebAssembly.Module compiled once here crosses into the worker, so
        // the worker instantiates QuickJS without compiling WASM at runtime.
        const wasmPath = createRequire(import.meta.url).resolve(
            "@jitl/quickjs-wasmfile-release-sync/wasm",
        );
        const wasmModule = await WebAssembly.compile(await readFile(wasmPath));

        const [plain, precompiled] = await Promise.all([
            inWorker({ compiled: script, history, live }),
            inWorker({ compiled: script, history, live, wasmModule }),
        ]);

        expect(plain.events).toEqual(expected);
        expect(precompiled.events).toEqual(expected);
        expect(plain.snapshot.key).toEqual(precompiled.snapshot.key);
        expect(plain.snapshot.lastBarTime).toBe(live[live.length - 1]?.time);
    });
});
