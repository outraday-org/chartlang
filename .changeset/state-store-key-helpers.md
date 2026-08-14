---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-language-service": patch
---

`StateStoreKey` identity helpers + a typed `SnapshotError`

`stateStoreKeyId(key)` is the canonical string form of a `StateStoreKey` —
fixed field order, joined `requestedIntervals` — so two structurally equal
keys written in different literal orders always serialise identically.
`stateStoreKeysEqual(a, b)` compares two optional keys through it, treating a
pair of absent keys as a match and an absent-vs-present pair as a mismatch.
`idbStateStore` now addresses its records through the shared helper instead of
a private copy; the emitted string is byte-identical, so existing records stay
addressable.

`SnapshotError` (with the structural `isSnapshotError` guard) is the typed
failure both hosts raise when a snapshot verb is refused — called before
`load`, called after the first push, a key mismatch, or a payload the
validator rejects. The guard matches on `name` rather than `instanceof` so it
stays true across a worker / QuickJS membrane and across duplicated package
copies.
