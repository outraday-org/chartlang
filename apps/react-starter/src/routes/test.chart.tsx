// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Test-only harness route for the e2e chart suite (tests/chart.spec.ts).
// Task 6 wires ChartPane into the real workspace (/) with the editor + EOD
// data; until then this route mounts ChartPane standalone so the chart
// render + alert-toast path can be asserted in isolation. It compiles a
// seed script through the real /api/compile route and feeds synthetic daily
// bars. Reachable in dev/preview; harmless in a clone (no nav links to it).

import type { Bar } from "@invinite-org/chartlang-core"
import { createFileRoute } from "@tanstack/react-router"
import { type ReactElement, useEffect, useState } from "react"

import { ChartPane, type CompiledArtifact } from "@/components/workspace/ChartPane"

export const Route = createFileRoute("/test/chart")({ component: TestChart })

// An SMA-cross-with-alert seed: exercises compute / ta.sma / ta.crossover /
// plot / alert through the real compiler, and fires a live alert so the
// toast path is exercised. Follows the required convention (top-level
// imports AND destructured compute params).
const SEED_SOURCE = `import { alert, defineIndicator, plot, ta } from "@invinite-org/chartlang-core"

export default defineIndicator({
  name: "SMA cross",
  apiVersion: 1,
  overlay: true,
  compute({ bar, ta, plot, alert }) {
    const fast = ta.sma(bar.close, 3)
    const slow = ta.sma(bar.close, 8)
    plot(fast, { title: "SMA(3)" })
    plot(slow, { title: "SMA(8)" })
    if (ta.crossover(fast, slow).current) {
      alert("SMA(3) crossed above SMA(8)", { severity: "info" })
    }
  },
})
`

// A deterministic zig-zag daily series so the fast/slow SMAs cross and the
// alert fires. Plain serialisable bars (no `point` method — the runtime
// injects it on its own BarView). Daily ("1D") matches the free EOD tier.
function seedBars(): Bar[] {
  const bars: Bar[] = []
  const start = Date.UTC(2024, 0, 1)
  const day = 86_400_000
  for (let i = 0; i < 60; i += 1) {
    const close = 100 + 10 * Math.sin(i / 3)
    const open = 100 + 10 * Math.sin((i - 1) / 3)
    const high = Math.max(open, close) + 1
    const low = Math.min(open, close) - 1
    bars.push({
      time: start + i * day,
      open,
      high,
      low,
      close,
      volume: 1_000,
      symbol: "TEST",
      interval: "1D",
      hl2: (high + low) / 2,
      hlc3: (high + low + close) / 3,
      ohlc4: (open + high + low + close) / 4,
      hlcc4: (high + low + close + close) / 4,
    } as Bar)
  }
  return bars
}

function TestChart(): ReactElement {
  const [artifact, setArtifact] = useState<CompiledArtifact | null>(null)
  const [bars] = useState<Bar[]>(() => seedBars())

  useEffect(() => {
    let cancelled = false
    const compile = async (): Promise<void> => {
      const res = await fetch("/api/compile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source: SEED_SOURCE }),
      })
      const body = (await res.json()) as {
        ok: boolean
        moduleSource?: string
        manifest?: unknown
      }
      if (cancelled || !body.ok || body.moduleSource === undefined) return
      setArtifact({ moduleSource: body.moduleSource, manifest: body.manifest })
    }
    void compile()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="h-full p-4" data-testid="test-chart-route">
      <ChartPane artifact={artifact} bars={bars} />
    </div>
  )
}
