---
"@invinite-org/chartlang-host-worker": minor
"@invinite-org/chartlang-host-quickjs": minor
"@invinite-org/chartlang-adapter-kit": minor
"chartlang-example-canvas2d-adapter": patch
---

Hosts (`host-worker`, `host-quickjs`) detect the array-shape `__manifest`
sidecar plus the new `__dependencies` export, mount the compiled
`CompiledScriptBundle`, and round-trip the six `dep-*` diagnostic codes
across both the postMessage wire and the QuickJS JSON membrane.
`host-worker`'s `CompiledModuleExport` type widens to carry the optional
`__manifest` / `__dependencies` sidecars; `host-quickjs`'s
`moduleSourceToScript` rewrites every drawn named export onto a
host-visible `globalThis.__chartlang_compiled_named` map and lowers
`__dependencies` onto its own global slot. `adapter-kit`'s
`validateEmission` confirmed (with explicit coverage) to accept every
new code. canvas2d-adapter integration test renders sibling-prefixed
plots, drops private-dep plots, and surfaces `dep-error` diagnostics
through `Adapter.onEmissions`. The compiler now appends
`export const __dependencies = [...]` to multi-export bundle output so
the runtime can mount each private dep as a `DepRunner`; single-script
bundles stay byte-identical (no `__dependencies` line).
