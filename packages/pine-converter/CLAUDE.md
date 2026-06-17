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
- **Expression parsing is a Pratt parser (`expressions.ts`).**
  `parseExpression(ctx)` is the single entry every `Expression` slot routes
  through (the Task-3 `expression-stub.ts` was deleted in Task 4). See the
  "Parser / expressions" section below for its precedence model and the
  `UnknownExpression` fallback contract.
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

### Parser / expressions (`src/parser/expressions.ts`, `unparse.ts`)

- **`parseExpression(ctx)` is a Pratt / precedence-climbing parser** —
  `parseTernary → parseBinary(minPrec) → parsePrefix → parsePostfix →
  parsePrimary`. The single binary-precedence source of truth is the
  `BINARY_PRECEDENCE` map (`or` 1 < `and` 2 < equality 3 < relational 4 <
  additive 5 < multiplicative 6). **`and`/`or`/`not`/`na`/`true`/`false`
  are `keyword` tokens, not operators** — `binaryPrecedenceOf` and the
  prefix/primary dispatch key on `(kind, text)` accordingly. The history
  `[`, call `(`, and member `.` are precedence-9 postfix, left-associative,
  driven by the `parsePostfix` loop (each `parseMemberAccess` consumes one
  `.member` so a chained `a.b.c` flattens into `chain` with `head: null`;
  only a computed receiver becomes `head`).
- **`UnknownExpression` is the unrecoverable-span fallback, not a token
  run.** When no prefix rule can start, a closing/separator boundary
  (`) ] } ,`, `newline`, `dedent`, `eof`) is LEFT IN PLACE and a zero-token
  zero-width node is returned so the statement layer's existing
  empty-expression check (`tokens.length === 0`) recovers; any other stray
  token is consumed into a one-token node. The parser never throws.
- **`parseAssignment` consumes BOTH the name and the `=`/`:=` operator**
  (two `next()` calls). The Task-3 stub masked a latent single-`next()` bug
  by greedily swallowing the operator into its token run; the real parser
  stops at the operator, so the operator must be consumed explicitly.
- **History `offset` is any expression.** Literal-bound enforcement for the
  chartlang emit constraint is Task 5/8, not the parser — `arr[i]` parses
  successfully here.
- **`type` / `method` / library `import` hard-reject at the top level**
  (`statements.ts` `parseKeywordStatement`): `unsupported-udt` /
  `unsupported-method` (block-recovered via `recoverCompound`) and
  `unsupported-library-import` (line-recovered via `recoverLine`). Lambdas
  PARSE to a `LambdaExpression` — the transform layer (not the parser)
  rejects them, keeping the parser surface-faithful.
- **`unparse(node)` (`unparse.ts`) is a property-test helper only.** It
  self-parenthesizes operator forms and emits a `paren-expression` as just
  its child (the child already groups), so `unparse∘parse` reaches a re-lex
  fixpoint. String literals carry their quotes in `LiteralExpression.value`
  (the raw lexeme), so `unparse` emits `value` verbatim.

### Semantic analysis (`src/semantic/`)

- **`analyze(script: Script): SemanticResult` is the stage entry —
  package-internal, never re-exported from `src/index.ts`** (same precedent
  as lexer/mapping/parser). It never throws: every problem is a
  `pine-converter/semantic/...` diagnostic on the returned result. The
  result type lives in `src/semantic/types.ts` (pure declarations, coverage-
  excluded); the barrel `src/semantic/index.ts` re-exports `analyze`,
  `classifyDrawingSites`, `inferQualifier`/`joinQualifier`,
  `BUILTIN_SYMBOLS`, and all of `types.ts`.
- **`SemanticResult` is the single annotated IR Tasks 8–15 consume.** It
  carries: the `scopes`/`annotations` identity-keyed `Map`s (keyed by AST
  node reference — a plain `Map`, not a `WeakMap`, because the spec exposes
  them as iterable `ReadonlyMap`s), the `symbols` table keyed by declaration
  `SourceSpan`, the `lifetimes` `LifetimeMap` keyed by the shared
  `SymbolInfo` identity, `referencesBarIndex`/`referencesFutureBarIndex`,
  and the two drawing-classification views described next.
- **Drawing-camp classification is the load-bearing output, and it is
  deterministic.** `analyze` exposes BOTH `drawingSites: readonly
  DrawingCallSite[]` (source-order, what Tasks 10–14 iterate) AND
  `drawingClassifications: ReadonlyMap<CallExpression, DrawingCamp>` (random
  access by call node). Each `DrawingCallSite` bundles the `.new()` call, the
  `PineDrawingConstructor` key, the `HandleType`, the `DrawingCamp`, and the
  call span. The classifier (`drawingCamp.ts`) applies the camp rules in a
  fixed order — never re-derive a camp in a transform; read this map.
- **A drawing constructor is recognised by `DRAWING_KIND_MAP.has(key)`, NOT
  `drawingLookup(key)`.** `linefill.new` is a mapping REJECT
  (`drawingLookup` → `null`) but still a recognised constructor — it
  classifies as Camp C-unbounded. Use membership for recognition, the
  lookup's `null` only for "no usable chartlang target".
- **Camp rules (in order):** (A) the constructor is assigned to a
  `var`/`varip` handle (decl initializer or `:=`/`=` value) → `camp-a`
  (`linefill` single handles reject); (B) the constructor is
  `array.push`'d into an identifier collection with a detected ring-buffer
  eviction (`if array.size(coll) >|>= K` whose body `*.delete`s
  `array.shift|remove(coll)`) → `camp-b` with the literal `K` and
  `capSource: "max-count-decl"`; otherwise an `indicator(...)`
  `max_*_count` arg makes it `camp-c-bounded`; otherwise a resolved
  collection falls back to `camp-b` with `BUCKET_DEFAULT_CAP` and
  `capSource: "bucket-default"`; everything else (incl. collection-driven
  `linefill.new(array.get(...), ...)`) is `camp-c-unbounded` (hard-reject,
  `unbounded-handle-collection`). `camp-c-bounded` emits
  `dynamic-handle-collection` (info); `camp-c-unbounded` emits
  `unbounded-handle-collection` (error).
- **Handle/collection symbols classify against the ROOT scope.** The camp
  classifier resolves names against the post-walk root `ScopeBuilder`, so a
  handle/collection declared at top level resolves; one declared only inside
  an `if`/`for` block does not (its child scope is discarded after the block
  walk) and falls to `camp-c-unbounded`. Top-level handle declaration is the
  v1 idiom; nested-only declarations are intentionally out of the bounded
  camps.
- **Declaration-vs-reassignment is decided on `Assignment` nodes, not bare
  `x = expr` decls.** The parser turns `x = expr` / `x := expr` into an
  `Assignment` (a `none`-qualifier `VariableDeclaration` only comes from a
  typed `float x = ...`). For `=`: a name already bound in an enclosing user
  scope → `AssignmentAnnotation { kind: "declaration", shadows }` +
  `accidental-shadowing`; otherwise a fresh symbol is declared. For `:=`: a
  bound name → `reassignment` (lifetime reassignment recorded for handles);
  an unbound name → `unknown-identifier`.
- **`na` flavour is computed up front in `walkExpression`** (no separate
  annotate pass): a bare `na` keyword takes `handle` when its assignment
  context is a handle var, else `numeric`; an `na(receiver)` call takes its
  flavour from the receiver's resolved `handleType`. Transforms read
  `SemanticAnnotation.naKind` rather than re-inferring.
- **Tuple-LHS multi-return (`[a, b] = f()`) is NOT parsed and NOT wired
  here.** The parser already discards a leading-`[` statement as
  `unexpected-token` (it can't start an expression), and the v1 drawing
  scope defers the multi-return surfaces (`request.security`/MTF). The
  semantic pass therefore only guards a `TupleExpression` reaching a value
  position with `unsupported-tuple-destructuring` (info). Revisit when a
  later slice adds the multi-return surfaces — that work owns wiring a real
  tuple-LHS statement form in the parser.
- **`builtins.ts` / `types.ts` carry no branchy logic** and `types.ts` is
  coverage-excluded; every other `semantic/` module holds 100%
  line/branch/function. Defensive switch arms unreachable from real parser
  output (e.g. a top-level `block-statement`) are covered by synthetic-AST
  unit tests, the same precedent the parser uses for its defensive arms.

### Coordinate resolver (`src/transform/coordinates.ts`, `exprEmit.ts`)

- **`resolveCoordinates(semantic: SemanticResult, opts: ConvertOpts):
  CoordinateResolution` is the stage entry — package-internal, re-exported
  only from `src/transform/index.ts`, never from `src/index.ts`** (same
  precedent as lexer/mapping/parser/semantic). It NEVER mutates the AST: it
  returns a `{ anchors: ReadonlyMap<ExpressionNode, ResolvedAnchor>;
  diagnostics: readonly Diagnostic[] }` side-table keyed by the source
  coordinate expression. Task 16's codegen reads `anchors` and renders each
  `ResolvedAnchor` verbatim. The task file named the entry
  `resolveCoordinates(annotated: AnnotatedScript, …, diagnostics:
  DiagnosticCollector)` — neither `AnnotatedScript` nor `DiagnosticCollector`
  exists; the real IR is `SemanticResult` and diagnostics are returned in the
  result (every stage does this), not pushed into a collector.
- **`ResolvedAnchor.*Expr` fields are chartlang TypeScript SOURCE STRINGS,
  not AST.** They are emitted by `emitExpr` (`exprEmit.ts`) and spliced
  verbatim by codegen. This deliberately avoids a second expression AST on
  the chartlang side. The property test re-parses every emitted string
  through the TypeScript API to guarantee syntactic validity.
- **bar_index → anchor rules (fixed order, `bar-index` xloc mode):** bare
  `bar_index` → historical offset 0; `bar_index[N]`/`bar_index - N` (literal
  N>0) → historical offset N; `bar_index + N` (literal N>0) → future offset
  N with `requiresBarInterval: true`; `bar_index ± <non-literal>` → future/
  historical by sign + `dynamic-bar-index` warning; anything else →
  `unresolved-bar-index` warning + historical offset 0. `xloc.bar_time` x
  values pass through as `bar-time-direct` (or `literal-world-point` when
  both coords are numeric literals).
- **Future-bar synthesis is fail-loud.** A `bar-index-future` anchor needs a
  bar interval; Task 16 emits `bar.time + ((N) * __BAR_INTERVAL_MS)`. When
  `opts.barInterval` is null AND any future anchor is produced, the resolver
  emits exactly ONE `requires-bar-interval` error (deduped via a single
  span flag), at the first offending anchor's span — not one per anchor.
- **`na` emission is context-sensitive and lives in `exprEmit`, not the
  identifier map.** `BUILTIN_IDENTIFIER_MAP` (`src/mapping/builtinIdentifiers
  .ts`) maps OHLCV/`time` → `bar.*` and `bar_index` → `__bar_index()` but
  deliberately OMITS `na`: the emitter reads `SemanticAnnotation.naKind` per
  node and emits `null` (handle) or `Number.NaN` (numeric/absent).
- **`table.new`/`linefill.new`/`polyline.new` carry no `(time, price)`
  pairs and are absent from `COORD_LAYOUT`** — the resolver skips them.
  Polyline `chart.point` array elements are resolved by their dedicated
  transform task, not here.
- **Diagnostics are namespaced `pine-converter/transform/...`** in the shared
  `diagnostics/codes.ts` registry (APPEND-only; the four Task-7 codes were
  added after the semantic codes). `codes.test.ts`'s namespace regex includes
  `transform`. `coordinates.ts`/`exprEmit.ts`/`builtinIdentifiers.ts` hold
  100% line/branch/function; defensive arms unreachable from real parser
  output (malformed `chart.point` callees, missing factory args) are covered
  by synthetic-`SemanticResult` unit tests, the same precedent as the parser.

### Transform: declarations + scaffold IR + DiagnosticCollector (`src/transform/`)

- **`ScriptScaffold` (`src/transform/ir.ts`) is THE mutable cross-task
  contract Tasks 9–15 populate.** `transformDeclaration(decl, analysis,
  diagnostics)` (`declaration.ts`) builds it from the top-level
  `IndicatorDeclaration`/`StrategyDeclaration` (library is hard-rejected
  upstream and never reaches here). The top-level record is `Readonly` (its
  scalar fields are decided once and not reassigned), but `inputs` /
  `stateSlots` / `handleSlots` / `handleRings` are plain mutable arrays and
  `computeBody.statements` is a mutable `string[]`. **Never mutate these
  arrays directly — go through the mutators** (`scaffoldMutators.ts`):
  `appendInput` (Task 9), `appendStateSlot` (Tasks 10/15), `appendHandleSlot`
  (Task 10), `appendHandleRing` (Task 11), `appendComputeStatement` (Tasks
  10–15, source-order; Task 16 joins + indents). `ComputeBodyIR` statements
  are chartlang TS SOURCE STRINGS (same "emit verbatim" precedent as the
  coordinate resolver's `*Expr`), not a second AST.
- **`ir.ts` is declaration-only and coverage-excluded** (`vitest.config.ts`,
  same category as the `ast/*.ts` modules). All runtime lives in the
  coverage-covered `declaration.ts`/`declarationArgs.ts`/
  `scaffoldMutators.ts`/`diagnosticCollector.ts`. A top-level
  `block-statement` can't come from the real parser, so the plot-scan's
  block arm is covered by a synthetic-AST unit test (the established
  defensive-arm precedent).
- **`DiagnosticCollector` (`diagnosticCollector.ts`) is the SINGLE mutable
  diagnostic surface for the transform layer.** Unlike the parse/semantic/
  coordinate passes (which RETURN diagnostics in their result), the
  `void`-returning Tasks 10–15 mutate the scaffold and must push into a
  shared collector: `push(diagnostic)`, `pushCode(key, span, message?)`
  (wraps `makeDiagnostic`), `has(code)`, `toArray()` (snapshot copy),
  `size`. Construct ONE per conversion, thread it through every transform,
  drain via `toArray()` at codegen. `transformDeclaration` snapshots it onto
  `scaffold.diagnostics` at build time — later tasks that push more
  diagnostics re-read the collector, not the frozen scaffold field.
- **`mapDeclarationArgs` (`declarationArgs.ts`) is the §2 arg → option
  table.** Each `max_*_count` bucket defaults to 50 (`BUCKET_DEFAULT_CAP`)
  to preserve Pine GC behaviour; over-cap values clamp to `BUCKET_CAP`
  (lines/labels/boxes 500, polylines 100) + `max-count-out-of-range`.
  `format.inherit`/`scale.none` → `null` + `indicator-arg-not-mapped`.
  Non-literal scalar args are silently ignored (no field set); strategy-only
  args fall through the `default` arm and drop silently. A computed title →
  `name: null` + `computed-indicator-title`; the caller substitutes
  `FALLBACK_INDICATOR_NAME` (`"<unknown>"`). The IR's `format`/`scale` are
  NARROWED (`ScaffoldFormat` = `price|percent|volume`, `ScaffoldScale` =
  `left|right`) — the Pine-reachable subset of core's wider `ValueFormat`/
  `ScaleAxis`.
- **Constructor choice (§3) keys on plot-family calls, not drawing camps.**
  `defineDrawing`'s indicator-only options (`overlay`/`scale`/`maxBarsBack`,
  which `DrawingOverrides` omits in core) are forced to `null` on the
  scaffold so codegen never emits them on a drawing. `strategy(...)` always
  yields `defineIndicator` regardless of plot presence.
- **Exports.** `transformDeclaration`, `DiagnosticCollector`,
  `mapDeclarationArgs`, `FALLBACK_INDICATOR_NAME`, the five `append*`
  mutators, and the IR types are re-exported from `src/transform/index.ts`
  (package-internal — NOT from `src/index.ts`, same precedent as the rest of
  the pipeline).
