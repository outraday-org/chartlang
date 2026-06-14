// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { ReactElement } from "react"

import { CodeBlock } from "@/components/landing/CodeBlock"

type Feature = Readonly<{
  title: string
  body: string
  code: string
  lang: "ts" | "bash"
  filename: string
}>

const FEATURES: readonly Feature[] = [
  {
    title: "One script, many charts.",
    body: "Write a .chart.ts once. The adapter contract makes it run on Lightweight Charts, ECharts, Highcharts, or your own renderer.",
    lang: "ts",
    filename: "rsi.chart.ts",
    code: `import { defineIndicator } from "@invinite-org/chartlang-core"

export default defineIndicator({
  name: "RSI",
  apiVersion: 1,
  compute({ bar, ta, plot }) {
    plot(ta.rsi(bar.close, 14))
  },
})
`,
  },
  {
    title: "Typed primitives, no DSL surprises.",
    body: "ta.* for technical analysis, plot / draw.* for visuals, alert for signals, input.* for parameters. All typed; the editor catches mistakes before compile.",
    lang: "ts",
    filename: "compute.ts",
    code: `const len = input.int("Length", 20)
const basis = ta.sma(bar.close, len)
plot(basis, { color: "#26a69a" })
`,
  },
  {
    title: "Sandbox-safe — runs anywhere a worker runs.",
    body: "The compiler emits a self-contained ESM bundle with no ambient globals. Drop it in a Web Worker, a QuickJS-WASM sandbox, or a Node alert server — same artifact, same output.",
    lang: "bash",
    filename: "compile",
    code: `$ chartlang compile foo.chart.ts
  foo.chart.js
  foo.chart.manifest.json
  foo.chart.d.ts
`,
  },
  {
    title: "Conformance-tested for portability.",
    body: "Every adapter is validated against a shared scenario suite. If your chart passes conformance, every chartlang script written against apiVersion: 1 works on it.",
    lang: "bash",
    filename: "conformance",
    code: `$ pnpm conformance
  220 scenarios passed
$ echo $?
0
`,
  },
]

/**
 * The "what chartlang is and what it does" grid — four cards, each pairing
 * a short headline and body with a small illustrative snippet.
 */
export function Features(): ReactElement {
  return (
    <section id="features" className="py-20 md:py-28">
      <h2 className="text-3xl font-bold text-foreground md:text-4xl">
        What chartlang does
      </h2>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        A small, typed primitive set; a sandboxable bundle; an adapter contract
        that keeps your script portable across charts.
      </p>
      <div className="mt-12 grid gap-6 md:grid-cols-2">
        {FEATURES.map((feature) => (
          <article
            key={feature.title}
            className="flex flex-col rounded-lg border border-border bg-muted/20 p-6"
          >
            <h3 className="text-lg font-semibold text-foreground">{feature.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{feature.body}</p>
            <div className="mt-4">
              <CodeBlock code={feature.code} lang={feature.lang} filename={feature.filename} />
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
