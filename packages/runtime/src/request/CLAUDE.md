# Runtime Request Kernels

- Request kernels are pure functions over ascending `Bar` arrays; callers own stream-order invariants.
- HTF alignment uses "most recent higher-timeframe value at or before main time".
- LTF bucketing uses half-open containment `[main.time, nextMain.time)`, with the final bucket absorbing in-progress bars.
- WeakMap caches key by array identity and must validate stored lengths before returning cached arrays.
- WeakMap cache hits are effectively intra-bar only: `onBarClose` clears `requestSecurityAscendingBars` each bar, so every bar produces fresh array identities. The length check is defense-in-depth against silent buffer reuse, not a cross-bar invariant.
- Shared bar materialisation (`barFromStream`, `ascendingBarsFor`) lives in `streamBars.ts` — do not re-inline it in kernels.

