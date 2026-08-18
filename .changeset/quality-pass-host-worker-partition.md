---
"@invinite-org/chartlang-host-worker": patch
---

Collapse `filterEmissions`'s five hand-copied validate loops into one helper

`filterEmissions` had grown one near-identical validate-and-partition loop per
channel — five of them by the time `orders` landed — differing only in whether
the rejection diagnostic carries the emission's `slotId` or `null`. They are now
five calls to a local `partitionValidated(items, diagnostics, slotIdOf)`, the
same shape host-quickjs already uses for the same five channels. The two hosts
stay separate published packages, so the helper is mirrored rather than shared;
what changes is that cross-host parity is now structural instead of five
copy-paste sites staying in step by hand.

No behaviour change: the same emissions pass, the same rejections become
`malformed-emission` diagnostics with the same `slotId` / `bar`, and the returned
`drawings` array is still a fresh copy.
