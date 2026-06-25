---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-compiler": minor
---

Add the pure, frozen `str` namespace to core (and mirror it in the compiler
ambient shim) — Pine-parity string + number-format helpers for building the
dynamic text the already-shipped `draw.text` / `draw.table` / `draw.marker` /
`alert(...)` holes consume. Like `color` / `math`, it is frozen, deterministic,
and compute-time, with no slot and no capability.

Number formatting is host-independent — a hand-rolled fixed/precision formatter
(no `Intl`, no `toLocaleString`, no locale/date) — so outputs are byte-identical
across the worker and quickjs hosts.

New core exports (also available as a frozen `str.*` namespace):

- `str.tostring(value, format?)` — numbers via a Pine-style mask (`"#.##"`
  trims trailing zeros; `"0.0000"` zero-pads to a fixed width); `NaN` / `±∞`
  render the Pine glyphs; `-0` normalizes to `"0"`. The `"mintick"` keyword
  form is deferred — the author passes a numeric step.
- `str.format(template, ...args)` — index-placeholder substitution (`{0}` /
  `{1}`) with an optional `{n,number,MASK}` numeric sub-mask and `{{` / `}}`
  literal braces; an out-of-range index is left intact (Pine parity).
- `str.length` / `str.contains` / `str.startsWith` / `str.endsWith` /
  `str.replace` (first occurrence) / `str.replaceAll` / `str.split` /
  `str.substring` / `str.upper` / `str.lower` / `str.trim` / `str.repeat`
  (negative / fractional counts guarded).

`StrNamespace` (`typeof str`) is exported alongside it.
