---
"@invinite-org/chartlang-cli": patch
"@invinite-org/chartlang-core": patch
---

Generate primitive reference pages for `plot`, `hline`, `alert`, and `request.lowerTf`: extended the Phase 4 docs generator with entries that source JSDoc from `packages/core/src/{plot,alert,request}/`, and added `@stable` markers to the top-level `plot` / `hline` / `alert` callable holes so the generator emits a stability label. The new pages are wired into the VitePress sidebar under Plot, Alert, and Request.
