---
"@invinite-org/chartlang-compiler": minor
---

Derive the `"orders"` capability from `order.*` callsites

`extractCapabilities` adds `"orders"` when it sees `order.buy` / `order.sell` /
`order.close`, resolved through the same `resolveCalleeName` every other
primitive uses — so both the core-import form and the destructured
`compute({ order })` form are recognised, while a user-shadowed local named
`order` is not. `order.position()` deliberately adds nothing: it reads the
position, it does not ask the adapter for anything.

`"orders"` is the one capability id no script *kind* seeds; it exists only if a
callsite put it there. `CapabilityId` is now imported from core rather than
re-declared locally, so the two cannot drift.

The bundled ambient shim gains the `order` namespace (`OrderAction`,
`OrderOpts`, `OrderPosition`, `OrderNamespace`) and the `ComputeContext.order`
member, keeping author-time types identical to what the runtime injects. A
derived lockstep guard in `program.test.ts` replaces the total-count pin it used
to carry, so adding a primitive to core cannot pass while the shim is missing it.
