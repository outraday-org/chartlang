---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-compiler": minor
"@invinite-org/chartlang-pine-converter": minor
"@invinite-org/chartlang-conformance": minor
"@invinite-org/chartlang-language-service": patch
---

Add the `ta.highestbars` / `ta.lowestbars` primitives plus the cross-package
wiring that makes them usable as drawing anchors and Pine-converter targets.

- **core / runtime:** `ta.highestbars(source, length, opts?)` and
  `ta.lowestbars(source, length, opts?)` return the bar OFFSET (≤ 0) to the
  highest / lowest `source` value over the trailing `length` bars (window
  INCLUDES the current bar). `0` → current bar is the extreme; `-k` → the
  extreme occurred `k` bars ago. Ties resolve to the most recent bar; NaN
  inputs are skipped; warmup is `length − 1` bars; tick-mode replays the
  in-progress head as the offset-0 candidate. Registered in
  `STATEFUL_PRIMITIVES` (now 174 entries) and `TA_REGISTRY` (now 96 entries).
- **compiler:** a literal-length `ta.highestbars` / `ta.lowestbars` call
  contributes `length − 1` toward `maxLookback`, so the runtime sizes the time
  ring buffer deep enough for a `bar.point(<that offset>, …)` anchor to resolve.
  A non-literal length contributes 0.
- **pine-converter:** `ta.highestbars` / `ta.lowestbars` now map to the real
  chartlang primitives (previously lossy passthroughs to `ta.highest` /
  `ta.lowest`). **Behavior change:** a DYNAMIC `bar_index + <non-literal>`
  drawing-x anchor no longer raises the hard `requires-bar-interval` error —
  the offset is resolved by `bar.point` at runtime sign-agnostically (a
  negative runtime offset, e.g. what `ta.highestbars` returns, resolves to the
  historical timestamp via the time buffer). Only the literal `bar_index + N`
  future case still requires a bar interval.
- **conformance:** new `TA_HIGHEST_LOWEST_BARS_SCENARIO` export pins both
  primitives end-to-end through the compiler + runtime over the bundled
  `goldenBars.json` fixture, and is added to `ALL_SCENARIOS`.
