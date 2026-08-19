---
"@invinite-org/chartlang-adapter-kit": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-conformance": minor
"@invinite-org/chartlang-host-quickjs": patch
---

Enforce `Capabilities.inputs` at runtime with a new `unsupported-input-kind` diagnostic

`Capabilities.inputs` has always been documented as a gate ("primitives outside
the declared set become silent no-ops + diagnostic") but was enforced nowhere:
it was the one capability axis with no runtime check. `resolveInputs` now
resolves a manifest input whose `kind` is absent from the adapter's declared set
to its descriptor default, ignores any host override for that key, and pushes
one `unsupported-input-kind` warning per input key per mount.

**This is observable behaviour change for adapters that under-declare
`inputs`.** An adapter declaring an EMPTY set now gates every scalar input (one
diagnostic each, per mount) and its scripts run on their defaults; a partial set
gates exactly its complement. Neither is an error state — the script still runs.
`external-series` is exempt: those feeds are host-callback-supplied and are not
part of this capability subset. If your adapter can offer input controls, list
their kinds in `Capabilities.inputs`.

**Observing it needs a `history` push or an early drain.** Like the pre-existing
`input-coercion-failed`, this diagnostic is raised while inputs resolve at MOUNT
(hence `bar: null`), and the per-bar close path resets the emission queues before
each compute step. A host that pushes `history` — or drains once before the first
event — sees it; a host that streams bar-by-bar from mount and never re-seeds
discards it. That is pre-existing runtime behaviour this change did not
introduce, but it is the first time it matters for a NEW code, so it is stated
here rather than left to be rediscovered. It is also why the `inputs-gated`
conformance scenario runs in history-reseed mode.

The dedup set is deliberately separate from the `input-coercion-failed` one, so
neither diagnostic can suppress the other for the same key; a gated key never
reaches type checking, so it emits `unsupported-input-kind` alone. Conformance
gains an `inputs-gated` scenario proving the gate cross-adapter.

`host-quickjs` is a patch because its generated dispatcher INLINES the runtime
dist — the gate reaches QuickJS guests only once that bundle is rebuilt.
