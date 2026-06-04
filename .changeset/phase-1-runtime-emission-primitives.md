---
"@invinite-org/chartlang-runtime": minor
---

Add the Phase-1 emission primitives (`plot` / `hline` / `alert`) plus
the supporting `emissionsQueue` push helpers, the shared pane
resolver, and the FNV-1a alert dedupe-key hash. Each primitive runs
against `ACTIVE_RUNTIME_CONTEXT`, gates against the adapter's
`Capabilities` per PLAN §7.4 silent-no-op semantics, validates via
`@invinite-org/chartlang-adapter-kit`'s `validateEmission` at the
push boundary, and dedupes on `(slotId, bar)`. The runtime exports
expose dual signatures — script-facing `(value, opts?)` matches the
`ComputeContext` typing while the compiler-injected `(slotId, value,
opts?)` is what actually executes. Replaces the Task-6 throw-stub
bodies in `primitives.ts`; identity is preserved through the barrel
chain.
