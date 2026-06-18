---
"@invinite-org/chartlang-host-worker": patch
"@invinite-org/chartlang-host-quickjs": patch
---

Fix single-script multi-timeframe loads dropping their secondary streams.
Both host boots now adopt the compiler's object-form `__manifest` sidecar
as the authoritative manifest for a single-script module
(`buildBundleFromModule` in host-worker, the bundle builder in
host-quickjs's `dispatcherCore`). The runtime `defineIndicator` stub zeroes
compiler-derived fields (`requestedIntervals`, `outputs`, `plots`,
`maxLookback`), so using `mod.default.manifest` left `requestedIntervals`
empty — a `request.security` script never registered its secondary streams
and every secondary candle was dropped with an `unknown-secondary-stream`
warning. Single-object detection goes through a dedicated `isSingleManifest`
guard (TS #17002: `Array.isArray` does not subtract a `ReadonlyArray` union
member). Cross-host parity is preserved.
