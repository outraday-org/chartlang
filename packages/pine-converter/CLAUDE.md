# packages/pine-converter/

`@invinite-org/chartlang-pine-converter` — Pine Script v6 → chartlang
source-to-source converter (drawings v1). Public surface (`convert`,
`ConvertOpts`, `ConvertResult`, diagnostics types) lives in `src/index.ts`;
the conversion pipeline is built stage-by-stage under `src/lexer/`,
`src/parser/`, `src/semantic/`, `src/mapping/`, `src/transform/`,
`src/codegen/`. The plan lives in `tasks/pine-drawing-converter/`.

## Invariants

### Lexer (`src/lexer/`)

- **`lex` is package-internal — never re-exported from `src/index.ts`.**
  Only the Task 3 parser consumes it. The barrel `src/lexer/index.ts`
  re-exports `lex` + `Token`/`TokenKind`/`LexResult`/`LexerDiagnostic`,
  but the package root deliberately does not.
- **Spans are 1-based and reuse the package `SourceSpan` shape**
  (`startLine`/`startColumn`/`endLine`/`endColumn`, all 1-based). The
  scanner tracks 1-based line + column as it walks so spans never need an
  off-by-one conversion. This matches the compiler's 1-based callsite-id
  format — keep both in lockstep if span semantics ever change.
- **Significant indentation is modeled with synthetic
  `newline`/`indent`/`dedent` tokens, and the counts always balance.**
  `createIndentTracker` (`indent.ts`) holds a column-level stack starting
  at `0`; `dedentToZero()` drains it at EOF so the number of `indent`
  tokens equals the number of `dedent` tokens emitted before the single
  trailing `eof`. The property test enforces this — do not emit a `dedent`
  without a prior matching `indent`.
- **Line continuation is a paren-depth + trailing-comma rule, not
  lookahead.** A `newline` (and any consequent `indent`/`dedent`) is
  suppressed while `parenDepth > 0` (incremented on `( [ {`, decremented
  on `) ] }`) OR the last significant token is a `,`. Blank and
  comment-only lines emit a `newline` but never touch the indent stack.
- **Malformed input never throws — it emits a `LexerDiagnostic`.** Codes
  are namespaced `pine-converter/lex/<code>`: `malformed-numeric`,
  `unterminated-string`, `invalid-color`, `illegal-character` (errors),
  `mixed-indent`, `inconsistent-dedent` (warnings). Malformed numerics
  still emit a token flagged `malformed: true` with `numericValue: NaN`
  so later passes short-circuit instead of propagating NaN.
- **`tokens.ts` is declaration-only and excluded from coverage** in
  `vitest.config.ts` (same category as a `types.ts` barrel). All real
  lexer logic lives in coverage-covered `lex.ts`/`indent.ts`/`numeric.ts`/
  `string.ts`/`keywords.ts` and must hold 100% line/branch/function.

### Mapping tables (`src/mapping/`)

- **Every Pine → chartlang name/enum decision routes through one table
  here — no transform re-derives a mapping.** `DRAWING_KIND_MAP`,
  `ENUM_VALUE_MAP`, `INPUT_MAP`, `TA_PASSTHROUGH_MAP`,
  `MATH_PASSTHROUGH_MAP` are immutable `ReadonlyMap`s; Tasks 7–15 consume
  them. Add a Pine-version symbol = add one row, never branch in a
  transform.
- **`chartlang: null` is the REJECT marker, and `lookup(map, key)`
  collapses both "absent key" and "REJECT entry" to `null`.** Callers get
  a single "no usable target" signal; the diagnostics layer reads the
  entry's `notes` directly off the map when it needs the rejection
  reason. Do not add a separate `isRejected` predicate — the null return
  IS the contract (e.g. `taLookup("ta.kcw")` → null, `linefill.new` →
  null).
- **chartlang TARGET symbols are verified against
  `@invinite-org/chartlang-core`, never invented.** `marker` has no
  `shape` field (label glyph styles drop the glyph with a warning note);
  `LineStyle` is `solid|dashed|dotted` only (arrow line styles → dashed +
  warning); `ta.pivothigh`/`pivotlow` project the `high`/`low` fields of
  `PivotsHighLowResult` (NOT `pivotHigh`/`pivotLow`); Pine `input.timeframe`
  → `input.interval`. If a Pine concept has no analogue, the entry is a
  REJECT — point at no fabricated symbol.
- **The mapping module is package-internal — not re-exported from
  `src/index.ts`** (same precedent as the lexer). Transforms import from
  `src/mapping/`. `core` is a **devDependency only**: the mapping source
  has zero `core` imports; only the cross-check tests
  (`drawingKinds.test.ts`, `inputs.test.ts`, `taPassthrough.test.ts`)
  import `DRAWING_KINDS` / `input` / `ta` to assert each target name is
  real.
- **`ChartlangSetter.transform` is typed `(args: readonly unknown[]) =>
  unknown`, NOT against the Pine AST.** The AST (`src/ast/`, Task 3/4) is
  built later; keeping the mapping AST-agnostic preserves the data/logic
  split. Transform tasks narrow `unknown` at their call site.
- **`index.ts` (barrel) and `types.ts` are excluded from coverage** by
  `vitest.config.ts`'s `src/**/types.ts` glob. `types.ts` is mostly
  declarations but also holds the shared `lookup` runtime helper; it still
  carries `types.test.ts` so the helper's branches stay regression-tested
  even though they don't count toward the gate. All other table data lives
  in the five `drawingKinds.ts`/`enums.ts`/`inputs.ts`/`taPassthrough.ts`/
  `mathPassthrough.ts` modules and must hold 100% line/branch/function.

### Parser / AST (`src/parser/`, `src/ast/`, `src/diagnostics/`)

- **`parseStatements(tokens)` is the parser entry — package-internal, never
  re-exported from `src/index.ts`** (same precedent as the lexer/mapping).
  It produces a `Script` AST plus diagnostics and **never throws**: every
  error becomes a `ParserDiagnostic` and parsing continues. The AST is
  always returned, even for empty or malformed input.
- **The lexer emits the version directive as ONE `version-directive` token
  (with `versionNumber`), NOT `//@version=` + an `int`.** The parser reads
  that single token — do not re-tokenize the directive text. A
  `version-directive` token always carries `versionNumber` (the lexer's
  regex requires `\d+`); the `=== undefined` guard in
  `parseVersionDirective` is type-safety only and is exercised by a
  synthetic-token unit test, not reachable from real lexer output.
- **INDENT/DEDENT map to `BlockStatement` boundaries.** `parseBlock` opens
  on an `indent` and closes on the matching `dedent`; the lexer's
  indent/dedent balance invariant means a block always closes, so the
  `close === null` arm in `parseBlock` is defensive (covered by a synthetic
  unbalanced-token unit test). Rejected compound statements
  (`for ... in`, `while`) are recovered via `recoverCompound`, which
  discards the header line AND the entire indented body block (tracking
  nested indent depth) so the parser resumes on the next sibling statement.
- **The cursor skips `comment` tokens transparently.** Blank/comment-only
  lines still emit `newline`, so `parseStatement` swallows a standalone
  leading `newline`. `TokenCursor.peekAhead(n)` is the fixed lookahead used
  to disambiguate `name = expr` named arguments and the `for ... in` head.
- **Expression parsing is a Task-3 STUB (`expression-stub.ts`).**
  `parseExpression(ctx)` captures the token run up to the next depth-0
  boundary (`newline`/`indent`/`dedent`/`eof`, depth-0 `,`/`)`/`]`/`}`, the
  `=>` operator, or a `to`/`by` keyword) into an `UnknownExpression`,
  tracking `( [ {` nesting so nested-call commas/closers stay in the run.
  Task 4 replaces this ONE module with the real Pratt parser — every
  `Expression` slot routes through it, so the swap is localized.
- **AST node modules are pure `export type` (zero runtime) and excluded
  from coverage** in `vitest.config.ts` (`src/ast/spans.ts`,
  `expressions.ts`, `statements.ts`, `script.ts`; `ast/types.ts` is covered
  by the `**/types.ts` glob). Every node is `readonly`, deeply immutable,
  carries a kebab-case string `kind` discriminator and a 1-based `span`.
  The `spanBetween(start, end)` runtime helper (`parser/spans.ts`) composes
  parent spans from child spans so the "every node's span ⊆ its parent's
  span" property holds by construction.
- **Diagnostic codes are a single typed registry (`diagnostics/codes.ts`),
  namespaced `pine-converter/parse/...`.** The parser references codes by
  key via `makeDiagnostic(key, span, messageOverride?)`; never inline a
  literal code/message in the parser. `codes.ts` is coverage-covered;
  `diagnostics/index.ts` (barrel) is excluded.
