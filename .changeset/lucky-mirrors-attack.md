---
"@invinite-org/chartlang-core": minor
---

Add the optional `ScriptManifest.compilerVersion` field.

The `StateStoreKey` tuple has always carried a `compilerVersion` slot with no
artifact-side source for it, leaving every consumer to guess. The manifest now
declares the slot's source directly.

The field is **optional on purpose**: `defineAlertCondition` builds a
`ScriptManifest` at script runtime inside the compiled bundle, where no
compiler exists. An absent value means "unknown", never a version — consumers
keying a cache on it should treat absence as a bypass rather than defaulting to
a placeholder string.
