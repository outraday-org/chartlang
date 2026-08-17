---
"@invinite-org/chartlang-core": minor
---

`order.*`: the script-facing market-intent namespace (RFC 0002)

A chartlang script could describe a signal but never *state* one. The only way
out was `alert("Long ...")`, and every consumer that wanted a trade out of it
ended up parsing the message — a convention written in prose, not a contract.
`order.*` makes the signal structured end to end.

- `order.buy(opts?)` / `order.sell(opts?)` / `order.close(opts?)` queue market
  intents on the new `orders` emission channel. `OrderOpts` carries
  `qty` (unsigned magnitude — the action names the side, never the sign),
  `label`, `marker` (render-side opt-out) and `meta`.
- `order.position()` reads the *nominal* position — `{ size, avgPrice,
  entryBar }` as of the previous confirmed step. Fill economics (slippage,
  commission, next-bar-open) stay with the consumer; the language tracks the
  position a sequence of intents implies and nothing more.
- No fifth script kind. `order.*` lives inside `defineIndicator`, and the
  `"orders"` capability is derived from callsites the way `"alerts"` is derived
  from `alert(...)` — a `defineStrategy` would have duplicated `defineIndicator`
  across the eight compiler files that spell the kind union out.

`CapabilityId` gains `"orders"`, and it is the one id **no script kind seeds**:
only `order.buy` / `order.sell` / `order.close` add it, because
`order.position()` is a pure read and must not make a script demand a capability
it never uses.

`STATEFUL_PRIMITIVES` gains four entries — the three emitters `slot: true` (each
callsite owns a stable id for its emissions, its once-per-slot capability
diagnostic and its synthetic marker slots) and `order.position` `slot: false`,
which is what makes reading your own position legal inside a bounded loop.

Additive within `apiVersion: 1`: new callsites only, no existing script changes
meaning.
