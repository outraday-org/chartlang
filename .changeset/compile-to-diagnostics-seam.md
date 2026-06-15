---
"@invinite-org/chartlang-editor": minor
"@invinite-org/chartlang-language-service": minor
---

Add a `compileToDiagnostics` injection seam so browser hosts can route compilation through their own server / worker boundary. `createLanguageService({ compileToDiagnostics })` now accepts a host callback; when supplied, diagnostics come from it and capability hints are appended locally. When omitted, Node runtimes keep the existing local compiler path and browser runtimes skip loading the Node-only compiler graph.

The editor also gains an explicit `previewPanel` option (and matching React prop). The preview-panel extension now mounts only when `previewPanel` or `previewRunner` is supplied, instead of always mounting the Phase 4 placeholder.
