---
"@invinite-org/chartlang-conformance": patch
---

Re-pin the `pine-converter-round-trip-camp-a` scenario's `drawing-hash` for the
converter's compact single-persistent-handle Camp A lowering. The drawing
emission stream's `op`/`state`/`bar` are byte-identical to the previous general
slot form; only the `handleId` slot-id string moved (the `draw.line(…)` callsite
shifted line/column), so the hash — which includes `handleId` — changes. No
runtime or harness behaviour changed.
