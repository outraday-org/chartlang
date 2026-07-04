---
"@invinite-org/chartlang-runtime": patch
---

Fix two external-series feed bugs that made a bound `input.externalSeries`
read render nothing.

- **Feed-guard tolerance:** external-series feed validation is now shape-only
  and tolerant per entry on EVERY entry path. `isExternalSeriesFeed` /
  `isExternalSeriesFeedMap` accept any `{ values: unknown[] }` shape, and
  `replaceExternalSeriesFeedMap` — behind `externalSeriesFeeds`,
  `resolveExternalSeries`, `setExternalSeries`, and the legacy `inputOverrides`
  feed path alike — keeps each array-shaped feed and coerces each value to a
  finite number or `NaN` (`null` / `undefined` / `NaN` / `±Infinity` → `NaN`)
  instead of a single non-numeric value discarding the ENTIRE feed (or, on the
  override path, dropping the feed and emitting a spurious
  `input-coercion-failed` diagnostic). This unblocks
  the QuickJS host path, where `stringifyFrame`'s `JSON.stringify` serialises
  `NaN` → `null`: the old all-or-nothing guard turned one such value into every
  bar reading `NaN`.
- **External-slot sizing:** external-series ring buffers are now sized to
  `max(OHLCV-derived capacity, feed length)` so a consumer that only touches
  OHLCV through the feed (collapsing the shared capacity to 1) can still read
  the feed at depth (`bound[n]`). The same sizing is applied on the
  history-reseed rebuild using the live post-`setExternalSeries` feed, so a
  re-seed never reintroduces a capacity-1 buffer. The OHLCV/main-stream
  capacity is unchanged.
