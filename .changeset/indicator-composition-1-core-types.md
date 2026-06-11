---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-adapter-kit": minor
"@invinite-org/chartlang-compiler": minor
---

Add `CompiledScriptObject.output` / `.withInputs` sentinels, `DependencyDeclaration` + `OutputDeclaration` types, optional `dependencies` / `outputs` / `exportName` / `siblings` / `isDrawn` fields on `ScriptManifest`, `CompiledScriptBundle` + `isCompiledScriptBundle` narrowing helper, and six new `dep-*` `DiagnosticCode` entries (`dep-error`, `dep-cycle`, `dep-unknown-output`, `dep-invalid-input-override`, `dep-dynamic`, `dep-output-not-titled`). The compiler ambient shim is widened in lockstep so script source resolves the new surface. Additive within `apiVersion: 1`.
