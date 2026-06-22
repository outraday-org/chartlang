---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-compiler": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-pine-converter": minor
"@invinite-org/chartlang-cli": patch
"@invinite-org/chartlang-language-service": patch
---

Add `state.array<T>(capacity)` — a persistent, bounded FIFO collection. Push
many values across bars (`a.push(v)`) into a fixed-capacity ring and read
them back by element (`a.get(0)` = newest, `a.last()`, `a.size`,
`a.capacity`, `a.clear()`). Bounded literal capacity keeps it
serialization-clean. The Pine converter lowers a bounded numeric
`var array<…>` Camp B ring to it.

The compiler guards the capacity: it must be a compile-time numeric literal
(a `const` numeric binding is accepted) that is a positive integer within
`MAX_STATE_ARRAY_CAPACITY` (100_000). A non-literal capacity errors
`state-array-capacity-not-literal`; an out-of-range / non-integer literal
errors `state-array-capacity-exceeds-max`.
