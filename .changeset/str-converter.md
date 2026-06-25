---
"@invinite-org/chartlang-pine-converter": patch
"@invinite-org/chartlang-conformance": patch
"@invinite-org/chartlang-cli": patch
"@invinite-org/chartlang-language-service": patch
---

Publish the author-facing surface for the `str` string namespace: extend the
Pine `str.*` converter mapping, prove the namespace is byte-stable across every
adapter, and ship the docs / skill / example surfaces.

Pine-converter changes:

- `str.replace_all(s, t, r)` → `s.replaceAll(t, r)` and `str.split(s, sep)` →
  `s.split(sep)` (the snake_case Pine names lower to the native JS method).
  This rounds out the existing `str.tostring` / `str.format` / `str.length` /
  `str.contains` / `str.upper` / `str.lower` lowerings — the same
  native-where-native-exists shape `math.*` uses for bare `Math.*`.
- A non-mask `str.tostring` format (grouping / `format.mintick`) or a styled
  `{n,number}` `str.format` placeholder continues to emit the existing
  `str-format-not-mapped` diagnostic and pass the call through, never a hard
  failure.

The `str` namespace emits **no new wire primitive** — its outputs are plain
`string`s that flow into the already-shipped `draw.text` / `draw.table` /
`draw.marker` / `alert(...)` holes — so **no adapter code change is required**.
The new `str-formatted-table` conformance scenario (a `draw.table` HUD built
from `str.format` / `str.tostring("#.##")` / `str.upper`) is replayed through
every adapter by `pnpm conformance`, which is the all-adapter byte-stability
proof (the emitted text payload hash is byte-identical across canvas2d, echarts,
konva, lightweight-charts, uplot, and webgl). The CLI primitive-docs generator
gains a `str` page entry (`docs/primitives/str.md`) and the language-service
hover registry is regenerated to include the deterministic `str` formatter
helper entries.
