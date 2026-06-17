# Task 2 — Pine v6 lexer — Validated Plan

## Context

Implement a hand-rolled, deterministic Pine Script v6 tokenizer in
`packages/pine-converter/src/lexer/`. Produces `Token[]` with 1-based
`SourceSpan`s plus synthetic `NEWLINE`/`INDENT`/`DEDENT` tokens for
significant-indentation block scoping. Package-internal `lex(source)`;
NOT re-exported from the package root. Consumed only by Task 3's parser.

## Pre-existing work (verified against workspace)

- `packages/pine-converter` scaffolded (Task 1, DONE). Files present:
  `src/index.ts` (public types + `convert` stub throwing
  `ConverterNotReadyError("lexer")`), `src/lexer/index.ts` (placeholder
  `export {};`), sibling stub dirs (ast/parser/semantic/mapping/...).
- `src/index.ts` exports `SourceSpan` as **1-based**
  `{ startLine, startColumn, endLine, endColumn }` and `Diagnostic`
  `{ code, severity, message, span, suggestion? }`. The lexer must reuse
  these exact shapes — task text "the diagnostic shape defined in
  `src/index.ts`" = `Diagnostic`.
- `vitest.config.ts` enforces 100% coverage, excludes `**/index.ts` and
  `**/types.ts`. Our `lex.ts`/`tokens.ts`/`keywords.ts`/`indent.ts`/
  `numeric.ts`/`string.ts` are all coverage-covered (none is named
  `index.ts`/`types.ts`).
- `fast-check@^3.20.0` is a **root** dev dependency (also in compiler) —
  resolvable from this package's vitest run. Property-test convention
  mirrored from `packages/compiler/src/bundle.property.test.ts` (pinned
  seed comment, `fc.assert(fc.property(...))`).
- No lexer exists anywhere in the workspace to mirror — greenfield. The
  compiler has no lexer/tokenizer (it uses the TS compiler API).

## Issues found / resolved

1. Task's `Token` example omits the `malformed` flag but §3 mandates a
   "sentinel `malformed: true` flag on the token". **Resolution:** add
   optional `malformed?: true` to `Token`. Only set on malformed
   numerics; absent otherwise (`exactOptionalPropertyTypes` is on, so
   never assign `undefined`).
2. Task §"Desired Behavior" names the diagnostic type `LexerDiagnostic`;
   §"public surface" exports `LexResult`. **Resolution:** `tokens.ts`
   defines `LexerDiagnostic = Diagnostic` (re-using the package
   `Diagnostic` shape so codes/severity/span/suggestion stay uniform)
   and `LexResult = { tokens, diagnostics }`. Export `LexerDiagnostic`
   from `lexer/index.ts` too (the task's §8 list is a subset — exporting
   the diagnostic alias is additive and harmless; it is not re-exported
   from the package root).
3. `SourceSpan` is 1-based. The scanner tracks 1-based line + column
   internally to avoid off-by-one conversions at span-construction time.
4. Diagnostic codes: namespace under `pine-converter/lex/...` for
   stability (matches `pine-converter/...` convention in the scaffold's
   example diagnostic). Codes: `malformed-numeric`, `unterminated-string`,
   `invalid-color`, `illegal-character`, `mixed-indent` (warning),
   `inconsistent-dedent` (warning).
5. Coverage gate is 100% branch — every diagnostic path + every operator
   + every escape needs a hitting test. The `lex.test.ts` fixture set is
   built to exercise each branch; `indent.test.ts` covers the state
   machine in isolation.

## Improvements over a naive transcription

- Indent state machine isolated in `indent.ts` as a pure object with
  `push`/`resolve(level)` returning the INDENT/DEDENT token deltas, so it
  is unit-testable without the full scanner (task §"indent.test.ts").
- Line-continuation handled via a single paren-depth counter incremented
  on `( [ {` and decremented on `) ] }`; NEWLINE/INDENT/DEDENT suppressed
  while depth > 0 OR the last significant token is a trailing comma — one
  predicate, no lookahead rescans.
- Numeric + string scanners are standalone functions returning a
  `{ token, diagnostics, next }` cursor result so they are independently
  testable and keep `lex.ts` a thin dispatcher.

## Numbered steps (verified paths)

1. `src/lexer/tokens.ts` — `TokenKind`, `Token` (+ `malformed?`),
   `LexerDiagnostic`, `LexResult`. JSDoc on the exported `Token`,
   `TokenKind`, `LexResult`, `LexerDiagnostic`.
2. `src/lexer/keywords.ts` — `PINE_V6_KEYWORDS: ReadonlySet<string>`
   exactly the task's 28-keyword set. Source-doc comment → v6 reference.
3. `src/lexer/indent.ts` — `createIndentTracker()` state machine:
   `resolve(level): { tokensToEmit, diagnostic? }`, `dedentToZero()`.
4. `src/lexer/numeric.ts` — `scanNumeric(src, start, line, col)` →
   int/float/hex/scientific, underscore separators, malformed detection.
5. `src/lexer/string.ts` — `scanString(src, start, line, col, quote)` →
   escapes `\n \t \\ \' \" \xNN \uNNNN`, unterminated diagnostic.
6. `src/lexer/lex.ts` — `lex(source): LexResult`. Main scan loop:
   comments + version directive, color literals, identifiers/keywords,
   operators/punctuation, dispatch to numeric/string scanners, NEWLINE +
   indent resolution via the tracker + paren-depth continuation,
   EOF dedent-to-zero + single `eof`.
7. `src/lexer/index.ts` — replace placeholder with
   `export { lex } from "./lex.js"; export type { ... } from "./tokens.js";`.
8. `src/lexer/lex.test.ts`, `lex.property.test.ts`, `indent.test.ts`.
9. Changeset `.changeset/pine-converter-lexer.md` — patch bump.

## Files to create / modify

| File | Action |
|------|--------|
| `src/lexer/tokens.ts` | create |
| `src/lexer/keywords.ts` | create |
| `src/lexer/indent.ts` | create |
| `src/lexer/numeric.ts` | create |
| `src/lexer/string.ts` | create |
| `src/lexer/lex.ts` | create |
| `src/lexer/index.ts` | replace placeholder |
| `src/lexer/lex.test.ts` | create |
| `src/lexer/lex.property.test.ts` | create |
| `src/lexer/indent.test.ts` | create |
| `.changeset/pine-converter-lexer.md` | create |

Do NOT touch `src/mapping/`, `src/parser/`, `src/semantic/`,
`src/index.ts` (concurrent teammate owns mapping; lexer is not root-exported).

## Gates to keep green

- `pnpm --filter @invinite-org/chartlang-pine-converter typecheck`
- `pnpm --filter @invinite-org/chartlang-pine-converter test` (100% cov)
- `pnpm lint` (Biome: 4-space, double-quote, semicolons, trailing comma,
  arrow parens, `import type`, no `any`, no `!`)
- `pnpm docs:check` (every `@example` must compile)
- `pnpm readme:check` (README unchanged)

## Changeset

`.changeset/pine-converter-lexer.md` — `patch` bump on
`@invinite-org/chartlang-pine-converter` (pre-1.0, internal addition, no
public-root surface change).

## Acceptance criteria

- [ ] `lex("//@version=6\nindicator('hi')")` → `version-directive`,
      `newline`, `identifier("indicator")`, `punctuation("(")`,
      `string("hi")`, `punctuation(")")`, `newline`, `eof`.
- [ ] INDENT count == DEDENT count before EOF (balance invariant).
- [ ] Property: non-structural token text reassembles a whitespace-
      stripped substring of source; every span is a contiguous range.
- [ ] 100% line/branch/function coverage on `src/lexer/`.
- [ ] Every `@example` compiles via `docs:check`.
- [ ] Changeset committed.
