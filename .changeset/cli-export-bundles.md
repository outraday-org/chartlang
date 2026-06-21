---
"@invinite-org/chartlang-cli": minor
---

Re-export `BUNDLED_ADAPTERS`, `ADAPTER_REGISTRY`, and the
`GeneratedAdapterBundle` / `GeneratedAdapterMeta` types from the package's
public entry point. This lets downstream installers (e.g. `create-chartlang`)
vendor the offline, version-pinned adapter bundles from a single source of
truth instead of deep-importing `src/generated/**` or depending on the
unpublished example adapters. Additive — no existing export changes.
