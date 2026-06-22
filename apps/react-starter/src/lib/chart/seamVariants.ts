// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// SEAM VARIANTS — the single source of truth for the per-library
// `activeAdapter.ts` body. One entry per bundled adapter id. The committed
// `activeAdapter.ts` is the `echarts` variant rendered from this table
// (byte-identical to `SEAM_VARIANTS.find(v => v.id === "echarts").seamSource`).
//
// Two consumers depend on this being the SSOT:
//   1. `tests/adapter-matrix.spec.ts` rewrites `activeAdapter.ts` to each
//      variant's `seamSource` and proves every library mounts a chart.
//   2. Task 7's installer `seamTemplates.ts` MUST emit a body byte-identical
//      to `SEAM_VARIANTS[id].seamSource` (after the `workspace:*` →
//      published-version substitution), guarded by a test there.
//
// Each `seamSource` is the FULL `activeAdapter.ts` file for that id. The
// contract every variant satisfies:
//   - import the concrete `create<X>Adapter` (+ its render entry + handle
//     type) from `chartlang-example-<id>-adapter`, plus the npm chart lib;
//   - `createActiveAdapter({ container, candleSource, interval?, onAlert? })`
//     maps the generic opts to the per-library factory args;
//   - `runActiveLoop(handle, { signal })` drives the per-library render loop;
//   - re-export `ActiveAdapterHandle` + `ACTIVE_ADAPTER_ID`.
//
// Mount kinds: canvas2d → a <canvas> the seam creates in `container`;
// lightweight-charts / uplot → the `container` element; echarts / konva →
// the `container` element (echarts.init / new Konva.Stage). `mount` records
// the DOM kind the matrix test asserts ("canvas" vs "div").

/** One bundled-adapter seam descriptor. */
export type SeamVariant = Readonly<{
  id: "canvas2d" | "lightweight-charts" | "uplot" | "echarts" | "konva"
  /** The `chartlang-example-<id>-adapter` package name. */
  pkg: string
  /** The npm chart library the seam imports (empty for canvas2d). */
  lib: string
  /** DOM mount kind the matrix test asserts. */
  mount: "canvas" | "div"
  /** The full `activeAdapter.ts` body for this id. */
  seamSource: string
}>

const HEADER = `// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// ACTIVE CHART ADAPTER — the single point the create-chartlang installer
// rewrites for the chosen library. Do NOT import a concrete
// chartlang-example-*-adapter anywhere else; the rest of the app drives
// charts through the abstract \`ActiveAdapterHandle\` + \`createActiveAdapter\`
// + \`runActiveLoop\` exported here.

import type { AlertEmission, CandleEvent } from "@invinite-org/chartlang-adapter-kit"`

const OPTS_TYPES = `/** Library-agnostic options ChartPane passes to {@link createActiveAdapter}. */
export type CreateAdapterOpts = Readonly<{
  container: HTMLElement
  candleSource: AsyncIterable<CandleEvent>
  interval?: string
  onAlert?: (a: AlertEmission) => void
}>

/** Options forwarded to {@link runActiveLoop} (cancellation via \`signal\`). */
export type RunActiveLoopOpts = Readonly<{ signal?: AbortSignal }>`

// canvas2d: create a <canvas> inside the container; runRendererLoop drives it.
const CANVAS2D_SEAM = `${HEADER}
import {
  createCanvas2dAdapter,
  type Canvas2dAdapterHandle,
  runRendererLoop,
} from "chartlang-example-canvas2d-adapter"

export type ActiveAdapterHandle = Canvas2dAdapterHandle

export const ACTIVE_ADAPTER_ID = "canvas2d"

${OPTS_TYPES}

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
`

// lightweight-charts: takes the container directly; runRendererLoop drives it.
const LWC_SEAM = `${HEADER}
import {
  createLightweightChartsAdapter,
  type LwcAdapterHandle,
  runRendererLoop,
} from "chartlang-example-lightweight-charts-adapter"

export type ActiveAdapterHandle = LwcAdapterHandle

export const ACTIVE_ADAPTER_ID = "lightweight-charts"

${OPTS_TYPES}

export function createActiveAdapter(opts: CreateAdapterOpts): ActiveAdapterHandle {
  return createLightweightChartsAdapter({
    container: opts.container,
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
`

// uplot: mounts on a target element with explicit size; runUplotLoop drives it.
const UPLOT_SEAM = `${HEADER}
import "uplot/dist/uPlot.min.css"
import {
  createUplotAdapter,
  type UplotAdapterHandle,
  runUplotLoop,
} from "chartlang-example-uplot-adapter"

export type ActiveAdapterHandle = UplotAdapterHandle

export const ACTIVE_ADAPTER_ID = "uplot"

${OPTS_TYPES}

export function createActiveAdapter(opts: CreateAdapterOpts): ActiveAdapterHandle {
  return createUplotAdapter({
    target: opts.container,
    width: opts.container.clientWidth || 800,
    height: opts.container.clientHeight || 480,
    candleSource: opts.candleSource,
    ...(opts.interval !== undefined ? { interval: opts.interval } : {}),
    ...(opts.onAlert !== undefined ? { onAlert: opts.onAlert } : {}),
  })
}

export async function runActiveLoop(
  handle: ActiveAdapterHandle,
  opts: RunActiveLoopOpts = {},
): Promise<void> {
  await runUplotLoop(handle, opts)
}
`

// echarts (default): created from echartsFactory: () => echarts.init(container);
// runEChartsLoop re-setOptions on each host drain. THIS body equals the
// committed activeAdapter.ts verbatim.
const ECHARTS_SEAM = `${HEADER}
import * as echarts from "echarts"
import {
  createEChartsAdapter,
  type EChartsAdapterHandle,
  type EChartsSurface,
  runEChartsLoop,
} from "chartlang-example-echarts-adapter"

export type ActiveAdapterHandle = EChartsAdapterHandle

export const ACTIVE_ADAPTER_ID = "echarts"

${OPTS_TYPES}

// echarts needs a DOM container + sizing it does not own, so the factory —
// not a raw container — is the seam: this module owns the echarts.init call.
//
// The adapter's \`buildViewport\` treats \`convertToPixel\` as "returns undefined
// when the chart isn't laid out yet"; the real echarts instance instead THROWS
// before its first laid-out \`setOption\` (reading \`queryComponents\` of an
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
`

// konva: mounts a Konva.Stage on the container. It has NO async render loop
// (it redraws inline from onEmissions) and its factory has NO onAlert field,
// so the seam builds a local loop over feedCandleEvent + handleInterval and
// forwards alerts itself from the drain.
const KONVA_SEAM = `${HEADER}
import Konva from "konva"
import type { RunnerEmissions } from "@invinite-org/chartlang-adapter-kit"
import {
  type CreateKonvaAdapterOpts,
  createKonvaAdapter,
  feedCandleEvent,
  handleInterval,
  type KonvaAdapterHandle,
} from "chartlang-example-konva-adapter"

export type ActiveAdapterHandle = KonvaAdapterHandle

export const ACTIVE_ADAPTER_ID = "konva"

${OPTS_TYPES}

export function createActiveAdapter(opts: CreateAdapterOpts): ActiveAdapterHandle {
  const width = opts.container.clientWidth || 800
  const height = opts.container.clientHeight || 480
  // The Konva adapter's StageConfig omits \`container\` (it renders headlessly
  // and lets the caller wire the DOM node), but the real Konva.Stage requires
  // one. Inject the seam's container by subclassing Stage so the adapter's
  // \`new konva.Stage({ width, height })\` mounts onto our DOM node. The real
  // Konva namespace is wider than the slice the adapter consumes, so cast it
  // to the adapter's own \`konva\` field type.
  const konva = {
    ...Konva,
    Stage: class extends Konva.Stage {
      constructor(config: { width: number; height: number }) {
        super({ ...config, container: opts.container as HTMLDivElement })
      }
    },
  } as unknown as CreateKonvaAdapterOpts["konva"]
  return createKonvaAdapter({
    konva,
    stage: { width, height },
    candleSource: opts.candleSource,
    ...(opts.interval !== undefined ? { interval: opts.interval } : {}),
  })
}

// konva has no exported async loop; mirror the shared loop shape locally over
// feedCandleEvent / handleInterval and forward alerts from each drain (its
// factory carries no onAlert hook).
export async function runActiveLoop(
  handle: ActiveAdapterHandle,
  opts: RunActiveLoopOpts = {},
): Promise<void> {
  const signal = opts.signal
  const aborted = (): boolean => signal?.aborted ?? false
  if (aborted()) return
  for await (const event of handle.candles({ interval: handleInterval(handle) })) {
    if (aborted()) return
    feedCandleEvent(handle, event)
    await handle.host.push(event)
    if (aborted()) return
    await new Promise<void>((r) => setTimeout(r, 0))
    if (aborted()) return
    const emissions: RunnerEmissions = await handle.host.drain()
    if (aborted()) return
    handle.onEmissions(emissions)
  }
}
`

/** The five bundled adapter seam variants (echarts is the committed default). */
export const SEAM_VARIANTS: ReadonlyArray<SeamVariant> = [
  {
    id: "canvas2d",
    pkg: "chartlang-example-canvas2d-adapter",
    lib: "",
    mount: "canvas",
    seamSource: CANVAS2D_SEAM,
  },
  {
    id: "lightweight-charts",
    pkg: "chartlang-example-lightweight-charts-adapter",
    lib: "lightweight-charts",
    mount: "div",
    seamSource: LWC_SEAM,
  },
  {
    id: "uplot",
    pkg: "chartlang-example-uplot-adapter",
    lib: "uplot",
    mount: "canvas",
    seamSource: UPLOT_SEAM,
  },
  {
    id: "echarts",
    pkg: "chartlang-example-echarts-adapter",
    lib: "echarts",
    mount: "div",
    seamSource: ECHARTS_SEAM,
  },
  {
    id: "konva",
    pkg: "chartlang-example-konva-adapter",
    lib: "konva",
    mount: "div",
    seamSource: KONVA_SEAM,
  },
]
