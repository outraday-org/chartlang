---
"@invinite-org/chartlang-pine-converter": patch
---

Readable synthesized identifiers in the generated `.chart.ts`. The blanket
`__` prefix is gone: a persistent handle from `var line trail = na` is now
emitted as `const trail = draw.line(…)` (the Pine identifier reused), rings as
their collection name, scalar state slots as their Pine name, the bar-index
bridge as `barCount`/`barIndex`, the drawing-handle helper as
`HandleSlot`/`useDrawingHandleSlot`/`HandleRing`/`useDrawingHandleRing`, and
inline inputs as `inlineInput`. A new scope-aware `NameAllocator`
(`transform/nameAllocator.ts`) seeds every in-scope identifier (compute-context
params, JS reserved words, every Pine symbol) and disambiguates a clash with a
numeric suffix (`trail2`) — never by reintroducing `__`. Output is purely
lexical-renamed; runtime emissions are unchanged.
