// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Client-only body of the embedded demo, trimmed for the landing
// surface:
// the script switcher and status badge move into a single toolbar, the
// alerts feed is capped, and the panes are locked to ~640px so the
// chart sits between Quickstart and the footer without dominating the
// page. Lazy-loaded as the default export so CodeMirror + the canvas
// adapter split out of the `/` entry chunk.

import type { AlertEmission } from "@invinite-org/chartlang-adapter-kit"
import type { Bar } from "@invinite-org/chartlang-core"
import { type ReactElement, useEffect, useMemo, useRef, useState } from "react"

import { ChartPane } from "./ChartPane"
import { EditorPane } from "./EditorPane"
import { type CompiledArtifact, createHybridLanguageService } from "./hybridLanguageService"
import { DEMO_SCRIPTS } from "./scripts"

const MAX_ALERTS_SHOWN = 6

/**
 * Resolve the initial script id from a `?script=<id>` query param so the
 * docs "Try it live" links land on a specific example. Falls back to the
 * first catalogue entry when the param is absent or unknown. Reads
 * `window` directly — DemoBody is lazy-loaded and client-only.
 */
function initialScriptId(): string {
  const fallback = DEMO_SCRIPTS[0]?.id ?? ""
  if (typeof window === "undefined") return fallback
  const requested = new URLSearchParams(window.location.search).get("script")
  return requested !== null && DEMO_SCRIPTS.some((s) => s.id === requested) ? requested : fallback
}

function AlertsList(props: Readonly<{ alerts: ReadonlyArray<AlertEmission> }>): ReactElement {
  if (props.alerts.length === 0) {
    return <p className="alerts-empty">No alerts fired yet.</p>
  }
  return (
    <ul className="alerts">
      {props.alerts.map((alert, i) => (
        <li
          className={`alert alert-${alert.severity}`}
          // biome-ignore lint/suspicious/noArrayIndexKey: append-only feed
          key={i}
        >
          <span className="alert-sev">{alert.severity}</span>{" "}
          <span className="alert-msg">{alert.message}</span>
        </li>
      ))}
    </ul>
  )
}

/**
 * The live demo. Wires the editor (left), chart (right), a script
 * switcher, and a recent-alerts card. The hybrid service is created
 * once and shared for the component's lifetime.
 */
export default function DemoBody(): ReactElement {
  const [artifact, setArtifact] = useState<CompiledArtifact | null>(null)
  const [bars, setBars] = useState<ReadonlyArray<Bar>>([])
  const [alerts, setAlerts] = useState<ReadonlyArray<AlertEmission>>([])
  const [scriptId, setScriptId] = useState(initialScriptId)
  const script = DEMO_SCRIPTS.find((s) => s.id === scriptId) ?? DEMO_SCRIPTS[0]
  const setArtifactRef = useRef(setArtifact)
  setArtifactRef.current = setArtifact

  const service = useMemo(
    () =>
      createHybridLanguageService((_nextStatus, nextArtifact) => {
        if (nextArtifact !== null) setArtifactRef.current(nextArtifact)
      }),
    [],
  )

  useEffect(() => {
    let cancelled = false
    void (async (): Promise<void> => {
      const response = await fetch("/bars.json")
      const raw: unknown = await response.json()
      if (cancelled || !Array.isArray(raw)) return
      setBars(raw as ReadonlyArray<Bar>)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handleAlert = (alert: AlertEmission): void => {
    setAlerts((previous) => {
      const next = [...previous, alert]
      return next.length > MAX_ALERTS_SHOWN ? next.slice(next.length - MAX_ALERTS_SHOWN) : next
    })
  }

  return (
    <div className="cl-demo mt-10 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Script</span>
          <select
            className="rounded-md border border-border bg-muted px-3 py-1.5 text-sm text-foreground"
            onChange={(event) => {
              setScriptId(event.target.value)
              setAlerts([])
              setArtifact(null)
            }}
            value={script?.id ?? ""}
          >
            {DEMO_SCRIPTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="panes">
        <section className="pane pane-editor">
          <EditorPane
            initialSource={script?.source ?? ""}
            key={script?.id ?? "none"}
            onSourceChange={() => {
              /* editor drives compile via the linter extension */
            }}
            service={service}
          />
        </section>
        <section className="pane pane-chart">
          <ChartPane
            artifact={artifact}
            bars={bars}
            onAlert={handleAlert}
            onPlayStart={() => setAlerts([])}
          />
          <div className="chart-alerts">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Recent alerts
            </h3>
            <AlertsList alerts={alerts} />
          </div>
        </section>
      </div>
    </div>
  )
}
