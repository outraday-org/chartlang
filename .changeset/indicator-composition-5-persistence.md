---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-host-worker": patch
---

Structured `StateSnapshot` carrying per-runner slot sections (primary +
siblings + dependencies) so a `CompiledScriptBundle`'s cold-replay
emissions match its warm-restart emissions byte-identically. Slot keys
now carry the active runner's `slotIdPrefix` everywhere they reach a
`StateStore` (`dep:<localId>/` for deps, `export:<exportName>/` for
siblings, empty for the primary). Flat-shape snapshots from before this
release continue to load back-compat as primary-only.
