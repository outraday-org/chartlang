---
"@invinite-org/chartlang-pine-converter": patch
"@invinite-org/chartlang-conformance": patch
"@invinite-org/chartlang-language-service": patch
---

Map the chart-aware Pine `math.*` / `nz` subset onto the chartlang `math`
namespace in the converter, and prove the namespace is byte-stable across every
adapter.

Pine-converter changes:

- `math.round_to_mintick(x)` → `math.roundToMintick(x, syminfo.mintick)` (the
  emitter injects the explicit tick step; the namespace is pure with no ambient
  `syminfo`).
- `math.avg(a, b, …)` / `math.sum(a, b, …)` → the variadic **scalar**
  `math.avg` / `math.sum`. This also fixes a latent bug where these mapped to
  the non-existent `Math.avg` / `Math.sum`. Pine's 2-arg **rolling**
  `math.sum(source, length)` / `math.avg(source, length)` has no chartlang
  scalar analogue, so it is left for a manual rewrite with a new advisory
  `math-rolling-window-unmapped` warning rather than being collapsed onto the
  scalar form.
- `nz(x)` / `nz(x, r)` → the scalar `math.nz(...)` with a new advisory
  `nz-scalar-assumed` info (switch to `ta.nz` by hand for a series argument).
- Bare numeric `math.abs`/`pow`/`sqrt`/`sign`/… stay on `Math.*` (the
  no-rewrap decision); `na(x)` keeps its existing context-aware inline
  predicate lowering.
- Codegen now wires the module-scope `math` import and the `syminfo` compute
  destructure when the converted source references them.

The `math` namespace emits **no new wire primitive** — its outputs are plain
`number`s that flow into the existing `plot`/`draw` holes — so **no adapter code
change is required**. The new `math-round-to-mintick` conformance scenario
(snapped levels → `draw.horizontalLine`) is replayed through every adapter by
`pnpm conformance`, which is the all-adapter byte-stability proof. The
language-service hover registry is regenerated to include the new `math.*`
helper entries.
