---
"@invinite-org/chartlang-compiler": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-host-worker": patch
"@invinite-org/chartlang-host-quickjs": patch
"@invinite-org/chartlang-conformance": patch
---

Compiled bundles now carry the real manifest on their `default` export (no
longer a stub), and a shared `buildBundleFromModule` loader merges `__manifest`
and throws on a stub-shaped manifest instead of silently collapsing series
capacity to 1.
