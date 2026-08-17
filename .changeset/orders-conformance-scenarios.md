---
"@invinite-org/chartlang-conformance": minor
---

`order-count` / `order-at-bar` assertions plus three order scenarios

Two new `ScenarioAssertion` kinds. `order-count` pins the size of the whole
buffered `orders` channel; `order-at-bar` pins the ordered subsequence of orders
landing on the bars its expectation names, so a strategy over the 10 000 golden
bars can pin its first trades without pinning all of them — an order on any other
bar is invisible to it, which is what makes it a spot check rather than a second
`order-count`. `label` is always compared: it is a required wire field that is
`""` when the author gave none, so an omitted expectation asserts that default
rather than skipping the field.

Three scenarios, run against all six reference adapters:

- `ORDER_EMA_CROSS_SCENARIO` — the round trip, with the auto-drawn `#marker` /
  `#label` plots hash-pinned.
- `ORDERS_GATED_SCENARIO` — the same source against a bag declaring
  `orders: false`: zero orders, one `unsupported-orders` diagnostic, and an
  empty marker slot proved against a bag that DOES declare `arrow` + `label`, so
  the emptiness is the declined order and not an undrawable glyph.
- `ORDER_POSITION_READS_SCENARIO` — `order.position()` folding across entries,
  reduces and flattens.

The `STATEFUL_PRIMITIVES` surface test enumerates the four new `order.*` entries
explicitly and extends both the cardinality sum and the `slot: false` expected
set, so the count cannot be satisfied by an accidental addition.
