# Task 1 — Parse tuple-LHS `request.security` + `[…]` source-list arg

> **Status: TODO**

## Goal

Make the converter's parser + semantic pass **recognise** the two Pine shapes a
tuple `request.security` needs — a tuple-LHS declaration whose RHS is a
`request.security` call, and a `[…]` **array literal** sitting in the call's
third (source) argument — and classify each tuple element as an **OHLCV field**
or an **arbitrary expression**, without yet emitting the chartlang reads (Task
2). This task ends at a clean, annotated IR; no parse/semantic errors for the
two Trend Wizard tuple lines.

## Prerequisites

- **T4 Task 1** (value-position `[…]` array-literal parsing) — the source-list
  arg `[high, low]` / `[expr, expr, expr]` is the same array-literal form T4
  adds. Build on it; do not re-implement array-literal parsing here.
- `../multi-symbol-security/` Tasks 1–2 (the `{ symbol, interval }` opts +
  `requestedFeeds` manifest) landed — T5 produces those feeds.

## Current Behavior

- Tuple-LHS (`[a, b] = …`) parses to a `TupleDeclaration` AST node
  (`src/parser/statements.ts`, `looksLikeTupleDeclaration`), and the semantic
  walk (`walkTupleDeclaration`, `src/semantic/analyze.ts`) defines one symbol
  per non-`_` target — **but only multi-output `ta.*` RHS** is recognised
  downstream (`MULTI_RETURN_TA_MAP`). A `request.security` RHS is not a
  recognised multi-output source, so it falls to `multi-return-not-mapped`.
- The Pine `[…]` square-bracket **array literal** does not parse today — the
  Pratt parser treats `[` only as postfix history-access
  (`src/parser/expressions.ts`); a `[high, low]` source arg becomes an
  `unknown-expression`. (Evidence: `[h,l] = request.security(...,[high,low])`
  → `parse/expected-token`, `unexpected-token`.)
- `request.security`'s argument shape is otherwise understood by
  `src/transform/requestSecurity.ts` (single-source form), which dispatches on
  the **third arg**: a bare OHLCV field → data form; any other expression →
  callback form.

## Desired Behavior

```pine
[src_custom_hi, src_custom_lo] = request.security(sym, "D", [high, low])
[a, b, c] = request.security(sym, "D", [cf_atr_perct(x), cf_atr_perct(y), cf_atr_perct(z)])
```

- Parses with **no** diagnostics.
- Semantic IR records, per tuple declaration backed by a `request.security`
  RHS: the resolved `{ symbol, interval }` feed (reusing multi-symbol
  resolution), the array of N source-element expressions, and per element a
  classification `{ kind: "ohlcv", field } | { kind: "expr", node }`.
- Arity mismatch (LHS names ≠ source-list length) → a new
  `security-tuple-arity-mismatch` diagnostic (warning), bind what it can.

## Requirements

### 1. Recognise `request.security` as a tuple-decl RHS

- In the tuple-declaration semantic handling (`src/semantic/analyze.ts`
  `walkTupleDeclaration`), detect an RHS whose callee is `request.security`
  (use the shared `dottedCallee`, `src/transform/callArgs.ts`). Tag the
  declaration with a `securityTuple` annotation rather than letting it reach
  the `multi-return-not-mapped` path. This is a path SEPARATE from
  `MULTI_RETURN_TA_MAP` (which is `ta.*`-only) — recognition is by the RHS
  callee + array-literal third arg, not the multi-output `ta.*` table.
- **Annotation shape (explicit).** Store the `securityTuple` annotation on the
  `TupleDeclaration` node in `analysis.annotations` (the identity-keyed
  annotations map), carrying
  `{ kind: "securityTuple"; feed: { symbol?; interval }; elements: ReadonlyArray<{ kind: "ohlcv"; field: string } | { kind: "expr"; node: ExpressionNode }> }`.
  Task 2's `emitTupleDeclaration` reads it back via
  `analysis.annotations.get(tupleDecl)`.

### 2. Parse + read the `[…]` source list

- Consume the third arg as an array literal (the T4 array-literal node). Each
  element is a full expression. Preserve source order (binds to LHS order).
- A non-array third arg under a tuple-LHS → `security-tuple-source-not-list`
  (error); skip.

### 3. Classify each element (OHLCV vs expression)

- Reuse `requestSecurity.ts`'s third-arg dispatch rule **per element**: a bare
  OHLCV identifier (`open/high/low/close/volume/hl2/hlc3/ohlc4/…`) →
  `{ kind: "ohlcv", field }`; anything else → `{ kind: "expr", node }`.
- Reuse the EXISTING `securityField()` helper in `requestSecurity.ts` (it
  already detects bare OHLCV identifiers for the single-source path) — do NOT
  write a second copy (repo no-divergence invariant). If the per-element call
  site needs it, re-export `securityField` from `src/transform/index.ts` rather
  than duplicating the OHLCV-field test.

### 4. Resolve the feed (symbol + interval)

- Reuse the multi-symbol resolution (literal symbol / `input.symbol` default /
  `input.enum`; literal / `input.enum` interval) from
  `../multi-symbol-security/`. A non-literal symbol/interval emits the
  multi-symbol diagnostics (`request-security-symbol-not-literal` /
  `request-security-interval-not-literal`) — do not invent new ones for that.
- **Trend Wizard caveat:** its interval is `src_tframe` from
  `input.timeframe("")`. If multi-symbol only accepts literal/`input.enum`
  intervals, an `input.interval`/`input.timeframe`-driven interval still
  rejects — record this as a known limitation in the diagnostic note (it is a
  broader MTF-input concern owned by multi-symbol-security, not T5).

### 5. New diagnostics (append-only, `src/diagnostics/codes.ts`)

- `security-tuple-arity-mismatch` (warning)
- `security-tuple-source-not-list` (error)

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/pine-converter/src/semantic/analyze.ts` | Modify | Detect `request.security` tuple RHS; annotate `securityTuple` + element classification. |
| `packages/pine-converter/src/transform/requestSecurity.ts` | Modify | Reuse the existing `securityField()` helper for elements; re-export it from `src/transform/index.ts` if the per-element call site needs it. |
| `packages/pine-converter/src/transform/callArgs.ts` | Modify (if needed) | Shared third-arg/array accessors. |
| `packages/pine-converter/src/diagnostics/codes.ts` | Modify | Append the two new codes. |
| `packages/pine-converter/src/semantic/analyze.test.ts` (+ synthetic) | Modify | Classification + arity + non-list coverage. |
| `packages/pine-converter/CLAUDE.md` | Modify | Document the `securityTuple` IR + element classification. |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm -F @invinite-org/chartlang-pine-converter test` (100% line/branch/function)
- `pnpm docs:check`

## Changeset

Covered by Task 2's `@invinite-org/chartlang-pine-converter` **patch**
changeset (this task is parse/semantic-only, no public surface change).

## Acceptance Criteria

- Both Trend Wizard tuple lines parse with no errors; the semantic IR carries
  the feed + N classified elements.
- OHLCV-field detection is shared with the single-source path (one helper).
- Arity mismatch + non-list source raise the new diagnostics; 100% coverage;
  `CLAUDE.md` updated.
