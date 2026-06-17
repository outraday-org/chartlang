---
"@invinite-org/chartlang-pine-converter": patch
---

Add the package-internal coordinate resolver (`src/transform/coordinates.ts`) that bridges Pine's bar-index coordinate model to chartlang's absolute `(time, price)` `WorldPoint` anchors. `resolveCoordinates(semantic, opts)` walks every coordinate-bearing drawing call-site (`line.new`/`box.new`/`label.new`) and produces a `ReadonlyMap<ExpressionNode, ResolvedAnchor>` side-table the Task 16 codegen renders verbatim — the AST is never mutated. Anchors classify into literal world points, `xloc.bar_time` pass-throughs, historical `bar_index` / `bar_index[N]` / `bar_index - N` offsets, future `bar_index + N` anchors (flagged `requiresBarInterval`), and the four `chart.point.*` factory forms. A future `bar_index + N` anchor with a null `barInterval` raises a single `requires-bar-interval` error.

Ships the Pine-expr → chartlang-TS-string emitter (`src/transform/exprEmit.ts`) that lowers every Pine expression node — remapping OHLCV/`time`/`bar_index` identifiers (`src/mapping/builtinIdentifiers.ts`), `and`/`or`/`not` to `&&`/`||`/`!`, and the context-sensitive `na` sentinel to `null` (handle) or `Number.NaN` (numeric) from its semantic annotation. Adds four `pine-converter/transform/...` diagnostic codes (`requires-bar-interval`, `dynamic-bar-index`, `unresolved-bar-index`, `chart-point-from-index-without-xloc`).
