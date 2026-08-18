---
"@invinite-org/chartlang-pine-converter": patch
---

Never emit a misplaced `strategy.long` / `strategy.short` into a lowered `qty:`

The semantic pass skips resolving a direction constant ANYWHERE inside a
recognised `strategy.*` signal call — deliberately, because scoping the skip to
one argument position would mean registering `strategy` as a namespace and
legalizing `strategy.long` in every expression. The consequence was that a
direction constant sitting in the `qty` slot
(`strategy.entry("L", strategy.long, strategy.long)`) reached codegen
unresolved, passed `isInlineScalar`, and was emitted verbatim as
`order.buy({ qty: strategy.long })` — a script that cannot compile, with no
diagnostic naming why.

`isInlineScalar` now rejects a direction constant, so the call takes the
existing "`qty` argument is not an inline scalar, so it was dropped" path and
the order lowers correctly without it. Malformed Pine either way; the difference
is a named note instead of broken output.

The `97-strategy-orders` golden fixture also gained the two cases its own plan
called for and the committed corpus was missing: an unresolvable direction
(warns `strategy-direction-assumed`, assumes `order.buy`) and a Pine variable
literally named `order` (renamed to `order2`, coexisting with the `order`
namespace the emitted script imports).
