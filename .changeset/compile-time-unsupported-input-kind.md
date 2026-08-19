---
"@invinite-org/chartlang-compiler": minor
---

Add the compile-time `unsupported-input-kind` gate behind a new `declaredInputKinds` option

`Capabilities.inputs` was documented as a gate but enforced nowhere. `compile`,
`compileFile`, `compileProject` and `transformAndAnalyse` now accept
`declaredInputKinds?: ReadonlyArray<InputKind>` — the host adapter's
`Capabilities.inputs` roster — and emit one error-severity
`unsupported-input-kind` `CompileDiagnostic` per `input.<kind>(...)` declaration
whose kind is absent from it. A host that knows its adapter at compile time now
fails an `input.session(...)` against an adapter that never declared `session`
at build time instead of resolving it silently to its default at run time. The
severity is `"error"`, so this is not a warning: `compile` **throws
`CompileError`** and a host that starts passing the roster will begin rejecting
scripts that compiled cleanly before. That is the intent — those scripts were
already silently broken on that adapter — but plan for it as a behaviour change
at the moment you adopt the option, not at the moment you upgrade.

**Absent ⇒ the check is skipped entirely**, so the option is purely additive: a
caller that does not pass it sees byte-identical behaviour. The plumbing mirrors
the existing `declaredIntervals` / `lower-tf-not-lower` precedent exactly,
including the `stripWriteFlag` forward that `compileFile` and `compileProject`
depend on.

The check extends the existing `extractInputs` `input.*` walk rather than adding
a second one, so "what counts as an input declaration" keeps one definition. It
compares the **wire** kind (`KIND_TO_WIRE`), not the callsite builder name —
`input.externalSeries(...)` is exempt at both rungs and a check written against
the camelCase spelling would have failed open silently. `external-series` feed
support is host-callback-supplied, not part of the capability subset.

`unsupported-input-kind` joins `CompileDiagnosticCode` (appended at the end;
existing codes are unchanged) and deliberately shares its literal with the
runtime `DiagnosticCode` of the same name, so a consumer can match one string
across both rungs. It is **not** a synonym for the existing
`unknown-input-kind`: that one means the callee is not an `input.*` builder at
all, while this one means a real builder the host's adapter did not declare.

Callers should note what the compiler cannot know: it does not know which
adapter will run the artifact. A host whose compiled script may run against more
than one adapter must pass the **intersection** of those adapters'
`Capabilities.inputs`.
