// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Manual browser smoke test — not part of CI. Open `index.html`
// in a browser served from the repo root (e.g. `python3 -m
// http.server` or `pnpm dlx http-server`).
//
// Depends on Task 11's compiled `examples/scripts/ema-cross.chart.js`
// + `ema-cross.chart.manifest.json` triple. Until Task 11 lands,
// this file documents the intended consumer flow; it does not
// build via the example adapter's `pnpm build` step.

import { mockCandleSource } from "@invinite-org/chartlang-adapter-kit";
import type { Bar } from "@invinite-org/chartlang-core";

import { createCanvas2dAdapter, runRendererLoop } from "../src";

declare global {
    interface ImportMeta {
        readonly url: string;
    }
}

const canvas = document.querySelector<HTMLCanvasElement>("#chart");
if (canvas === null) throw new Error("playground: #chart canvas not found");

const bars: ReadonlyArray<Bar> = await fetch(new URL("./bars.json", import.meta.url)).then(
    (r) => r.json() as Promise<ReadonlyArray<Bar>>,
);

const compiledResp = await fetch(new URL("../../scripts/ema-cross.chart.js", import.meta.url));
const moduleSource = await compiledResp.text();
const manifestResp = await fetch(
    new URL("../../scripts/ema-cross.chart.manifest.json", import.meta.url),
);
const manifest = await manifestResp.json();

const adapter = createCanvas2dAdapter({
    canvas,
    candleSource: mockCandleSource(bars, { interval: "1D", mode: "stream" }),
});
await adapter.host.load({ moduleSource, manifest });
await runRendererLoop(adapter);
