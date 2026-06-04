---
"@invinite-org/chartlang-core": minor
---

Replace the Phase-0 placeholder with the Phase-1 typed surface:
`defineIndicator` / `defineAlert` constructors, the `ta` / `plot` / `alert`
callable holes the compiler retargets at the runtime, the frozen
`STATEFUL_PRIMITIVES` registry, and every §4.3 type. Nothing executes —
`core` ships types and callable surfaces only; the runtime ships the real
implementations in Tasks 5-8.
