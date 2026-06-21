// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Local push-candle source, extracted from apps/site's ChartPane (where it
// was an inline helper). Kept LOCAL on purpose: it imports only the
// adapter-kit / core types, never a concrete `chartlang-example-*-adapter`,
// so the adapter seam (`src/lib/chart/activeAdapter.ts`) stays the single
// point that names a renderer. ChartPane feeds the symbol's full daily
// history through one `history` batch; the `push`/`end` API is the seam a
// future replay (re-streaming history bar-by-bar) would drive.

import type { CandleEvent } from "@invinite-org/chartlang-adapter-kit"
import type { Bar } from "@invinite-org/chartlang-core"

/** A candle source plus the imperative handle that feeds it. */
export type PushCandleSource = Readonly<{
  source: AsyncIterable<CandleEvent>
  push: (bar: Bar) => void
  end: () => void
}>

/**
 * A candle source that yields the static `history` batch once, then waits
 * for `push(bar)` calls (emitting each as a `close`) until `end()` is
 * invoked (on adapter teardown). The starter pushes the full EOD history
 * as the single `history` batch and never calls `push`, so the chart is
 * static — but the seam stays so Task 6 / a replay can re-stream.
 */
export function createPushCandleSource(history: ReadonlyArray<Bar>): PushCandleSource {
  const queue: Bar[] = []
  let wake: (() => void) | null = null
  let ended = false
  return {
    source: {
      async *[Symbol.asyncIterator](): AsyncIterator<CandleEvent> {
        yield { kind: "history", bars: history }
        while (true) {
          const bar = queue.shift()
          if (bar !== undefined) {
            yield { kind: "close", bar }
            continue
          }
          if (ended) return
          await new Promise<void>((resolve) => {
            wake = resolve
          })
          wake = null
        }
      },
    },
    push: (bar) => {
      queue.push(bar)
      wake?.()
    },
    end: () => {
      ended = true
      wake?.()
    },
  }
}
