---
"@invinite-org/chartlang-pine-converter": minor
---

Add the new `@invinite-org/chartlang-pine-converter` package — first slice of the Pine Script v6 → chartlang source-to-source converter (drawings v1). This release ships the §22.4 scaffold and the stable public-surface stub (`convert`, `ConvertOpts`, `ConvertResult`, `Diagnostic`, `DiagnosticSeverity`, `SourceSpan`, `ConvertManifest`, `ConverterCapabilities`, `ConverterNotReadyError`) so downstream tasks have pinned types to import. `convert(...)` throws `ConverterNotReadyError("lexer")` until the pipeline lands across Tasks 2–16.
