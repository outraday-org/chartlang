---
"@invinite-org/chartlang-compiler": minor
"@invinite-org/chartlang-language-service": minor
---

Add an in-memory cross-file producer seam so a single-source host can resolve sibling `./X.chart` imports without disk access.

- `compiler`: new `CompileOptions.inMemoryChartSources` (a `./X.chart` specifier → source map). It feeds both the cross-file producer resolver (`createProducerResolver`'s new `inMemorySources` option) so dependency analysis and bundling inline the producer, and the typecheck program (via the new `TransformAndAnalyseOptions.inMemoryChartImports`) which serves each resolving specifier as a virtual `CompiledScriptObject` stub to suppress a spurious `TS2307`. Both paths are opt-in and lazy — only specifiers actually imported are consulted, so the default (no map / empty map) is byte-identical to the disk path.
- `language-service`: new `LanguageServiceOptions.inMemoryChartSources`, forwarded to the local Node compiler when `compileToDiagnostics` is not injected, so a host's diagnostics compile does not report `TS2307` for sibling chart imports it holds in memory.
