// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

// Runs one alert runner inside a `node:worker_threads` Worker. Imports the
// BUILT package (`dist/`), exactly as a consumer's worker would.
import { parentPort, workerData } from "node:worker_threads";

import variant from "@jitl/quickjs-wasmfile-release-sync";
import { newQuickJSWASMModuleFromVariant, newVariant } from "quickjs-emscripten-core";

import { createAlertRunner } from "../../dist/index.js";

const { compiled, history, live, wasmModule } = workerData;

// With a precompiled `WebAssembly.Module` from the parent, the worker never
// compiles WASM itself; one QuickJS module serves every runner in the worker.
const quickJsModule =
    wasmModule === undefined
        ? undefined
        : newQuickJSWASMModuleFromVariant(newVariant(variant, { wasmModule }));

const runner = await createAlertRunner({
    compiled,
    interval: "1h",
    frequency: "every_time",
    symInfo: { ticker: "TEST" },
    ...(quickJsModule === undefined ? {} : { quickJsLike: () => quickJsModule }),
});
await runner.warmUp(history);
const events = [];
for (const bar of live) events.push(...(await runner.onBarClose(bar)));
const snapshot = await runner.exportSnapshot();
runner.dispose();
parentPort.postMessage({ events, snapshot });
