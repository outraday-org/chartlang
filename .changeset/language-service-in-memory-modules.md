---
"@invinite-org/chartlang-language-service": minor
---

Add an `inMemoryModules` option to `createLanguageService`. When `compileToDiagnostics` is NOT injected, the service runs the Node compiler locally for diagnostics; this option is forwarded to that `compile` call so a host where the workspace `@invinite-org/chartlang-*` packages are not resolvable on disk (e.g. a bundled serverless function) can supply pre-bundled package sources and avoid an esbuild "Could not resolve" failure. Ignored when `compileToDiagnostics` is provided.
