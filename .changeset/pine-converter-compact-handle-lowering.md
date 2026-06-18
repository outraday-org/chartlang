---
"@invinite-org/chartlang-pine-converter": patch
---

Compact codegen for the common single-persistent-handle Camp A case. A plain
`var <drawingType> h = na` handle that is created once and mutated each bar (no
`*.delete`, not `varip`) now lowers to a bare `const <local> = draw.<kind>(…)`
create + `<local>.update(…)` patch, exploiting the runtime's callsite-
persistence instead of emitting the `useDrawingHandleSlot`/`__HandleSlot`
generic helper, the `current()`/`set()` slot indirection, and the
`DrawingHandle` type import. The emission-level behaviour is byte-identical
(verified against the golden corpus and the compiler round-trip). Anything
outside the clean idiom — a `*.delete`, a `varip` handle, tables, static
polyline/linefill, and Camp B/C rings — falls back to the general slot
machinery.
