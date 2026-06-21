// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// ACTIVE CHART ADAPTER — the single point the create-chartlang installer
// rewrites for the chosen library. Do NOT import a concrete
// chartlang-example-*-adapter anywhere else; the rest of the app drives
// charts through the abstract `ActiveAdapterHandle` + `createActiveAdapter`
// + `runActiveLoop` exported here.

import type { AlertEmission, CandleEvent } from "@invinite-org/chartlang-adapter-kit"
import * as echarts from "echarts"
import {
  createEChartsAdapter,
  type EChartsAdapterHandle,
  type EChartsSurface,
  runEChartsLoop,
} from "chartlang-example-echarts-adapter"

export type ActiveAdapterHandle = EChartsAdapterHandle

export const ACTIVE_ADAPTER_ID = "echarts"

/** Library-agnostic options ChartPane passes to {@link createActiveAdapter}. */
export type CreateAdapterOpts = Readonly<{
  container: HTMLElement
  candleSource: AsyncIterable<CandleEvent>
  interval?: string
  onAlert?: (a: AlertEmission) => void
}>

/** Options forwarded to {@link runActiveLoop} (cancellation via `signal`). */
export type RunActiveLoopOpts = Readonly<{ signal?: AbortSignal }>

// echarts needs a DOM container + sizing it does not own, so the factory —
// not a raw container — is the seam: this module owns the echarts.init call.
//
// The adapter's `buildViewport` treats `convertToPixel` as "returns undefined
// when the chart isn't laid out yet"; the real echarts instance instead THROWS
// before its first laid-out `setOption` (reading `queryComponents` of an
// undefined coordinate system). Wrap it so a pre-layout call returns undefined,
// honouring the adapter contract and letting it fall back to a deterministic
// viewport instead of killing the render loop.
function makeEchartsSurface(container: HTMLElement): EChartsSurface {
  const chart = echarts.init(container)
  return {
    setOption: (option, setOpts) => chart.setOption(option, setOpts),
    resize: () => chart.resize(),
    dispose: () => chart.dispose(),
    convertToPixel: (finder, value) => {
      try {
        const px = chart.convertToPixel(finder, value as unknown as number[])
        return Array.isArray(px) ? ([px[0], px[1]] as const) : undefined
      } catch {
        return undefined
      }
    },
  }
}

export function createActiveAdapter(opts: CreateAdapterOpts): ActiveAdapterHandle {
  return createEChartsAdapter({
    echartsFactory: () => makeEchartsSurface(opts.container),
    candleSource: opts.candleSource,
    ...(opts.interval !== undefined ? { interval: opts.interval } : {}),
    ...(opts.onAlert !== undefined ? { onAlert: opts.onAlert } : {}),
  })
}

export async function runActiveLoop(
  handle: ActiveAdapterHandle,
  opts: RunActiveLoopOpts = {},
): Promise<void> {
  await runEChartsLoop(handle, opts)
}
