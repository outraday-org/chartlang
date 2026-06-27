---
"@invinite-org/chartlang-pine-converter": minor
---

Recognise + classify Pine's tuple-LHS `request.security` form in the semantic
pass (`[a, b] = request.security(sym, tf, [s1, s2])`). The `[…]` source list
(already parsed as a value-position array literal) is read per element and each
entry is classified as a bare OHLCV `field` (data form) or an arbitrary `expr`
(callback form) — the same OHLCV-field test and feed resolver the single-source
`request.security` path uses, now extracted into the shared ast-only leaf
`transform/securityShape.ts` (`securityField` / `resolveSecurityFeed`). A
`securityTuple` annotation (`{ feed, elements }`) is stored on the
`TupleDeclaration` node for the lowering pass to read back. New semantic
diagnostics: `security-tuple-source-not-list` (error — a non-array third arg)
and `security-tuple-arity-mismatch` (warning — name/source length differ); a
non-literal symbol/interval feed reuses the existing `request-security-not-
mapped`.

The lowering pass now consumes that annotation: a tuple-LHS `request.security`
emits **one independent read per element** (`const <name> = …`), all sharing a
single `{ symbol?, interval }` opts literal (one feed; the runtime dedups via
`feedKey`). OHLCV elements use the data form, computed elements the callback
form, via shared `securityOpts` / `securityDataRead` / `securityCallbackRead`
builders the single-source path also uses. A `_` element is dropped; an
arity-mismatch binds what it can; a rejected feed/source emits nothing (never the
misleading `multi-return-not-mapped`). For example
`[hi, lo] = request.security(syminfo.tickerid, "D", [high, low])` lowers to two
data reads that compile. Ships the OHLCV + computed-expr fixture round-trips and
the supported/skill docs.
