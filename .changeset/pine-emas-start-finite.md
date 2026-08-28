---
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-conformance": patch
"@invinite-org/chartlang-host-quickjs": patch
---

Make canonical EMA Pine-compatible: seed on the first finite source, emit gaps
without losing recurrence state, and isolate tentative ticks from later closes.
Re-pin EMA-composed primitives and conformance scenarios to the new recurrence.
Regenerate the QuickJS dispatcher so its inlined runtime uses the same EMA.
