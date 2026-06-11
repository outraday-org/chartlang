---
"@invinite-org/chartlang-runtime": patch
---

`onHistory` now accumulates emissions across the bulk history walk so a single `drain` after a `history` event returns every bar's emissions (PLAN §6.1), instead of only the final bar's. Previously the per-bar reset inside `onBarClose` (correct for per-event drains) discarded the prior bars' emissions because `onHistory` walked the bars with no accumulator. Visible symptom in adapter consumers: indicator plots only rendered for the streamed tail after warmup, not the bulk-filled history.
