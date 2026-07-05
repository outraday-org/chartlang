---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-compiler": minor
---

Type the `compute` `inputs` bag per input descriptor. `inputs.<key>` now
resolves to the exact value the runtime hands the script — `input.externalSeries`
→ `Series<T>` (defaulting to `Series<number>` when the generic is omitted),
`int`/`float`/`time`/`price` → `number`, `bool` → `boolean`, `enum<U>` → `U`,
`color`/`string`/`symbol`/`interval`/`session` → `string`, `source` →
`SourceField` — so reads are cast-free (`inputs.bound.current`, `[n]`, and
feeding `ta.*` all type-check with no `as Series<number>` / `as number`). The
four `define*` constructors became generic over their `inputs` schema in
lockstep with the compiler's ambient shim; scripts that declare no `inputs`
keep `Readonly<Record<string, unknown>>`. Existing casts stay legal (now
redundant), while the previous silently-broken mis-port — treating an
external-series view as a plain `number` (`const n: number = inputs.bound`) —
is now a type error. Pure type surface: runtime output and the emitted manifest
are byte-identical.
