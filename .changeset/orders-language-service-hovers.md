---
"@invinite-org/chartlang-language-service": minor
---

Hover docs for the `order.*` namespace

`hoverRegistry.generated.ts` is regenerated from core's JSDoc, so the editor now
answers for `order`, `order.buy`, `order.sell`, `order.close`,
`order.position()` and the four `Order*` type aliases — nine new registry keys,
with the EMA-cross example rendered inline. No hand-written entries: the
registry is a generated artifact and the source of truth stays the JSDoc on the
primitive.
