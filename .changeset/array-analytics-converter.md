---
"@invinite-org/chartlang-pine-converter": patch
"@invinite-org/chartlang-conformance": patch
---

Map the Pine `array.*` reduction family onto the chartlang `state.array` handle
surface and prove it across every adapter.

- **Converter:** a new internal `ARRAY_REDUCTION_MAP` (`mapping/arrayReductions.ts`)
  lowers `array.sum/avg/min/max/range/median/variance/stdev/indexof/includes`,
  `array.percentile_linear_interpolation` → `<slot>.percentile`, and
  `array.sort(id, order)` → `<slot>.sort("asc"|"desc")` onto the handle methods.
  `array.sort` raises an `array-sort-returns-copy` info (chartlang's `sort`
  returns a fresh copy, never mutating the ring); `array.percentile_nearest_rank`
  and any unmapped `array.*` over a slot emit a `Number.NaN` placeholder + an
  `array-reduction-not-mapped` warning rather than hard-failing. The Pine `order`
  enum (`order.ascending`/`order.descending`) is now a recognised builtin. Fixture
  `35-array-reductions` covers the clean family.
- **Conformance:** `array-rolling-stats` pins a rolling `stdev`/`median` series
  over a `state.array<number>(14)` window. The reductions are pure compute that
  ride the existing `plot` hole — **no new wire primitive and no per-adapter code
  change** — so `pnpm conformance` replays the scenario through every adapter and
  asserts byte-stable output.
