# Math

Plain JavaScript `Math.*` is **already available** in `compute` — only
`Math.random` is forbidden (it breaks replay determinism). So `Math.abs`,
`Math.pow`, `Math.sqrt`, `Math.floor`, `Math.ceil`, `Math.round`, `Math.min`,
`Math.max`, `Math.log`, `Math.exp`, and the rest work directly, with no import.

The [`math.*`](../primitives/math.md) namespace deliberately does **not**
re-wrap those. It adds **only** the chart-aware and Pine-parity helpers bare
`Math` cannot express: tick-size rounding, the NaN-aware scalar helpers
(`na`/`nz`/`fixnan`), `sign`/`clamp`, and the variadic skip-NaN reducers
(`avg`/`sum`). It is a frozen, deterministic, compute-time namespace — the same
shape as [`color`](../primitives/input/color.md) / `str`.

## Where `abs` / `sqrt` / `pow` live

On bare `Math`. If you reach for `math.abs` you will not find it — use
`Math.abs`. `math.*` is the small set of extras, not a superset of `Math`:

```ts
import { defineIndicator, math, plot } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Math vs math",
    apiVersion: 1,
    compute({ bar, plot, syminfo }) {
        const spread = Math.abs(bar.high - bar.low); // bare Math — fine
        const snapped = math.roundToMintick(bar.close, syminfo.mintick); // chart-aware extra
        plot(spread);
        plot(snapped);
    },
});
```

`math` is a module-scope namespace (import it at the top), **not** a
`compute({ … })` field — do not destructure it. `syminfo` *is* a `compute`
field, so it is destructured.

## Tick-size rounding

`math.roundToMintick(value, mintick)` snaps `value` to the nearest multiple of
`mintick` — the price-snapping every drawing/level script wants. The namespace
is pure (no ambient `syminfo`), so you pass the tick size explicitly, usually
`syminfo.mintick`:

```ts
const level = math.roundToMintick(bar.close * 1.01, syminfo.mintick);
```

A `mintick <= 0` or NaN returns `value` unchanged (a missing tick size means
"do not snap"). `math.roundTo(value, step)` is the same operation with a general
step when the intent is not price-snapping.

## Scalar `na` / `nz` vs the series `ta.nz`

chartlang separates the **scalar** NaN helpers (in `math`) from the
**series** form (in `ta`):

| Want | Use | Shape |
|------|-----|-------|
| Is this plain number missing? | `math.na(x)` | `number → boolean` |
| Coalesce a plain number | `math.nz(x, replacement?)` | `number → number` (default `0`) |
| Carry the last good plain number | `math.fixnan(x, lastGood)` | caller threads `lastGood` |
| Coalesce a **series** | [`ta.nz(series, replacement?)`](../primitives/ta/) | series-aware |

`math.nz` mirrors `ta.nz`'s `?? 0` convention — they coalesce the same way, one
on a scalar and one on a series. Reach for `math.nz` on an intermediate scalar
(`const x = math.nz(maybeNaN);`) and `ta.nz` when you are coalescing a series.

## Reducers, sign, clamp

`math.avg(...values)` / `math.sum(...values)` are **variadic scalar** reducers
that skip NaN arguments (`math.avg(2, NaN, 4) === 3`). They are a fixed-arity
mean/sum of the values you pass — **not** a rolling window. For a rolling
average/sum over the last *K* bars use a [`ta.*`](../primitives/ta/) moving
average or a `state.array<number>(K)` you push into each bar.

`math.sign(value)` returns `-1` / `0` / `1` (propagating NaN), and
`math.clamp(value, lo, hi)` clamps to the inclusive range `[lo, hi]`.

## Converting from Pine

The [Pine converter](../converter/) maps `math.round_to_mintick(x)` →
`math.roundToMintick(x, syminfo.mintick)` (injecting the tick step), `na`/`nz` →
the scalar `math.na`/`math.nz`, and `math.avg`/`math.sum`/`math.sign` to their
chartlang members. Bare numeric `math.abs`/`pow`/`sqrt`/… stay on `Math.*`.
Pine's **rolling** `math.sum(source, length)` / `math.avg(source, length)` has
no scalar analogue, so the converter leaves it for a manual rewrite rather than
collapsing it onto the scalar form. See the
[skill mapping](../skills/chartlang-coding) for the full table.
