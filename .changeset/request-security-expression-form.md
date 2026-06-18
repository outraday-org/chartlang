---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-compiler": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-host-worker": minor
"@invinite-org/chartlang-host-quickjs": minor
"@invinite-org/chartlang-pine-converter": minor
"@invinite-org/chartlang-conformance": patch
---

Add the higher-timeframe expression/callback overload to `request.security`.
Alongside the existing data form `request.security({ interval })` →
`SecurityBar`, scripts can now write `request.security({ interval }, (bar) =>
…)` → `Series<number>`, where the callback runs on the **higher-timeframe
clock** — `request.security({ interval: "1W" }, (bar) => ta.ema(bar.close, 20))`
is a true weekly EMA(20) (20 weekly bars), not 20 main bars of a weekly-stepped
series. The result is aligned no-lookahead down to the main timeline.

- **core** — the `SecurityExpr` callback type (re-exported from the package
  root), the second `security` overload, and the shared `statefulPrimitives`
  entry annotated as covering both arities.
- **compiler** — records one `SecurityExpressionDescriptor { slotId, interval,
  paramName }` per expression callsite in `manifest.securityExpressions`
  (sorted by `slotId`, omitted for the data-only form), and validates each
  callback against the allowed subset — its `bar` parameter and body locals,
  the ambient `ta` / `inputs`, safe `Math.*` globals, and literals — rejecting
  any captured outer binding with the new
  `request-security-expr-captures-local` diagnostic.
- **runtime** — mounts one `SecurityExprRunner` per manifest entry: the
  callback is captured lazily on the first main compute, driven once per HTF bar
  close through a dedicated fold `StreamState` so `ta.*` accumulate on the HTF
  clock, and one sampled value per HTF bar feeds a per-slot output buffer that
  `request.security(opts, expr)` returns aligned no-lookahead to the main
  timeline. Capability / interval / stream fallbacks return an all-NaN series
  with a deduped diagnostic.
- **host-worker / host-quickjs** — boot the expression form unchanged; the
  `__manifest` sidecar already carries `securityExpressions`.
- **pine-converter** — Pine's `request.security(sym, "D", ta.ema(close, 9))`
  now lowers to the chartlang callback form
  `request.security({ interval: "1d" }, (bar) => ta.ema(bar.close, 9))` (a bare
  OHLCV third arg keeps lowering to the data form).
- **conformance** — new scenarios prove the weekly expression value differs
  from a same-length main-timeframe EMA, plus the `multiTimeframe: false` NaN
  fallback.
