---
"@invinite-org/chartlang-editor": minor
"@invinite-org/chartlang-language-service": minor
---

Add a `ChartlangLanguageService` interface (exported from `@invinite-org/chartlang-language-service` and re-exported from `@invinite-org/chartlang-editor`) and let `createChartlangEditor({ service })` (and the React `<ChartlangEditor service={...}>` prop) inject a consumer-provided implementation. When a service is injected, `setCapabilities(...)` becomes a no-op because the injected service owns its own capability surface. Editor extension type signatures now reference the named interface instead of `ReturnType<typeof createLanguageService>`, so consumers can build the surface from scratch (e.g. a hybrid local hover / remote `compileToDiagnostics`) without abandoning the editor factory.
