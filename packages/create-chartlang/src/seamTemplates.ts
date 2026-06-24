// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// SEAM TEMPLATES — the installer's emit copy of the per-library
// `activeAdapter.ts` body. Each body MUST stay byte-identical to
// `apps/react-starter/src/lib/chart/seamVariants.ts`'s
// `SEAM_VARIANTS[id].seamSource` (the matrix-proven SSOT) AFTER the single
// deterministic clone-time substitution this module applies: the package
// name `chartlang-example-<id>-adapter` → the vendored local adapter name.
// `seamTemplates.test.ts` clones the real starter tree and byte-diffs every
// id against that SSOT, so the installer can never emit a seam the starter's
// `adapter-matrix.spec.ts` never rendered.
//
// Edit a library's seam in `seamVariants.ts` (the app SSOT), then mirror it
// here — the parity test fails the build until they agree.

/**
 * The five bundled adapter ids the installer can vendor + rewrite the seam for.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { SEAM_IDS } from "@invinite-org/create-chartlang";
 *     for (const id of SEAM_IDS) void id;
 */
export const SEAM_IDS = ["canvas2d", "lightweight-charts", "uplot", "echarts", "konva"] as const;

/**
 * A bundled-adapter id the installer can rewrite the seam for (one of
 * {@link SEAM_IDS}).
 *
 * @since 0.1
 * @stable
 * @example
 *     import type { SeamId } from "@invinite-org/create-chartlang";
 *     const id: SeamId = "echarts";
 *     void id;
 */
export type SeamId = (typeof SEAM_IDS)[number];

const HEADER = `// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// ACTIVE CHART ADAPTER — the single point the create-chartlang installer
// rewrites for the chosen library. Do NOT import a concrete
// chartlang-example-*-adapter anywhere else; the rest of the app drives
// charts through the abstract \`ActiveAdapterHandle\` + \`createActiveAdapter\`
// + \`runActiveLoop\` exported here.

import type { AlertEmission, CandleEvent } from "@invinite-org/chartlang-adapter-kit"`;

const OPTS_TYPES = `/** Library-agnostic options ChartPane passes to {@link createActiveAdapter}. */
export type CreateAdapterOpts = Readonly<{
  container: HTMLElement
  candleSource: AsyncIterable<CandleEvent>
  interval?: string
  onAlert?: (a: AlertEmission) => void
}>

/** Options forwarded to {@link runActiveLoop} (cancellation via \`signal\`). */
export type RunActiveLoopOpts = Readonly<{ signal?: AbortSignal }>`;

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
  const cssWidth = opts.container.clientWidth || 800
  const cssHeight = opts.container.clientHeight || 480
  // Back the canvas at device-pixel resolution so the chart stays crisp on
  // HiDPI / retina screens; CSS keeps it laid out at the container's CSS size.
  // The adapter draws into the full backing store and only re-scales its
  // pan/zoom pointer math by \`devicePixelRatio\`, so the render is unchanged.
  const dpr = opts.container.ownerDocument.defaultView?.devicePixelRatio ?? 1
  const canvas = opts.container.ownerDocument.createElement("canvas")
  canvas.width = Math.round(cssWidth * dpr)
  canvas.height = Math.round(cssHeight * dpr)
  canvas.style.width = \`\${cssWidth}px\`
  canvas.style.height = \`\${cssHeight}px\`
  opts.container.replaceChildren(canvas)
  return createCanvas2dAdapter({
    canvas,
    candleSource: opts.candleSource,
    devicePixelRatio: dpr,
    // Frame the most recent ~120 bars by default (TradingView-style); the
    // full history stays in memory and scrollable via pan / zoom-out.
    initialVisibleBars: 120,
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
`;

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
    // Frame the most recent ~120 bars by default (TradingView-style); the
    // full history stays in memory and scrollable via pan / zoom-out.
    initialVisibleBars: 120,
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
`;

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
    // Frame the most recent ~120 bars by default (TradingView-style); the
    // full history stays in memory and scrollable via pan / zoom-out.
    initialVisibleBars: 120,
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
`;

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
    // Frame the most recent ~120 bars by default (TradingView-style); the
    // full history stays in memory and scrollable via pan / zoom-out.
    initialVisibleBars: 120,
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
`;

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

// The Konva adapter renders alerts as part of its declared capability surface
// but paints no alert UI, and its factory carries no onAlert hook — so the seam
// forwards alerts itself from the drain loop. onAlert is captured per handle
// here and invoked in runActiveLoop (which, unlike the factory, sees emissions).
const KONVA_ON_ALERT = new WeakMap<ActiveAdapterHandle, (a: AlertEmission) => void>()

export function createActiveAdapter(opts: CreateAdapterOpts): ActiveAdapterHandle {
  const width = opts.container.clientWidth || 800
  const height = opts.container.clientHeight || 480
  // The real Konva namespace is wider than the structural slice the adapter
  // consumes, so cast it to the adapter's own \`konva\` field type. Passing
  // \`container\` lets the adapter mount the stage on our DOM node AND attach
  // its wheel-zoom / drag-pan / dblclick-reset interaction to it.
  const konva = Konva as unknown as CreateKonvaAdapterOpts["konva"]
  const handle = createKonvaAdapter({
    konva,
    container: opts.container,
    stage: { width, height },
    candleSource: opts.candleSource,
    // Frame the most recent ~120 bars by default (TradingView-style); the
    // full history stays in memory and scrollable via pan / zoom-out.
    initialVisibleBars: 120,
    ...(opts.interval !== undefined ? { interval: opts.interval } : {}),
  })
  if (opts.onAlert !== undefined) KONVA_ON_ALERT.set(handle, opts.onAlert)
  return handle
}

// konva has no exported async loop that forwards alerts; mirror the shared loop
// shape locally over feedCandleEvent / handleInterval and forward each drain's
// alerts to the seam-captured onAlert (its factory carries no hook).
export async function runActiveLoop(
  handle: ActiveAdapterHandle,
  opts: RunActiveLoopOpts = {},
): Promise<void> {
  const signal = opts.signal
  const onAlert = KONVA_ON_ALERT.get(handle)
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
    if (onAlert !== undefined) for (const alert of emissions.alerts) onAlert(alert)
  }
}
`;

const SEAM_BODIES: Readonly<Record<SeamId, string>> = {
    canvas2d: CANVAS2D_SEAM,
    "lightweight-charts": LWC_SEAM,
    uplot: UPLOT_SEAM,
    echarts: ECHARTS_SEAM,
    konva: KONVA_SEAM,
};

/** The example-adapter package name for an id (the seam's import specifier). */
function exampleAdapterPkg(id: SeamId): string {
    return `chartlang-example-${id}-adapter`;
}

/**
 * Type guard: is `value` one of the five bundled-adapter ids the installer
 * can rewrite the seam for?
 *
 * @since 0.1
 * @stable
 * @example
 *     import { isSeamId } from "@invinite-org/create-chartlang";
 *     if (isSeamId("echarts")) {
 *         // narrowed to SeamId
 *     }
 */
export function isSeamId(value: string): value is SeamId {
    return (SEAM_IDS as ReadonlyArray<string>).includes(value);
}

/**
 * Produce the `activeAdapter.ts` body the installer writes for `id`, with the
 * example-adapter import specifier rewritten to the vendored local adapter
 * package name. The returned string is byte-identical to
 * `SEAM_VARIANTS[id].seamSource` after that single substitution — the parity
 * the matrix-proven SSOT guarantees.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { seamTemplateFor } from "@invinite-org/create-chartlang";
 *     const body = seamTemplateFor("echarts", "@local/echarts-adapter");
 *     void body;
 */
export function seamTemplateFor(id: SeamId, adapterPkgName: string): string {
    return SEAM_BODIES[id].split(exampleAdapterPkg(id)).join(adapterPkgName);
}
