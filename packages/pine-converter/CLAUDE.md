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
- **A Pine variable colliding with a host `compute(ctx)` param is RENAMED, not
  left to shadow.** `COMPUTE_CONTEXT_NAMES` (`nameAllocator.ts`) is the canonical
  host-param set (kept in lockstep with `emitCompute.ts`'s `destructureFields` —
  `bar`/`ta`/`plot`/`hline`/`bgcolor`/`barcolor`/`alert`/`inputs`/`state`/
  `request`/`time`/`session`/`syminfo`/`barstate`); `isComputeContextName`
  exposes it. `allocateForSymbol` treats a host-param name as un-reclaimable (the
  host binding stays live — a `bgcolor(...)` callee, the `inputs` object), so a
  Pine `bgcolor` symbol takes a fresh `bgcolor2`. `transformOther` builds a
  `renamedSymbols` map (one `allocateForSymbol` per colliding user symbol) wired
  into `EmitContext`; `rewriteIdentifier` rewrites every reference and
  `emitDeclaration`/`emitAssignment` rewrite the LHS, while the host call site
  (`plotFamily`/`alertCall`, hardcoded callee) keeps the host name. A `var`-slot
  collision needs no `renamedSymbols` entry — its slot local is the same
  host-avoiding `allocateForSymbol` name via `stateSlots`.

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
- **Line continuation has two rules: an eager paren-depth + trailing-comma
  rule, and a deferred leading-operator rule (bounded one-token buffering,
  NOT arbitrary lookahead).** (1) A `newline` (and any consequent
  `indent`/`dedent`) is suppressed eagerly while `parenDepth > 0` (incremented
  on `( [ {`, decremented on `) ] }`) OR the last significant token is a `,`.
  (2) Otherwise a content-line `newline` is **deferred** (held in
  `pendingNewline`) until the next significant token is known: if that token is
  a **leading-operator continuation lead** AND its line is indented **strictly
  deeper than the statement-start column** (== the tracker's `currentLevel()`,
  since a statement's first line resolves the stack top to its own indent), the
  held `newline` is **dropped** and the indent stack is left untouched (no
  `resolve`, so no `indent`/`dedent`) — the line is transparent to block
  structure. Any other token **flushes** the held `newline` + runs the
  indentation resolver normally. The held newline is resolved by the *very next
  significant token*, so this stays consistent with "not lookahead." The
  continuation-lead set (`isContinuationLead`, `indent.ts`) is a single shared
  constant keyed on `(kind, text)` mirroring the parser's `BINARY_PRECEDENCE`
  infix surface PLUS the ternary `?`/`:`, MINUS the prefix-only `not`; the two
  MUST stay in sync (a new `BINARY_PRECEDENCE` operator must be added to the
  lead set). The lexer cannot import `BINARY_PRECEDENCE` (the parser depends on
  the lexer — a runtime back-import would cycle), so the mirror is deliberate.
  Disambiguation: a `-`/`+` line at the *same* indent as the statement start is
  a NEW unary statement, not a continuation; `?`/`:` are lexer-valid leads but
  the parser (`parseTernary`) owns their syntactic completion. Blank and
  comment-only lines emit their `newline` immediately (no deferral) and never
  touch the indent stack. The indent/dedent balance invariant
  (`lex.property.test.ts`) still holds — continuation lines never push the stack.
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

- **`MATH_PASSTHROUGH_MAP` splits bare `Math.*` from the chart-aware `math.*`
  extras.** Most numeric members map to bare `Math.*` (the no-rewrap decision —
  `math.sign` STAYS `Math.sign`). The three chart-aware rows route to the
  chartlang `math` namespace instead: `math.round_to_mintick` →
  `"math.roundToMintick"` (NOT a REJECT — the emitter injects the
  `syminfo.mintick` step), `math.avg` → `"math.avg"`, `math.sum` → `"math.sum"`
  (the variadic SCALAR reducers; this fixed the prior latent `Math.avg`/`Math.sum`
  invalid-JS mapping). `emitMath` (`transform/other.ts`) consumes the map and
  adds two behaviours the table cannot express: the `syminfo.mintick` injection
  for `round_to_mintick`, and a rolling-arity guard — a 2-arg
  `math.sum`/`math.avg(source, length)` is Pine's rolling window with NO
  chartlang scalar analogue, so it emits `math-rolling-window-unmapped` + a
  `/* TODO rolling window */` rather than collapsing onto the scalar form.
- **`ARRAY_REDUCTION_MAP` (`mapping/arrayReductions.ts`) owns the Pine `array.*`
  reduction NAME/enum decisions; the per-arg shaping + emit live in
  `transform/emitContext.ts`'s `rewriteArrayBuiltin`.** A reduction over a
  registered numeric `state.array` slot lowers onto the HANDLE METHOD
  (`array.stdev(win)` → `win.stdev()`, `array.percentile_linear_interpolation`
  → `<slot>.percentile`, `array.sort(id, order)` → `<slot>.sort("asc"|"desc")`
  via `ARRAY_SORT_ORDER_MAP`) — same slot surface as the existing
  `array.push`/`array.get` rewrites, so NO `array` import is emitted. Two
  append-only diagnostics ride this: `array.sort` raises `array-sort-returns-copy`
  (info — chartlang's `sort` returns a fresh COPY, never mutating the ring), and
  `array.percentile_nearest_rank` (a `chartlang: null` REJECT) + any UNMAPPED
  `array.*` over a slot emit a `Number.NaN /* TODO */` placeholder +
  `array-reduction-not-mapped` (warning), NEVER broken `array.<x>(...)` or a hard
  fail. (This SUPERSEDES the old "unrecognised `array.*` falls to the generic
  path" behavior.) The diagnostics flow through the OPTIONAL
  `EmitContext.arrayWarn` structural sink (the `DrawCallContext.warn` precedent),
  populated only by `transformOther` from the `DiagnosticCollector`; it fires
  only inside the slot-gated rewrite (where `arraySlots` ⇒ `arrayWarn` is set), so
  there is ONE classification site and no second walk. The Pine `order` enum
  (`order.ascending`/`order.descending`) is a recognised `semantic/builtins.ts`
  const + namespace root.
- **`MAP_BUILTIN_MAP` (`mapping/mapBuiltins.ts`) owns the Pine `map.*` NAME +
  shape decisions; the per-arg emit lives in `transform/emitContext.ts`'s
  `rewriteMapBuiltin`.** A `map.*(id, …)` over a registered numeric-value
  `state.map` slot (scanned by `transform/mapCollection.ts`, mirroring
  `numericArray.ts`) lowers onto the HANDLE surface — `map.put` → `<slot>.set`,
  `map.get` → `(<slot>.get(k) ?? Number.NaN)` (na-bridged, since chartlang `get`
  returns `undefined` where Pine `map.get` returns `na`), `map.contains` →
  `has`, `map.remove` → `delete`, `map.size` → `<slot>.size` (a PROPERTY, not a
  call), `map.clear` → `clear()` — same slot surface as the `array.*` rewrites,
  so NO `map` import is emitted. **CAPACITY IS SYNTHESIZED:** Pine `map.new<K,
  V>()` is unbounded but chartlang `state.map(N)` needs a literal, so
  `emitMapSlots` (`other.ts`) emits `state.map<number, number>(1000)`
  (`SYNTHESIZED_MAP_CAPACITY`) + a `map-capacity-synthesized` info — a map is
  NEVER rejected for missing capacity (unlike a numeric `array`, which
  hard-rejects `unbounded-array-collection`), so `MapScan` has NO `unbounded`
  partition. The KEY type is lost by the parser (the `map<K, V>` annotation
  collapses to its LAST type arg, the VALUE), so the emit is always
  `<number, number>`; a non-numeric VALUE map raises `map-collection-non-numeric`
  (info) and is not lowered. `map.keys`/`map.values` (`chartlang: null` REJECTs —
  no v1 iterators) and any unmapped `map.*` over a slot emit a `Number.NaN /* TODO
  */` placeholder + `map-builtin-not-mapped` (warning) via the OPTIONAL
  `EmitContext.mapWarn` sink (the `arrayWarn` precedent), never broken JS. `map`
  is a recognised `semantic/builtins.ts` namespace root (without it every
  `map.*` member is a spurious `unknown-identifier`). `map.*` ops never match
  `isDrawingOwnedCall` (only `array.`/`table.`/`linefill.`/setter calls do), so
  map slot names go in `owned` (to skip the `map.new` decl) but need no
  `arrayNames`-style carve-out.
- **Pine `nz(x[, r])` lowers to the SCALAR `math.nz(...)` in `exprEmit.ts`,
  NOT via a mapping-table row.** The bare `nz` identifier callee is intercepted
  in `emitExpr`'s call-expression case (after the calendar `lowerBuiltinCall`
  block, same precedent) → `math.nz(<args>)`; the advisory `nz-scalar-assumed`
  (info) is raised at the TOP-LEVEL `emitSpecialCall` site (`other.ts`), where
  the diagnostic collector is in scope. chartlang's `ta.nz` is itself scalar, so
  v1 routes every `nz` to `math.nz`; a series argument is the rarer hand-rewrite.
  `na(x)` is UNCHANGED — it keeps its context-aware inline predicate
  (`(x === null)` / `!Number.isFinite(x)`), never `math.na`.
- **Free-expression `color.new(...)` / `color.rgb(...)` lowers in pure
  `emitExpr.ts`, using `colorConvert.ts` as the single color-math source.**
  Scoped styling positions (plot / hline / table / bgcolor / setter paths)
  still call `convertColorWith` where they hold the `DiagnosticCollector`.
  The nested expression hook cannot push `color-transp-approximated` directly;
  top-level value calls continue to report it from `other.ts`, while deeply
  nested free-expression lowering deliberately preserves valid output without
  introducing a second diagnostic walk.
- **Every Pine → chartlang name/enum decision routes through one table
  here — no transform re-derives a mapping.** `DRAWING_KIND_MAP`,
  `ENUM_VALUE_MAP`, `INPUT_MAP`, `TA_PASSTHROUGH_MAP`,
  `MATH_PASSTHROUGH_MAP`, `MULTI_RETURN_TA_MAP` (multi-output `ta.*` tuple
  destructuring — `ta.macd`/`bb`/`kc`/`dmi`/`supertrend`) are immutable
  `ReadonlyMap`s; Tasks 7–15 consume them. Add a Pine-version symbol = add one
  row, never branch in a transform.
- **Calendar built-in CALLS route through `BUILTIN_CALL_MAP`
  (`builtinCalls.ts`), distinct from the bare-value `BUILTIN_IDENTIFIER_MAP`.**
  The bare value reads `dayofweek` / `time_close` / `timenow` lower to accessor
  forms via `BUILTIN_IDENTIFIER_MAP` (`time.dayofweek(bar.time)` /
  `time.timeClose(bar.time)` / `time.now()`); `time` stays `bar.time`.
  Their explicit CALL forms (`dayofweek(t)`, `time()`, `time_close()`) MUST be intercepted by
  `lowerBuiltinCall(name, emittedArgs)` BEFORE the generic `callee(args)` path
  — both in `emitExpr`'s `call-expression` case (the pure, nested path) and in
  `other.ts`'s `emitSpecialCall` (the top-level path, which additionally pushes
  `time-builtin-not-mapped` for an unmapped argument shape like
  `time(timeframe)`). Without the interception the value-fragment remap would
  compose into `time.dayofweek(bar.time)(t)` / `bar.time()`. The mapped forms:
  `time()` → `bar.time`; `time_close()` → `time.timeClose(bar.time)`;
  `dayofweek(t[, tz])` → `time.dayofweek(t[, tz])`;
  `timestamp(y, m, d[, h[, min[, s[, tz]]]])` → `time.timestamp(...)` for
  numeric-first arities 3-7. Pine's leading-timezone overload
  (`timestamp("UTC", y, m, d, ...)`) is deliberately DEFERRED and returns
  `null` for now because chartlang's `time.timestamp` expects `tz` last.
  `input.session` is a plain `INPUT_MAP` passthrough row (string default via
  `literalDefault`). When the generated source names `time.*` / `session.*`,
  codegen's `scanUsage` (`usage.ts`) force-includes `time` / `session` in BOTH
  the import list AND the `compute` destructure (`emitImports.ts` /
  `emitCompute.ts`).
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
  synthetic-token unit test, not reachable from real lexer output. Version
  `6` is accepted silently; version `5` is accepted with the
  `pine-version-downlevel` warning because the transform pipeline is
  version-agnostic; every other version still emits
  `unsupported-pine-version`.
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
  The cursor does NOT swallow `newline` globally (that would ripple to
  line-continuation, switch arms, and every `peekAhead`); the structural
  matches that must tolerate a comment-only / blank line call
  `TokenCursor.skipNewlines()` EXPLICITLY first — `parseVersionDirective`
  (leading license/blank lines before `//@version=6`), `parseBlock` (an
  indented block whose first physical line is a comment), and BOTH switch arm
  loops (`parseSwitchStatement` and `parseSwitchExpression`), which
  `skipNewlines()` at the top of every arm iteration so a blank/comment-only
  line between or after the arms is a stray `newline` that is skipped, NOT
  parsed as a malformed arm. (A trailing blank/comment line after the final arm
  is the common Pine idiom — without the skip the statement form cascades an
  `unexpected-token` and the value form misfires `switch-expression-unsupported`
  on the empty "arm".) A genuinely missing directive / genuinely empty body
  still fires `missing-version-directive` / `expected-token` after the skip.
- **A `name(params) => body` head parses to a `FunctionDeclaration` statement
  (`ast/statements.ts`) — the Pine user-defined function form.**
  `parseStatement` recognizes it with bounded `peekAhead` lookahead
  (`looksLikeFunctionDeclaration`): an `identifier`, `(`, a paren-depth-balanced
  parameter list, `)`, then `=>`. The `=>` after the balanced `)` is the
  unambiguous decl marker, so a plain call `f(args)` / history `f(args)[n]` /
  unclosed head `f(a` (eof before `=>`) all fall through to the existing
  identifier path unchanged. Params are **bare identifiers** (Pine v1 UDF params
  are untyped): `FunctionParam` is `{ name, span }` only — **no `default`
  field**. A typed param `float x` drops the type to the bare name `x` with a
  `udf-typed-param-unsupported` **warning** (chosen for v1 so a typed-param
  helper still converts); a defaulted param `x = 2`, a non-identifier param
  `1 + 2`, or a trailing comma `a,` **rejects the whole declaration** —
  `udf-param-default-unsupported` (error) / `expected-token` respectively —
  recovering the line + indented block via `recoverCompound` and registering no
  node (`parseFunctionDeclaration` returns `null`). The **body** is a
  `BlockStatement` whose **last statement is the implicit return** (Pine UDFs
  have no `return` keyword): a single-line `=> expr` wraps the expression in a
  one-statement block; a multi-line `=>` + `newline indent … dedent` reuses
  `parseBlock` (same block shape as `if`/`for`). Parse-only — statefulness
  classification + emission are Tasks 2–4; `transform/other.ts`'s `emitStatement`
  carries a no-op `function-declaration` arm until then, and `analyze` does not
  yet descend into UDF bodies.
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

### Residual diagnostics (expected, NOT bugs)

A clean conversion of a large feature-heavy script still emits non-error
diagnostics. These were audited and are **correct, expected output** — they
are honest notes about a deliberate lowering, not defects. Do NOT "fix" them by
suppressing the diagnostic; each one is the documented contract for a construct
that has no byte-identical chartlang analogue.

- **`ta-signature-divergence` (warning).** A `ta.*` Pine primitive maps to the
  closest chartlang member whose signature/semantics differ; the arguments are
  passed through unchanged and the note says how to reconcile by hand. The
  canonical case is `ta.cross(a, b)` → `ta.crossover` (chartlang has no
  bidirectional `ta.cross`; the note says "synthesise as crossover ||
  crossunder"); `ta.swma` → `ta.wma` is the same approximation pattern. This is
  intentional and LOUD (severity `warning`, actionable note) — never a silent
  wrong value. It cannot be a mapping-table row because the faithful lowering is
  a combined expression (`crossover || crossunder`), not a one-name swap.
  Extending it to a real synthesised lowering is a `ta.*`-lowering feature, out
  of scope for the audit.
- **`color-transp-approximated` (info).** A `color.new(base, transp)` /
  `color.rgb(r, g, b, transp)` plot/hline/table colour is lowered with Pine's
  0–100 transparency folded into an alpha channel (`#RRGGBBAA` for a literal
  base, `color.withAlpha(...)` for a dynamic one). The alpha PRESERVES the
  transparency; the note just records the representation change. Informational
  by design — no behaviour change.
- **`table-bucket-cap-adjusted` (info).** The drawing-bucket `other` cap is
  widened to fit the converted tables. Informational; the widening is the fix,
  not a problem.
- **`input-arg-not-mapped` / `table-formatting-not-mapped` (warning).** Pine
  input metadata `group`/`inline`/`tooltip`/`display`/`confirm` is modelled
  when literal; this diagnostic remains only for unmodelled input args such as
  `active`, unknown input args, or modelled input args whose value is not a
  compile-time literal. `TableCell` still cannot carry Pine
  `text_formatting`/`text_font_family`/`text_wrap`. Consolidated to one
  warning per distinct arg name (Task 5). The drop is a documented hard
  boundary.
- **`request-security-different-symbol` / `request-security-gaps-dropped`
  (info).** Multi-symbol/timeframe feed notes — the feed resolved through its
  input default; `gaps=` has no chartlang analogue. Informational.
- **`history-on-non-series` (warning) STAYS SILENT for a series-in-Pine
  receiver, and that silence means "back the `[n]` with a slot", not
  "impossible".** It fires from `analyze.ts` when `inferQualifier(receiver) !==
  "series"`, and `inferQualifier` JOINS THROUGH UDF calls, so a slope/MA local
  declared via a stateful UDF (`ma_1_slope = cf_slope(ma_1, …)`), a ternary of
  `ta.*` (`ma_slope_comp = … ? ta.sma : ta.ema`), or a cross-UDF argument
  (`cf_slope(ma_1, …)`) is correctly inferred `series` and the warning does NOT
  fire. The receivers really ARE series in Pine; chartlang indexes them via an
  INDEXABLE SLOT, so the lowering MUST back each such `[n]` with a
  `state.series`/`state.boolSeries` slot — see the Part A/B history-promotion
  notes in the `other.ts`/`udfInline.ts` section. (The earlier claim that
  silence on a clean parse meant "the receiver really is non-series" was WRONG —
  the silence is exactly the signal to slot-back the index, and Trend Wizard's
  31 TS7053 errors came from emitting `x[1]` on the `.current` SCALAR projection
  rather than on a slot.)
  The slot-backing now also covers four receiver kinds beyond a user-declared
  `var`/UDF-series local (all in `other.ts`): (1) a top-level `=`-decl ROOTED IN
  AN OHLCV BUILTIN (`chg = (close - close[1]) / …`) — A1's resolver
  (`scanPromotedSeries`) applies the `BUILTIN_SYMBOLS` fallback so `close`
  infers `series`; (2) a BOOLEAN promoted decl / direct-`ta.cross*` series — the
  promotion carries an element type (`booleanValued` ⇒ `state.boolSeries`, else
  `state.series`), so the per-bar `<slot>.value = <boolean>` write type-checks;
  (3) the SCALAR series builtin `time` (`SCALAR_BAR_SERIES_SOURCES`) — a
  synthesized `state.series` slot is fed `<slot>.value = bar.time` at the top of
  `compute` and `EmitContext.builtinSeriesSlots` rewrites `time[n]` → `<slot>[n]`
  (a bare `time` stays `bar.time`); the call-remapped scalars
  (`time_close`/`timenow`/`bar_index`) remain a documented gap; (4) a SOURCE
  INPUT (`input.source` / bare `input(defval=close)`) — `EmitContext.sourceInputs`
  emits `bar[inputs.<name> as SourceField]` (an indexable `PriceSeries`, pulling
  a `type SourceField` import via `usage.sourceField`) instead of the old
  `(inputs.<name> as number)` cast, so `src[1]` and `ta.*(src, …)` work.
- **`request.security` is series-qualified, and a REJECTED feed emits a safe
  placeholder.** `memberCallQualifier` (`qualifiers.ts`) maps `request.security`
  → `series`, so a history-indexed feed local (`earnings[1]`) is slot-backed by
  the promotion pass. `emitRequestSecurity` returns the `Number.NaN /* unsupported
  request.security feed */` placeholder (NOT the verbatim broken call) for an
  out-of-subset symbol/timeframe, keeping the loud `request-security-not-mapped`
  error; it returns `null` ONLY when the call is not a `request.security` at all.
- **An untyped color-valued decl resolves its `na` arm to the transparent
  color.** `valueIsColor` (`analyze.ts`) gives a `c = cond ? color.x : na` decl /
  assignment the `"color"` na-context even without a `color` type annotation, so
  the `na` lowers to `#00000000` (not `Number.NaN`, which would poison the value
  to `string | number`).
- **Pine `syminfo.<member>` aliases route through `remapSyminfoMember`
  (`builtinIdentifiers.ts`).** `syminfo.prefix` → `syminfo.exchange`; name-matched
  members pass through verbatim; an unmodelled member is a best-effort residual.

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
- **`parseAssignment` consumes BOTH the name and the assignment operator**
  (two `next()` calls). The operator is `=`/`:=` OR a compound arithmetic form
  (`+=`/`-=`/`*=`/`/=`), gated by `isAssignmentOperator`; all six widen the AST
  `AssignmentOperator`. The Task-3 stub masked a latent single-`next()` bug by
  greedily swallowing the operator into its token run; the real parser stops at
  the operator, so the operator must be consumed explicitly.
- **An inline `switch`/arrow arm body reads a comma-separated assignment LIST,
  not a single statement.** `parseSwitchCase` (`statements.ts`) loops on `,`
  (relying on the lexer's trailing-comma line continuation, so `a := 8, b := 21`
  is one logical line), parsing each element as its own `Statement` into
  `SwitchCase.body` — so an arm body is N statements. The AST is unchanged
  (`SwitchCase.body` was already `readonly Statement[]`); the switch lowering
  already iterates it (see the transform "`switch` lowering" invariant).
- **A `switch` used as a VALUE parses to a `SwitchExpression` and lowers to a
  chained ternary.** `switch` is BOTH a statement (`parseSwitchStatement`) and a
  Pratt prefix expression: in a declaration/assignment/tuple value position
  (`float r = switch s …`, `x := switch s …`, `[a,b] = switch s …` — Trend
  Wizard's `cf_ma` return) `parsePrimary` (`expressions.ts`) delegates the
  `switch` keyword to `parseSwitchExpression` (`statements.ts`, imported across
  the existing `statements ↔ expressions` function cycle). Each arm is parsed by
  `parseSwitchExpressionArm` as a single EXPRESSION via `parseExpression` (NOT
  `parseSwitchCase`, whose statement-based body would reject an array-literal arm
  value `=> [1, 2]` as a statement-leading `[` tuple head). `subject` is `null`
  for the subject-less boolean form. The node lowers in `emitExpr`
  (`exprEmit.ts`) to a right-nested ternary: with a subject `subject === label ?
  value : …`, subject-less `cond ? value : …`, a wildcard `=> value` arm is the
  default, and an exhausted chain yields `Number.NaN` (Pine's unmatched-`na`).
  `rewriteTree` lowers each subject/test/value in SCALAR position (a value
  `switch` yields a scalar, so a nested `ta.*` arm projects to `.current`). The
  RESIDUAL unsupported sub-shape — a multi-line block arm body, a comma list, or
  a `:=`/`=` assignment arm (not a single expression) — still emits ONE
  `switch-expression-unsupported` (error, reworded for this shape) and degrades
  the whole `switch` to an `unknown-expression`. Adding `SwitchExpression` to the
  `ExpressionNode` union means EVERY exhaustive expression walker carries a
  `switch-expression` arm (`emitExpr`/`forEachHistoryAccess`/`unparse`/
  `inferQualifier`/`walkExpression`/`collectExpressionFacts`/`rewriteTree`/
  `substituteParams`/`substituteIterator`/`expandNode`/
  `expressionHasStatefulPrimitive`); `collectInlineInputs` is the deliberate
  exception (Pine forbids `input.*()` inside a conditional/switch arm).
- **History `offset` is any expression.** Literal-bound enforcement for the
  chartlang emit constraint is Task 5/8, not the parser — `arr[i]` parses
  successfully here.
- **A `[` has THREE disjoint contexts; the Pratt structure keeps them apart.**
  (a) A **prefix** `[` (no left operand — reached from `parsePrimary` at a value
  start: after `=`/`:=`/`(`/`,`/an operator, or an `options=` named-arg value)
  is a **value-position array literal** → `ArrayLiteralExpression { elements:
  readonly ExpressionNode[] }` (`parseArrayLiteral`, empty `[]` + trailing comma
  allowed; elements via `parseExpression`). (b) A **postfix** `[` (a receiver is
  present — `a[0]`) stays the precedence-9 `history-access-expression` in
  `parsePostfix`. (c) A **statement-leading** `[` is owned by `parseStatement`
  (`statements.ts`), NOT this expression entry — see the tuple note below. An
  unterminated array literal (`[1, 2`) returns the zero-width `UnknownExpression`
  fallback (boundary token left in place, no diagnostic here — the statement
  layer reports it), never throws, never consumes to EOF. `emitExpr`/`unparse`
  emit `[e0, e1, …]` (the `array-literal-expression` arm shares the
  `tuple-expression` body where the output is identical). Task 3/4 consume the
  node as an `options=` value (each element a `literal-expression`).
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
- **Call-only built-ins still need semantic rows.** A bare-rooted callable
  like `timestamp(...)` is lowered later by `BUILTIN_CALL_MAP`, but it must
  also appear in `BUILTIN_SYMBOLS` as `simple` or analysis emits a spurious
  `unknown-identifier` before transform/codegen.
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
  any other statement-leading `[` line (a non-identifier target, a missing
  comma, a `:=`) is rejected **explicitly in `parseStatement`** with
  `unexpected-token` + `recoverLine` — it is NEVER allowed to fall through to
  the value-position array-literal parse, because a statement-leading `[` is
  always a destructuring head in Pine (value arrays appear only nested, reached
  through `parseExpression`). `walkTupleDeclaration`
  walks the RHS and `defineSymbol`s each non-`_` target (a `_` is a discarded
  placeholder, not bound). The transform layer lowers it (see the codegen
  `emitTa`/tuple section). The legacy `unsupported-tuple-destructuring` (info)
  now fires ONLY for a `TupleExpression` reaching a VALUE position (RHS), which
  the statement form never produces.
- **A tuple-LHS whose RHS is `request.security` is recognised + classified in
  the SEMANTIC walk, on a path SEPARATE from `MULTI_RETURN_TA_MAP` (which is
  `ta.*`-only).** `analyzeSecurityTuple` (`semantic/securityTuple.ts`, called
  from `walkTupleDeclaration`) detects the RHS by callee (`dottedCallee` ===
  `"request.security"`, the shared leaf accessor) and stores a `securityTuple`
  annotation on the `TupleDeclaration` node in `analysis.annotations` (the
  identity-keyed map). The annotation is
  `{ kind: "securityTuple"; feed: { symbol?; interval }; elements: ReadonlyArray<{ kind: "ohlcv"; field } | { kind: "expr"; node }> }`:
  the feed is resolved by the SHARED `resolveSecurityFeed` (see the transform
  `request.security` invariant — `symbol` omitted for `syminfo.tickerid`), and
  each `[…]` source element is classified by the SHARED `securityField` (bare
  OHLCV → `ohlcv`, anything else → `expr`) — the SAME two helpers the
  single-source path uses, no second copy. Task 2's `emitTupleDeclaration` reads
  the annotation back via `analysis.annotations.get(decl)` and lowers it to N
  independent reads. **Diagnostics:** a non-array third arg →
  `security-tuple-source-not-list` (error, semantic-namespaced); a name/source
  arity mismatch → `security-tuple-arity-mismatch` (warning) + bind-what-it-can;
  a computed / wrong-axis / out-of-table symbol-or-interval feed reuses the
  existing transform `request-security-not-mapped` (the task's
  `request-security-*-not-literal` codes never existed — `request-security-not-
  mapped` is the landed multi-symbol reject) and produces NO annotation.
  The feed is resolved by the SHARED `resolveSecurityFeed` threaded the script's
  `SecurityFeedInputs` (see the transform `request.security` invariant), so an
  `input.symbol`/`input.timeframe`-bound symbol/timeframe resolves to its
  `inputs.<name>` ref identically to the single-source path (`feed.symbol` /
  `feed.interval` are chartlang EMIT-SOURCE STRINGS, not raw values).
- **The `request.security` AST-shape + feed-resolution helpers live in the
  ast-only leaf `transform/securityShape.ts`** (`securityField`,
  `resolveSecurityFeed`, `SecurityFeed`), imported by BOTH `requestSecurity.ts`
  (single-source) and `semantic/securityTuple.ts` (tuple). The leaf imports only
  `../ast` + `timeframeConvert.ts`, so the semantic layer can import it directly
  WITHOUT a `semantic → transform` cycle (the `transform/callArgs.ts` precedent);
  do NOT import these through the `transform/index.ts` barrel (it pulls
  `coordinates.ts → ../semantic`, which WOULD cycle).
- **Native Pine enum declarations are compile-time symbols.** The parser reads
  `enum Name` into an `EnumDeclaration` whose members preserve declaration
  order and carry either the explicit string title (`member = "Title"`) or
  `null` (semantic default: the member name). `registerEnumTypes` hoists
  top-level enums BEFORE the statement walk, creates a `kind: "enum-type"`
  symbol in the root scope, and exposes the deterministic lookup on
  `SemanticResult.enumTypes` for Task 4's `input.enum` lowering. A
  `EnumType.member` reference resolves through that symbol; an unknown member
  is `unknown-enum-member`, not `unknown-identifier`. Enum declarations emit
  nothing, so every statement walker carries an explicit no-op
  `enum-declaration` arm.
- **A user-defined function (`FunctionDeclaration`) registers a `kind:
  "function"` symbol carrying `params: readonly string[]` and a resolved
  `stateful: boolean`; Tasks 3/4 read that symbol to choose reuse vs.
  inline.** `registerUserFunctions` runs BEFORE the body walk and HOISTS every
  top-level UDF (forward, backward, and sibling-UDF call sites all resolve — no
  declare-before-use rule), so a call to a UDF no longer raises
  `unknown-identifier`. Each UDF body walks in a CHILD scope seeded with its
  params (`kind: "function-parameter"`, per-param span into the `symbols` map,
  the `TupleTarget` precedent); the child scope is DISCARDED after the body
  walk, so a param is invisible outside the function (a body-free identifier is
  still `unknown-identifier`). A call whose arg count differs from the resolved
  `params.length` warns `udf-arity-mismatch` (`functionParamArity` returns
  `null` for any non-function callee, so builtins/`ta.*` member calls are
  untouched).
- **Statefulness is computed in a pre-pass and stored IMMUTABLY on the UDF
  symbol — never patched after the walk.** `resolveUdfStatefulness`
  (`semantic/statefulness.ts`) classifies the whole UDF set from the AST alone
  (no scope/symbol machinery): seed each UDF with its builtin-stateful body
  fact (`callIsStatefulPrimitive` over `plot`/`hline`/`alert`/`ta.*`/`draw.*`),
  link bare-identifier callees into a call graph (a non-UDF callee like `nz`
  contributes no edge), then run a monotone fixpoint so a UDF that calls a
  stateful UDF is itself stateful (a pure cycle stays pure; the fixpoint is
  bounded). Because the verdict is final before the symbol is built, the symbol
  is constructed ONCE with its immutable `stateful` — no stale copies across
  frozen scopes.
- **Recursion is REJECTED.** The pre-pass detects cycles (a UDF whose
  transitive closure includes itself) and emits ONE `udf-recursive-rejected`
  (error) per cycle on the lexically-first member. Recovery: the recursive UDF
  is still registered with its REAL params + `stateful: true` (chosen over the
  task's "empty params" so call sites neither cascade `unknown-identifier` NOR
  raise a spurious `udf-arity-mismatch`).
- **The builtin stateful-primitive predicate lives in `semantic/statefulness
  .ts` (`callIsStatefulPrimitive`), NOT in the transform layer.** The transform
  already depends on the semantic result, so the predicate was moved DOWN to
  break a would-be `semantic → transform` cycle; `transform/statefulNames.ts`
  imports + re-exports it (so `controlFlow.ts` / `transform/index.ts` keep
  their import path) and still owns the expression-walk `expressionHasStateful
  Primitive`. One predicate, one source of truth.
- **`builtins.ts` / `types.ts` carry no branchy logic** and `types.ts` is
  coverage-excluded; every other `semantic/` module holds 100%
  line/branch/function. Defensive switch arms unreachable from real parser
  output (e.g. a top-level `block-statement`, or the UDF facts-collector's
  `return`/`break`/`continue`/nested-`function-declaration` arms) are covered
  by synthetic-AST unit tests, the same precedent the parser uses for its
  defensive arms.

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
- **A `literal == literal` / `literal != literal` comparison WIDENS its left
  operand with a same-base `as` cast (`exprEmit.ts` binary case).** When an
  inlined UDF / value-`switch` substitutes literals onto BOTH sides of an
  equality (`"SMA" == "SMA"`, after a dropdown `ma_slope_comp_type == "SMA"`
  collapses), strict TS rejects it as TS2367 ("no overlap") even though it is a
  harmless always-true/false test. `literalBaseType` (string/number/boolean,
  `null` otherwise) gates a `(<left> as <base>) == <right>` rewrite, applied
  ONLY when the operator is `==`/`!=` AND both operands are literals sharing a
  base — so a legitimately-typed mismatch never has a NEW error masked, and a
  color/other literal (base `null`) is untouched.
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
  (wraps `makeDiagnostic`), `pushCodeOnce(key, dedupeKey, span, message?)`,
  `has(code)`, `toArray()` (snapshot copy), `size`. Construct ONE per
  conversion, thread it through every transform, drain via `toArray()` at
  codegen. `transformDeclaration` snapshots it onto `scaffold.diagnostics` at
  build time — later tasks that push more diagnostics re-read the collector,
  not the frozen scaffold field.
- **`pushCodeOnce` de-dupes by `(code, dedupeKey)`, where `has(code)`
  de-dupes by code alone — so a noisy per-call-site warning collapses to ONE
  diagnostic per distinct discriminator across the whole script** (emitted at
  the FIRST occurrence's span, the rest suppressed). The transform walk is
  source-order deterministic, so the chosen span + emission order are stable.
  This is how an unmapped `input.*` argument
  (`input-arg-not-mapped`, `inputs.ts`), an unmapped `table.cell` formatting
  argument (`table-formatting-not-mapped`, `tables.ts`), and the
  `request.security` `gaps=` info (`request-security-gaps-dropped`,
  `requestSecurity.ts`) each warn once per distinct ARG NAME / once per script
  rather than once per call. The genuinely-unmapped and the non-literal-value
  uses of `input-arg-not-mapped` share the code but key on disjoint arg-name
  sets, so each name resolves to exactly one (honest) override message.
- **`mapDeclarationArgs` (`declarationArgs.ts`) is the §2 arg → option
  table.** Each `max_*_count` bucket defaults to 50 (`BUCKET_DEFAULT_CAP`)
  to preserve Pine GC behaviour; over-cap values clamp to `BUCKET_CAP`
  (lines/labels/boxes 500, polylines 100) + `max-count-out-of-range`.
  `format.inherit`/`scale.none` → `null` + `indicator-arg-not-mapped`.
  Non-literal scalar args are silently ignored (no field set); strategy-only
  args fall through the `default` arm and drop silently. `UNMAPPED_ARGS`
  (`timeframe`, `behind_chart`, …) each raise one `indicator-arg-not-mapped`;
  `RECOGNIZED_NOOP_ARGS` (currently just `explicit_plot_zorder`) are RECOGNIZED
  no-ops — chartlang already orders marks by declaration order within their
  group, so the flag is satisfied by default and emits one
  `explicit-plot-zorder-default` **info** note (NOT a warning), sets no field,
  and the converter NEVER emits a numeric `z`. Keep the two sets disjoint; do
  NOT re-add `explicit_plot_zorder` to `UNMAPPED_ARGS`. A computed title →
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
  else is scanned for nested (inline) inputs. The promoted call is REWRITTEN AT
  ITS USE SITE by `rewriteTree` (`emitContext.ts`): the call's `spanKey` is
  looked up in `EmitContext.promotedInline` and the node replaced with the
  `inputs.<name>` read — with the SAME cast a bare input identifier gets
  (`(inputs.inlineInput as number)` when `inputCasts` has the name, bare
  `inputs.inlineInput` otherwise). Keyed by `spanKey` (not node identity —
  `udfInline` clones nodes; the span survives). Without this the raw
  `input.*(...)` call would leak into `compute` (the hole throws at runtime).
- **Rejects push a `pine-converter/transform/...` error and skip the input
  (no `appendInput`):** a native `input.enum(...)` whose default is not a
  declared `EnumType.member` → `input-enum-default-not-member`; a computed
  `input.source` default → `non-literal-source-input`; a non-literal default
  (incl. an unknown/`non-string` timeframe) → `non-literal-input-default`; an
  unrecognised `input.*` → `unknown-input-primitive`. Allowed defaults are
  compile-time literals PLUS a unary `+`/`-` on a numeric literal
  (`input.int(-1)`) and compile-time color forms (`color.<name>`,
  `color.rgb(...)`, `color.new(...)`) folded through `colorConvert.ts`'s
  converter palette helpers. Literal `group`/`inline`/`tooltip` pass through as
  string opts; Pine input `display.all` is recognized and omitted, `display.none` /
  `display.status_line` / `display.data_window` lower to `"none"` /
  `"status-line"` / `"data-window"` via `INPUT_DISPLAY_MAP`; literal
  `confirm=true|false` passes through. Unmapped named args (`active`,
  unknowns, unsupported `display.*`, a non-literal `title`/`minval`/metadata
  arg…) warn via `input-arg-not-mapped` and are dropped, but the input is still
  emitted — and these consolidate to ONE diagnostic per distinct ARG NAME
  across the whole script (via `pushCodeOnce`, `warnUnmappedInputArg`/
  `warnNonLiteralInputArg`), not one per call site.
- **A native Pine `input.enum(EnumType.member, title?, …)` lowers to a
  string-backed chartlang `input.enum("<member value>", ["<all member values>"], { title? })`.**
  The enum type is resolved from `SemanticResult.enumTypes`; the selected
  member's resolved value becomes the default, all declaration-ordered member
  values become the options list, and the SAME metadata helper used by the
  dropdown bridge threads `title` (2nd positional or named), `group`, `inline`,
  `tooltip`, `display`, and `confirm`. A default that is not a resolved
  `EnumType.member` raises `input-enum-default-not-member` and skips the input.
- **A Pine `input.string/int/float(default, title?, options=[literals])`
  (dropdown) becomes chartlang `input.enum(default, [literals], { title? })`
  (`resolveOptionsEnum`, parameterised by an `OptionsConfig`), keyed on the
  `options=` named arg being an `ArrayLiteralExpression` of UNIFORM literals
  (all strings, or all numbers — `OPTIONS_DROPDOWN_CONFIG` maps `input.string`→
  string, `input.int`/`input.float`→numeric).** This is the
  converter-SYNTHESISED options → enum bridge, distinct from Pine's native
  `input.enum` primitive above. The target builder name lives in mapping
  (`STRING_OPTIONS_ENUM_BUILDER`, `mapping/inputs.ts`), not inlined. The
  title threads from the 2nd positional arg OR a `title=` named arg (core's
  `input.enum` takes the title in an options OBJECT, not a trailing slot), and
  the same literal `group`/`inline`/`tooltip`/`display`/`confirm` metadata
  helper used by normal inputs builds the enum options object.
  A default ∉ options warns `input-string-options-default-mismatch` (still
  emits the enum); a MIXED / non-literal `options=` list cannot become an
  enum and falls back to the plain factory (options dropped) with
  `input-string-options-not-literal` — `buildOptions(skipOptionsArg=true)`
  suppresses the would-be double `input-arg-not-mapped` on `options`. A
  CROSS-TYPE list (all-numeric on `input.string`, all-string on numeric) and
  the vacuous empty `[]` DEFER to the generic path (`config.deferElements`),
  dropping the options via `input-arg-not-mapped`. The string-enum read casts
  as `string` in `inputCastType` (`emitContext.ts`, gated on `input.enum("`); a
  NUMERIC enum (`input.enum(21, …`) casts as `number`, so length args /
  comparisons type-check. Numeric `input.enum<number>` only type-checks
  because Task 1 widened core's `input.enum` to `T extends string | number`,
  and is fully functional end-to-end: `compiler/extractInputs` serialises a
  uniform numeric options list, and `runtime/resolveInputs.matchesDescriptor`'s
  `enum` arm accepts a numeric override.
- **A bare generic `input(...)` (callee identifier `input`, NOT
  `input.<member>`) is recognised in `inputCalleeKey` and lowered by
  `buildBareInput` — the SOURCE-vs-TYPED target is a TRANSFORM decision keyed
  on the resolved `defval` (positional[0] OR named `defval=`), not a mapping
  lookup.** A series default (OHLCV / synthetic field via `sourceDefault`) →
  `input.source("<field>", { title? })`; a compile-time literal default → the
  typed `input.int/float/bool/string/color` by `LiteralKind` (`BARE_TYPED_FACTORY`,
  unary `±`-numeric preserved); a missing / `na` / computed default rejects
  `non-literal-input-default`. Both hoist to `scaffold.inputs` (read as
  `inputs.<name>`), so `other.ts:isInputCall` ALSO matches the bare `input`
  callee to skip the decl in `compute`. `INPUT_MAP["input"]` is a
  recognised-primitive MARKER only (`chartlang: "input.source"` = the series
  target); `buildBareInput` decides the typed case. The `BARE_TYPED_FACTORY`
  miss arm (`literalKind: "na"`) is unreachable from the real parser (bare `na`
  is an `na-expression`, not a `literal-expression`) and is covered by a
  synthetic-AST test (`inputs.synthetic.test.ts`).
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
  it in `ring.push(...)`). `ctx: DrawCallContext = { emit, anchors, warn }` —
  a STRUCTURAL sink (not the `DiagnosticCollector` class) so both camps share
  one signature; `warn` only raises `label-style-not-mapped` /
  `yloc-padding-approximated`. **`emit: EmitContext` is the DRAWING emit
  context** ({@link buildDrawingEmitContext}, `emitContext.ts`): a draw-option
  value (`color=lineColor`, `width=2`) lowers through `emitWithContext`, NOT
  bare `emitExpr`, so a bare `input.color`/`input.int` reference qualifies to
  `(inputs.<name> as <cast>)` exactly like the `transformOther` scalar path —
  do NOT reintroduce an annotation-only `styleValueSource` that leaks the bare
  Pine identifier. Coordinates come from the resolved
  `anchors` side-table (the `.new()` site pass); `DRAW_METHOD`/`ANCHOR_ARITY`
  are TOTAL `Record<ChartlangDrawKind, …>` maps (no `??` fallback, so no dead
  arm). `resolveCampADrawKind(site, diagnostics)` (`drawKindResolve.ts`)
  picks the chartlang kind: `line.new`→`line`, `box.new`→`rectangle`,
  `label.new`→`text` by default or `marker`/`frame`/`arrow-mark-up|down`/
  `rectangle` per the `style=label.style_*` enum (unmapped/non-drawing style
  → `text` + `label-style-not-mapped`).
- **`foldSetters(setters, handleType, emit, warn): string | null`
  (`setterFold.ts`) is the reusable setter→patch fold** (Camp A + Camp B +
  tables). The `emit: EmitContext` (NOT a bare `AnnotationLookup`) lowers each
  setter VALUE through `emitWithContext`, so `label.set_text(lbl, "x" +
  str.tostring(close))` lowers the nested `str.tostring` (→ `String(...)`) and a
  bare input qualifies — a setter value is a full expression context, not a
  raw `emitExpr` splice. A `SetterCall` is `{ method, call }`. It looks each setter's
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
  `size.*`/`color.*` lower through `enumLookup`; a transparency-carrying cell
  colour (`color.new(base, transp)` / 4-arg `color.rgb(...)`) routes through the
  shared `convertColorWith` (hex fold / `color.withAlpha`, raising
  `color-transp-approximated`); every other non-enum styling value, and the cell
  TEXT, lower via `emitWithContext` over the {@link buildDrawingEmitContext}
  context — so a bare `input.color` qualifies AND a `str.tostring(array.size(
  ring))` cell text lowers BOTH the `str.tostring` (→ `String(...)`) and the
  `array.size(<ring>)` over a Camp B drawing ring (→ `<ring>.size()`, via
  `EmitContext.handleRings`). The tables pass runs LAST (after Camp B registers
  its rings), so every ring is resolvable; do NOT rebuild a minimal empty-input
  `EmitContext` here (that was the leak that emitted `array.size(levels)` /
  bare `lineColor`). The only gaps are merge (no analogue →
  top-left fallback) and Pine's `text_formatting`/`text_font_family`/`text_wrap`
  (no analogue → `table-formatting-not-mapped` warning, dropped — consolidated
  to ONE diagnostic per distinct arg name across the whole script via
  `pushCodeOnce`, not one per cell).
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
  opts)); } else { slot.current()?.update({ edgeA, edgeB }); }`. The edge
  strings + the `draw.fillBetween(...)` call come from the SHARED
  `emitFillBetweenBand(edgeA, edgeB, fill)` builder (below); `emitLinefill`
  passes `{ kind: "endpoints", a, b }` descriptors + its own default fill
  (`"#00000033"`).
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
- **`emitFillBetweenBand(edgeA, edgeB, fill)` (exported from
  `polylineLinefill.ts`) is the ONE `draw.fillBetween` band builder — both the
  static `linefill.new` lowering AND the Pine `fill(plot/hline, …)` lowering
  (`plotFamily.ts`) route through it; never assemble a second.** It takes two
  pre-resolved `FillBetweenEdge` descriptors (`{ kind: "constant", price }` for
  an `hline`, `{ kind: "series", value }` for a `plot`, `{ kind: "endpoints",
  a, b }` for a `linefill`'s two line anchors — each a rendered SOURCE STRING)
  plus a pre-folded `fill: string | null` (`null` ⇒ opts omitted, the core
  default fill), and returns `{ edgeA, edgeB, call }`. `constant`/`series` edges
  render `[bar.point(0, X), bar.point(0, X)]` (both endpoints at the CURRENT
  bar, re-anchored each compute tick — x-extent is the current bar, NOT a
  cross-bar ribbon, which is deferred); `endpoints` passes `[a, b]` through. The
  3-kind union is exhaustive (no `default`), so there is no dead unknown-kind
  arm. Colour folding + the colour diagnostic stay in each CALLER (they diverge:
  `linefill` defaults to `"#00000033"` + raises `linefill-color-transp-
  approximated`; `fill` omits opts when colourless + folds via the plot-family
  `styleValue` rule, which raises `color-transp-approximated`).
- **`fill(a, b, color?)` lowers to a bare `draw.fillBetween(...)` statement via
  `emitPlotFamily`'s `case "fill"` (`emitFill`), NOT a handle slot.** Unlike
  `linefill` (which needs `set_color`/`delete` mutations, hence the slot), a
  `fill` has no mutations, so the call rides as a plain per-bar statement (like
  `plot`/`hline`). `emitFill` resolves each handle arg via `resolveFillEdge` →
  `fillHandleCall`: an INLINE `hline(p)`/`plot(e)` call, or an identifier bound
  by a top-level `<name> = hline/plot(...)` `assignment` OR `var <name> =
  hline/plot(...)` `variable-declaration` (the resolution scope is the script
  `body`, passed as `emitPlotFamily`'s 4th param). The `emitPlotFamily` switch
  is exhaustive over a `PlotFamilyName` literal union (no `default` arm —
  `fill-not-mapped` is now pushed ONLY from `emitFill`). **Two append-only fill
  codes:** `fill-handle-unresolved` (error) when a handle resolves to neither an
  `hline` nor a `plot` (unbound id, `array.get` ring handle, missing arg, an
  inline non-`hline`/`plot` call, or an `hline()`/`plot()` with no value); the
  NARROWED `fill-not-mapped` (error, message updated) ONLY for a deferred
  gradient (`top_color`/`bottom_color`/`top_value`/`bottom_value`) or `fillgaps`
  form. `fill` is NEVER silently dropped — every unsupported shape emits exactly
  one of the two codes.
- **`colorConvert.ts` owns the ONE colour-lowering rule shared by the
  linefill, plot/hline (`plotFamily.ts`), and table (`tables.ts`) paths — never
  fork a second.** `convertColorWith(node, emit)` is the core; `convertColor(node,
  annotations)` is the thin wrapper (`emit = (n) => emitExpr(n, annotations)`)
  the linefill / polyline paths use. The plot, table, AND drawing-setter
  (`setterFold.ts`) paths pass `convertColorWith(node, (n) => emitWithContext(n,
  ctx))` so a dynamic base / transp is **input/state/ring-aware** — a bare
  `input.color` base qualifies to `(inputs.<name> as string)`. (The table path
  formerly used the annotation-based `convertColor`; that leaked a bare input —
  it now threads the `buildDrawingEmitContext` context like the plot path.) The
  rule (fixed):
  - **Literal base + literal transp folds to a quoted `#RRGGBBAA` string.**
    `color.new(base, transp)` with a compile-time `#RRGGBB` base (a `color.*`
    enum or `#RRGGBB` literal) → `alpha = round(255 * (100 - clamp(transp, 0,
    100)) / 100)`, 2-digit uppercase hex via `transpToAlphaHex` (`color.new(
    color.gray, 80)` → `#787B8633`; `color.gray` is `#787B86`, not the task
    file's illustrative `#808080`). A 4-arg `color.rgb(r, g, b, transp)` with all
    literal components folds the same way (`byteHex` clamps each `[0, 255]`
    component; `color.rgb(255, 153, 0, 60)` → `#FF990066`).
  - **A DYNAMIC base or transp emits `color.withAlpha(<base>, <alpha>)`** with
    `alpha` in core's **0–1** range (`(100 - clamp(transp, 0, 100)) / 100` for a
    literal transp, `(100 - <emitted transp>) / 100` for a dynamic one). The base
    is the resolved hex when known, else the emitted expression; a 4-arg
    `color.rgb` dynamic base re-emits `color.rgb(r, g, b)`. (chartlang core has
    NO `color.new` — a `color.new` must NEVER reach the `emit` fallback.)
  - A bare `color.*` enum lowers through `enumLookup`; a 3-arg `color.rgb(r, g,
    b)` with literal components folds to `#RRGGBB`; a dynamic 3-arg
    `color.rgb` and every other node fall through to `emit` (so `color.rgb`
    survives and Task 2's `color`-import gating must cover any surviving
    `color.` member).
  - `isTranspColorForm(node)` (a 2-arg `color.new` or 4-arg `color.rgb`) is the
    predicate the plot/hline/table call sites raise `color-transp-approximated`
    (info) on. The linefill path keeps its own `linefill-color-transp-
    approximated` (info), raised by `emitLinefill` when the fill colour is a
    `color.new(...)` — the two codes are NOT overloaded across paths.
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
- **A `ta.*` result lowers to `(...).current` through ONE shared rule,
  `lowerTaToCurrent` (`emitContext.ts`) — applied at the top level AND in any
  nested scalar position.** `emitTa` (`other.ts`) owns the top-level value of a
  declaration/assignment and raises the `ta-not-mapped` /
  `ta-signature-divergence` diagnostics; the recursive `rewriteTree`
  (`emitContext.ts`) applies the SAME helper to a `ta.*` in a **scalar
  position** — an operand of a binary/unary operator, a ternary arm, or a
  `math.*` / `Math.*` argument (`emitScalar`) — so `ta.rsi(close,14) * 0.1` →
  `ta.rsi(bar.close, 14).current * 0.1`. The lowering is **position-aware**: a
  `ta.*` in a **series position** stays a `Series` (chartlang `ta.*` sources are
  `Series<number>`) — a source arg to another `ta.*`, a direct `plot`/`hline`
  value, a `request.security` callback body, or a history-access receiver
  (`ta.sma(close,20)[1]`). chartlang `ta.*` returns a `Series<number>` (a
  history view object); `.current` projects the per-bar scalar (`ta.*` keeps its
  own per-call-site history, so feeding scalars in and reading `.current` out
  reproduces Pine semantics). `lowerTaToCurrent` resolves signature-divergent
  names through `taLookup` (`ta.rma` → `ta.smma`) and restructures
  `ta.pivothigh`/`ta.pivotlow` to `ta.pivotsHighLow({ leftLength, rightLength })
  .high|.low` (a function-result field projection, NOT a
  `ta.pivotsHighLow.high(...)` method); a nested lowering raises NO diagnostic
  (the top-level `emitTa` site owns them) — instead the nested rule notifies the
  OPTIONAL `EmitContext.taWarn` structural sink (the `arrayWarn`/`mapWarn`
  precedent, populated only by `transformOther`): a lowered nested `ta.*` raises
  `nested-ta-lowered` (info, deduped once per script via
  `diagnostics.has(DIAGNOSTIC_CODE_ENTRIES[code].code)`), and an unmapped /
  REJECT `ta.*` left as a `Series` in a scalar position raises
  `nested-ta-not-lowered` (warning, the residual-series safety net) — so a
  nested `ta.*` is NEVER a silent output. Other `EmitContext` constructions
  (plot/table/…) leave `taWarn` absent, so those positions stay silent, exactly
  as the array/map sinks do. Fixture `41-nested-ta-arith` proves the clean nested
  arithmetic round-trips through the compiler. An input read lowers as
  `inputs.<name> as <type>`: `inputCastType` (`emitContext.ts`, shared by
  `transformOther` AND the drawing transforms via `buildDrawingEmitContext`) →
  `number`/`boolean`/`string` from the `input.*` factory drives the
  `inputs.len as number` cast (`EmitContext.inputCasts`). `input.color` casts as
  `string` (a `#RRGGBB[AA]` colour string), so a bare `color=lineColor` draw
  option assigns to the `string` colour field.
- **Native Pine enum member reads are compile-time string values in expression
  emission.** `emitExpr` receives `SemanticResult.enumTypes` through
  `EmitContext.enumTypes` and lowers a resolved bare `EnumType.member` access to
  `"<member value>"` before falling back to the normal dotted member-chain
  output. Unknown members are already semantic `unknown-enum-member`; unresolved
  accesses remain verbatim so existing fallback behavior is preserved.
- **A NESTED `math.*` call lowers its callee to the bare-native `Math.*`
  passthrough through the SAME `rewriteTree` seam (`emitContext.ts`).** The
  top-level `emitMath` (`other.ts`) only remaps the OUTERMOST call, so before
  this rule a `math.max(math.min(a, b), c)` body leaked the undefined inner
  `math.min` (chartlang's `math` namespace has no `min`/`max`). `rewriteTree`
  now rewrites a nested `math.*` call whose `mathLookup` target starts with
  `Math.` (`math.min`/`math.max`/`math.abs`/…) onto that native member, args
  recursing in scalar position (so a doubly-nested member lowers too). The
  chart-aware `math.*` targets (`math.avg`/`math.sum`/`math.roundToMintick`) ARE
  real chartlang members and stay as-is — their rolling-window / mintick-injection
  handling stays the top-level `emitMath` path's. This is the `math` sibling of
  the nested-`ta` lowering above; fixture `42-udf-pure-limit` (a pure UDF body
  `math.max(math.min(…))`) is the round-trip witness.
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
- **A tuple-LHS `request.security` lowers to N INDEPENDENT reads, checked BEFORE
  the multi-return-`ta.*` path.** `emitTupleDeclaration` (`other.ts`) first reads
  the `securityTuple` annotation off the decl (`analysis.annotations.get(decl)
  ?.securityTuple`, classified in the semantic walk — see the semantic
  `request.security` invariant). When present, `emitSecurityTuple` emits one
  `const <name> = …` per element: an `ohlcv` element → the data form, an `expr`
  element → the callback form, via the SHARED `securityDataRead` /
  `securityCallbackRead` builders (`securityShape.ts`, used by the single-source
  `requestSecurity.ts` too). All N reads share ONE `{ symbol?, interval }` opts
  literal from the SHARED `securityOpts` (one feed; the runtime dedups via
  `feedKey`, and the compiler's `requestedFeeds` extraction picks up the N
  standard single-source reads with no special-casing — proven by the
  fixtures-compile round-trip, NOT a converter manifest pass). **Unlike the
  multi-return-`ta.*` path there is NO `tupleFieldAliases` indirection** — each
  name is its own `const` and bare downstream references resolve unchanged
  (`registerTupleFields` skips a `request.security` RHS since `multiReturnRhs`
  returns null for it). A `_` target and an absent element (more names than
  elements — `security-tuple-arity-mismatch` already warned in the semantic walk)
  are skipped; a cross-symbol feed pushes `request-security-different-symbol` ONCE
  (mirroring the single-source advisory). **Ordering is load-bearing:** a
  `request.security` RHS with NO annotation (a feed/source reject the semantic
  walk already diagnosed as `request-security-not-mapped` /
  `security-tuple-source-not-list`) returns `[]` BEFORE the `multiReturnRhs`
  fall-through, so it never also fires the misleading `multi-return-not-mapped`.
  The bound reads are `Series` (no `.current`, matching the single-source form);
  scalar arithmetic on a bound read is the same Series-identifier gap as the
  single-source path (read `.current`). `:=` tuple-element reassignment is out of
  scope (same limit as the multi-return form). Input-driven feed VARIABLES still
  reject (the multi-symbol-security follow-up; see the semantic invariant).
- **A PURE user-defined function (`stateful: false`) is emitted ONCE as a
  reusable chartlang arrow `const` hoisted to the FRONT of the compute body;
  every call site reuses it (no inlining).** `emitPureUdfs` (`other.ts`) runs in
  `transformOther` BEFORE the source-order statement walk, so a pure UDF
  `const` lands after the state-slot allocations (codegen preamble) and before
  any non-UDF statement. The statement walk's `function-declaration` arm stays a
  no-op (`emitStatement` → `[]`): a pure UDF's emission is the hoisted prepend,
  and a STATEFUL UDF (excluded here — `symbol.stateful !== false`) is Task 4's
  call-site inline; **both** share the no-op declaration arm, which is the seam
  between the two paths. Pure UDFs are ordered callee-before-caller by a
  post-order DFS (`orderPureUdfs`) over the call graph re-derived from each
  body via `collectUdfBodyFacts` (`semantic/statefulness.ts`); recursion can
  never reach this set (a cycle is forced `stateful: true`), so the `visited`
  pre-mark yields a true topological sort. A bare callee that is not itself a
  pure UDF (`nz`, a stateful UDF — a `math.*` member call has no bare callee at
  all) contributes no edge. Each emitted UDF raises one `udf-emitted-function`
  (info). The statefulness verdict is READ off the hoisted `kind: "function"`
  symbol (`analysis.symbols.get(decl.span).stateful`) — **never re-derived**; a
  duplicate-named EARLIER declaration resolves to no symbol (the semantic hoist
  registers only the last) and is skipped, so only the last `const` is emitted.
- **A pure UDF body lowers param REFERENCES verbatim (shadowed via
  `EmitContext.localNames`) but emits each param NAME with a `: number` TYPE
  ANNOTATION — no `emitContext.ts` change was needed for the shadowing.**
  `ctx.localNames` already short-circuits the input/slot rewrite
  (`rewriteIdentifier` checks it FIRST), so seeding it with the UDF names (at
  the top-level `ctx`, so a call-site callee like `cf_limit(...)` keeps its bare
  name) plus, per UDF, its params + body-local names (in the child `ctx`) makes a
  param/local reference stay verbatim while a free input/`var` reference in the
  body still rewrites (`inputs.<name>` / `<slot>.value`) — the closure captures
  the enclosing `compute` scope. The emitted param LIST is typed `: number` (an
  untyped arrow param fails `noImplicitAny`; see the typed-param invariant in the
  UDF block below). A single-expression body becomes an
  expression-bodied arrow (`cf_add(a, b) => a + b` → `const cf_add = (a: number,
  b: number) => a + b;`); any other body becomes a block arrow whose value locals lower to `let`
  (uniformly — a later `:=`/`+=` reassignment of the same name emits a plain
  `name <op> rhs;`, and nested-control-flow reassignments are handled by reusing
  the top-level `emitStatement` lowering) and whose LAST statement yields the
  implicit `return` (a value local returns its name; a bare expression returns
  the expression; a control-flow last statement yields no return). The body's
  expressions route through the SAME `emitCallValue` the top-level statement
  walk uses, so `math.*`/`str.*`/input/`nz` lower identically. A pure UDF
  contains NO `ta.*`/state by definition (Task 2), so the nested-`ta` `.current`
  concern does not arise here — that is only the stateful-inline path.
- **A STATEFUL user-defined function (`stateful: true`) is INLINE-EXPANDED at
  every call site (`src/transform/udfInline.ts`), NEVER emitted as a shared
  function — and that is a CORRECTNESS requirement, not an optimisation.** The
  compiler keys every `ta.*`/`state.*` slot on the GENERATED source position of
  the call (`callsiteIdFor` → `<sourcePath>:<line>:<col>#0`). A stateful helper
  emitted as ONE shared function would put its `ta.*` at ONE position, so all N
  callers would share ONE slot → cross-contaminated state. Pine instead gives
  each lexical call site its OWN state. INLINING the body at each call site
  reproduces that: each call site emits its OWN copy of the body's `ta.*`/
  `state.*` at its OWN generated position, so the compiler mints an INDEPENDENT
  slot per call site **with no compiler change**. The converter never mints slot
  ids; inlining IS the mechanism. Re-emitting the same body twice cannot collide
  because (1) each expansion is separate compute statement(s) at distinct lines/
  columns, (2) every synthesized local (arg temp, body local) is a FRESH
  `scaffold.names.allocate(...)` name, and (3) the compiler derives the slot id
  from position. `udfInline.test.ts` compiles a two-call example through
  `transformAndAnalyse` and asserts the two `ta.ema` calls get DISTINCT slot ids
  (the divergence witness).
- **The inliner is DISPATCHED from `emitDeclaration` / `emitAssignment` /
  `emitExpressionStatement`, gated on `walk.statefulUdfs.size > 0`** (a script
  with no stateful UDF takes the legacy `emitCallValue` path with ZERO new
  walking — byte-identical). `inlineStatefulCalls(value, ctx, scope, prelude)`
  walks the value, and for a call whose bare callee resolves to a stateful UDF
  (and is not on the inline stack) it: binds each param to its arg, clones the
  body with params→args substituted (the shared `substituteParams` /
  `substituteParamsStatement` in `controlFlow.ts`), lowers each body statement in
  a CHILD `EmitContext` (the caller ctx spread + `localNames` extended with the
  param / arg-temp / body-local unique names — `emitContext.ts` needs NO change),
  pushes intermediate locals / arg temps into `prelude` (emitted BEFORE the
  consuming statement, like scalar `let`s precede drawing pushes), and splices
  the body's return expression as a pseudo `identifier-expression` (a verbatim
  lowered source string) into the call's position. `udfInline.ts` carries NO
  `other.ts` import (which would cycle) — `other.ts` injects the two lowerers
  (`emitCallValue` / `emitStatement`) as the `InlineScope.emitters` callbacks.
- **Evaluate-once arg rule: a bare identifier / literal substitutes INLINE; any
  OTHER arg (a compound expression, a member access, or — crucially — one
  CONTAINING a call) is HOISTED to a `const <tmp> = <arg>;` temp.** Pine
  evaluates each arg once; a `ta.*`/stateful-UDF arg must advance its OWN slot
  every bar even when the param is referenced zero times, which the hoist
  guarantees (and a ref-count gate would wrongly drop). Hoisting raises
  `udf-arg-hoisted` (info); each inlined call raises `udf-inlined` (info). A
  recursive UDF (already `udf-recursive-rejected`, forced `stateful: true`) is
  inlined ONCE and its self-call left bare via the inline stack guard. Body
  statement kinds handled: `assignment` / `variable-declaration` (→ a uniquely-
  named `let`, a later `:=`/compound reassignment reuses the unique) /
  `expression-statement`; any other (a bare control-flow body statement) is a
  best-effort `substituteParamsStatement` + injected `emitStatement` fallback
  (no return contribution — the result defaults to `Number.NaN`). A
  history-indexed body local IS now promoted to a `state.*Series` slot (Part B,
  see the `historyIndexedBodyLocals`/`registerSeriesSlot` note in the
  `other.ts`/`udfInline.ts` history-promotion section). KNOWN LIMITATION: a local
  DECLARED inside a nested control-flow body statement is still not uniquified.
- **A pure UDF param is emitted with a `: number` TYPE ANNOTATION
  (`emitPureUdf`, `other.ts`).** An untyped arrow param trips the compiler's
  `noImplicitAny` (TS7006), so a clean pure helper would not type-check. `number`
  is the sound annotation for the numeric helper case: every realistic pure
  helper uses its params in scalar/number positions (arithmetic, `math.*`,
  comparison), and a `PriceSeries` call-site arg (`bar.close`) is `number &
  Series<…>` (`Price = number`), assignable to `number`. The ONE pure-helper
  shape this does NOT cover is a PURE param that history-indexes itself (`f(src)
  => src - src[1]`): a pure UDF is emitted as a real arrow whose param is a
  scalar `: number`, so `number[1]` is a TS7053 error. (A STATEFUL helper whose
  param/body is history-indexed IS handled — Part A2 promotes the argument, Part
  B the body-local; only the pure-helper self-index stays a narrow documented
  gap, not a corpus fixture.)
- **UDF fixture corpus.** The UDF surface is pinned by fixtures `42`–`46`:
  `42-udf-pure-limit` (`cf_limit` — the PURE-helper round-trip: typed-param arrow
  `const`, nested `math.*` lowered to `Math.*`, CLEAN), `43-udf-stateful-slope-
  divergence` (`cf_slope(close, …)` + `cf_slope(open, …)` — the DIVERGENCE
  WITNESS: two independent inlined `ta.ema` slots, CLEAN; OHLCV args are
  natively indexable, so they are NOT slot-promoted), `45-trend-wizard-helpers`
  (the faithful clean helper cluster — `cf_dist` on derived MAs + multi-line
  `cf_atr_perct`, all stateful-inlined, CLEAN), `44-udf-recursive-rejected` (the
  `udf-recursive-rejected` error, exempt from the round-trip by the has-error
  guard), and `46-trend-wizard-slope-pending` — the real Trend Wizard
  `cf_slope(ma_1, …)` usage: a stateful helper whose body indexes a PARAM's
  history (`ma[1]`) applied to a DERIVED MA local. This NOW COMPILES — Part A2
  promotes the `ma_1`/`ma_2` arguments to `state.series` slots (it was a parked
  `KNOWN_NON_COMPILING` entry before the cross-UDF history-promotion landed).
  `74-inlined-bool-history` pins Part B (a `cf_macross`-like body-local
  `ta.crossover` read at `[1]`/`[2]` → per-call-site `state.boolSeries` slots).
- **KNOWN GAPS** (covered by the `KNOWN_NON_COMPILING` skip list in
  `fixtures-compile.test.ts`): draw-call style opts (`line.new(…,
  color=lineColor)`) are not input-aware, so an input-styled drawing leaks the
  bare name; a tuple-decl element reassigned with `:=` is not supported.
  (A `ta.*` nested in a scalar expression IS now `.current`-lowered — see the
  shared `lowerTaToCurrent` rule above; fixture `41-nested-ta-arith` converts
  AND compiles through the round-trip, so it is NOT a known gap.)
  **Pine OHLCV history `close[i]` now COMPILES** — the compute bar's `bar.close`
  is an indexable `PriceSeries`, so `bar.close[i]` (literal, or an unrolled loop
  index) type-checks; `14-polyline-rebuild` was removed from the skip list.
  **NUMERIC `var`/`varip` history now COMPILES** too — a numeric scalar that is
  history-indexed anywhere lowers to `state.series` instead of `state.float`/`int`
  (see the `state.series` lowering note below), so `var x := …; x[1]` round-trips
  (fixture `30-var-series-history`, NOT in the skip list). **`bool`/`string`
  `var` history now COMPILES** as well (T12) — a history-indexed `var bool` →
  `state.boolSeries`, `var string` → `state.stringSeries` (the non-numeric
  siblings of `state.series`; first-bar/out-of-range `[n]` ⇒ `false`/`""`),
  using the SAME value/history/`:=` split as the numeric series. Remaining gaps:
  TUPLE-element history (`macdLine[1]`, where `macdLine` is projected with
  `.current`, so `…macd.current[1]` indexes a scalar); and **`color` `var`
  history** (a `state.colorSeries` is a deferred follow-up — the converter keeps
  the scalar `state.color` slot and emits `series-history-non-numeric`, so
  `<slot>.value[n]` stays a known non-compiling form for color, never in a clean
  fixture). A persistent **`var color` SCALAR** (no `[n]`) DOES compile —
  `state.color` (T12).
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
  (an identifier init) defaults to `state.float` + a `scalar-state-type-defaulted`
  info — the converter NEVER silently guesses. Slot local REUSES the Pine scalar
  identifier; reads → `<slot>.value`, `:=` → `<slot>.value
  = …`. The `MutableSlot<T>` API is `.value` get/set (NOT the drawing-handle
  slot's `.current()`/`.set()`). A plain `=` declaration → `let x = …`; a `=`
  the semantic pass flags `declaration` → `let`, a reassignment → bare `x = …`.
- **A non-indexed `na`-init `string` scalar seeds an empty string, while `bool`
  keeps the null sentinel (`emitDeclaration`, `other.ts`).** A `var string`
  initialised to `na` that is NEVER history-indexed gets no series slot, so it
  emits `let x = "";` to match Pine's effective string-`na` runtime default and
  keep later string-typed calls (`alert(x)`) from seeing a `string | null`
  union. The adjacent `var bool x = na` case still emits
  `let x: boolean | null = null;`; that identical narrowing gap is intentionally
  left to the bool follow-up. Numeric `int`/`float` `na` declarations stay on
  the `Number.NaN` path.
- **A `var color` scalar lowers to `state.color` (`colorScalar`/`emitStateSlots`,
  T12).** A `var`/`varip` whose declared type is `color`, OR whose init is a
  color literal (`#RRGGBB(AA)`) / `color.*` palette member / `color.*(...)` call,
  is a persistent COLOR — `state.color(<init>)` (a `MutableSlot<Color>`, read/`:=`
  via `.value`). It is registered even with an `na` init (the one na-init scalar
  besides a series slot that gets a slot, not a `let`). A Pine `na` (transparent)
  color lowers to the concrete CSS string `PINE_NA_COLOR` = `"#00000000"` (fully
  transparent — the runtime synthesizes NO default) via the semantic `naKind:
  "color"` flavour (`analyze.ts` → `exprEmit.emitNa`); the na-flavour is keyed on
  a `color` TYPE ANNOTATION, so an annotation-less `var c = color.red`
  reassignment-na arm stays numeric (rare; documented). `varip color` has no
  `state.tick.color`, so it approximates to the non-tick slot +
  `varip-series-approximated`. NO `scalar-state-type-defaulted` for a color
  anymore (it is now inferred, not defaulted). Color HISTORY (`color[1]`) is
  still deferred (`state.colorSeries`) — see the non-numeric history note below.
- **A history-indexed scalar lowers to a SERIES slot keyed on its element type
  (`scanHistorySeries`/`scalarElementType`/`emitStateSlots`, `other.ts`).** A
  `var`/`varip` read with `[n]` ANYWHERE in the script (whole-body +
  expression-tree walk via the shared `forEachHistoryAccess` in `exprEmit.ts`)
  becomes a series slot: NUMERIC → `state.series(<init>)`, BOOL →
  `state.boolSeries(<init>)`, STRING → `state.stringSeries(<init>)` (T12). This
  is what makes the generated `x[n]` compile (each is an indexable `Series<T>`,
  so `x[1]` is a real history read; a scalar `<slot>.value[n]` would be a
  typecheck error). The init: numeric → the literal value / `Number.NaN` for an
  `na` init / `Number.NaN` + `scalar-state-type-defaulted` for an un-inferable
  init; bool → the literal / `false` for `na` (v6 first-bar default); string →
  the literal / `""` for `na`. An `na`-init series scalar (normally dropped from
  the scalar map) IS registered when history-indexed. A `varip` series of ANY of
  the three approximates to its NON-tick form + `varip-series-approximated`
  (`state.tick.*Series` deferred). A scalar NEVER `[n]`-indexed keeps its leaner
  scalar slot (`state.bool`/`state.string`/…). VALUE reads go through
  `rewriteIdentifier` → `<slot>.value`; HISTORY reads through
  `EmitContext.seriesSlots` → the BARE slot local (`<slot>[n]`); writes (`:=`)
  stay `<slot>.value = …` — the SAME machinery for all three types (bool/string
  series are NOT number-coercible, but this path never emits `+s`). A still-
  UNSUPPORTED non-numeric history (`color` — `state.colorSeries` is deferred)
  keeps its scalar `state.color` lowering and emits `series-history-non-numeric`
  (info) — its `[n]` is a known gap, never in a clean fixture. (This diagnostic
  is RETIRED for `bool`/`string`, which now lower to a real series.) A
  non-literal series-slot offset (`x[i]`/`x[-i]`) on a numeric/bool/string series
  wires the (pre-existing, error-severity) `dynamic-series-index` — EXCEPT a
  `[i]` whose offset is the bare identifier of an enclosing `for` iterator
  (`isLoopBoundOffset`), which is a legal runtime history read on an indexable
  `Series`/`state.series` receiver and is NOT flagged. `walkHistoryAccesses`
  threads the in-scope loop-iterator names so the classifier can tell a
  loop-bound `[i]` from a free `[i]`/`[j]`.
- **An `=`-declared, history-indexed `ta.*` series is PROMOTED to a
  `state.series` slot too (`isTaSeriesDeclaration`/`emitTaSeriesSlots`,
  `other.ts`).** A non-`var` `ma = ta.ema(...)` read as `ma[i]` cannot stay the
  `.current` scalar (`number[i]` is a type error) — and a bare `Series<number>`
  is not number-coercible, so its many scalar uses (`ma >= 0`, `plot(ma)`) break
  if `.current` is dropped. So the converter promotes it to the SAME
  `state.series` slot the `var`-history path uses: `const ma = state.series(NaN)`
  (init NaN; the value is computed each bar), the declaring assignment lowers via
  `emitAssignment`'s slot branch to `ma.value = ta.<…>(...).current` (the per-bar
  write — `emitTa` still appends `.current`), bare reads → `ma.value`, `ma[i]` →
  a real indexed read. The detection gate (`isTaSeriesDeclaration`): an `=`
  assignment (which the semantic `=` arm already characterises as a declaration —
  no annotation re-check) whose value is DIRECTLY a `ta.*` call, AND that is
  history-indexed ANYWHERE (the `scan.taSeries` gate). A ta-series NEVER
  `[n]`-indexed keeps its `.current` scalar lowering (no regression to the
  existing `.current` fixtures/goldens). The slot local + `seriesNames` entry are
  allocated into the SAME `slots`/`seriesNames` maps as the `var` series (the
  emit machinery is reused wholesale — only the detection + the NaN-init slot
  emission are new). v1 is NUMERIC `state.series<number>` only (ta returns a
  number); non-numeric `state.series<bool>`/`<color>` stays T12's surface. This
  is what lets MASM's `for i … ma_slope[i]` consolidation loop convert to a
  COMPILING runtime `for` (the T10 §5 crux) instead of an impossible unroll.
- **Part A — non-`ta.*` series locals + cross-UDF arguments are ALSO promoted to
  a numeric `state.series` slot (`scanPromotedSeries`, `other.ts`).** A receiver
  that `inferQualifier` calls `series` (joining through UDF calls) but which
  `isTaSeriesDeclaration` rejects still needs a slot when it is `[n]`-indexed —
  otherwise the emitted `x[1]` indexes the `.current` SCALAR (TS7053, the Trend
  Wizard 31-error cluster). Two shapes feed `promotedSeries` (numeric
  `state.series(Number.NaN)`, same read/write rewrites as the direct-`ta.*`
  path): **A1** a top-level `=`-decl whose VALUE is series-qualified AND
  history-indexed at the top level but is NOT directly a `ta.*` call (a UDF-call
  RHS `ma_1_slope = cf_slope(…)`, a ternary `ma_slope_comp = … ? ta.sma :
  ta.ema`) — the history-indexed gate keeps a non-indexed series local (fixture
  43's `close_slope`) a plain `let`; **A2** a SIMPLE-IDENTIFIER argument passed
  to a STATEFUL UDF whose body history-indexes the matching parameter
  (`statefulUdfParamHistory`: `cf_slope(ma, n) => …ma[1]…` → promote the
  `cf_slope(ma_1, …)`/`cf_slope(rsi_ma, …)` args), since the post-inline
  `ma_1[1]` would index a `number`. A2 only promotes args that name a
  USER-DECLARED series local (`rootScope.symbols.has` + `qualifier === "series"`),
  so an OHLCV arg (`cf_slope(close, …)`, fixture 43) — already an indexable
  `PriceSeries` — is left untouched. `forEachCall` finds the call through the
  scalar-expression containers (direct / binary / unary / ternary / paren) a
  promoting call realistically nests in; other containers are a documented
  best-effort gap (a missed promotion surfaces as a normal compile error, never
  a silent value).
- **Part B — a history-indexed INLINED body-local is slot-backed
  (`udfInline.ts`).** `cf_macross`'s body-local `ma_cross = ta.crossover(MA1,
  MA2)` read at `ma_cross[1]`/`[2]` cannot stay a `let` (the `[n]` would index a
  `boolean`). `historyIndexedBodyLocals` detects it; each inline expansion backs
  it with its OWN `state.*Series` slot (element type from the initializer via
  `seriesSlotInit`: `ta.cross`/`crossover`/`crossunder` → `state.boolSeries(false)`,
  else `state.series(Number.NaN)`) registered through the new
  `InlineScope.registerSeriesSlot` callback (which `other.ts` wires to
  `appendStateSlot`). The slot is registered + bound BEFORE its init is lowered
  so a self-referential history (`x = nz(x[1]) + a`) resolves its own `[n]` to
  the fresh slot; the write emits `<slot>.value = …`, bare reads `<slot>.value`,
  `[n]` reads the bare slot, and a `:=` reassignment writes `<slot>.value` too.
  Each call site mints an INDEPENDENT slot (the per-call-site instancing the
  inliner already gives `ta.*`) — `cf_macross` called 4× → 4 boolSeries slots
  (fixture `74-inlined-bool-history`). NO core/runtime change: `state.boolSeries`
  / `state.series` already expose a writable `.value` head + indexable `[n]`.
- **A bounded numeric `var array<float|int>` lowers to `state.array`
  (`numericArray.ts` + `emitArraySlots`/`emitContext.ts`).** A NUMERIC Camp B
  ring — `var`/`varip array<float|int>` whose initializer is `array.new(...)`,
  with a FIFO eviction signature — now lowers to `const <name> =
  state.array<number>(K)`, the numeric analogue of the drawing-handle Camp B
  ring (`campB.ts`). The detection is the `array.new(...)` initializer (the
  load-bearing discriminator: the parser collapses `array<float>` to a `float`
  annotation, so the SCALAR pipeline would otherwise mis-lower
  `var array<float> win = array.new()` to `state.float(array.new())` — adding
  the array names to `owned` is what stops that). The element type is read from
  the `var array<T>` annotation (`int`/`float` → numeric; `bool`/`string`/`color`
  → non-numeric; a null annotation defaults to numeric). The cap `K` comes from
  the eviction-guard literal (`if array.size(coll) >|>= K` whose body BARE-shifts
  `array.shift(coll)` / `array.remove(coll, …)` — a numeric ring has NO handle to
  `*.delete`) or the `array.new<float>(K)` literal size arg (guard wins). Only
  ROOT-level decls are scanned (a nested-only decl is not a top-level `var`); a
  handle ring (`var array<line>`) is an OWNED drawing site, filtered out before
  the numeric scan, so the two paths never collide. Operations rewrite onto the
  slot via `EmitContext.arraySlots` (`array.push(coll, v)` → `<slot>.push(v)`,
  `array.get(coll, n)` → `<slot>.get(<slot>.size - 1 - (n))`, `array.size` →
  `<slot>.size`, `array.last` → `<slot>.last()`, `array.first` →
  `<slot>.get(<slot>.size - 1)`, `array.clear` → `<slot>.clear()`; an
  unrecognised `array.*` member over a slot falls through to a raw emit). **The
  `array.get` index is INVERTED** because Pine `array.get` indexes from the
  oldest (index 0 = first pushed, evicted by `array.shift`) while chartlang
  `state.array.get(n)` is newest-first (`n = 0` newest); `array.last`/
  `array.first` likewise map to newest/oldest so all three reads target the
  same element Pine would. The eviction `if` is elided (the ring rotates
  modulo K) + one `ring-eviction-implicit` info. A NON-numeric collection emits
  `array-collection-non-numeric` (info); an unbounded (no-cap, or `K <= 0`)
  numeric array hard-rejects `unbounded-array-collection` (error) — chartlang has
  no unbounded collection. **A `for i = 0 to array.size(coll)` summation does NOT
  lower** — chartlang's compiler requires LITERAL `for` bounds
  (`unbounded-loop`), and a literal-`K` bound would NaN-poison the unfilled tail,
  so the converter leaves the loop to the existing `loop-bounds-not-literal`
  reject. Fixture `31-var-array-window` (push + `last`/`get`/`size` reads, NOT in
  the skip list) is the round-trip proof. `state.map`, matrices, and non-numeric
  collections stay documented gaps.
- **Loop policy (`emitFor`, §1a) is stateful/non-stateful split, NOT
  unroll-always.** A body that calls a stateful primitive (`plot`/`hline`/
  `alert`/`ta.*`/`draw.*`, detected recursively through nested `if`/`for`/
  `switch`/`block` via `expressionHasStatefulPrimitive` + `bodyHasStateful`
  `Primitive`) MUST unroll (the compiler rejects a stateful call in any loop):
  each iteration renders with `substituteIterator` substituting the concrete
  index. A bound resolves to a compile-time int from a literal/unary-literal OR
  an `input.int` default (`resolveBound` + the `inputIntMetadata` re-walk).
  Stateful loops still unroll at the resolved input default and raise
  `loop-unroll-frozen-at-input-default` (the count is frozen at the default).
  A non-stateful body with a TRUE literal bound emits a runtime `for`; a
  non-stateful `for i = <literal> to <input.int>` with a literal `by` emits a
  runtime `for` over `(inputs.<name> as number)` so the iteration count follows
  the input. If that input has no `maxval`, emit
  `loop-bound-input-unbounded` so the compiler's 5000-slot dynamic lookback
  fallback is explicit. **The input-bound runtime loop is ASCENDING-ONLY:** it
  emits only an `i <= inputs.<name>; i++` header, so it is taken only when the
  literal from-bound is `<=` the input DEFAULT. When `from.value >
  to.value(default)` Pine would auto-count DOWN, and a runtime ascending loop
  can't express that, so `emitInputBoundLoop` returns `null` and the loop falls
  back to the frozen unroll-at-default path (`loop-unroll-frozen-at-input-
  default`), which renders the real direction via the from-vs-to relation rather
  than emitting a permanently-false loop that silently runs zero iterations. **Pine auto-counts DOWN when `from > to`; the `by`
  value contributes only its MAGNITUDE (direction is the from-vs-to relation).**
  An ascending loop emits `for (let i = a; i <= b; i++ | i += mag)`; a
  descending loop emits `for (let i = a; i >= b; i-- | i += -mag)`. The unroll
  path mirrors this (ascending: `i <= to`; descending: `i >= to`; `stepDelta =
  ±|by|`), so a descending or `by`-stepped loop runs its real iteration set
  rather than zero. `step === 0` (or a non-literal `by`) is non-resolvable. A
  non-stateful body with any other non-literal bound rejects
  `loop-bounds-not-literal-for-stateful-body`. A stateful body with a
  non-resolvable bound rejects the same. The SAME direction+magnitude unroll
  rule is mirrored in `tables.ts`'s `unrollLoop` (a non-literal/zero `by` →
  `table-dynamic-loop`) and `polylineLinefill.ts`'s `unrollBuildLoop` (a
  non-literal/zero `by` → `polyline-dynamic-points` reject). `substituteIterator` is the SHARED
  iterator-unroll helper (exported from `src/transform/index.ts`); `tables.ts`
  and `polylineLinefill.ts` import it from here rather than re-implementing it.
- **`break`/`continue` OVERRIDE the unroll heuristic — a loop whose body
  contains a `break`/`continue` is ALWAYS a runtime `for`, never unrolled.** A
  `break` cannot span unrolled iterations, so the presence of `break`/`continue`
  (detected by `bodyHasBreakContinue`/`statementHasBreakContinue` in
  `controlFlow.ts`, a SEPARATE signal from the stateful walk, mirroring its
  nested-`if`/`for`/`switch`/`block` shape) forces the runtime-`for` path —
  `emitRuntimeForFromBounds` emits the loop from the RESOLVED bounds (literal OR
  frozen `input.int` default; the latter still raises
  `loop-unroll-frozen-at-input-default`, the count being frozen even though this
  is a real `for`). The two signals are opposites: stateful forces unroll,
  `break`/`continue` forces runtime, so a body that is BOTH stateful AND has a
  `break`/`continue` is unconvertible → `stateful-loop-with-break` (error). A
  non-resolvable break-loop bound rejects `loop-bounds-not-literal-for-stateful-body`
  (reused, not a new code). The runtime-`for` child context carries
  `inLoop: true` (`loopChildContext`), which is how `emitStatement` decides a
  `break`/`continue` lowers to a JS jump; a `break`/`continue` reached with
  `inLoop` falsy (top level, or any block not nested in a loop) raises
  `break-continue-outside-loop` (error) and emits nothing rather than a stray,
  illegal `break;` (`emitLoopJump`).
- **Compound assignment (`+=`/`-=`/`*=`/`/=`) is parsed end-to-end and lowers
  to a read-modify-write, NEVER a declaration.** The lexer emits each as ONE
  two-char operator token (longest-match, ahead of `+`/`-`/`*`/`/` + `=`); the
  AST `AssignmentOperator` carries them; `parseAssignment` accepts them
  (`isAssignmentOperator`); the semantic analyzer treats them as reassignments
  (its non-`=` branch), so a compound assign to an unbound name is
  `unknown-identifier`. `emitAssignment` passes the operator through:
  `=`/`:=` → `=`; a compound op stays itself, onto a `state.*` scalar slot's
  `<slot>.value <op> <rhs>` or a plain local `<name> <op> <rhs>`.
  `substituteIterator`/`substituteStatement` pass a compound-assign statement
  through unchanged in the unroll path (the `assignment` arm preserves
  `operator`).
- **`switch` lowering.** A subjected `switch x` → `switch (x) { case <t>: {…}
  break; … default: {…} break; }`; a subjectless `switch` (boolean-case form) →
  an `if`/`else if`/`else` chain (a lone default renders unconditionally). **An
  arm body is a statement LIST** (`SwitchCase.body: readonly Statement[]`), and
  both `emitSwitch`/`emitSubjectlessSwitch` (`controlFlow.ts`) render
  `emitBody(arm.body).join(" ")` — so a comma multi-assignment arm
  (`"X" => a := 8, b := 21`) emits EACH element in source order (here `a = 8;
  b = 21;`, or `<slot>.value = …` per element when the target is a `var`→state
  slot) before the trailing `break;`. No special multi-element path — the same
  per-statement dispatch the single-element arm uses. The
  plot family (`plotFamily.ts`), `str.*` surface (`strFormat.ts`),
  `request.security` MTF (`requestSecurity.ts`), and strategy signals
  (`strategySignals.ts`) are per-construct emitters returning a string or a warn
  result; color args route through `enumLookup` (`color.red`→`"#FF5252"`).
  `request.security({ interval }).<field>` returns a `Series` — a downstream
  scalar context inserts `.current` + `mtf-series-to-scalar-conversion`. A bare
  `alert(message, freq?)` is lowered by `emitAlertCall` (`alertCall.ts`), wired
  into `emitExpressionStatementCore` AFTER `emitStrategySignal` and BEFORE the
  generic emitter (which would otherwise leak the Pine 2nd arg verbatim). The
  message emits through `emitWithContext` (string concat preserved); the
  enclosing `if` is PRESERVED, never hoisted (chartlang `alert` is imperative,
  like Pine). chartlang's `AlertOpts` has no frequency contract, so the
  `alert.freq_*` 2nd arg is DROPPED with an `alert-frequency-not-mapped` (info);
  the three freq enums are recognised via `ENUM_VALUE_MAP.has` (REJECT rows, the
  `linefill.new` precedent — NOT `enumLookup`, which collapses a REJECT to
  null), never a private set. An unrecognised 2nd arg (a freq held in a
  variable) is still dropped (message-only emit) but without the info; an
  `alert()` with no positional message returns `null` (generic fallback).
  Adding `frequency` to core `AlertOpts` is a deferred follow-up. Fixture
  `57-alert-message-freq` pins the lowering (two dropped freqs + a bare
  `alert(message)`); MASM-style `var string alert_msg = na` now has its own
  focused fixture (`82-na-string-default`) and is not part of alert-frequency
  lowering. `fill`
  over two `hline`/`plot` handles lowers to `draw.fillBetween` (see the
  `emitFillBetweenBand`/`emitFill` invariants above); only an unresolved handle
  (`fill-handle-unresolved`) or a gradient/`fillgaps` form (narrowed
  `fill-not-mapped`) rejects. `math.random`/`math.round_to_mintick`/`ta.kcw` →
  `math-not-mapped`/`ta-not-mapped` warn + `/* TODO unmapped */`.
- **`emitStr` (`strFormat.ts`) lowers the FULL Pine v6 `str.*` surface to
  NATIVE JS** — the same native-where-native-exists shape as bare `Math.*` (NO
  `str` import/destructure is added to the generated output; the `str` namespace
  is for hand-authored chartlang). The `switch (member)` maps: `tostring` →
  `String(x)` / `(x).toFixed(n)` (a `"#.##"` precision mask via `parsePineFormat`,
  else `str-format-not-mapped`); `format` → a synthesised template literal (bare
  `{n}` slots, a styled `{n,number}` / out-of-range / unterminated placeholder →
  `str-format-not-mapped`); `length` → `.length`; `upper`/`lower` →
  `.toUpperCase()`/`.toLowerCase()`; `contains` → `.includes(t)`;
  `startswith`/`endswith` → `.startsWith(t)`/`.endsWith(t)`; `pos` →
  `.indexOf(t)` (Pine `na`-on-absent diverges to JS `-1`, acceptable v1);
  `split` → `.split(sep)`; `substring` → `.substring(b[, e])` (2-or-3-arg,
  both 0-based); `trim` → `.trim()`; `repeat` → `.repeat(n)`; `replace_all` →
  `.replaceAll(t, r)`; `replace` → `.replace(t, r)`; `tonumber` → `Number(s)`
  (`NaN` ≈ `na`). **Guards / rejects (all reuse `str-not-mapped`, NO new
  codes):** `repeat` with a non-empty / non-literal separator (JS has no
  one-expression repeat-with-separator; only a `""` empty-string-literal
  separator maps); `replace` with a non-zero / non-literal occurrence (JS
  string-target `.replace` is occurrence-`0` only — the literal-`0` / unary
  `+0`/`-0` case is detected by the per-file `literalZero` predicate, mirroring
  `plotFamily.ts`'s private `isLiteralZero` plus a unary unwrap); `match`
  (regex) and `format_time` (host-time, no native one-liner) fall through to
  the `default` arm; and a too-few-args call to any member. The `unary` /
  `binary` / `ternary` / custom `emitSubstring` / `emitRepeat` / `emitReplace`
  helpers all return `str-not-mapped` on a missing required arg.
- **A `request.security` READ is `.current`-PROJECTED — the result is a
  `Series<number>` and scalar use needs the scalar head.** Both shared builders
  append `.current`: `securityDataRead` → `request.security(<opts>).<field>.current`,
  `securityCallbackRead` → `request.security(<opts>, (bar) => <body>).current`, and
  `securityCallbackReadBlock` → `request.security(<opts>, (bar) => { … return …;
  }).current`. INSIDE the callback `bar` is the `SecurityBar` whose OHLCV fields
  are series-only `Series<Price>` (NOT the number-coercible main `bar`), so an
  OHLCV read in callback scalar arithmetic is ALSO `.current`-projected
  (`bar.close` → `bar.close.current`) — `EmitContext.securityExpr` gates this in
  `rewriteTree`. The block form is reached when a STATEFUL UDF in the source
  inlines into a prelude (`emitSecuritySourceCallback`, `other.ts`): a
  multi-statement inline → block-bodied arrow; a prelude-free source (a direct
  `ta.*`, a single-expr UDF) stays the expression arrow even when the script has
  a stateful UDF. The single-source AND tuple paths share these builders, so a
  scalar bound read (`hi.current`) is byte-consistent across both.
- **`request.security`'s THIRD arg decides the chartlang FORM; the FIRST arg
  decides the SYMBOL (`requestSecurity.ts`).** A bare OHLCV source field lowers
  to the **data** form `request.security(<opts>).<field>.current`; ANY other
  source (a `ta.*`/expression) lowers to the **callback** form
  `request.security(<opts>, (bar) => <source>).current` — the HTF expression form
  that runs on the higher-timeframe clock the way Pine does. The callback body is
  `emitWithContext(source, ctx)` verbatim (the shared field mapper already
  rewrites the source's `close`/`hl2`/… reads to `bar.close`/`bar.hl2`/…). Do
  NOT re-introduce the old `request.security({ interval }).<emitted-source>`
  main-timeframe shape — it counted the `ta.*` window in main bars, the root
  bug. The `<opts>` symbol/interval slots are resolved by the SHARED
  `resolveSecurityFeed`, threaded the script's `SecurityFeedInputs` (built once
  by `collectSecurityFeedInputs` and carried on `EmitContext.securityFeedInputs`;
  the tuple path shares it via the semantic walk). `feed.symbol`/`feed.interval`
  are chartlang EMIT-SOURCE STRINGS (a quoted literal or an `inputs.<name>`
  ref), spliced verbatim by `securityOpts`. SYMBOL: `syminfo.tickerid` →
  omit `symbol` (`{ interval }`, byte-identical to the single-symbol output); a
  **string literal** (`"NASDAQ:AAPL"`) or literal-only `+` concat
  (`"ESD:" + "AAPL"`) → `{ symbol: "...", interval }`; an **identifier bound to
  an `input.symbol` or `input.string`** → `{ symbol: inputs.<name> as string,
  interval }` (the cast: `compute`'s `inputs` is `Record<string, unknown>`, so an
  un-cast read fails the `RequestSecurityOpts` typecheck — the compiler's feed
  extractor unwraps the `as`/parens to resolve the default). A present
  (cross-symbol) feed pushes an **info** `request-security-different-symbol`. The
  INTERVAL slot resolves the same three ways (literal tf / empty `""` chart
  timeframe / `input.timeframe`-bound `inputs.<name> as string`). A `gaps=` named
  arg pushes the **info** `request-security-gaps-dropped` once per script
  (`pushCodeOnce`; chartlang feeds are gap-filled by default).
  `request-security-not-mapped` is reserved for the
  genuinely-unsupported shapes (a computed / wrong-axis symbol or interval, an
  out-of-table timeframe, missing args); an in-subset `ta.*` source and a
  literal/input-bound symbol+interval are supported.
- **A `request.security` expression callback HOISTS the bar-invariant top-level
  bindings its body captures, so the higher-timeframe closure resolves them to
  callback-LOCALS instead of capturing a main-timeline binding (which the
  compiler's `validateSecurityExpr` rejects as
  `request-security-expr-captures-local`).** `collectCaptureHoist`
  (`transform/securityCapture.ts`) walks the callback body's free identifier
  reads, and for each that resolves to a top-level symbol (excluding inputs, the
  `bar` param, `BUILTIN_IDENTIFIER_MAP` / namespace roots, and `ctx.localNames`)
  it finds the binding's defining statement(s) — a `variable-declaration`, an
  `assignment`, or a `switch` whose arms assign it — and, when EVERY defining RHS
  is bar-INVARIANT (`inferQualifier(...) !== "series"`, the same resolver
  `scanPromotedSeries` uses) AND the binding is a PLAIN local (not a
  `ctx.stateSlots` / `ctx.seriesSlots` slot), re-emits a copy of those statements
  (transitively, in source order) as a callback-local prelude. The re-emit reuses
  `emitStatement` with a `securityExpr` child context + a FRESH throwaway
  `DiagnosticCollector` (so a hoisted statement never double-reports), and the
  hoisted names are unioned into the body emit's `localNames`. `emitSecurity
  SourceCallback` prepends the hoist prelude BEFORE the stateful-UDF inline
  prelude (arg temps may read a hoisted binding) and uses the BLOCK callback form
  whenever the combined prelude is non-empty. A captured binding that is
  bar-VARYING (depends on series / `ta.*` / OHLCV) or slot-backed is NOT
  hoistable and pushes the append-only **error** `request-security-expr-captures-
  series` (one per un-hoistable name) — an actionable converter diagnostic in
  place of the downstream compiler `captures-local`. Both the single-source
  (`emitRequestSecurity`'s optional `callbackEmit`, threaded from the
  `emitSpecialCall` call site that holds the `Walk`) and tuple paths route their
  expression callbacks through `emitSecuritySourceCallback`, so both hoist. The
  numeric `na` sentinel emits as the bare `NaN` (a `validateSecurityExpr`-safe
  value global) NOT `Number.NaN` inside a `securityExpr` context — `rewriteTree`'s
  `na-expression` arm remaps it (the validator allows `NaN`/`Math` but rejects
  `Number` as a captured outer binding). **Limitation:** a SINGLE-source read
  whose source is a STATEFUL USER-DEFINED FUNCTION (`request.security(sym, tf,
  cf(len))`, `cf` stateful) is pre-inlined by `emitAssignment` into a baked
  verbatim-source identifier BEFORE `emitSecuritySourceCallback` sees it, so its
  captures are invisible to the hoist (the binding leaks); the TUPLE form of the
  same source (Trend Wizard's shape) passes the real AST and hoists. A bare
  builtin `ta.*` single-source (`ta.atr(len)`) is not a UDF and hoists fine.
- **`hline` threads a `linestyle=hline.style_*` enum onto the `lineStyle` opt,
  and an ASSIGNED hline reuses the same lowering (`plotFamily.ts`).** The
  `hline.style_solid|dotted|dashed` rows live in `mapping/enums.ts`; `emitHline`
  reads `enumArg(args, "linestyle")` and appends `["lineStyle", JSON.stringify(
  style)]` only when present (a styleless hline omits the key). An assigned hline
  (`guide = hline(...)`) routes through `emitHlineValue` in `emitCallValue`
  (`other.ts`) so it lowers to the SAME `hline(price, { … })` as the statement
  form (not the verbatim emitter, which would leak the Pine positional
  title/color/linestyle args). A 2-arg `color.new` / 4-arg `color.rgb` reaching
  `emitCallValue` in a VALUE position (a UDF return, a plain assignment) folds to
  a `#RRGGBBAA` hex / `color.withAlpha(...)` via `isTranspColorForm` +
  `convertColorWith` — chartlang has no `color.new`, so the verbatim form would
  not type-check. A `draw.curve`/table-cell `as const` tuple is the established
  literal-tuple gate (`tables.ts`, `polylineLinefill.ts`).
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
- **Pine `plot(<value>, display=<v>)` lowers onto the `{ visible }` plot opt
  (`plotFamily.ts` `displayOption`/`displayMemberKind` → `emitPlot`).** The
  `display` named arg threads as a `["visible", …]` pair appended AFTER the
  shared title/color/lineWidth pairs (the common pairs are extracted into
  `commonOptionPairs`; `commonOptions`/`emitHline` still render them alone — only
  `plot` gets `visible`). Mapping (routed through the `src/mapping/enums.ts`
  `DISPLAY_MAP`/`displayLookup` table, NOT an inline compare): `<cond> ?
  display.all : display.none` → `visible: <emit(cond)>`; the inverted `<cond> ?
  display.none : display.all` → `visible: !(<emit(cond)>)`; a bare `display.none`
  → `visible: false`; a bare `display.all` → OMIT the key (byte-clean — the
  runtime treats omitted and `visible: true` identically, and the task mandates
  omit, never `visible: true`). Any OTHER `display.*` target (the `DISPLAY_MAP`
  REJECT rows `status_line`/`price_scale`/`pane`/`data_window`, an unknown
  member, a non-all/none ternary pair, or a non-`display.*` value) → the
  append-only `plot-display-approximated` (warning) + OMIT the key (plot left
  visible). `displayLookup` returns ONLY the `all`/`none` entries, so
  `displayMemberKind`'s `=== "all" ? "all" : "none"` fully partitions a non-null
  lookup (no dead arm). `display=` is NEVER silently dropped.
- **`bgcolor`/`barcolor` lower to the chartlang Pine-ergonomic SUGAR
  (`plotFamily.ts` `emitBackground`), NOT `plot(NaN, { style })`.** Since
  Deliverable 2 of the `bgcolor`/`barcolor` ergonomics feature, `emitBackground`
  emits `bgcolor(<color>)` / `barcolor(<color>)` carrying the REAL per-bar color
  expression — including a per-bar conditional (`close > open ? color.green :
  color.red`), so the dynamic-color semantics survive (the runtime routes it
  through `PlotEmission.colorValue`). `styleValue` resolves `color.*` enum leaves
  recursively through paren/ternary nodes (so each branch of a conditional color
  becomes a hex literal while the condition flows through the normal emitter).
  bgcolor's `transp` (named or `pos[1]`) and both aliases' named `title` thread
  onto the `{ … }` opts bag; a bare call with no color is a no-op → `null`. The
  emitted aliases drive the codegen `usage`/`import`/destructure flags
  (`codegen/usage.ts` `bgcolor`/`barcolor`), so the generated script imports +
  destructures `bgcolor`/`barcolor` exactly like `plot`. Before Deliverable 2 the
  emit was a static `plot(NaN, { style: { kind, color } })`, which LOST the
  per-bar color — do not revert to that shape.
- **New codes (APPENDED to `diagnostics/codes.ts`, no reorder):**
  `plot-offset-needs-ta-call`, `plot-offset-overrides-ta-offset` (warnings),
  `ta-signature-divergence`, `ta-not-mapped`, `math-not-mapped`,
  `str-format-not-mapped`, `str-not-mapped` (warnings), `fill-not-mapped`,
  `request-security-not-mapped`, `dynamic-series-index`,
  `loop-bounds-not-literal-for-stateful-body` (errors),
  `request-security-lookahead-not-supported` (warning),
  `request-security-gaps-dropped` (info — the `gaps=` arg has no chartlang
  analogue; feeds are gap-filled by default; consolidated to once per script
  via `pushCodeOnce`),
  `request-security-different-symbol` (info — repurposed from a warning when
  multi-symbol landed; the CODE STRING is unchanged, only the severity/message
  are: a literal cross-symbol read now LOWERS to `{ symbol, interval }` rather
  than being rejected),
  `strategy-signal-only`, `loop-body-unrolled`,
  `mtf-series-to-scalar-conversion`, `loop-unroll-frozen-at-input-default`,
  `scalar-state-type-defaulted`, `series-history-non-numeric`,
  `varip-series-approximated` (infos — the last two added by the
  `state.series` `var`-history lowering; `dynamic-series-index` was registered
  here earlier and is now WIRED),
  `request-security-expr-captures-series` (error — a `request.security`
  expression callback captures a bar-VARYING outer binding that cannot be
  reconstructed inside the higher-timeframe closure; a bar-invariant capture is
  hoisted silently, no diagnostic). Re-exports APPENDED to `src/transform/
  index.ts` (incl. `forEachHistoryAccess` from `exprEmit.ts`).
- **Coverage.** `other.ts`/`controlFlow.ts`/`emitContext.ts`/`statefulNames.ts`/
  `securityCapture.ts`/
  `strFormat.ts`/`plotFamily.ts`/`requestSecurity.ts`/`strategySignals.ts`/
  `alertCall.ts` hold 100% line/branch/function. Parser-unreachable arms (a top-level
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
- **`math`/`color` are IMPORT-only; `syminfo` is DESTRUCTURE-only** in
  `UsageFlags` — they are NOT symmetric. `math` AND `color` are module-scope
  frozen namespaces (like `str`), so each pushes to `emitImports.ts` ONLY and is
  NEVER added to the `emitCompute.ts` destructure (`color` is NOT a
  `ComputeContext` field — verified in `core/src/types.ts`); `syminfo` is a
  `ComputeContext` view, so it pushes to the `emitCompute.ts` destructure ONLY
  and is NEVER imported. All three are substring-scanned (`math.` / `color.` /
  `syminfo.`) over the corpus, mirroring `time.`/`session.`; the `math.` scan is
  case-sensitive so bare `Math.abs` (capital `M`, the no-rewrap passthrough)
  never false-positives. The injected `syminfo.mintick` step on
  `math.roundToMintick(x, syminfo.mintick)` is what pulls BOTH `math`/`syminfo`
  in at once. **`color` rides in whenever a `color.*` member SURVIVES colour
  lowering** — `color.withAlpha(...)` (dynamic base/transp), a dynamic 3-arg
  `color.rgb(...)` passthrough, or a bare palette member (`color.green`) emitted
  verbatim in a plain assignment. An all-literal colour folds to a quoted
  `#RRGGBB` / `#RRGGBBAA` string with no `color.` token, so a hex-only script
  imports no `color` (byte-compat — no spurious import).
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
