---
"@invinite-org/chartlang-cli": minor
---

`order.*` primitive pages, and `orders: true` in the scaffolded adapter

`chartlang docs` emits one page per `order.*` member —
`docs/primitives/order/{buy,sell,close,position}.md` — following the
`request.*` shape rather than one consolidated namespace page: each member
carries its own JSDoc, and a single `order.md` would additionally mint a bare
`order` id in the examples-coverage target set that no example could ever
credit.

`chartlang scaffold`'s starter adapter declares `...capabilities.orders(true)`.
It costs nothing: the template already declares the `arrow` and `label` plot
kinds the runtime's auto-markers lower to, so a scaffolded adapter honours the
channel with no rendering code at all. The six vendored example adapters are
re-vendored with their own `orders` declarations and `onOrder?` sinks.
