---
"@invinite-org/chartlang-pine-converter": patch
---

Add the polyline + linefill transform (`src/transform/polylineLinefill.ts` + `src/transform/colorConvert.ts`). `transformPolylineLinefill(analysis, scaffold, diagnostics)` self-filters the `polyline.new` and static `linefill.new` drawing sites and lowers them into the `ScriptScaffold` IR.

Polylines map to `draw.polyline` (straight), `draw.curve` (a 3-anchor `curved=true`), or `draw.path` with `closed: true` (a closed loop). Because the parser does not support Pine's `[...]` square-bracket array literal, the reachable anchor source is the `var array<chart.point>` build idiom: a literal-bounded `for i = 0 to N` loop that `array.push`es `chart.point.*` values unrolls (iterator-substituted) into a fixed anchor list rebuilt each `barstate.islast` tick; a non-literal (data-driven) bound is the finalised `polyline-dynamic-points` reject. A `>3`-anchor `curved=true` falls back to `draw.polyline` with a warning; `polyline.delete` emits the remove + slot-clear pattern.

Static two-line `linefill.new(lineA, lineB, color)` is approximated as a filled `draw.rotatedRectangle(quad, { fill, fillAlpha })` over the two referenced lines' endpoints — `draw.path`/`PathOpts` carries no fill, so `ShapeStyle` on a rotated rectangle is the only fill-capable arbitrary-quad primitive. `linefill.set_color` folds into a style update, `linefill.delete` clears the slot, and a bar-by-bar two-series fill additionally raises `linefill-series-fill`. The shared `convertColor` / `transpToAlphaHex` helpers fold `color.new(base, transp)` into a `#RRGGBBAA` hex (`color.new(color.gray, 80)` → `#787B8633`).

`transformCampC` now early-returns on `polyline.new` and the static (non-`array.get`) `linefill.new` so Task 14 solely owns them; a collection-driven `linefill.new(array.get(...))` cross-collection fill remains a Camp C `cross-collection-linefill` reject. Adds five `pine-converter/transform/...` diagnostic codes: `polyline-curved-anchors-warning`, `polyline-closed-info`, `linefill-series-fill`, `linefill-color-transp-approximated`, `linefill-rotatedrect-approximated`.
