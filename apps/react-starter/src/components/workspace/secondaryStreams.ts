// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from apps/site/src/components/demo/secondaryStreams.ts. The MTF
// (multi-timeframe) resample pump: wrap a main candle source so each
// `manifest.requestedIntervals` higher-timeframe stream is synthesised live
// from the daily bars and woven in as secondary `close` events. Local on
// purpose — the symbol is `createResamplingCandlePump`, it imports only the
// adapter-kit / core types, and it does NOT touch a concrete
// `chartlang-example-*-adapter`, so the adapter seam stays clean.
//
// NOTE: the starter's free EODData tier is daily-EOD only, so daily is the
// finest interval. Resampling daily into weekly / monthly works; a script
// that requests a SUB-daily interval (e.g. "1h") cannot be resampled from
// daily bars and yields NaN for that stream — daily is the floor.

import type { CandleEvent } from "@invinite-org/chartlang-adapter-kit"
import type { Bar } from "@invinite-org/chartlang-core"

const MS_PER_SECOND = 1_000
const MS_PER_MINUTE = 60 * MS_PER_SECOND
const MS_PER_HOUR = 60 * MS_PER_MINUTE
const MS_PER_DAY = 24 * MS_PER_HOUR
const MS_PER_WEEK = 7 * MS_PER_DAY
// Calendar months are uneven; the resampler uses a ≈30-day bucket for `M`
// so the synthetic higher-timeframe stream stays deterministic.
const MS_PER_MONTH = 30 * MS_PER_DAY

const UNIT_MS: Readonly<Record<string, number>> = {
  s: MS_PER_SECOND,
  m: MS_PER_MINUTE,
  h: MS_PER_HOUR,
  d: MS_PER_DAY,
  w: MS_PER_WEEK,
  M: MS_PER_MONTH,
}

const INTERVAL_PATTERN = /^(\d+)([smhdwM])$/

/**
 * Parse a chartlang interval literal (`"30s"`, `"1h"`, `"1D"`, `"1W"`,
 * `"1M"`) into a bucket size in milliseconds. Units match
 * case-insensitively except `M` (month) vs `m` (minute), which follow the
 * chartlang interval convention. Returns `null` for an unparseable literal
 * so the caller can skip it.
 */
function intervalToBucketMs(interval: string): number | null {
  if (interval.length === 0) return null
  // Normalise the unit case so `D`/`W` parse the same as `d`/`w`, while `m`
  // (minute) and `M` (month) keep their author-given casing.
  const match = INTERVAL_PATTERN.exec(normaliseUnit(interval))
  if (match === null) return null
  const count = Number.parseInt(match[1] ?? "", 10)
  const unitMs = UNIT_MS[match[2] ?? ""]
  if (!Number.isFinite(count) || count <= 0 || unitMs === undefined) return null
  return count * unitMs
}

/** Fold every unit to lowercase except a trailing month marker (`M`). */
function normaliseUnit(interval: string): string {
  const unit = interval[interval.length - 1] ?? ""
  const body = interval.slice(0, -1)
  if (unit === "M" || unit === "m") {
    // `M` stays month; `m` stays minute — preserve the author's casing.
    return `${body}${unit}`
  }
  return `${body}${unit.toLowerCase()}`
}

/** Aggregate a non-empty run of source bars into one higher-timeframe bar. */
function aggregateBucket(bars: ReadonlyArray<Bar>, interval: string): Bar {
  const first = bars[0]
  const last = bars[bars.length - 1]
  if (first === undefined || last === undefined) {
    throw new Error("aggregateBucket requires a non-empty bucket")
  }
  let high = first.high
  let low = first.low
  let volume = 0
  for (const bar of bars) {
    if (bar.high > high) high = bar.high
    if (bar.low < low) low = bar.low
    volume += bar.volume
  }
  const open = first.open
  const close = last.close
  // No `point` method: input bars are streamed to the worker host via
  // `postMessage`, and a function is not structured-cloneable (it throws
  // `DataCloneError`). The runtime injects the real `point` on its own
  // `BarView`, so input bars stay plain serialisable data.
  return {
    // No-lookahead: the higher-timeframe bar is only known at its close, so
    // it is timestamped at the LAST constituent bar.
    time: last.time,
    open,
    high,
    low,
    close,
    volume,
    symbol: first.symbol,
    interval,
    hl2: (high + low) / 2,
    hlc3: (high + low + close) / 3,
    ohlc4: (open + high + low + close) / 4,
    hlcc4: (high + low + close + close) / 4,
  } as Bar
}

/** Mutable accumulator for the higher-timeframe bucket currently open. */
type BucketState = { key: number; bars: Bar[] }

/**
 * Wrap a main candle source so that, as bars flow through, it synthesises
 * each requested higher-timeframe stream **live** and weaves the secondary
 * `close` events into the output.
 *
 * The starter has no real higher-timeframe feed (free tier is daily-EOD),
 * so this buckets the main bars (`Math.floor(time / bucketMs)`) and emits
 * one aggregated secondary `close` (tagged with `streamKey = interval`)
 * each time a bucket rolls over. Doing this on the live stream keeps the
 * higher-timeframe series advancing if fresh bars are pushed; a one-shot
 * resample would freeze the weekly line at the last historical bucket.
 *
 * A `history` batch is **split** so each secondary close is interleaved at
 * the right point — without the split a monolithic batch defers every
 * secondary flush to the batch's last timestamp and the cap-1 secondary
 * ring buffer keeps only the final bar, leaving the higher-timeframe series
 * all-NaN across the replay. Completed buckets are timestamped at their
 * last constituent bar (no-lookahead) and the in-progress bucket is
 * intentionally NOT flushed: a week's close is only known once the next
 * week opens. Intervals whose literal cannot be parsed are skipped. `tick`
 * events pass through untouched — a provisional in-bar update must not roll
 * a higher-timeframe bucket.
 */
export function createResamplingCandlePump(
  main: AsyncIterable<CandleEvent>,
  intervals: ReadonlyArray<string>,
): AsyncIterable<CandleEvent> {
  const sizes: Array<{ interval: string; bucketMs: number }> = []
  for (const interval of intervals) {
    const bucketMs = intervalToBucketMs(interval)
    if (bucketMs !== null) sizes.push({ interval, bucketMs })
  }
  return {
    async *[Symbol.asyncIterator](): AsyncIterator<CandleEvent> {
      const open = new Map<string, BucketState>()

      // Fold one main bar into each interval's open bucket, returning a
      // secondary `close` for every bucket the bar rolled over. The
      // completed bucket excludes the rolling bar, so its aggregate stays
      // no-lookahead (timestamped at its own last constituent).
      function rollover(bar: Bar): CandleEvent[] {
        const closes: CandleEvent[] = []
        for (const { interval, bucketMs } of sizes) {
          const key = Math.floor(bar.time / bucketMs)
          const cur = open.get(interval)
          if (cur === undefined) {
            open.set(interval, { key, bars: [bar] })
          } else if (key !== cur.key) {
            closes.push({
              kind: "close",
              bar: aggregateBucket(cur.bars, interval),
              streamKey: interval,
            })
            open.set(interval, { key, bars: [bar] })
          } else {
            cur.bars.push(bar)
          }
        }
        return closes
      }

      for await (const event of main) {
        if (event.kind === "history") {
          let chunk: Bar[] = []
          for (const bar of event.bars) {
            const closes = rollover(bar)
            if (closes.length > 0) {
              if (chunk.length > 0) {
                yield { kind: "history", bars: chunk }
                chunk = []
              }
              for (const close of closes) yield close
            }
            chunk.push(bar)
          }
          if (chunk.length > 0) yield { kind: "history", bars: chunk }
          continue
        }
        if (event.kind === "close") {
          for (const close of rollover(event.bar)) yield close
          yield event
          continue
        }
        yield event
      }
    },
  }
}
