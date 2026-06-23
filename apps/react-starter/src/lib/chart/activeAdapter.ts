// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// ACTIVE CHART ADAPTER — the single point the create-chartlang installer
// rewrites for the chosen library. Do NOT import a concrete
// chartlang-example-*-adapter anywhere else; the rest of the app drives
// charts through the abstract `ActiveAdapterHandle` + `createActiveAdapter`
// + `runActiveLoop` exported here.

import type { AlertEmission, CandleEvent } from "@invinite-org/chartlang-adapter-kit"
import {
  createCanvas2dAdapter,
  type Canvas2dAdapterHandle,
  runRendererLoop,
} from "chartlang-example-canvas2d-adapter"

export type ActiveAdapterHandle = Canvas2dAdapterHandle

export const ACTIVE_ADAPTER_ID = "canvas2d"

/** Library-agnostic options ChartPane passes to {@link createActiveAdapter}. */
export type CreateAdapterOpts = Readonly<{
  container: HTMLElement
  candleSource: AsyncIterable<CandleEvent>
  interval?: string
  onAlert?: (a: AlertEmission) => void
}>

/** Options forwarded to {@link runActiveLoop} (cancellation via `signal`). */
export type RunActiveLoopOpts = Readonly<{ signal?: AbortSignal }>

// canvas2d paints onto a <canvas>; the seam creates one inside the generic
// container so ChartPane only ever provides a DOM node.
export function createActiveAdapter(opts: CreateAdapterOpts): ActiveAdapterHandle {
  const canvas = opts.container.ownerDocument.createElement("canvas")
  canvas.width = opts.container.clientWidth || 800
  canvas.height = opts.container.clientHeight || 480
  opts.container.replaceChildren(canvas)
  return createCanvas2dAdapter({
    canvas,
    candleSource: opts.candleSource,
    ...(opts.interval !== undefined ? { interval: opts.interval } : {}),
    ...(opts.onAlert !== undefined ? { onAlert: opts.onAlert } : {}),
  })
}

export async function runActiveLoop(
  handle: ActiveAdapterHandle,
  opts: RunActiveLoopOpts = {},
): Promise<void> {
  await runRendererLoop(handle, opts)
}
