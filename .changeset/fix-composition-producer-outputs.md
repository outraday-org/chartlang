---
"@invinite-org/chartlang-core": patch
"@invinite-org/chartlang-compiler": patch
---

Fix Phase-7 indicator composition where a producer's titled `plot(...)` outputs were never wired to consumers. The compiler computed each binding's `outputs` statically but only wrote them into the manifest sidecar, never onto the producer object's own `manifest.outputs` — so the runtime allocated no dep-output ring buffer and every `<binding>.output("title")` read returned NaN past warmup.

`defineIndicator` now copies an optional `outputs` opts field into the manifest (omitted ⇒ manifest byte-identical to a script with no titled plots), and the compiler bakes each producer binding's titled `outputs` into its `defineIndicator({...})` opts literal so private deps, named-export siblings, and cross-file producer defaults are self-describing at runtime. Output-free scripts are untouched. Additive within `apiVersion: 1`.
