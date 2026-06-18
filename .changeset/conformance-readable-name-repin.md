---
"@invinite-org/chartlang-conformance": patch
---

Re-pin the three `pine-converter-round-trip-*` scenario `drawing-hash`es for the
converter's readable-identifier rename. The drawing emission stream's
`op`/`state`/`bar` are byte-identical (a variable rename is purely lexical and
changes no emitted values); only the `handleId` slot-id string moved because the
shorter synthesized names shifted the `draw.*` callsite column. No runtime or
harness behaviour changed.
