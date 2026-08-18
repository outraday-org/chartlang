---
"@invinite-org/chartlang-host-worker": minor
---

Carry and validate the `orders` channel across the worker boundary

`filterEmissions` — the trust boundary for the postMessage wire format — now
walks `raw.orders` and replaces any emission that fails adapter-kit's
`validateEmission` with a `malformed-emission` diagnostic, and the filtered array
rides the `RunnerEmissions` it posts back. Orders carry a compiler-injected slot
id, so a malformed one is attributable: it follows the ALERT side of that loop
set (`slotId` on the diagnostic) rather than the null-slot alert-condition / log
side.

Without this the channel would arrive empty on the host side of every worker
mount — the runtime would have emitted, the boot would have dropped it silently.
