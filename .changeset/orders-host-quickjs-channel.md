---
"@invinite-org/chartlang-host-quickjs": minor
---

Carry and validate the `orders` channel across the QuickJS membrane

The regenerated dispatcher bundle carries the boolean `orders` capability into
the guest realm on the `load` frame and the `orders` array back out on every
`drain`, and host-side `validateDrain` partitions it like the other channels —
a malformed order becomes a `malformed-emission` diagnostic stamped with its
compiler-injected `slotId` rather than reaching an adapter.

This is the half that matters to a server-side strategy evaluation: without it a
script's `order.*` calls would run in the sandbox and their intents would never
cross back.
