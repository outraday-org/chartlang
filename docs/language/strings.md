# Strings

The [`str.*`](../primitives/str.md) namespace is a frozen, deterministic,
compute-time string toolkit — the same shape as [`math`](./math.md) /
[`color`](../primitives/input/color.md). It builds the dynamic text the
already-shipped `draw.text` / `draw.table` / `draw.marker` / `alert(...)` holes
consume, with Pine-parity number formatting and **no** `Intl` / locale, so the
output is byte-identical across the worker and quickjs hosts.

```ts
import { defineIndicator, str } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "OHLC HUD",
    apiVersion: 1,
    overlay: true,
    compute({ bar, draw }) {
        draw.table({
            position: "top-right",
            cells: [
                [{ text: str.format("{0} · {1}", str.upper(bar.symbol), bar.interval) }],
                [{ text: str.format("C {0}", str.tostring(bar.close, "#.##")) }],
            ],
        });
    },
});
```

`str` is a module-scope namespace (import it at the top), **not** a
`compute({ … })` field — do not destructure it.

## Number formatting

`str.tostring(value, format?)` mirrors Pine `str.tostring(value, format)`. With
no `format` a number stringifies plainly (and a `boolean` / `string` passes
through `String(value)`). The optional `format` is a Pine-style fixed-precision
**mask** — the count of `#`/`0` digits **after** the dot is the number of
fractional digits:

| Mask | `str.tostring(12.3456, mask)` |
|------|-------------------------------|
| `"#.##"` | `"12.35"` |
| `"0.0000"` | `"12.3456"` |
| `"#"` / `"0"` (no `.`) | `"12.3456"` — a mask with no dot has no fractional run, so it is ignored and the value stringifies plainly |

The formatter is hand-rolled on `value.toFixed(n)` — **never** `toLocaleString`
/ `Intl` — so there is no thousands separator and no locale drift: the same
input is byte-identical on every host. `NaN` / `±Infinity` render as their Pine
glyphs and `-0` collapses to `"0"`.

> The literal `"mintick"` keyword form (`str.tostring(x, "mintick")`) is **not**
> supported in v1 — it would need ambient `syminfo` inside a pure function. Pass
> the tick size explicitly with [`math.roundToMintick`](./math.md) before
> formatting, or round to a fixed precision with a `"#.##"` mask.

## `str.format` placeholders

`str.format(template, ...args)` substitutes positional `{n}` placeholders (and
the optional `{n,number,#.##}` numeric-mask form) — index-placeholder only, no
locale / date sub-formats (those need `Intl`):

```ts
str.format("{0} / {1}", "fast", "slow"); // "fast / slow"
str.format("p={0,number,#.##}", 12.3456); // "p=12.35"
```

## The rest of the surface

`str.length`, `str.contains`, `str.startsWith`, `str.endsWith`, `str.replace`
(first occurrence, **string** match — never a `RegExp`, avoiding ReDoS and
keeping determinism), `str.replaceAll`, `str.split`, `str.substring`,
`str.upper`, `str.lower`, `str.trim`, and `str.repeat` (which clamps negative /
fractional counts that `String.repeat` would throw on).

## Converting from Pine

The [Pine converter](../converter/) lowers `str.*` to the native JS method —
`str.tostring(x, "#.##")` → `(x).toFixed(2)`, `str.format("{0}", a)` → a
template literal, `str.replace_all` → `s.replaceAll(...)`, `str.split` →
`s.split(...)`, `str.upper`/`str.lower`/`str.length`/`str.contains` to their
native equivalents — the same native-where-native-exists shape `math.*` uses for
bare `Math.*`. A non-mask `str.tostring` format (grouping / `format.mintick`) or
a styled `{n,number}` placeholder emits a `str-format-not-mapped` diagnostic and
passes the call through. See the [skill mapping](../skills/chartlang-coding) for
the full table.
