# packages/pine-converter/

`@invinite-org/chartlang-pine-converter` — Pine Script v6 → chartlang
source-to-source converter (drawings v1). Public surface (`convert`,
`ConvertOpts`, `ConvertResult`, diagnostics types) lives in `src/index.ts`;
the conversion pipeline is built stage-by-stage under `src/lexer/`,
`src/parser/`, `src/semantic/`, `src/mapping/`, `src/transform/`,
`src/codegen/`. The plan lives in `tasks/pine-drawing-converter/`.

## Invariants

### Synthesized identifier naming (`src/transform/nameAllocator.ts`)

- **Every synthesized identifier in the generated output is READABLE and
  collision-safe — there is NO blanket `__` prefix.** The old convention
  prefixed every synthesized name with `__` to disambiguate it from a
  translated Pine identifier; that is GONE. A drawing handle from `var line
  trail = na` is emitted as `const trail = …` (the Pine identifier reused), a
  ring from `var array<line> lvls` as `lvls`, a scalar state slot as its Pine
  name, the bar-index bridge as `barCount`/`barIndex`, the drawing-handle
  helper as `HandleSlot`/`useDrawingHandleSlot`/`HandleRing`/
  `useDrawingHandleRing`. If you add a new synthesized-name SITE, route it
  through the allocator — never re-introduce a `__` prefix and never inline an
  affixed name at a call site.
- **`ScriptScaffold.names: NameAllocator` is the single, scope-aware allocator
  threaded through every name site.** It is seeded ONCE in
  `transformDeclaration` via `collectReservedNames(analysis)` (the `compute`
  context params `bar`/`draw`/…, the JS/TS reserved words, and every declared
  Pine symbol name). It exposes three claim methods, all of which sanitize the
  base (strip a leading `__`, drop invalid chars, prefix a digit-leading base
  with `n`, fall back to `value`) and NEVER return a `__`-prefixed name:
  - `allocateForSymbol(pineName)` — for a Pine SYMBOL (handle / ring / state
    slot / tuple-result). Prefers the symbol's own identifier (so `trail`
    stays `trail`); the seeded Pine name is reclaimable here because the
    symbol's source references are rewritten to this synthesized name. MEMOIZED
    per `pineName`, so two sites touching one symbol (e.g. two `array.push`
    into one ring, or `tupleResultName` called from both `tupleAliases` and
    `emitTupleDeclaration`) get the SAME name — the dedup the old pure
    `ringLocalName`/`handleSlotLocalName` got for free.
  - `allocate(preferred)` — for a GENERIC synthesized name (the ring element
    temp `element`, an inline-input `inlineInput`, a table `<handle>Cells`).
    Avoids BOTH the seeded user names and previously-emitted names.
  - `allocateMemoized(key, preferred)` — for the codegen helper names, MEMOIZED
    by `key` so `emit(scaffold)` is deterministic across repeated calls (a
    second invocation replays the first allocation instead of suffixing).
- **Collision rule.** When a preferred base is already taken, the allocator
  appends the smallest integer ≥ 2 that is free (`trail` → `trail2` →
  `trail3`), NEVER a `__` fallback. A Pine script that already has a var named
  `barIndex` forces the bar-index bridge to `barIndex2`; a Pine handle and a
  helper both wanting `HandleSlot` resolve to `HandleSlot` / `HandleSlot2`.
- **The `bar_index` VALUE read flows through an internal sentinel, renamed at
  codegen.** `mapping/builtinIdentifiers.ts` lowers `bar_index` to the fixed
  `__barIndexBridge()` sentinel at transform time (before the bridge name is
  allocated — `emitExpr` is a pure function not threaded the allocator).
  `codegen/emitCompute.ts` allocates the readable `HelperNames` (last, after
  every per-symbol name) and `renameBarIndexSentinel` rewrites the
  `__barIndexBridge` / `__barIndexBridgeCount` sentinels to the allocated
  `barIndex` / `barCount` across EVERY emitted line. The sentinel is the ONE
  internal `__` token, and it NEVER reaches the generated `.chart.ts`
  (`usage.ts` keys its bridge-needed flag on `BAR_INDEX_SENTINEL`). yloc
  padding lowers to an inline `0.001` literal — no synthesized const.

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
  `MATH_PASSTHROUGH_MAP`, `MULTI_RETURN_TA_MAP` (multi-output `ta.*` tuple
  destructuring — `ta.macd`/`bb`/`kc`/`dmi`/`supertrend`) are immutable
  `ReadonlyMap`s; Tasks 7–15 consume them. Add a Pine-version symbol = add one
  row, never branch in a transform.
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
- **Tuple-LHS multi-return (`[a, b, c] = ta.macd(...)`) IS parsed + wired.**
  A statement-leading `[` whose head matches `[ ident (, ident)* ] =`
  (`looksLikeTupleDeclaration`, `parser/statements.ts`) parses to a
  `TupleDeclaration` AST node (`names: { name; span }[]` — per-name spans so
  the semantic `symbols` map gets one entry per element, no span collision);
  any other `[` line still routes to `unexpected-token`. `walkTupleDeclaration`
  walks the RHS and `defineSymbol`s each non-`_` target (a `_` is a discarded
  placeholder, not bound). The transform layer lowers it (see the codegen
  `emitTa`/tuple section). The legacy `unsupported-tuple-destructuring` (info)
  now fires ONLY for a `TupleExpression` reaching a VALUE position (RHS), which
  the statement form never produces. `request.security`/MTF multi-return is
  still out of scope (its RHS isn't a recognised multi-output `ta.*`, so it
  warns `multi-return-not-mapped`).
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
  both coords are numeric literals). **A DYNAMIC `bar_index + <non-literal>`
  offset does NOT `noteFuture` (no `requires-bar-interval`):** the runtime
  resolves the offset sign-agnostically via `bar.point` — a negative runtime
  value (e.g. what `ta.highestbars`/`ta.lowestbars` return, ≤ 0) resolves to
  the historical timestamp through the time buffer, a positive one
  extrapolates from bar spacing. ONLY the LITERAL `bar_index + N` future case
  still `noteFuture`s. (This is why `let hbar = ta.highestbars(bar.high, N)
  .current; bar.point((hbar), …)` — lowered from `line.new(bar_index + hbar,
  …)` — needs no `opts.barInterval`.)
- **Bar-offset anchors lower to `bar.point(<signed offset>, <price>)`.**
  `anchorToWorldPoint` (`coordinates.ts`) emits `bar.point(0, price)` for the
  current bar, `bar.point(-(N), price)` for an `N`-back historical offset, and
  `bar.point((N), price)` for an `N`-ahead future offset; `chart-point-now`
  also collapses to `bar.point(0, price)`. The runtime resolves the offset to a
  real (historical) or extrapolated (future) `WorldPoint` at compute time, so
  the converter NO LONGER synthesises `bar.time ± (N * __BAR_INTERVAL_MS)`
  arithmetic or emits the `__BAR_INTERVAL_MS = 0` sentinel const
  (`emitBarIntervalConst` and the `UsageFlags.barInterval` flag were removed).
  The drawing anchor frame is still ONLY `WorldPoint { time, price }`;
  `bar.point` is authoring sugar, not a new anchor shape. The `barIndex` /
  `barCount` running-count bridge (for `bar_index` VALUE reads; readable + collision-safe, internal `__barIndexBridge` sentinel renamed at codegen) is unrelated
  and stays.
- **`requires-bar-interval` stays as a manifest-intent signal, not a hard
  arithmetic dependency.** A `bar-index-future` anchor still carries
  `requiresBarInterval: true` and, when `opts.barInterval` is null AND any
  future anchor is produced, the resolver emits exactly ONE
  `requires-bar-interval` error (deduped via a single span flag) at the first
  offending anchor's span. Future anchors now resolve at runtime via
  `bar.point`, so the interval is advisory (it drives
  `manifest.requiresBarInterval`) rather than feeding a `__BAR_INTERVAL_MS`
  computation.
- **`na` emission is context-sensitive and lives in `exprEmit`, not the
  identifier map.** `BUILTIN_IDENTIFIER_MAP` (`src/mapping/builtinIdentifiers
  .ts`) maps OHLCV/`time` → `bar.*` and `bar_index` → the internal `__barIndexBridge()` sentinel (renamed to `barIndex()` at codegen) but
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

- **Shared AST accessors live in ONE place — `callArgs.ts`.** `dottedCallee`
  (the bare-rooted dotted callee name, used by ~9 transforms to dispatch on a
  Pine builtin), `positionalArgs` (the unnamed args), and `namedArg` (a named
  arg by key) are the divergence-free call-shape accessors every transform
  consumes from here — never re-implement them per file. (The `literalInt`
  family is NOT shared: `coordinates.ts` wants positive-only + paren-unwrap,
  `polylineLinefill.ts` wants `+`-only, `controlFlow.ts`/`tables.ts` want signed
  `±`, so each keeps its own intentionally-different variant.) The iterator
  unroll helper `substituteIterator` is likewise shared from `controlFlow.ts`
  (re-exported from `index.ts`) — `tables.ts`/`polylineLinefill.ts` import it.
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

### Transform: inputs (`src/transform/inputs.ts`, `timeframeConvert.ts`)

- **`transformInputs(analysis, scaffold, diagnostics): void` emits ONE
  `InputDeclarationIR` per Pine `input.*` site, and `InputDeclarationIR` is
  `{ name, code }` — a VERBATIM chartlang source string, NOT the rich
  kind/defaultValue/min/max shape Task 9's task file describes.** The task
  file also invented a `scaffold.identifierRewrites` map; it does NOT exist
  and was deliberately not added. Rewriting a Pine input reference (`len` →
  `inputs.len`) is Task 16 codegen's job — the input-name registry IS
  `scaffold.inputs`, so an unused side-map would contradict the IR. This
  follows the "emit verbatim source strings" precedent (coordinate resolver
  `*Expr`, `ComputeBodyIR`).
- **A named input (`len = input.int(20)`) keys its descriptor by the bound
  name; an inline input (`ta.ema(close, input.int(20))`) is promoted to a
  synthesised `inlineInput` name (allocator-issued, e.g. `inlineInput`/`inlineInput2`) with an `inline-input-promoted` info.** The
  walk descends `if`/`for`/`switch`/block bodies + full expression trees; a
  declaration whose value is DIRECTLY an `input.*` call is named, anything
  else is scanned for nested (inline) inputs. The actual call-node → 
  `inputs.<name>` expression splice is Task 16's, not here.
- **Rejects push a `pine-converter/transform/...` error and skip the input
  (no `appendInput`):** `input.enum` → `input-enum-rejected`; a computed
  `input.source` default → `non-literal-source-input`; a non-literal default
  (incl. an unknown/`non-string` timeframe) → `non-literal-input-default`; an
  unrecognised `input.*` → `unknown-input-primitive`. Allowed defaults are
  compile-time literals PLUS a unary `+`/`-` on a numeric literal
  (`input.int(-1)`). Unmapped named args (`tooltip`/`group`/`inline`/
  `confirm`, a non-literal `title`/`minval`/…) warn once via
  `input-arg-not-mapped` and are dropped, but the input is still emitted.
- **`pineTimeframeToInterval`/`intervalToPineTimeframe`
  (`timeframeConvert.ts`) are the §3 Pine-timeframe ↔ chartlang-interval
  table (`"60"`↔`"1h"`, `"D"`→`"1d"`, …), returning `null` for an
  out-of-table value. Reused by Task 15's MTF `request.security`. The
  `tuple-expression`/`switch`-as-value walk arms are unreachable from the
  real parser and are covered by a synthetic-AST unit test
  (`inputs.synthetic.test.ts`), the established defensive-arm precedent.

### Transform: Camp A (handle-slot helper + setter-fold)

- **`transformCampA(site, analysis, scaffold, diagnostics): void`
  (`campA.ts`) lowers ONE `camp-a` `DrawingCallSite` — a single
  `var`/`varip` handle created once and mutated each bar.** It early-returns
  if `site.camp.kind !== "camp-a"` (so callers can pass the whole
  `drawingSites` list and let it self-filter). It mutates the scaffold +
  `DiagnosticCollector`; Task 16 codegen reads `scaffold.handleSlots` +
  `scaffold.computeBody`.
- **The handle slot name is THE cross-task contract Task 11 reuses.**
  `handleSlotLocalName(pineName, scaffold.names)` (`handleSlot.ts`) reuses the Pine identifier (`var line trail` → `trail`);
  Camp A stores that FINAL local in `HandleSlotIR.name` and references it
  verbatim in compute statements. Task 16 codegen emits both the
  `useDrawingHandleSlot` helper DEFINITION and the
  `const <name> = useDrawingHandleSlot<"<kind>">();` allocation (readable handle local) from
  `scaffold.handleSlots` — Camp A does NOT emit the helper or the allocation
  (the §8 prose in the task file is overridden by Task 16 §1/§4; follow the
  IR/codegen split). The GENERAL (non-compact) compute statements are:
  `if (<local>.current() === null) { <local>.set(<drawCall>); }`, one
  `<local>.current()?.update(<patch>);` per branch, and
  `<local>.current()?.remove(); <local>.set(null);` per `*.delete`.
- **The single-persistent-handle COMPACT lowering drops the slot machinery for
  the common case.** `HandleSlotIR` carries a `compact: boolean`. A slot is
  compact when the handle is a plain `var` (NOT `varip`) AND has NO `*.delete`
  anywhere in the script. The compact form exploits the runtime's
  callsite-persistence (each `draw.*` callsite keys its drawing state by slot id
  and re-emits `op: "update"` with merged state on cross-bar re-entry —
  `createDrawingHandle` in runtime `emit/draw/handle.ts`): a `const <local> =
  draw.<kind>(…)` evaluated every bar IS the persistent handle, and the followup
  `<local>.update(<patch>)` patches it. This is byte-identical at the EMISSION
  level to the general form — the `useDrawingHandleSlot` closure resets every
  bar, so its `current() === null` guard fires the SAME `draw.*` callsite every
  bar (create → runtime-merged update), and its `current()?.update(…)` patches
  the just-created handle. Camp A therefore emits, for a compact slot:
  `const <local> = <drawCall>;` and one `<local>.update(<patch>);` per branch.
  The PINNING contract is unchanged: a partial whole-anchor move (`set_xy2`
  only) still fills the un-moved index from the creation expression via
  `drawCallAnchors`/`foldSetters` (with `partial-anchor-filled`), so the anchor
  expression strings — and thus the per-bar emissions — match the general form
  exactly. The golden corpus + `fixtures-compile.test.ts` round-trip guard this.
- **The compact lowering FALLS BACK to the general slot machinery whenever the
  shape is not the clean single-create idiom.** A `*.delete` (the bare `const`
  cannot express the slot's `set(null)` + next-bar resurrection cleanly), a
  `varip` handle, a `table.new` site (`transformTables`, always non-compact), a
  static `linefill`/`polyline` site (`transformPolylineLinefill`, always
  non-compact), and any Camp B/C ring all stay non-compact. Codegen emits the
  `useDrawingHandleSlot` helper + `DrawingHandle` import iff ANY handle slot is
  non-compact (`hasNonCompactHandleSlot`, `emitHelpers.ts`); a compact slot
  emits NO allocation in `emitSlotAllocations` (its `const` create IS the
  allocation). `scanUsage.drawingHandle` (the `type DrawingHandle` import gate)
  is likewise `hasNonCompactHandle || hasRings`.
- **`synthesizeDrawCall(kind, call, ctx)` (`handleSlot.ts`) is the reusable
  draw-call synthesis** (Camp A wraps it in `slot.set(...)`, Camp B will wrap
  it in `ring.push(...)`). `ctx: DrawCallContext = { annotations, anchors,
  warn }` — a STRUCTURAL sink (not the `DiagnosticCollector` class) so both
  camps share one signature; `warn` only raises `label-style-not-mapped` /
  `yloc-padding-approximated`. Coordinates come from the resolved
  `anchors` side-table (the `.new()` site pass); `DRAW_METHOD`/`ANCHOR_ARITY`
  are TOTAL `Record<ChartlangDrawKind, …>` maps (no `??` fallback, so no dead
  arm). `resolveCampADrawKind(site, diagnostics)` (`drawKindResolve.ts`)
  picks the chartlang kind: `line.new`→`line`, `box.new`→`rectangle`,
  `label.new`→`text` by default or `marker`/`frame`/`arrow-mark-up|down`/
  `rectangle` per the `style=label.style_*` enum (unmapped/non-drawing style
  → `text` + `label-style-not-mapped`).
- **`foldSetters(setters, handleType, annotations, warn): string | null`
  (`setterFold.ts`) is the reusable setter→patch fold** (Camp A + Camp B +
  tables). A `SetterCall` is `{ method, call }`. It looks each setter's
  `statePath` up in `DRAWING_KIND_MAP`'s `setterMap` and builds ONE
  `Partial<DrawingState>` object: whole-anchor setters (`set_xy1`/`set_xy2`,
  `statePath` `["anchors", N]`, arity 2) collapse into `anchors: [a, b]`
  (the `(x, y)` pair routed through `resolveAnchorExpr` so `bar_index`-mode
  setters lower to `bar.time` arithmetic, identical to the `.new()` anchors);
  style setters nest under `style`; `set_text`→`body`. **Deep
  single-coordinate setters (`["anchors", N, "time"|"price"]`, len 3) CANNOT
  merge into the tuple via the runtime's shallow `Partial<DrawingState>`
  merge and are DROPPED with `set-path-unsupported` (info).** Later setters
  override earlier ones at the same path; `null` when nothing folds.
- **Setters are grouped per straight-line block** (top level + each `if`/
  `else if`/`else` branch, one nesting level — the v1 idiom). Setters in
  >1 branch each emit their own merged `update({...})` + a
  `setter-fold-cross-branch` (info). A handle `varip` reuses the same slot +
  `varip-approximated` (info); a non-`na` `var` initial → 
  `cross-mount-state-not-preserved` (info, deduped once per site by code via
  the `DIAGNOSTIC_CODES[code].code` full-string `has(...)` check — `pushCode`
  stores the FULL stable code, not the short key). `yloc.abovebar/belowbar`
  → `bar.high|low ± ((bar.high - bar.low) * 0.001)` inline literal (`ylocResolve.ts`)
  + a once-per-script `yloc-padding-approximated`.
- **`anchorToWorldPoint` / `resolveAnchorExpr` live in `coordinates.ts`** (not
  `handleSlot.ts`) to avoid a `handleSlot`↔`setterFold` import cycle.
  `resolveAnchorExpr(x, y, annotations, opts?)` resolves a single coordinate
  pair OUTSIDE the `.new()` sweep (setter args) and does NOT raise
  diagnostics — the `.new()` site pass already reported them for the script.
  All exports re-export from `src/transform/index.ts` (package-internal).
  `campA.ts`/`handleSlot.ts`/`setterFold.ts`/`drawKindResolve.ts`/
  `ylocResolve.ts` hold 100% line/branch/function; defensive arms
  unreachable from real parser output (an unmapped `linefill` camp-a kind,
  the non-string `style` enum) are covered by synthetic-`DrawingCallSite`
  unit tests (`campA.synthetic.test.ts`), the established precedent.

### Transform: Camp B (ring buffer)

- **`transformCampB(site, analysis, scaffold, diagnostics): void`
  (`campB.ts`) lowers ONE `camp-b` `DrawingCallSite` — a `var
  array<line|label|box>` filled by `array.push(coll, <draw>.new(...))` with
  FIFO eviction — into a chartlang ring buffer.** It early-returns when
  `site.camp.kind !== "camp-b"` (callers can pass the whole `drawingSites`
  list) AND when `site.constructor === "polyline.new"` (polyline ring draw
  synthesis is Task 14's — `synthesizeDrawCall` renders only the
  line/box/label families). It mutates the scaffold + `DiagnosticCollector`;
  Task 16 codegen reads `scaffold.handleRings` + `scaffold.computeBody`.
- **ONE `draw.<kind>(...)` callsite at a fixed source position is the load-
  bearing invariant.** The Pine `array.push(coll, <site.call>)` is found by
  identity match (`expr.args[1]?.value === site.call`, never re-derived) and
  its enclosing guard (`findPushGuard`: top-level → unguarded, else the
  one-level `if` condition emitted via `emitExpr`). The compute statement is
  `if (<cond>) { <ring>.push(<drawCall>); }` (or unguarded) — exactly one
  push, NEVER a `draw.*` inside a loop (the compiler's
  `stateful-call-inside-loop` gate rejects that). `<drawCall>` is
  `synthesizeDrawCall(kind, site.call, ctx)` reused verbatim from Camp A; the
  resolved kind comes from `resolveCampADrawKind`. The explicit
  `array.shift`/`*.delete` eviction block is NOT emitted (the ring rotates
  modulo K internally) — one `ring-eviction-implicit` (info) per ring marks
  the elision.
- **The ring API is THE cross-task contract Task 12 (Camp C) + Task 13
  (tables) reuse** (`ringHelper.ts`, all re-exported from
  `src/transform/index.ts`):
  - `ringLocalName(collectionName, scaffold.names)` allocates the readable ring local REUSING the Pine collection identifier (`var array<line> lvls` → `lvls`) (codegen emits the
    matching `const <coll> = useDrawingHandleRing<"<kind>">(<cap>);`
    allocation from `scaffold.handleRings` — Camp B does NOT emit the helper
    or allocation, same IR/codegen split as Camp A's handle slot).
  - `resolveRingCap(site, diagnostics): number | null` →
    `K = min(site.camp.cap, CHARTLANG_BUCKET_CAP[bucket])`. `CHARTLANG_BUCKET_CAP`
    is `{ line: 500, box: 500, label: 500, polyline: 100 }`. Emits
    `cap-mismatch` (info) once when the bucket clamp lowered the cap;
    `ring-buffer-zero-cap` (error) + returns `null` when `K <= 0`. Returns
    `null` for a non-camp-b site (defensive).
  - `registerRing(scaffold, collectionName, kind, cap): string` → wraps
    `appendHandleRing` and returns the ring local. Takes the collection NAME
    (not the site) so it stays camp-agnostic for Task 12.
- **`arrayBuiltinMap.ts` maps `array.*` READS onto ring accessors**
  (`mapArrayBuiltin(call, ringLocal, annotations): ArrayBuiltinResult | null`):
  `array.first`→`<ring>.at(0)`, `array.last`→`<ring>.at(<ring>.size() - 1)`,
  `array.size`→`<ring>.size()`, `array.get(coll, i)`→`<ring>.at(<i>)` (index
  lowered via `emitExpr`). A literal negative `array.get(coll, -1)` returns
  `{ kind: "reject", code: "negative-array-index" }`; a missing index arg or a
  non-mapped callee (incl. the WRITE builtins `array.push`/`array.shift`,
  which the transform handles directly) returns `null`. Task 12 reuses this
  for its read-site rewrites.
- **Loop-driven updates lower to a literal-bounded `for`.** A `for i = 0 to
  array.size(coll) - 1` whose body `set_*`s `array.get(coll, i)` becomes
  `for (let i = 0; i < <K>; i++) { const element = <ring>.at(i); if (element === null)
  continue; element.update(<patch>); }` — the bound is the LITERAL cap (always),
  `at(i)` internally gates the filled count, and `.update()` is a method (not
  a stateful primitive) so it is loop-legal. The patch folds via the shared
  `foldSetters` (deep single-coordinate setters drop with
  `set-path-unsupported`). When NO setter folds, the loop falls back to a
  `/* TODO */` body + one `anchor-mirror-required` (warning).
- **Rejections.** `linefill.new(array.get(coll, ...), ...)` anywhere over the
  collection (scanned statement-value-wise, recursing one level into `if`/`for`
  bodies) → `linefill-over-ring` (error) + skip (no ring registered) — Camp C
  finalises the message in Task 12. The six Task-11 codes are APPENDED to
  `diagnostics/codes.ts` (no reorder): `ring-eviction-implicit`,
  `cap-mismatch`, `anchor-mirror-required`, `ring-buffer-zero-cap`,
  `negative-array-index`, `linefill-over-ring`.
- **Coverage.** `campB.ts`/`ringHelper.ts`/`arrayBuiltinMap.ts` hold 100%
  line/branch/function; defensive arms unreachable from real parser output (a
  non-camp-b site, an unmapped `linefill` constructor, a `findPushGuard`
  not-found fallthrough) are covered by synthetic-`DrawingCallSite` unit tests
  (`campB.synthetic.test.ts`), the established precedent.

### Transform: Camp C (heuristics + hard-reject)

- **`transformCampC(site, analysis, scaffold, diagnostics): void` (`campC.ts`)
  is the safety net for dynamic drawing collections** that don't fit the Camp B
  ring model. It early-returns unless `site.camp.kind` is `"camp-c-bounded"` or
  `"camp-c-unbounded"` (callers can pass the whole `drawingSites` list), AND it
  early-returns on `polyline.new` and on a static (non-`array.get`)
  `linefill.new` — Task 14's `transformPolylineLinefill` OWNS those (it converts
  them best-effort rather than rejecting). Only a cross-collection
  `linefill.new(array.get(...))` stays a Camp C reject here. It either FOLDS the
  site into a Camp B ring (heuristic succeeded) or emits ONE hard-reject; it
  NEVER silently drops a site (the property test enforces "exactly one
  heuristic-applied info OR exactly one reject").
- **The fold REUSES `transformCampB`, it does not duplicate the ring.** A
  reducible site is lowered by constructing a synthetic `DrawingCallSite` that
  keeps the SAME `.new()` `site.call` (so `transformCampB`'s identity-matched
  push scan still finds it) but swaps `camp` to a `camp-b` view (`{ kind:
  "camp-b", collectionSymbol, cap, capSource: "max-count-decl" }`) and delegates.
  The fold only lands when the collection resolves at the ROOT scope
  (`analysis.rootScope.symbols.get(name)`) — the same root-only rule the
  classifier uses; an unresolved collection falls through to a reject. A
  polyline fold delegates to `transformCampB`, which early-returns on
  `polyline.new` (Task 14's surface), so the info is emitted but no ring is
  registered — consistent with Camp B's polyline deferral.
- **The semantic `DrawingCamp` camp-c carries ONLY `{ kind, reasoning }`** — no
  collection symbol, no push-site reference. Heuristics RE-DERIVE the push
  collection from the AST (`array.push(coll, site.call)` identity match,
  descending `if`/`for` bodies). This is the load-bearing reason H2/H3 exist as
  best-effort re-scans rather than reading a pre-attached context.
- **Heuristics (`campCHeuristics.ts`, `tryHeuristics`, priority order H1→H2→H3):**
  - **H1 implicit-cap-from-indicator** — only fires for `camp-c-bounded`
    (which the classifier produces iff an `indicator(...)` `max_<family>_count`
    exists). Reads the chosen `K` from `scaffold.maxDrawings[<plural>]`
    (`line→lines`, …; `table`/`linefill` map to `null` → no fold). Task 8
    defaults every bucket to 50, so the `cap === undefined` guard is defensive.
  - **H2 bounded-by-loop-bound** — the only push lives in a `for i = 0 to L`
    with a literal / unary-literal / `input.int` `L`; the ring caps at `L`
    (`to L` → `L+1`, `to L - 1` → `left-right+1`).
  - **H3 single-use-collection** — counts straight-line top-level
    `array.push(coll, …)` statements; that count is the cap.
  - **Reality check:** the frozen classifier already routes a root-resolved
    looped/straight-line collection to `camp-b` (bucket-default), so H2/H3
    rarely fire end-to-end (they need a non-root-resolved collection with a
    provable literal bound). They exist for the heuristic shape + are exercised
    by synthetic-camp `DrawingCallSite` tests. H1 is the dominant real fold.
- **Reject taxonomy (`campCRejects.ts`, `CAMP_C_REJECTS`, `rejectSuggestion`).**
  Each `RejectCode` maps to a `SuggestionFn` templated over `CampCContext`
  (`{ site, collectionName, inferredCap }`) so the advice names the specific
  `K`/collection. `classifyReject` (`campC.ts`) picks the code from the site
  shape + camp `reasoning`: collection-anchored `linefill.new` →
  `cross-collection-linefill`; a `<family>.copy(...)` reference →
  `handle-copy`; reasoning naming `.all`/`for...in` → `for-in-line-all`;
  `UDT` → `handle-store-in-udt`; `dynamic index` → `dynamic-handle-index`;
  default → `unbounded-handle-collection`. (`polyline.new` no longer reaches
  `classifyReject` — `transformCampC` early-returns on it; Task 14 emits the
  `polyline-dynamic-points` reject.) The DOMINANT real rejects are
  `unbounded-handle-collection` (collection with no cap / nested-only decl) and
  `cross-collection-linefill`; the rest name parser-rejected or Camp-A-classified
  constructs (`for...in`/`while`/`type`/`method` are block-recovered at parse;
  `polyline.new`/`*.copy` form Camp A sites), so they are reached only via
  synthetic camps in the tests but kept in the table for completeness.
- **Reject visibility + strict mode.** Every reject pushes its `error`
  diagnostic via `makeDiagnostic(code, span)` with the registry's generic
  `suggestion` REPLACED by the templated one (`{ ...base, suggestion }` — note
  `pushCode`'s override replaces the MESSAGE, not the suggestion, so the reject
  builds the diagnostic directly), AND appends a
  `// [pine-converter] HARD-REJECT (<code>) at L:C — <constructor>(...) — …`
  compute statement (verbatim-string IR). `transformCampC` takes NO
  `ConvertOpts`: the §3 output-comment position and §4 strict-mode
  `output: null` are Task 16 codegen's, reading the `error`-severity rejects +
  the reject comments. The reject comment embeds `site.constructor` + span
  (not raw Pine source — `transformCampC` isn't threaded the source text).
- **New codes (APPENDED to `diagnostics/codes.ts`, no reorder):**
  `camp-c-heuristic-applied` (info), `dynamic-handle-index`,
  `cross-collection-linefill`, `polyline-dynamic-points`, `handle-copy`,
  `handle-store-in-udt`, `for-in-line-all` (all `error`). The
  `unbounded-handle-collection` reject REUSES the existing SEMANTIC code key.
- **Coverage.** `campC.ts`/`campCHeuristics.ts`/`campCRejects.ts` hold 100%
  line/branch/function; the H2/H3 fold paths, the parser-unreachable reject
  codes, and the defensive heuristic guards (table/linefill family → null,
  empty `maxDrawings`, malformed `array.push` args) are covered by
  synthetic-`DrawingCallSite` unit tests (`campC.synthetic.test.ts`), the
  established precedent.

### Transform: tables (`src/transform/tables.ts`)

- **`transformTables(analysis, scaffold, diagnostics): void` (`tables.ts`)
  lowers Pine's mutable-builder table API into chartlang's immutable
  `draw.table({ position, cells })`.** Unlike Camp A/B/C it takes the whole
  `analysis` (not one `DrawingCallSite`) and finds its own `table.new`
  camp-a sites: a `table` handle is created once and *fully rebuilt* each
  `barstate.islast` tick, and the cell writes are scattered across the
  script, so the transform owns the whole-script walk per table.
- **`table.new` does NOT go through `transformCampA`.** A `var table`
  handle classifies `camp-a` (semantic `classifyHandleSite`), and
  `resolveCampADrawKind` would return the non-`ChartlangDrawKind` string
  `"table"` for which `synthesizeDrawCall` has no `draw.*` method. Task 16
  codegen's Camp A loop MUST skip `site.constructor === "table.new"` and
  hand those sites to `transformTables`. The handle-slot naming is still
  shared (`handleSlotLocalName` reuses the Pine identifier, `kind: "table"`); only
  the body synthesis diverges.
- **The chartlang `draw.table` cell model matches Pine's `(col, row)` grid
  cleanly.** core `TableCell` is `{ text; bgColor?; textColor?;
  textHalign?; textValign?; textSize? }`; `position.*`/`text.align_*`/
  `size.*`/`color.*` lower through `enumLookup`; non-enum styling values
  lower via `emitExpr`. The only gaps are merge (no analogue → top-left
  fallback) and Pine's `text_formatting`/`text_font_family`/`text_wrap`
  (no analogue → `table-formatting-not-mapped` warning, dropped).
- **Cells are collected last-write-wins into a `Map<"col:row", CellSpec>`**
  by a one-level descent (top level + `if`/`else if`/`else`/`for` bodies).
  A `for i = a to b` whose body writes the handle UNROLLS when both bounds
  are literal/unary-literal — the iterator is substituted into each cell-
  write expression (`close[i]` → `bar.close[2]`) BEFORE `emitExpr`; a
  non-literal bound emits `table-dynamic-loop` (error) and skips the body.
  Writes whose `(col, row)` is non-literal are skipped; `col >= columns` /
  `row >= rows` (declared dims) emit `table-cell-out-of-bounds` (error).
  When `table.new` omits the count args the grid extent is inferred from the
  max observed `(col, row)`.
- **`merge_cells` keeps the top-left cell and blanks the span**
  (`table-merge-fallback` warning per call; non-literal corners → warn,
  blank nothing). **`clear` is a rebuild-each-bar no-op** (`table-clear-noop`
  info — the table is rebuilt from an empty grid anyway). **`delete` sets a
  collected flag** and emits `<slot>.current()?.remove(); <slot>.set(null);`
  (detected in the same walk, not a separate scan). A second `table.new`
  into one handle emits `table-multi-init` (warning) and keeps the first.
- **Cap.** `table` is core's `"other"` bucket; `transformTables` raises
  `scaffold.maxDrawings.other` to `tableCount + 1` (headroom) with
  `table-bucket-cap-adjusted` (info) when the current cap is lower.
- **The seven Task-13 codes are APPENDED to `diagnostics/codes.ts`**
  (no reorder): `table-multi-init`, `table-cell-out-of-bounds`,
  `table-dynamic-loop`, `table-merge-fallback`, `table-clear-noop`,
  `table-bucket-cap-adjusted`, `table-formatting-not-mapped`. The compute
  body statements are verbatim source strings (the established IR precedent);
  Task 16 codegen emits the `useDrawingHandleSlot<"table">()` allocation.
- **Coverage.** `tables.ts` holds 100% line/branch/function; defensive arms
  unreachable through normal dashboards (`table.cell` with a non-identifier /
  missing handle arg, a `not`-prefixed non-`+`/`-` index, a `table.*` method
  that is neither cell/cell_set/merge/clear/delete, a merge missing its
  corners) are covered by edge-case real-source tests in
  `tables.synthetic.test.ts`.

### Transform: polyline + linefill (`src/transform/polylineLinefill.ts`, `colorConvert.ts`)

- **`transformPolylineLinefill(analysis, scaffold, diagnostics): void`
  (`polylineLinefill.ts`) owns ALL `polyline.new` sites and the STATIC
  two-line `linefill.new(lineA, lineB)` sites.** Like `transformTables` it
  takes the whole `analysis` (not one `DrawingCallSite`) and self-filters
  `analysis.drawingSites` by `constructor`. Camp B already early-returns on
  `polyline.new`; Camp C now early-returns on `polyline.new` AND a static
  (non-`array.get`) `linefill.new` so this transform solely owns them. The
  collection-driven `linefill.new(array.get(...))` cross-collection fill stays
  a Camp C `cross-collection-linefill` reject — the split is by the
  `array.get` arg shape, NOT the camp (every `linefill` handle classifies
  `camp-c-unbounded`, so this transform re-derives the handle name from the
  AST via `handleNameOf`, an identity match on `decl.initializer`/`assignment.value`).
- **The Pine `[...]` square-bracket array literal does NOT parse** (the Task-4
  Pratt parser only treats `[` as postfix history-access), so a
  `polyline.new([chart.point.A, …])` literal-array is unreachable from real
  source — its first arg becomes an `unknown-expression`. The REACHABLE
  polyline anchor source is the `var array<chart.point>` build idiom:
  `array.new<chart.point>()` + a `for i = 0 to <literal>` loop pushing
  `chart.point.*` values. `unrollBuildLoop` substitutes the iterator into each
  pushed `chart.point` via the SHARED `substituteIterator` from `controlFlow.ts`
  (re-exported from `src/transform/index.ts`; `tables.ts` + `controlFlow`'s loop
  unroll consume the same function — no per-task re-implementation)
  and emits a fixed anchor list rebuilt each `barstate.islast`; a non-literal
  bound (or a non-identifier / missing first arg) is the finalised
  `polyline-dynamic-points` reject. The `tuple-expression` literal-array branch
  is kept (covered by `polylineLinefill.synthetic.test.ts`) per the established
  parser-unreachable-arm precedent.
- **Polyline draw-kind selection (`polylineDrawCall`):** `closed=true` →
  `draw.path(anchors, { closed: true, … })` + `polyline-closed-info`;
  `curved=true` with exactly 3 anchors → `draw.curve(anchors as const, …)`
  (the chartlang `AnchorTriple` smooth curve); `curved=true` with >3 anchors →
  `draw.polyline(…)` + `polyline-curved-anchors-warning`; otherwise
  `draw.polyline(…)`. `line_color` lowers via `convertColor`. `polyline.delete`
  emits the `remove()` + `set(null)` slot-clear.
- **Static linefill → `draw.fillBetween`, a true filled band.** A
  `linefill.new(lineA, lineB, color)` lowers to `draw.fillBetween([aA, aB],
  [bA, bB], { fill })` whose two edges are the referenced lines' endpoints
  (`edgeA` = lineA's, `edgeB` = lineB's; resolved via `resolveAnchorExpr` +
  `anchorToWorldPoint` off each line's `line.new` camp-a site). The runtime
  reverses `edgeB`, so passing `[bA, bB]` closes the same `A1 → A2 → B2 → B1`
  polygon the old `draw.rotatedRectangle` quad described — but now it is a
  first-class fill, not an approximation. The fill colour comes from
  `convertColor` (a `color.new(base, transp)` folds losslessly into a
  `#RRGGBBAA` hex, so the alpha lives in the colour and NO separate
  `fillAlpha` is emitted). The handle slot kind is `fill-between` (the
  `DrawingState` family for `draw.fillBetween`); the create/update body is
  `if (slot.current() === null) { slot.set(draw.fillBetween(edgeA, edgeB,
  opts)); } else { slot.current()?.update({ edgeA, edgeB }); }`.
  `linefill.set_color` folds into a `style` update; `linefill.delete` clears
  the slot. A `color.new(...)` fill still raises
  `linefill-color-transp-approximated` (the transp → 8-bit alpha hex is a
  rounding); when both lines are re-anchored every bar (`line.set_*`),
  `linefill-series-fill` (info) marks the band as tracking both lines'
  latest anchors. The dynamic forms still hard-reject: a cross-collection
  `linefill.new(array.get(...))` → `cross-collection-linefill` (Camp C); a
  linefill over a ring's elements → `linefill-over-ring` (Camp B). The
  `linefill-rotatedrect-approximated` info was RETIRED (the lowering is no
  longer an approximation).
- **`convertColor(node, annotations)` + `transpToAlphaHex(transp)`
  (`colorConvert.ts`) are the shared colour helpers.** `color.new(base, transp)`
  with a compile-time `#RRGGBB` base (a `color.*` enum or `#RRGGBB` literal) and
  a literal int `transp` folds to a quoted `#RRGGBBAA` string —
  `alpha = round(255 * (100 - clamp(transp, 0, 100)) / 100)`, 2-digit uppercase
  hex (`color.new(color.gray, 80)` → `#787B8633`; note `color.gray` is
  `#787B86`, not the task file's illustrative `#808080`). A bare `color.*` enum
  lowers through `enumLookup`; everything else falls back to `emitExpr`. The
  `linefill-color-transp-approximated` info is raised by `emitLinefill` when the
  fill colour arg is a `color.new(...)`.
- **New codes (APPENDED to `diagnostics/codes.ts`, no reorder):**
  `polyline-curved-anchors-warning` (warning), `polyline-closed-info` (info),
  `linefill-series-fill` (info), `linefill-color-transp-approximated` (info).
  (`linefill-rotatedrect-approximated` was added here then RETIRED when the
  linefill lowering moved from `draw.rotatedRectangle` to `draw.fillBetween`.)
  `polyline-dynamic-points` already
  existed (a Task-12 code) and is REUSED — `transformCampC`'s `classifyReject`
  no longer returns it (the dead polyline arm was removed when Camp C handed
  polyline to Task 14).
- **Coverage.** `polylineLinefill.ts`/`colorConvert.ts` hold 100%
  line/branch/function. The parser-unreachable tuple-literal polyline path is
  covered by `polylineLinefill.synthetic.test.ts` (a spliced synthetic call);
  the remaining edge arms (`substituteIterator` node kinds, an unbound
  collection-pushed polyline, a non-identifier / missing linefill line arg, a
  reassigned `:=` handle) are covered by real-source tests in
  `polylineLinefill.coverage.test.ts`, the established precedent.

### Transform: control flow + passthrough (`src/transform/other.ts`)

- **`transformOther(analysis, scaffold, diagnostics): void` (`other.ts`)
  populates the `computeBody` for every NON-drawing top-level statement, and
  it runs FIRST — before the Camp A/B/C + tables + polyline drawing transforms
  (`convert` in `src/index.ts`).** The non-drawing scalar declarations it emits
  (`let ph = ta.pivotsHighLow({…}).high.current`) MUST precede the drawing
  pushes/updates that reference them — Pine declares a pivot/level scalar at the
  top, then pushes it into a collection inside a guard, so emitting the push
  first would reference `ph` before its `let` (a `used-before-declaration`
  compile error). `transformOther` reads only `analysis` + `scaffold.inputs`
  (never the drawing transforms' output), so running it first is order-safe.
  (Earlier this was the LAST transform — that ordering shipped the
  used-before-declaration bug.) The entry is `transformOther` in
  `src/transform/other.ts`, NOT `transformControlFlow` in `controlFlow.ts`
  (a package-private lowerer module). The §5 `sourceIndex`-interleaving +
  `RawTsStatement`/`IfStatement` IR the task file describes were never built;
  the real IR is verbatim STRING statements appended via
  `appendComputeStatement`.
- **`emitTa` appends `.current` to every top-level `ta.*` result, and an input
  read lowers as `inputs.<name> as <type>`.** chartlang `ta.*` returns a
  `Series<number>` (a history view object) and types `compute({ inputs })`
  loosely, so the literal Pine `ph = ta.X(...)` / `len` references do not
  type-check as scalars without these. `.current` projects the per-bar scalar
  (`ta.*` keeps its own per-call-site history, so feeding scalars in and reading
  `.current` out reproduces Pine semantics); `inputCastType` (`other.ts`) →
  `number`/`boolean`/`string` from the `input.*` factory drives the
  `inputs.len as number` cast (`EmitContext.inputCasts`). `ta.pivothigh`/
  `ta.pivotlow` restructure to `ta.pivotsHighLow({ leftLength, rightLength })
  .high|.low` (a function-result field projection, NOT a
  `ta.pivotsHighLow.high(...)` method).
- **Multi-output `ta.*` tuple destructuring lowers via `MULTI_RETURN_TA_MAP`
  (`mapping/multiReturnTa.ts`).** `[macdLine, signalLine, hist] = ta.macd(...)`
  emits ONE result const `const <firstName>Result = ta.macd(bar.close, {
  fastLength, slowLength, signalLength });` (the `emitTupleDeclaration` arm in
  `other.ts`), and each element rewrites to `<firstName>Result.<field>.current`
  via `EmitContext.tupleFieldAliases` (pre-scanned by `registerTupleFields`,
  checked in `rewriteIdentifier` after `stateSlots`, before `inputNames`). The
  table is keyed by Pine name → `{ chartlang, args, fields }`: `args` is the Pine
  positional layout (`positional` | `opt:<key>` | `drop`) folded into the
  trailing opts object; `fields` is the chartlang field per Pine TUPLE POSITION
  (Pine order, so Bollinger's `[middle, upper, lower]` is encoded even though
  chartlang's own field order is `{upper, middle, lower}`), `null` for a Pine
  output with no chartlang field. Seeded: `ta.macd`, `ta.bb`, `ta.kc`
  (→`ta.keltner`, source/`useTrueRange` dropped), `ta.dmi` (ADX → `null` field),
  `ta.supertrend`. A `multiReturnTa.test.ts` cross-checks every non-null field
  against the core `*Result` type. Diagnostics: `multi-return-not-mapped`
  (warning, unrecognised RHS — emits nothing), `multi-return-arity-mismatch`
  (warning, a name binds a `null`/absent field, e.g. dmi's ADX),
  `multi-return-arg-dropped` (info, a Pine arg dropped). Add a function = add one
  table row + verify Pine return order.
- **KNOWN GAPS** (covered by the `KNOWN_NON_COMPILING` skip list in
  `fixtures-compile.test.ts`): a `ta.*` nested inside an expression
  (`mult * ta.stdev(...)`) is not `.current`-lowered (only top-level), so series
  arithmetic does not yet compile; draw-call style opts (`line.new(…,
  color=lineColor)`) are not input-aware, so an input-styled drawing leaks the
  bare name; a tuple-decl element reassigned with `:=` is not supported.
  **Pine OHLCV history `close[i]` now COMPILES** — the compute bar's `bar.close`
  is an indexable `PriceSeries`, so `bar.close[i]` (literal, or an unrolled loop
  index) type-checks; `14-polyline-rebuild` was removed from the skip list.
  **NUMERIC `var`/`varip` history now COMPILES** too — a numeric scalar that is
  history-indexed anywhere lowers to `state.series` instead of `state.float`/`int`
  (see the `state.series` lowering note below), so `var x := …; x[1]` round-trips
  (fixture `30-var-series-history`, NOT in the skip list). Two gaps remain:
  TUPLE-element history (`macdLine[1]`, where `macdLine` is projected with
  `.current`, so `…macd.current[1]` indexes a scalar); and `bool`/`string` `var`
  history (a `state.series<bool>`/`<string>` is a deferred follow-up — the
  converter keeps the scalar slot and emits `series-history-non-numeric`, so
  `<slot>.value[n]` stays a known non-compiling form for those, never in a
  clean fixture).
- **Drawing-ownership dedup is the load-bearing skip.** `transformOther` walks
  ALL statements but emits ONLY non-drawing ones: it skips (a) any call that is
  a `DRAWING_KIND_MAP.has` constructor, (b) a `*.set_*`/`*.delete`/`array.*`/
  `table.*`/`linefill.*` mutation whose first-arg handle/collection is OWNED,
  (c) the handle/collection declaration itself, and (d) a ring-eviction guard
  (`if array.size(coll) >|>= K` whose body only `*.delete`s an `array.shift|`
  `remove(coll)`). The owned set is `drawingSites` camp-a handles + camp-b
  `collectionSymbol`s + every `symbols` entry with `handleType !== null` + every
  collection an `array.push(coll, <drawing>.new(...))` targets (re-derived from
  the AST one level into `if`/`for` bodies — a `camp-c-bounded` collection
  carries no symbol on its camp, so it MUST be re-derived). This prevents both
  double-emit and the compiler's `stateful-call-inside-loop` reject. A
  malformed array-typed handle decl (`var line[] xs = …`, which the parser
  models as `var line` with an `unknown-expression` init) is also skipped.
- **Input references and scalar reads rewrite HERE, not in codegen.**
  `emitWithContext` (`emitContext.ts`) wraps `emitExpr`: a bare identifier that
  exactly matches a registered `scaffold.inputs` name → `inputs.<name>`; a
  `var`/`varip` scalar → `<slot>.value`; a shadowing local (loop iterator,
  `let`-declared name) is checked FIRST and stays verbatim. Task 16 is pure
  templating and does NOT rewrite input refs (CLAUDE.md §inputs says it's
  codegen's job, but codegen has no rewrite step — `transformOther` owns it via
  the registry it can read). `ta.*`/`math.*` remapping only fires when the call
  is the TOP-LEVEL value of a statement/declaration (`emitSpecialCall`); a
  `ta.*` nested in a plot arg lowers through `emitExpr` by identity (acceptable
  v1 scope — only signature-divergent names like `ta.rma`→`ta.smma` differ).
- **Scalar `var`/`varip` → `state.*` slots (`registerStateSlots`/
  `emitStateSlots`).** A scalar's literal initializer picks the factory
  (int→`state.int`, float→`state.float`, bool→`state.bool`, string→
  `state.string`); a `varip` uses the `state.tick.*` form; an un-inferable type
  (e.g. a `#RRGGBB` color literal, an identifier init) defaults to `state.float`
  + a `scalar-state-type-defaulted` info — the converter NEVER silently guesses.
  Slot local REUSES the Pine scalar identifier; reads → `<slot>.value`, `:=` → `<slot>.value
  = …`. The `MutableSlot<T>` API is `.value` get/set (NOT the drawing-handle
  slot's `.current()`/`.set()`). A plain `=` declaration → `let x = …`; a `=`
  the semantic pass flags `declaration` → `let`, a reassignment → bare `x = …`.
- **A history-indexed NUMERIC scalar lowers to `state.series`, NOT the scalar
  `state.float`/`int` (`scanHistorySeries`/`emitSeriesSlot`, `other.ts`).** Only
  a numeric `var`/`varip` read with `[n]` ANYWHERE in the script (whole-body +
  expression-tree walk via the shared `forEachHistoryAccess` in `exprEmit.ts`)
  becomes `const x = state.series(<init>)` — this is what makes the generated
  `x[n]` compile (the `state.series` slot is an indexable `Series<number>`, so
  `x[1]` is a real history read; a scalar `<slot>.value[n]` would be a typecheck
  error). The init is the literal numeric value, `Number.NaN` for an `na` init
  (so an `na`-init numeric `var` — normally dropped from the scalar map — IS
  registered when history-indexed), or `Number.NaN` + `scalar-state-type-
  defaulted` for an un-inferable init. A `varip` numeric series approximates to a
  NON-tick `state.series` + `varip-series-approximated` (`state.tick.series` is
  deferred). A numeric `var` NEVER `[n]`-indexed keeps its leaner scalar slot.
  VALUE reads still go through `rewriteIdentifier` → `<slot>.value`; HISTORY
  reads go through `EmitContext.seriesSlots` → the BARE slot local
  (`<slot>[n]`); writes (`:=`) stay `<slot>.value = …`. A NON-numeric (`bool`/
  `string`/`color`) history-indexed `var` keeps its scalar lowering and emits
  `series-history-non-numeric` (info) — its `[n]` is the deferred
  `state.series<bool>`/`<string>` gap, never in a clean fixture. A non-literal
  series-slot offset (`x[i]`/`x[-i]`) wires the (pre-existing, error-severity)
  `dynamic-series-index`.
- **Loop policy (`emitFor`, §1a) is stateful/non-stateful split, NOT
  unroll-always.** A body that calls a stateful primitive (`plot`/`hline`/
  `alert`/`ta.*`/`draw.*`, detected recursively through nested `if`/`for`/
  `switch`/`block` via `expressionHasStatefulPrimitive` + `bodyHasStateful`
  `Primitive`) MUST unroll (the compiler rejects a stateful call in any loop):
  each iteration renders with `substituteIterator` substituting the concrete
  index. A bound resolves to a compile-time int from a literal/unary-literal OR
  an `input.int` default (`resolveBound` + the `inputDefaults` re-walk); an
  input-derived bound ALSO raises `loop-unroll-frozen-at-input-default` (the
  count is frozen at the default). A non-stateful body with a TRUE literal bound
  emits a runtime `for`. **Pine auto-counts DOWN when `from > to`; the `by`
  value contributes only its MAGNITUDE (direction is the from-vs-to relation).**
  An ascending loop emits `for (let i = a; i <= b; i++ | i += mag)`; a
  descending loop emits `for (let i = a; i >= b; i-- | i += -mag)`. The unroll
  path mirrors this (ascending: `i <= to`; descending: `i >= to`; `stepDelta =
  ±|by|`), so a descending or `by`-stepped loop runs its real iteration set
  rather than zero. `step === 0` (or a non-literal `by`) is non-resolvable. A
  non-stateful body with an
  `input.int`/non-literal bound unrolls-when-resolvable (a runtime `for` with a
  non-literal bound is compiler-forbidden) else rejects
  `loop-bounds-not-literal-for-stateful-body`. A stateful body with a
  non-resolvable bound rejects the same. The SAME direction+magnitude unroll
  rule is mirrored in `tables.ts`'s `unrollLoop` (a non-literal/zero `by` →
  `table-dynamic-loop`) and `polylineLinefill.ts`'s `unrollBuildLoop` (a
  non-literal/zero `by` → `polyline-dynamic-points` reject). `substituteIterator` is the SHARED
  iterator-unroll helper (exported from `src/transform/index.ts`); `tables.ts`
  and `polylineLinefill.ts` import it from here rather than re-implementing it.
- **`switch` lowering.** A subjected `switch x` → `switch (x) { case <t>: {…}
  break; … default: {…} break; }`; a subjectless `switch` (boolean-case form) →
  an `if`/`else if`/`else` chain (a lone default renders unconditionally). The
  plot family (`plotFamily.ts`), `str.*` subset (`strFormat.ts`),
  `request.security` MTF (`requestSecurity.ts`), and strategy signals
  (`strategySignals.ts`) are per-construct emitters returning a string or a warn
  result; color args route through `enumLookup` (`color.red`→`"#FF5252"`).
  `request.security({ interval }).<field>` returns a `Series` — a downstream
  scalar context inserts `.current` + `mtf-series-to-scalar-conversion`. `fill`
  → `fill-not-mapped` (error); `math.random`/`math.round_to_mintick`/`ta.kcw` →
  `math-not-mapped`/`ta-not-mapped` warn + `/* TODO unmapped */`.
- **`request.security`'s THIRD arg decides the chartlang form
  (`requestSecurity.ts`).** A bare OHLCV source field lowers to the **data**
  form `request.security({ interval }).<field>`; ANY other source (a
  `ta.*`/expression) lowers to the **callback** form
  `request.security({ interval }, (bar) => <source>)` — the HTF expression form
  that runs on the higher-timeframe clock the way Pine does. The callback body
  is `emitWithContext(source, ctx)` verbatim (the shared field mapper already
  rewrites the source's `close`/`hl2`/… reads to `bar.close`/`bar.hl2`/…). Do
  NOT re-introduce the old `request.security({ interval }).<emitted-source>`
  main-timeframe shape — it counted the `ta.*` window in main bars, the root
  bug. `request-security-not-mapped` is now reserved for the genuinely-
  unsupported shapes (non-literal / out-of-table timeframe, missing args); an
  in-subset `ta.*` source is supported.
- **Pine `plot(<value>, offset=N)` threads onto a direct `ta.*` plot value
  (`plotFamily.ts` `emitPlot`).** `emitPlot` IS passed the
  `DiagnosticCollector` (the `case "plot"` site threads it; `hline`/
  conditional/background paths are NOT — `hline` has no Pine `offset`). When a
  non-zero `offset=` named arg is present AND `pos[0]` is a direct `ta.*` call
  (`dottedCallee(value)?.startsWith("ta.")` — the same ta-dispatch shape, never
  re-detected), `renderTaWithOffset` rebuilds the call so the signed offset
  threads onto its opts (`ta.sma(bar.close, 20, { offset: 5 })`, positive AND
  negative; a non-literal offset threads verbatim). The ta call's own non-
  `offset` named args fold into the SAME opts object; a same-named `offset` on
  the ta call is OVERRIDDEN by the plot-level value (Pine plot offset is the
  source of truth) + `plot-offset-overrides-ta-offset` (warning). `offset=0`
  (`isLiteralZero`, int OR float) is treated as no offset — byte-identical to
  the no-offset path. The Pine member chain is emitted verbatim (no `taLookup`,
  the established plot-path behaviour). A plot whose value is NOT a direct
  `ta.*` call (a bare series, a variable, an arithmetic/`call` with a non-`ta`
  callee) has no representable chartlang offset target (chartlang has no plot-
  level offset — deferred follow-up), so the offset is DROPPED with
  `plot-offset-needs-ta-call` (warning).
- **New codes (APPENDED to `diagnostics/codes.ts`, no reorder):**
  `plot-offset-needs-ta-call`, `plot-offset-overrides-ta-offset` (warnings),
  `ta-signature-divergence`, `ta-not-mapped`, `math-not-mapped`,
  `str-format-not-mapped`, `str-not-mapped` (warnings), `fill-not-mapped`,
  `request-security-not-mapped`, `dynamic-series-index`,
  `loop-bounds-not-literal-for-stateful-body` (errors),
  `request-security-different-symbol`,
  `request-security-lookahead-not-supported` (warnings),
  `strategy-signal-only`, `loop-body-unrolled`,
  `mtf-series-to-scalar-conversion`, `loop-unroll-frozen-at-input-default`,
  `scalar-state-type-defaulted`, `series-history-non-numeric`,
  `varip-series-approximated` (infos — the last two added by the
  `state.series` `var`-history lowering; `dynamic-series-index` was registered
  here earlier and is now WIRED). Re-exports APPENDED to `src/transform/
  index.ts` (incl. `forEachHistoryAccess` from `exprEmit.ts`).
- **Coverage.** `other.ts`/`controlFlow.ts`/`emitContext.ts`/`statefulNames.ts`/
  `strFormat.ts`/`plotFamily.ts`/`requestSecurity.ts`/`strategySignals.ts` hold
  100% line/branch/function. Parser-unreachable arms (a top-level
  `block-statement`/`return-statement`, a camp-b `collectionSymbol` site, a
  handle-typed symbol skip, a non-identifier push collection, the
  `array.shift`/`array.remove` eviction variants, an empty subjectless switch,
  the `seriesSlotReceiver` slot-undefined defensive arm) are covered by
  synthetic-`SemanticResult`/`emitFor`/node-literal unit tests
  (`other.synthetic.test.ts`, `controlFlow.test.ts`, `exprEmit.test.ts`'s
  `forEachHistoryAccess` walk, `emit-context.test.ts`'s series-slot cases), the
  established defensive-arm precedent.

### Codegen (`src/codegen/`)

- **`emit(scaffold): string` (`emit.ts`) is the pure-templating back end** —
  no semantic decisions, no transforms, byte-deterministic for a given
  scaffold. It assembles the auto-generated header, the minimized core import
  (`emitImports.ts`), and the `export default defineIndicator/defineDrawing
  ({ … })` block (options via `emitInputs.ts`/`emitMaxDrawings.ts`, body via
  `emitCompute.ts`), then runs a brace-depth reindent (`format.ts`). All
  compute statements + input/state refs reach codegen as FINAL chartlang
  source strings (the transforms did every `len → inputs.len` / scalar
  `var → <slot>.value` rewrite) — codegen NEVER rewrites identifiers.
- **Codegen OWNS the drawing-handle helper DEFINITIONS + every module-state /
  handle / ring allocation, and emits them INSIDE `compute`, not at module
  level.** `draw`/`state` are only bound via the destructured `compute(ctx)`
  param — there is no module-scope `draw`/`state` — so `useDrawingHandleSlot`
  (`type` + `function`), `useDrawingHandleRing` (`type` + fixed-cap FIFO
  `function` that `remove()`s the evicted handle), the `state.*` slot
  allocations (`const count = state.int(0);`), the handle-slot allocations
  (`const lvl = useDrawingHandleSlot<"line">();`), and the ring
  allocations (`const lvls = useDrawingHandleRing<"line">(50);`) are ALL
  emitted at the top of the compute body (`emitHelpers.ts` +
  `emitCompute.ts`). The task file's §Desired-Behaviour template showed these
  at module top — that CANNOT compile; the compute-body placement is verified
  by the `emit-compile.test.ts` round-trip through
  `@invinite-org/chartlang-compiler`. `@invinite-org/chartlang-core` ships NO
  such helpers — the converter defines them itself; `DrawingHandle` IS a real
  core type, imported type-only. **A COMPACT handle slot
  (`HandleSlotIR.compact === true`, the single-persistent-handle Camp A
  lowering) emits NO allocation and needs NO helper:** its `const <local> =
  draw.<kind>(…)` create statement (emitted by Camp A) is the allocation, so
  `emitSlotAllocations` skips it and `emitHandleSlotHelper` is gated on
  `hasNonCompactHandleSlot(scaffold)` (not `handleSlots.length > 0`). The helper
  + `DrawingHandle` import appear iff at least one handle slot is non-compact OR
  a ring exists.
- **`scanUsage(scaffold)` (`usage.ts`) is the SINGLE source of truth for both
  the import list AND the `compute` destructure** so they never drift. `draw`/
  `state` force-on when the scaffold carries handle/ring/state allocations;
  `DrawingHandle` rides in whenever a NON-compact handle slot or any ring is
  emitted (a compact slot's bare `const` carries no type annotation, so it never
  names `DrawingHandle`); everything else is a substring scan over the generated
  source corpus (every statement is already a final string). The emission ORDER for the pipeline is
  fixed (`transformDeclaration` builds + RETURNS the scaffold → `transformInputs`
  → **`transformOther` FIRST** (so scalar `let`s precede the drawing pushes that
  read them) → per-site Camp A/B/C dispatch, **skipping `table.new` AND
  `polyline.new`** (their dedicated transforms own them) → `transformTables`
  → `transformPolylineLinefill` → `emit`), wired in `convert()` (`src/index.ts`,
  sync, no compile round-trip — that is the async `convertFile`'s job, Task 18).
- **`emitMaxDrawings.ts` emits ALL FIVE buckets when any is set** (unset → `0`)
  — core's `DrawingCounts` is a total 5-bag budget, so a partial literal is a
  compile-time type error; omit the whole property only when no bucket is set.
- **`scaffoldToManifest(scaffold, analysis)` (`manifest.ts`)** derives
  `requiresBarInterval` from `analysis.referencesFutureBarIndex` and
  `drawingKindsUsed` from the sorted-unique handle-slot ∪ ring kinds.
- **`codegen-output-invalid` is the only Task-16 code** (APPENDED to
  `diagnostics/codes.ts`, namespaced `pine-converter/codegen/...`; the
  `codes.test.ts` namespace regex includes `codegen`). It is reserved for the
  async round-trip verify (Task 18) — sync `convert` does not raise it.
- **Coverage.** Every `src/codegen/` module holds 100% line/branch/function.
  `src/index.ts` (the `convert` wiring) is the coverage-excluded barrel, but
  its branches are still exercised by `index.test.ts` + `emit-compile.test.ts`.

### Diagnostics framework (`src/diagnostics/`)

- **The code STRINGS are the converter's stable PUBLIC CONTRACT (README §156)
  and never change.** Every diagnostic across the pipeline carries a stable
  `code` (`pine-converter/{lex,parse,semantic,transform,codegen}/<slug>`); the
  full strings are load-bearing for downstream tooling (CLI, editor, gate
  scripts) and the conformance scenarios (`diagnostic-code-absent`). Adding a
  code = add one entry; renaming a code = a breaking change. Tasks 18/19/20
  depend on the existing strings — never edit a `code:` value.
- **`DIAGNOSTIC_CODE_ENTRIES` (the by-short-KEY object) is the single source of
  truth; `DIAGNOSTIC_CODES` is a derived `ReadonlyMap` keyed by the full code
  STRING.** The keyed object drives `ParserDiagnosticCode = keyof typeof
  DIAGNOSTIC_CODE_ENTRIES`, `makeDiagnostic(key, span, msg?)`, and the
  once-per-script dedup in Camp A/B (`DIAGNOSTIC_CODE_ENTRIES[code].code` →
  full string for `collector.has(...)`). The map exists for the report/format
  side, which only sees a `Diagnostic.code` (a full string), not a short key —
  `DIAGNOSTIC_CODES.get(diagnostic.code)`. Both are derived from one literal so
  they never drift; `codes.test.ts` asserts the map is keyed by every entry's
  `code` and is the same size as the object.
- **`DiagnosticReport` (`report.ts`) is the read/format side and is DISTINCT
  from the transform-layer `DiagnosticCollector` (`transform/diagnosticCollector
  .ts`).** The collector is the MUTABLE push sink the `void`-returning transform
  passes share (`push`/`pushCode`/`has`/`size`/`toArray`, ~60 importers) — do
  NOT touch it or rename it. `DiagnosticReport` is an IMMUTABLE wrapper over an
  assembled `readonly Diagnostic[]` (`errors()`/`warnings()`/`infos()`/`all()`/
  `frozen()`/`upgradeWarningsToErrors()`); construct it from
  `ConvertResult.diagnostics`. The two same-named-but-different classes were
  deliberately NOT unified (Task 17 named both `DiagnosticCollector`; we kept
  the transform one and named the new one `DiagnosticReport` to avoid a
  two-classes-one-name footgun).
- **Formatters: `formatDiagnostic(d, source)` (rustc/tsc-style single block —
  `severity[slug]: msg`, ` --> :L:C` locator, gutter + source line + `^^^`
  caret underline, multi-line spans get a start underline + `...` elision + end
  underline, then `= suggestion:` / `= docs:` lines), `formatDiagnosticReport(
  diagnostics, source)` (counted header + non-empty `[errors]`/`[warnings]`/
  `[infos]` sections), `formatDiagnosticsJson(diagnostics)` (stable property
  order code→severity→message→span→suggestion, `suggestion` omitted when
  absent).** The docs anchor is derived from the code's last `/` segment →
  `https://chartlang.dev/converter/diagnostics#<slug>` (Task 20 ships the
  page). These three + `DiagnosticReport` are what Task 18's CLI renders.
- **`strictMode` is honored in `convert()` (`src/index.ts`).** `convert(source,
  { strictMode: true })` runs `upgradeWarningsToErrors` over the assembled
  `ConvertResult.diagnostics` so every `warning` comes back as `error` (info/
  error untouched); it applies on the early lex/parse short-circuit returns too.
  It does NOT null `output` — strict callers detect failure by scanning the
  diagnostics for any error severity. (The Camp-C `strict-mode.test.ts` prose
  that deferred an `output:null` behavior to codegen is superseded: there is no
  output-nulling; the severity upgrade is the whole strict-mode surface.)
- **Coverage.** `codes.ts`/`report.ts`/`format.ts`/`formatReport.ts`/
  `formatJson.ts` hold 100% line/branch/function; `diagnostics/index.ts`
  (barrel) is coverage-excluded. The `code-coverage-grep.test.ts` walks
  `src/**` with the TS Compiler API (NOT a regex) and asserts every
  `makeDiagnostic("<key>", …)` / `pushCode("<key>", …)` first-arg literal is a
  registered key; `span-propagation.property.test.ts` runs 30+ inline fixtures
  through `convert()` and asserts no diagnostic carries a zero start span. The
  `format.ts` out-of-range source-line fallbacks (`lines[span.line - 1] ?? ""`,
  reached only by a synthetic span pointing past EOF) are covered by dedicated
  single- and multi-line cases in `format.test.ts`.

### CLI + API (`src/index.ts` `convertFile`)

- **`convertFile(path, opts?: ConvertFileOpts): Promise<ConvertResult>` is the
  ONLY async public entry; `convert` stays synchronous.** It reads `path` as
  UTF-8, strips the extra `outPath` field, forwards the rest as `ConvertOpts`
  to `convert`, and — when `opts.outPath` is set AND `result.output !== null` —
  writes the converted source to `outPath`. It NEVER `mkdir`s the parent
  directory (the caller owns the output dir). File I/O failures REJECT the
  promise; they are host-environment errors, deliberately distinct from a clean
  conversion that merely emitted error-severity diagnostics — the CLI maps the
  rejection to exit 2 and a diagnostics-only failure to exit 1.
- **`stripOutPath` returns `undefined` (not an empty object) when no
  convert-relevant option survives** so the forward call passes nothing,
  preserving the `exactOptionalPropertyTypes` contract (`convert` never sees an
  explicit `undefined` field). `ConvertFileOpts = ConvertOpts & { outPath? }`.
- **`@invinite-org/chartlang-pine-converter/diagnostics` is the formatter
  sub-export the CLI consumes** (`formatDiagnosticReport`/`formatDiagnosticsJson`
  + `DiagnosticReport`); the package root keeps the `convert`/`convertFile` +
  public-type surface. Both entries are declared once in `scripts/scaffold.ts`'s
  `SUBPATH_EXPORTS` and re-run into `package.json` — do not hand-edit the
  `exports` map. `convertFile`'s `node:fs/promises` use adds `@types/node` as a
  devDependency (the package's first `node:*` import).
- **Coverage.** `convertFile` lives in the coverage-excluded `src/index.ts`
  barrel; its branches are still exercised by `convertFile.test.ts` (fs
  roundtrip, outPath-absent no-write, null-output no-write, strict forward, I/O
  reject). `subexport.test.ts` asserts the `./diagnostics` formatter surface
  resolves.
