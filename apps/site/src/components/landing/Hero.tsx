// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { ReactElement } from "react"

import { CodeBlock } from "@/components/landing/CodeBlock"

const DOCS_URL = "https://docs.chartlang.invinite.com"

// Hard-coded copy of the root README's canonical EMA-cross example so the
// marketing page and the README stay in lockstep. Kept as a literal — not
// imported from packages/ — so primitive-signature churn never breaks the
// marketing build.
const EMA_CROSS_SNIPPET = `import { defineIndicator } from "@invinite-org/chartlang-core"

export default defineIndicator({
  name: "EMA Cross",
  apiVersion: 1,
  overlay: true,
  compute({ bar, ta, plot, alert }) {
    const fast = ta.ema(bar.close, 12)
    const slow = ta.ema(bar.close, 26)
    plot(fast, { color: "#26a69a", title: "EMA(12)" })
    plot(slow, { color: "#ef5350", title: "EMA(26)" })
    if (ta.crossover(fast, slow).current) {
      alert("EMA(12) crossed above EMA(26)", { severity: "info" })
    }
  },
})
`

/**
 * Above-the-fold marketing block: the chartlang elevator pitch, two CTAs,
 * and the canonical EMA-cross example mirroring the root README.
 */
export function Hero(): ReactElement {
  return (
    <section className="py-20 md:py-28">
      <div className="grid items-center gap-12 md:grid-cols-2">
        <div>
          <p className="font-mono text-xs font-medium uppercase tracking-widest text-accent">
            Open source · MIT-licensed
          </p>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-foreground md:text-5xl">
            Open scripts for technical analysis. Run on any chart.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            chartlang is a TypeScript embedded DSL for indicator, drawing, and
            alert scripts. Authors write ordinary <code>.chart.ts</code> files
            using a small set of primitives; a compiler emits a sandboxable
            bundle that runs on any conforming chart adapter. One script, many
            charts.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a
              href="#demo"
              className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Try the demo
            </a>
            <a
              href={DOCS_URL}
              className="inline-flex items-center justify-center rounded-md border border-border px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
            >
              Read the docs
            </a>
          </div>
        </div>
        <div className="md:justify-self-end md:max-w-md">
          <CodeBlock code={EMA_CROSS_SNIPPET} lang="ts" filename="ema-cross.chart.ts" />
        </div>
      </div>
    </section>
  )
}
