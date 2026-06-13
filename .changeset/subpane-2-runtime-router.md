---
"@invinite-org/chartlang-runtime": minor
---

Turn `paneResolver.ts` into a real pane router. `RuntimeContext` now
carries mount-resolved `defaultPane` + `scriptPane` keys derived from
`manifest.overlay` / `manifest.name`: `overlay: false` scripts default
to a sanitised `script:<name>` subpane, and explicit `pane: "new"`
coalesces to one stable per-script subpane. Named panes pass through
unchanged when the adapter declares `subPanes >= 1`; on `subPanes: 0`
adapters everything still folds to overlay with the existing
`unsupported-pane` diagnostic. `hline()` now routes `opts.pane` through
the same resolver instead of hard-coding `pane: "overlay"`.

Step 2 of the `subpane-rendering` feature. Additive for `overlay: true`
and no-`overlay` scripts (byte-identical overlay emissions); `overlay:
false` scripts now emit a non-overlay pane string, which is the
explicit intent of the feature. The canvas2d adapter and demos consume
these keys in tasks 3-5.
