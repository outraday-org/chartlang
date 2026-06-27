---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-compiler": minor
"@invinite-org/chartlang-pine-converter": minor
---

Add non-numeric persistent state: `state.color` plus boolean/string series
slots (`state.boolSeries` / `state.stringSeries`), enabling `var color` and
`var bool/string` history conversion.

`state.color(init)` is a persistent color scalar (`MutableSlot<Color>`, the
`Color` string seeded with `init`). `state.boolSeries(init)` /
`state.stringSeries(init)` are the non-numeric siblings of the numeric
`state.series` — a writable `.value` head plus integer-indexed `[n]` history
(`BoolSeriesSlot` / `StringSeriesSlot`). First-bar / out-of-range history reads
are `false` for booleans (Pine v6 semantics) and `""` for strings. The numeric
`state.series` / `NumberSeriesSlot` signature is unchanged (numeric snapshots
stay byte-identical). The compiler ambient `state` shim mirrors all three
factories + the two new slot types in lockstep.

The Pine converter now lowers a `var color` scalar to `state.color` (a Pine `na`
color → the concrete transparent CSS string `"#00000000"`), and a history-indexed
`var bool` / `var string` to `state.boolSeries` / `state.stringSeries` (value
read / `[n]` history / `:=` write split, mirroring the numeric series). The
`series-history-non-numeric` info is retired for `bool`/`string` (now first-class)
and narrowed to the still-unsupported `color` history case.
