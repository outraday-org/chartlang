// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// The right pane: loads a compiled chartlang artifact into the active
// adapter's worker host, feeds it the symbol's real daily bars, drives the
// render loop, and surfaces alerts in a small footer feed (every alert) +
// toasts (LIVE alerts only — see `onAlert` below; historical alerts replayed
// from the `history` batch never toast, so loading a script doesn't spam a
// toast for every past crossover).
//
// Adapter-agnostic by construction — it drives charts ONLY through the
// `src/lib/chart/activeAdapter.ts` seam (`createActiveAdapter` +
// `runActiveLoop` + `ActiveAdapterHandle`). It must NEVER import a concrete
// `chartlang-example-*-adapter`; swapping the library is a one-module edit
// the create-chartlang installer automates. The stream plumbing
// (`createPushCandleSource`, `createResamplingCandlePump`) is local and
// likewise seam-clean.
//
// Static by design: the starter has real EOD history, so the full dataset
// goes through one `history` batch and renders — no random-walk simulator
// (unlike apps/site's demo). Task 6 wires this into the editor + EOD data.

import type { AlertEmission } from "@invinite-org/chartlang-adapter-kit"
import type { Bar, ScriptManifest } from "@invinite-org/chartlang-core"
import { type ReactElement, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { ScrollArea } from "@/components/ui/scroll-area"
import { createActiveAdapter, runActiveLoop } from "@/lib/chart/activeAdapter"
import { createPushCandleSource } from "./streamPump"
import { createResamplingCandlePump } from "./secondaryStreams"

const FALLBACK_INTERVAL = "1D"
const MAX_FEED_ALERTS = 50

/**
 * The host-loadable compiled artifact: exactly the `{ moduleSource, manifest }`
 * pair the compile route returns and `host.load()` accepts. `manifest` is
 * typed `unknown` here (mirroring the site's local `CompiledArtifact`) and
 * cast to `ScriptManifest` at `host.load`; Task 6 swaps this for the ported
 * `CompiledArtifact` type with no behaviour change.
 */
export type CompiledArtifact = Readonly<{
  moduleSource: string
  manifest: unknown
}>

/**
 * Props for {@link ChartPane}. The pane disposes + re-mounts the adapter
 * whenever `artifact` or `bars` change. `onAlert` lets the host (Task 6's
 * status bar) observe every alert; the footer feed lists them all, while
 * toasts fire ONLY for live alerts (those on bars newer than the loaded
 * history) so a freshly-loaded script doesn't toast its whole past.
 */
export type ChartPaneProps = Readonly<{
  bars: ReadonlyArray<Bar>
  artifact: CompiledArtifact | null
  onAlert?: (alert: AlertEmission) => void
}>

type Handle = ReturnType<typeof createActiveAdapter>

export function ChartPane(props: ChartPaneProps): ReactElement {
  const { artifact, bars } = props
  const containerRef = useRef<HTMLDivElement | null>(null)
  const handleRef = useRef<Handle | null>(null)
  const onAlertRef = useRef(props.onAlert)
  onAlertRef.current = props.onAlert
  const [feed, setFeed] = useState<ReadonlyArray<AlertEmission>>([])

  useEffect(() => {
    const container = containerRef.current
    if (container === null || artifact === null || bars.length === 0) return

    // Tear down the previous adapter before spinning up a fresh one.
    handleRef.current?.dispose()
    handleRef.current = null
    setFeed([])

    const controller = new AbortController()
    const pushSource = createPushCandleSource(bars)

    // The full dataset is replayed through one `history` batch (see
    // streamPump.ts), so any alert on a bar at or before the newest loaded
    // bar is HISTORICAL — it already happened and shouldn't pop a toast.
    // Only alerts on bars newer than this (pushed live via `push`) are
    // "future" and worth toasting. Falls back to +Infinity (treat all as
    // historical → no toast) if the time is somehow unknown.
    const lastHistoryTime = bars[bars.length - 1]?.time ?? Number.POSITIVE_INFINITY

    // Multi-timeframe scripts request higher-timeframe streams in their
    // manifest. The free EOD tier is daily-only, so resample the daily bars
    // into each requested interval live and weave the secondary closes in;
    // non-MTF scripts keep the plain single-source path. (Sub-daily requested
    // intervals can't be resampled from daily bars and yield NaN.)
    const requestedIntervals = (artifact.manifest as ScriptManifest).requestedIntervals
    const candleSource =
      requestedIntervals.length > 0
        ? createResamplingCandlePump(pushSource.source, requestedIntervals)
        : pushSource.source

    const handle = createActiveAdapter({
      container,
      candleSource,
      interval: bars[0]?.interval ?? FALLBACK_INTERVAL,
      onAlert: (alert) => {
        onAlertRef.current?.(alert)
        // Toast only LIVE alerts; historical ones (from the replayed
        // history) just populate the footer feed.
        if (alert.time > lastHistoryTime) {
          toast(alert.message, {
            ...(alert.severity === "info" ? {} : { description: `severity: ${alert.severity}` }),
          })
        }
        setFeed((prev) => [alert, ...prev].slice(0, MAX_FEED_ALERTS))
      },
    })
    handleRef.current = handle

    const start = async (): Promise<void> => {
      try {
        await handle.host.load({
          moduleSource: artifact.moduleSource,
          manifest: artifact.manifest as ScriptManifest,
        })
        if (controller.signal.aborted) return
        await runActiveLoop(handle, { signal: controller.signal })
      } catch (err) {
        if (controller.signal.aborted) return
        console.error("chart render failed", err)
      }
    }
    void start()

    return () => {
      pushSource.end()
      controller.abort()
      handle.dispose()
      if (handleRef.current === handle) handleRef.current = null
    }
  }, [artifact, bars])

  useEffect(() => {
    return () => {
      handleRef.current?.dispose()
      handleRef.current = null
    }
  }, [])

  const ready = artifact !== null && bars.length > 0

  return (
    <div className="flex h-full flex-col" data-testid="chart-pane">
      {/* `overflow-hidden` clips the fixed-size canvas to its box: the
          adapter sizes the canvas once at mount, so without this any later
          shrink of this flex child (e.g. the alerts panel appearing) would
          let the canvas paint over the panel below. The panel is reserved
          up-front (below) so the adapter measures the correct height. */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {ready ? null : (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
            {artifact === null
              ? "Compile a script to render a chart."
              : "Pick a symbol to load price data."}
          </div>
        )}
        <div
          aria-label="chart"
          className="h-full w-full"
          data-testid="chart-container"
          ref={containerRef}
        />
      </div>
      {ready ? (
        <div className="shrink-0 border-t border-border" data-testid="alerts-feed">
          <ScrollArea className="h-28">
            {feed.length > 0 ? (
              <ul className="divide-y divide-border text-xs">
                {feed.map((alert, i) => (
                  <li
                    className="flex items-center gap-2 px-3 py-1.5"
                    key={`${alert.dedupeKey}-${alert.bar}-${i}`}
                  >
                    <span className="font-mono text-muted-foreground">[{alert.severity}]</span>
                    <span className="truncate text-foreground">{alert.message}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex h-28 items-center justify-center text-xs text-muted-foreground">
                No alerts yet.
              </div>
            )}
          </ScrollArea>
        </div>
      ) : null}
    </div>
  )
}
