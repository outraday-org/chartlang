# Runtime Request Kernels

- Request kernels are pure functions over ascending `Bar` arrays; callers own stream-order invariants.
- HTF alignment uses "most recent higher-timeframe value at or before main time".
- LTF bucketing uses half-open containment `[main.time, nextMain.time)`, with the final bucket absorbing in-progress bars.
- WeakMap caches key by array identity and must validate stored lengths before returning cached arrays.
- WeakMap cache hits are effectively intra-bar only: `onBarClose` clears `requestSecurityAscendingBars` each bar, so every bar produces fresh array identities. The length check is defense-in-depth against silent buffer reuse, not a cross-bar invariant.
- Shared bar materialisation (`barFromStream`, `ascendingBarsFor`) lives in `streamBars.ts` — do not re-inline it in kernels.
- `securityExprRunner.ts` is the HTF **expression** form (`request.security(opts, expr)`), distinct from the data form's `security.ts`. It folds the callback once per HTF bar into a dedicated fold `StreamState` + a `Float64RingBuffer` output buffer (one value per HTF bar). `makeSecurityExprSeries` (in `security.ts`) aligns that buffer (`ascendingValues(output)` as `htfSeries`) to the main timeline via the same `getOrAlign` no-lookahead kernel as the OHLCV form, against the **real** secondary stream's ascending bars (so `output[i]` pairs with secondary ascending bar `i`). The aligned-series Proxy builder (`makeAlignedSeriesProxy`) is shared by both forms — head-relative reads re-run the (memoised) alignment producer. Fallbacks reuse the data-form codes via `pushOnce`. See `packages/runtime/CLAUDE.md` for the drive-on-HTF-close / lazy-capture invariant.

