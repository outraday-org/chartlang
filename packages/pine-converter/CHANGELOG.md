# @invinite-org/chartlang-pine-converter

## 0.7.0

### Minor Changes

- f92d131: Allow non-stateful Pine loops bounded by `input.int` to emit runtime loops, and size compiler history lookback from the input `max`.
- f92d131: Accept Pine v5 scripts through the existing converter subset with a downlevel warning instead of hard-rejecting the version directive.
- f92d131: Support `time[n]` history. The scalar series builtin `time` (which remaps to a
  non-indexable `bar.time`) is backed by a synthesized `state.series` slot fed
  `bar.time` each bar, so `time[1]` indexes the slot. A bare `time` read still
  lowers to `bar.time`.
- f92d131: Back a history-indexed boolean local with `state.boolSeries` instead of the
  numeric `state.series`. A promoted `=`-decl / direct-`ta.cross*` series whose
  value is boolean (a comparison, `and`/`or`/`not`, or a boolean ternary) now
  chooses its slot element type, so the per-bar `<slot>.value = <boolean>` write
  and `<slot>[n]` reads type-check.
- f92d131: Fold compile-time Pine color expressions in `input.color` defaults.
- f92d131: Resolve a bare `na` in a color-valued expression to the transparent color
  (`#00000000`) even without a `color` type annotation — e.g. an untyped
  `c = cond ? color.green : na`. Previously the `na` arm defaulted to
  `Number.NaN`, poisoning the value's type to `string | number`.
- f92d131: Lower Pine `color.new` and `color.rgb` calls when they appear in free expressions.
- f92d131: Rename a Pine variable whose name collides with a `compute(ctx)` host param
  (`bgcolor = …` shadowing the `bgcolor(...)` builtin). The variable's
  declaration and every reference take a fresh host-avoiding local (`bgcolor2`)
  while the host call site keeps `bgcolor`, fixing the emitted duplicate
  identifier. The canonical host-param list is synced with the `compute`
  destructure.
- f92d131: History-promote a top-level `=`-declared local whose value is rooted in a bare
  OHLCV builtin (`chg = (close - close[1]) / close[1] * 100` then `chg[1]`). The
  A1 promotion resolver now applies the `BUILTIN_SYMBOLS` fallback, so such a
  series-qualified, history-indexed local lowers to an indexable `state.series`
  slot instead of a plain `let` (which made `chg[1]` index a `number`).
- f92d131: Emit a safe `Number.NaN` placeholder for a rejected `request.security` (an
  out-of-subset symbol/timeframe) instead of the verbatim broken call, so the
  rest of the emitted file still type-checks; the `request-security-not-mapped`
  error still flags the feed. `request.security` is now series-qualified, so a
  history-indexed rejected feed is slot-backed.
- f92d131: Support `input.string` and literal-concatenated symbols in `request.security`.
- f92d131: Lower a source input (`input.source` / bare `input(defval=close)`) as the
  chosen bar series. A reference now emits `bar[inputs.<name> as SourceField]` —
  an indexable, number-coercible `PriceSeries` — instead of a `(inputs.<name> as
number)` cast, so `src[1]` history reads and `ta.*(src, …)` source args work.
- f92d131: Map Pine `syminfo.prefix` (the chart symbol's exchange prefix) to chartlang's
  `syminfo.exchange`, the matching `SymInfoView` field.
- f92d131: Map Pine's numeric-first `timestamp(...)` builtin to chartlang `time.timestamp(...)`.
- f92d131: Expose host-injected wall-clock time through `time.now()` and map Pine `timenow` to it.

### Patch Changes

- f92d131: Lower string-typed Pine `na` declarations to an empty-string default so downstream string calls compile.

## 0.6.0

### Minor Changes

- d542f99: Preserve Pine input metadata fields during conversion.
- d542f99: Support native Pine `input.enum(EnumType.member, ...)` lowering with enum-member expression rewriting, and replace the old `input-enum-rejected` diagnostic with `input-enum-default-not-member` for malformed enum defaults.

### Patch Changes

- d542f99: Parse native Pine enum declarations and register enum type symbols for converter semantic analysis.

## 0.5.0

### Minor Changes

- c44c0d5: Back history-indexed series-in-Pine receivers with indexable `state.*Series`
  slots so they compile, instead of emitting `x[1]` on a `.current` scalar
  (the Trend Wizard `cf_slope`/`cf_macross` cluster — 31 TS7053 errors → 0).

  Two converter-only promotions:

  - **Cross-UDF / non-`ta.*` series locals (Part A).** A top-level `=`-decl
    whose value is series-qualified and `[n]`-indexed but is not directly a
    `ta.*` call (`ma_1_slope = cf_slope(…)`, `ma_slope_comp = … ? ta.sma :
ta.ema`), and a simple-identifier argument passed to a stateful UDF whose
    body history-indexes the matching parameter (`cf_slope(ma_1, …)` → promote
    `ma_1`), now lower to a numeric `state.series` slot. An OHLCV argument
    (already an indexable `PriceSeries`) is left untouched.
  - **History-indexed inlined body-locals (Part B).** A stateful UDF body-local
    read at `[n]` (`cf_macross`'s `ma_cross = ta.crossover(…)` read at
    `ma_cross[1]`/`[2]`) is backed by a `state.boolSeries`/`state.series` slot at
    each inline call site, so every call site gets independent history.

  `request.security` reads are now `.current`-projected (data, expression, and
  the new block-callback form for a stateful UDF inlined into the HTF closure),
  and OHLCV reads inside a `request.security` callback project `.current` for
  scalar use. No core or runtime change.

- f89117d: Map input-bound `request.security` symbol/timeframe feeds,
  `input.timeframe`→`input.interval` (incl. chart timeframe), and the `gaps=`
  argument.

  The converter now resolves a `request.security` symbol/timeframe bound to an
  `input.symbol` / `input.timeframe` declaration through that input and emits the
  chartlang `inputs.<name>` reference (so the value stays user-editable), instead
  of rejecting it with `request-security-not-mapped`. `input.timeframe` maps to
  `input.interval`, and an empty `input.timeframe("")` default is the chart
  timeframe (`input.interval("")`) rather than a spurious
  `non-literal-input-default`. The tuple/list output form shares the same
  resolution. A `gaps = barmerge.gaps_off|gaps_on` argument is recognised and
  dropped with one `request-security-gaps-dropped` info (chartlang feeds are
  gap-filled by default) instead of an unmapped-arg error. A computed / wrong-axis
  symbol or timeframe still rejects with `request-security-not-mapped`.

  `compiler`: the `request.security` feed extractor (`getInputDefault` /
  `getInputsEnumOptions`) now unwraps enclosing parentheses + `as` casts, so the
  converter's `inputs.<name> as string` feed emit — the cast is required because a
  script's `compute` `inputs` is typed `Record<string, unknown>` — resolves to the
  input default. A hand-written un-cast `inputs.<name>` is unchanged.

- f89117d: Support value-form `switch` expressions (`x = switch s …`, Pine's `cf_ma`
  helper). A `switch` in a declaration / assignment / tuple value position now
  parses into a new `SwitchExpression` AST node (a Pratt prefix rule) and lowers
  to a right-nested ternary chain: with a subject, `subject === label ? value :
…`; subject-less, `cond ? value : …`; a wildcard `=> value` arm is the default;
  and an unmatched subject yields `na` (`Number.NaN`), matching Pine's value-
  `switch` semantics. Each arm value is lowered in scalar position, so a nested
  `ta.*` arm projects to its `.current` scalar. The old hard reject
  (`switch-expression-unsupported`) is retired for the single-expression value
  form — which also clears the `unexpected-token` recovery cascades it caused — and
  now fires only for the residual unsupported sub-shape (a multi-statement block,
  comma list, or `:=` assignment arm).

### Patch Changes

- f89117d: Consolidate `input-arg-not-mapped` and `table-formatting-not-mapped` to one
  diagnostic per distinct unmapped argument name across the whole script (the
  representative span is the first occurrence), instead of one per call site.
  A script with ~150 grouped inputs now reports ~4 input-arg warnings, not 228,
  and a styled on-chart table ~3 cell-formatting warnings, not 6. The
  `request.security` `gaps=` info is likewise consolidated to once per script.
  Mapped-argument behavior (including the dynamic `bgcolor`/`text_color` table
  path) is unchanged.
- a47c2fe: Fix three Pine→chartlang lowering gaps that made the support/resistance sample
  emit chartlang that did not compile (the converter reported 0 errors). The
  drawing transforms (Camp A/B, tables, setter-fold) now emit option/setter/cell
  values through the shared input/ring/`str`-aware `emitWithContext` instead of a
  bare `emitExpr` / minimal context:

  - A bare `color=<input.color>` draw option now qualifies to `(inputs.<name> as
string)` (and `input.color` casts as `string`) instead of leaking the
    undefined Pine identifier.
  - `str.tostring(...)` lowers to `String(...)` in every expression context (a
    `label.set_text` body, a binary-op operand), not just `table.cell`.
  - `array.size(<ring>)` over a Camp B drawing-handle ring lowers to
    `<ring>.size()` even when nested (e.g. inside `str.tostring`), via the new
    `EmitContext.handleRings` rewrite.

- 903f14a: Hoist bar-invariant captures into `request.security` expression callbacks so
  they compile. A higher-timeframe callback runs on a separate clock, so the
  chartlang compiler rejects any callback that captures a main-timeline binding
  (`request-security-expr-captures-local`). The converter now reconstructs every
  captured top-level binding whose value is bar-INVARIANT (it bottoms out at
  `inputs`/`Math`/literals — e.g. a length derived from an `input.int` and a
  `switch`-over-input preset) as a callback-local `let`/`switch` prelude
  (transitively, in source order), so the references resolve in-scope. Both the
  single-source and tuple `request.security` paths hoist. The numeric `na`
  sentinel emits as the validator-safe `NaN` (not `Number.NaN`) inside a security
  callback. A genuinely bar-VARYING capture (one depending on series / `ta.*` /
  OHLCV) cannot be rebuilt and now raises the new append-only error
  `request-security-expr-captures-series` — an actionable converter diagnostic in
  place of a downstream compiler error. This fixes feature-heavy scripts (e.g.
  Trend Wizard) that derived a higher-timeframe `ta.atr` length from inputs.
- f89117d: Fix both `switch` parsers to tolerate a blank or comment-only line between or
  after the arms. A trailing blank/comment line (the common Pine idiom of a
  `switch` block followed by a section comment) previously left a stray `newline`
  between the last arm and the block `dedent`: the statement form cascaded an
  `unexpected-token` into every following statement, and the value form misfired
  `switch-expression-unsupported` on the empty "arm" and degraded the whole
  `switch` to a placeholder. Both arm loops now `skipNewlines()` before each arm,
  so a value-form `switch` whose single-expression arms are followed by a blank
  line (e.g. the `cf_ma` MA-selector helper) converts cleanly.
- f89117d: Tolerate leading comments/blank lines before the version directive and at the
  start of an indented block. The parser now skips comment-only / blank lines
  (via a new explicit `TokenCursor.skipNewlines()`) before matching
  `//@version=6` and before opening an indented block, so a Pine script with a
  license header above the directive — or a block whose first physical line is a
  comment — parses cleanly. A genuinely missing directive or empty body still
  reports `missing-version-directive` / `expected-token`.

## 0.4.0

### Minor Changes

- 70cb92f: Lower Pine `alert(message, freq?)` to chartlang `alert(message)`. The message
  passes through the ordinary expression emitter (string concatenation preserved)
  and the enclosing `if` is preserved, never hoisted — chartlang's `alert` is
  imperative, the same shape as Pine's. The Pine `alert.freq_*` frequency
  argument is consumed (dropped) with a new `alert-frequency-not-mapped` (info),
  because chartlang's `AlertOpts` carries no firing-frequency contract; the three
  frequency enums (`alert.freq_all`, `alert.freq_once_per_bar`,
  `alert.freq_once_per_bar_close`) are recognised as REJECT rows in
  `ENUM_VALUE_MAP` so the symbol is never leaked to the generic emitter. Adding a
  `frequency` field to core `AlertOpts` is a deferred follow-up.
- 70cb92f: Recognise + classify Pine's tuple-LHS `request.security` form in the semantic
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

- 70cb92f: Add non-numeric persistent state: `state.color` plus boolean/string series
  slots (`state.boolSeries` / `state.stringSeries`), enabling `var color` and
  `var bool/string` history conversion.

  `state.color(init)` is a persistent color scalar (`MutableSlot<Color>`, the
  `Color` string seeded with `init`). `state.boolSeries(init)` /
  `state.stringSeries(init)` are the non-numeric siblings of the numeric
  `state.series` — a writable `.value` head plus integer-indexed `[n]` history
  (`BoolSeriesSlot` / `StringSeriesSlot`). First-bar / out-of-range history reads
  are `false` for booleans (Pine v6 semantics) and `""` for strings. The numeric
  `state.series` / `NumberSeriesSlot` signature is unchanged (numeric snapshots
  stay byte-identical). The compiler ambient `state` shim mirrors all three
  factories + the two new slot types in lockstep.

  The Pine converter now lowers a `var color` scalar to `state.color` (a Pine `na`
  color → the concrete transparent CSS string `"#00000000"`), and a history-indexed
  `var bool` / `var string` to `state.boolSeries` / `state.stringSeries` (value
  read / `[n]` history / `:=` write split, mirroring the numeric series). The
  `series-history-non-numeric` info is retired for `bool`/`string` (now first-class)
  and narrowed to the still-unsupported `color` history case.

- 70cb92f: Add a per-plot authoring `visible` opt — `plot(x, { visible })` (and Pine
  `display = display.all | display.none` conversion). Wired into the existing
  `PlotEmission.visible` wire field; omitted when visible so existing emissions
  stay byte-identical. (adapter-kit needs no change — its `visible` wire field +
  validator already exist @since 0.8.)

  The compiler also threads a boolean-literal `visible` into a new optional
  `manifest.plots[*].defaultVisible` static hint (a host can pre-toggle a legend
  entry); an input-driven `{ visible }` is resolved per run and leaves the field
  absent, so unused-visibility manifests stay byte-identical.

  The conformance suite adds the `PLOT_VISIBLE_SCENARIO` export pinning the wire
  contract cross-adapter: `plot(value, { visible: false })` emits `visible: false`
  while a no-`visible` plot AND a `visible: true` plot both omit the field
  (byte-identical wire), with a control `plot-hash` proving `visible` is never in
  the numeric `{ bar, value }` tuple.

  The Pine converter (minor — new capability + a new diagnostic code) maps a
  `plot(..., display=...)` named arg onto the `{ visible }` opt:
  `<cond> ? display.all : display.none` → `{ visible: <cond> }` (the inverted
  arm order → `{ visible: !(<cond>) }`), a bare `display.none` → `{ visible:
false }`, and a constant `display.all` (or an omitted `display=`) omits the key
  for byte-clean output. Any other `display.*` target (`status_line`/`price_scale`/
  `pane`/`data_window`) is left visible with a new `plot-display-approximated`
  warning — `display=` is never silently dropped.

### Patch Changes

- 70cb92f: Lower Pine `fill(hline, hline)` / `fill(plot, plot)` to `draw.fillBetween`.
  Both the static `linefill.new` lowering and the new `fill` lowering now route
  through one shared `emitFillBetweenBand` edge-builder over pre-resolved edge
  descriptors (constant-price hline / per-bar plot series / line endpoints); the
  linefill output is byte-identical. The `fill` handles resolve to their defining
  top-level (or inline) `hline`/`plot` calls and the fill colour folds via the
  shared T6 colour rule. `fill-not-mapped` is narrowed to the deferred gradient /
  `fillgaps` forms (message updated), and a new `fill-handle-unresolved` (error)
  covers a handle that resolves to neither an `hline` nor a `plot` — `fill` is
  never silently dropped. Adds the `fill-hline-band` / `fill-plot-band` (clean,
  compile round-trip) and `fill-reject` fixtures, and documents the mapping in
  the converter `supported.md` / `rejects.md`.

## 0.3.0

### Minor Changes

- 382d1f1: pine-converter (lexer): support **leading-operator line continuation**. An
  indented line that begins with an infix/ternary lead (`and`, `or`, `+`, `-`,
  `*`, `/`, `%`, `==`, `!=`, `>`, `>=`, `<`, `<=`, `?`, `:`) now continues the
  previous line's expression instead of starting a new (truncated) statement —
  the MASM-style multi-line boolean condition that dominates real-world Pine.

  The lexer suppresses the intervening `newline`/`indent`/`dedent` via a
  **deferred `newline` emit** (bounded one-token buffering: the held newline is
  resolved by the very next significant token, not by arbitrary lookahead),
  composing with the existing paren-depth + trailing-comma suppression. A
  continuation line must be indented **strictly deeper than the statement-start
  column**, so a non-indented unary `-`/`+` (or a same-indent `and`) stays a
  separate statement. Block structure is unaffected: `if`/`for` bodies still open
  on a real `indent` and close on the matching `dedent`, and the indent/dedent
  counts stay balanced. The prefix-only `not` is never a continuation lead.

  No new diagnostic codes; the stable `code:` contract is unchanged. A
  `37-leading-op-continuation` fixture triple locks the behaviour behind the
  compile round-trip, and `docs/converter/supported.md` documents the idiom.

- 382d1f1: Convert Pine `for` loops that use `break`/`continue`, and add compound
  assignment (`+=`/`-=`/`*=`/`/=`) — the two general-purpose gaps that broke most
  real looping scripts (the `MASM_Strat.md` consolidation counter is the
  reference).

  - **No-unroll-with-`break`:** a loop whose body contains a `break`/`continue` is
    now ALWAYS emitted as a runtime `for` (a `break` cannot span unrolled
    iterations), overriding the stateful/non-stateful unroll heuristic. The bound
    resolves from a literal OR a frozen `input.int` default
    (`loop-unroll-frozen-at-input-default`). A body that is BOTH stateful AND has a
    `break`/`continue` is unconvertible → new `stateful-loop-with-break` error; a
    non-resolvable break-loop bound reuses `loop-bounds-not-literal-for-stateful-body`.
  - **Outside-loop guard:** a `break`/`continue` with no enclosing loop is dropped
    with a new `break-continue-outside-loop` error instead of emitting an illegal
    stray `break;`.
  - **Compound assignment:** `+=`/`-=`/`*=`/`/=` parse end-to-end (lexer operator
    tokens, AST `AssignmentOperator`, `parseAssignment`) and lower to a
    read-modify-write at top level and inside loop bodies — onto a `state.*`
    scalar slot's `.value` or a plain local. (Previously `count += 1` mis-lowered
    to `count + (undefined); 1;`.)
  - **Runtime series index:** an `=`-declared, history-indexed `ta.*` series
    (`ma = ta.ema(...)` read as `ma[i]`) is promoted to a `state.series` slot —
    reusing the existing `var`→`state.series` machinery — so `ma[i]` is a legal
    indexed read while `ma`'s scalar uses (`ma >= 0`, `plot(ma)`) still work via
    `ma.value`. A `[i]` whose offset is an enclosing `for` iterator is a valid
    runtime history read, not a `dynamic-series-index`. A `ta.*` series never
    `[n]`-indexed keeps its `.current` scalar lowering (no regression). This makes
    the `MASM_Strat.md` consolidation loop convert to a compiling runtime `for`.

  Two append-only diagnostic codes: `break-continue-outside-loop`,
  `stateful-loop-with-break`.

- 382d1f1: pine-converter (transform): lower a nested `ta.*` call to its `(...).current`
  scalar projection **wherever it sits in a scalar position** — an operand of a
  binary/unary operator, a ternary arm, or a `math.*` / `Math.*` argument — not
  only when it is the top-level value of a declaration. `ta.rsi(close, 14) * 0.1`
  now converts to `ta.rsi(bar.close, 14).current * 0.1` instead of a bare
  `Series<number>` that does not type-check. The lowering routes through the same
  `taLookup`-backed rule the top-level `emitTa` uses (so `ta.rma` → `ta.smma` and
  pivots resolve), and is position-aware: a `ta.*` fed as a **source argument to
  another `ta.*`** stays a `Series` (chartlang `ta.*` sources are
  `Series<number>`), as do a direct `plot`/`hline` value, a `request.security`
  callback body, and a history-access receiver. No double `.current` at top
  level; existing golden output is byte-identical.

  The lowering is now observable: a nested projection raises a `nested-ta-lowered`
  info (deduped once per script) and an unmapped / rejected `ta.*` left as a
  `Series` in a scalar position raises a `nested-ta-not-lowered` warning, so a
  nested `ta.*` is never a silent non-compiling output. Fixture
  `41-nested-ta-arith` exercises the operator, ternary, and `ta`-source forms and
  round-trips through the compiler.

- 810125e: pine-converter: lower the full Pine v6 `str.*` surface. `str.startswith` /
  `str.endswith` → `s.startsWith(t)` / `s.endsWith(t)`, `str.pos` →
  `s.indexOf(t)`, `str.substring` → `s.substring(begin[, end])`, `str.trim` →
  `s.trim()`, `str.repeat` → `s.repeat(n)` (2-arg or empty-string-literal
  separator), occurrence-aware `str.replace` → `s.replace(t, r)` (no occurrence
  or a literal-`0` occurrence), and `str.tonumber` → `Number(s)`. This rounds out
  the existing `str.tostring` / `str.format` / `str.length` / `str.contains` /
  `str.upper` / `str.lower` / `str.split` / `str.replace_all` lowerings — the same
  native-where-native-exists shape `math.*` uses for bare `Math.*` (no `str`
  import/destructure is added to the generated output).

  `str.match` (regex) and `str.format_time` (host-time) have no native
  one-liner and continue to emit the existing `str-not-mapped` diagnostic and
  pass the call through; so do a `str.repeat` with a non-empty separator and a
  `str.replace` with a non-zero / non-literal occurrence. No new diagnostic codes
  — the stable `code:` contract is unchanged.

- 382d1f1: Pine **user-defined function declarations** now convert (T1). A helper written
  `f(a, b) => expr` (single-line) or with a multi-line indented body (whose last
  statement is the implicit return) lowers two ways depending on whether its body
  is stateful: a **pure** (state-free) helper hoists to a reusable chartlang
  arrow-function `const` at the top of `compute` that every call site reuses,
  while a **stateful** helper (one that transitively calls `ta.*` / `state.*` /
  `plot` / `hline` / `alert` / `draw.*`) is **inline-expanded at each call site**.
  Inlining is a correctness requirement, not an optimisation: chartlang keys every
  `ta.*` / `state` slot by lexical source position, so a shared function would make
  all callers collide on one slot and cross-contaminate state — inlining gives each
  call site its own slot, reproducing Pine's per-call-site state instancing (two
  calls to the same helper provably diverge).

  A pure helper's params are emitted with a `: number` type annotation so the
  hoisted arrow type-checks (an untyped param trips the compiler's `noImplicitAny`),
  and a nested `math.*` call in any body now lowers its callee to the bare-native
  `Math.*` passthrough (`math.max(math.min(a, b), c)` → `Math.max(Math.min(a, b),
c)`) — the `math` sibling of the existing nested-`ta.*` lowering — so a pure
  helper like `cf_limit` round-trips cleanly through the compiler.

  New diagnostics ride this: `udf-emitted-function`, `udf-inlined`,
  `udf-arg-hoisted` (info), `udf-typed-param-unsupported`, `udf-arity-mismatch`
  (warning), and the `udf-param-default-unsupported` / `udf-recursive-rejected`
  rejects (error). Fixtures `42`–`46` exercise the surface — the pure-helper
  round-trip (`42`), the divergence witness (`43`), the faithful Trend Wizard
  helper cluster (`45`), and the recursion reject (`44`) convert cleanly; one v1
  limitation is documented and tracked: a stateful helper that indexes a param's
  history only inlines cleanly when applied to an OHLCV argument (a derived-series
  argument needs a `state.series` promotion, a planned follow-up).

- 48e8ebb: Support comma multi-assignment `switch` arm bodies and turn a value-position
  `switch` into a clean reject (T3).

  - **`switch` arms with a comma-separated assignment list now convert.** A Pine
    arm body such as `"X" => a := 8, b := 21` (Trend Wizard's `preset_select`
    uses ten per branch) parses into N statements and lowers each in source
    order before the `break;` — no element is dropped. The switch lowering was
    already list-aware; the parser now populates the arm body as a list. Fixture
    `47-switch-multi-assign` round-trips through the compiler.
  - **A `switch` used as a value (`x = switch s …`, Trend Wizard's `cf_ma`) is
    now a clean reject** — `pine-converter/parse/switch-expression-unsupported`
    (error) — instead of silently-broken output. The parser recovers the switch
    header + arm block and resumes at the next statement. Rewrite it as a chained
    ternary, or assign inside each arm body (which IS supported). Lowering a
    value-position switch to a ternary chain is a tracked follow-up.

- 48e8ebb: Parse value-position `[…]` array literals (T4 Task 2).

  - **A `[…]` appearing as a value now parses to an `ArrayLiteralExpression`**
    instead of breaking with `expected-token` / `unexpected-token`. This covers a
    named-arg value (`input.string("EMA", options=["SMA", "EMA"])`), a call
    argument (`f([high, low])`), and a right-hand side (`x = [1, 2, 3]`); empty
    `[]` and a trailing comma are allowed. The Pratt parser disambiguates the
    three `[` contexts automatically: a **prefix** `[` (value start) is the array
    literal, a **postfix** `[` (`a[0]`) stays history-access, and a
    statement-leading `[ ident, … ] =` stays tuple destructuring (a malformed
    statement-leading head still rejects with `unexpected-token`).
  - An unterminated `[` recovers via the established zero-width fallback — the
    parser never throws.

  This is the parser enabler for the T4 `input.string/int(options=)` →
  `input.enum` mapping (Tasks 3–4 consume the node) and for T5's `[high, low]`
  `request.security` source list.

  Map string dropdowns to `input.enum` (T4 Task 3).

  - **`input.string(default, title?, options=["A", "B"])` now converts to
    `input.enum(default, ["A", "B"], { title? })`** — a real fixed-options
    dropdown instead of a free-text input that silently dropped the options.
    String comparisons against the value (`sel == "EMA"`) keep working. The title
    threads from the positional 2nd arg or a `title=` named arg.
  - A `default` not in `options` warns `input-string-options-default-mismatch`
    (the enum is still emitted); a mixed / non-literal `options=` list falls back
    to a plain `input.string` with `input-string-options-not-literal`. Numeric
    `options=` dropdowns and Pine's UDT-backed `input.enum` are unchanged here
    (numeric is Task 4; the UDT enum stays rejected).
  - New diagnostic codes: `input-string-options-default-mismatch`,
    `input-string-options-not-literal`.

  Map numeric dropdowns and bare `input()` (T4 Task 4).

  - **`input.int/float(default, options=[8, 21, 30, …])` now converts to a numeric
    `input.enum(default, [8, 21, 30, …], { title? })`** (the `input.enum<number>`
    form Task 1 widened core for). Numeric use sites keep working — `len == 8`
    comparisons and length args (`ta.sma(close, len)`) read `inputs.len as number`.
  - **A bare generic `input(...)` now hoists to `manifest.inputs`** instead of
    leaking an uncompilable `input(...)` call: a series default
    (`input(title="LT", defval=close)`) → `input.source("close", { title? })`; a
    literal default → the typed `input.int/float/bool/string/color` by the
    literal's kind. A missing / `na` / computed default rejects with
    `non-literal-input-default`. The source-vs-typed choice is a transform
    decision; `INPUT_MAP` carries only a recognised-primitive marker for bare
    `input`.

- 48e8ebb: Convert Pine's transparency-carrying colour forms — `color.new(base, transp)`
  and the 4-arg `color.rgb(r, g, b, transp)` — across the **plot / hline /
  table** paths, and gate the `color` import so the output compiles.

  - **Lowering (shared rule):** `colorConvert.ts`'s `convertColorWith(node, emit)`
    is the single colour rule the plot (`plotFamily.ts`), table (`tables.ts`), and
    linefill paths share. A literal `#RRGGBB`/palette base + literal `transp` folds
    to a quoted `#RRGGBBAA` hex string (`alpha = round(255 * (100 - transp) /
100)`); a **dynamic** base or `transp` emits `color.withAlpha(<base>, (100 -
transp) / 100)` (core's `withAlpha` takes alpha in 0–1). A 3-arg
    `color.rgb(r, g, b)` passes through. Every transparency fold raises a
    `color-transp-approximated` info.
  - **Import gating:** `scanUsage` (`codegen/usage.ts`) gains a `color: boolean`
    flag, force-on whenever a `color.*` member survives in the output
    (`color.withAlpha`, a 3-arg `color.rgb`, or a bare palette member). `color`
    joins the core import list as a module-scope namespace (like `math`/`str`) —
    it is NEVER added to the `compute` destructure. An all-hex script imports no
    `color` (byte-compatible — no spurious import).
  - Fixtures `51-color-rgb-transp` (plot + hline, hex, no import),
    `52-color-new-literal` (table cell, hex, no import), and
    `53-color-dynamic-base` (`withAlpha` + 3-arg `color.rgb` passthrough +
    surviving palette member, `color` imported) round-trip through the compiler.

### Patch Changes

- 382d1f1: Map the Pine `array.*` reduction family onto the chartlang `state.array` handle
  surface and prove it across every adapter.

  - **Converter:** a new internal `ARRAY_REDUCTION_MAP` (`mapping/arrayReductions.ts`)
    lowers `array.sum/avg/min/max/range/median/variance/stdev/indexof/includes`,
    `array.percentile_linear_interpolation` → `<slot>.percentile`, and
    `array.sort(id, order)` → `<slot>.sort("asc"|"desc")` onto the handle methods.
    `array.sort` raises an `array-sort-returns-copy` info (chartlang's `sort`
    returns a fresh copy, never mutating the ring); `array.percentile_nearest_rank`
    and any unmapped `array.*` over a slot emit a `Number.NaN` placeholder + an
    `array-reduction-not-mapped` warning rather than hard-failing. The Pine `order`
    enum (`order.ascending`/`order.descending`) is now a recognised builtin. Fixture
    `35-array-reductions` covers the clean family.
  - **Conformance:** `array-rolling-stats` pins a rolling `stdev`/`median` series
    over a `state.array<number>(14)` window. The reductions are pure compute that
    ride the existing `plot` hole — **no new wire primitive and no per-adapter code
    change** — so `pnpm conformance` replays the scenario through every adapter and
    asserts byte-stable output.

- 810125e: Map the chart-aware Pine `math.*` / `nz` subset onto the chartlang `math`
  namespace in the converter, and prove the namespace is byte-stable across every
  adapter.

  Pine-converter changes:

  - `math.round_to_mintick(x)` → `math.roundToMintick(x, syminfo.mintick)` (the
    emitter injects the explicit tick step; the namespace is pure with no ambient
    `syminfo`).
  - `math.avg(a, b, …)` / `math.sum(a, b, …)` → the variadic **scalar**
    `math.avg` / `math.sum`. This also fixes a latent bug where these mapped to
    the non-existent `Math.avg` / `Math.sum`. Pine's 2-arg **rolling**
    `math.sum(source, length)` / `math.avg(source, length)` has no chartlang
    scalar analogue, so it is left for a manual rewrite with a new advisory
    `math-rolling-window-unmapped` warning rather than being collapsed onto the
    scalar form.
  - `nz(x)` / `nz(x, r)` → the scalar `math.nz(...)` with a new advisory
    `nz-scalar-assumed` info (switch to `ta.nz` by hand for a series argument).
  - Bare numeric `math.abs`/`pow`/`sqrt`/`sign`/… stay on `Math.*` (the
    no-rewrap decision); `na(x)` keeps its existing context-aware inline
    predicate lowering.
  - Codegen now wires the module-scope `math` import and the `syminfo` compute
    destructure when the converted source references them.

  The `math` namespace emits **no new wire primitive** — its outputs are plain
  `number`s that flow into the existing `plot`/`draw` holes — so **no adapter code
  change is required**. The new `math-round-to-mintick` conformance scenario
  (snapped levels → `draw.horizontalLine`) is replayed through every adapter by
  `pnpm conformance`, which is the all-adapter byte-stability proof. The
  language-service hover registry is regenerated to include the new `math.*`
  helper entries.

- 382d1f1: Parser + AST for Pine user-defined function declarations (T1 Task 1). Add a
  `FunctionDeclaration` statement node (`name`, `FunctionParam[]`, `body:
BlockStatement`) and teach `parseStatement` to recognize the `name(params) =>`
  head in both the single-line (`f(a, b) => expr`) and multi-line (indented body
  with an implicit last-expression return) forms. Two append-only parse
  diagnostics ride this: `udf-typed-param-unsupported` (warning — a typed param
  is treated as its bare name) and `udf-param-default-unsupported` (error — a
  defaulted param rejects the whole declaration). Parse-only; semantic
  registration and emission land in T1 Tasks 2–4 (the public converter surface is
  unchanged here, so the user-visible bump is folded into Task 5's feature
  changeset).
- 382d1f1: Emit pure (state-free) Pine user-defined functions as reusable chartlang
  arrow-function `const`s (T1 Task 3). `transformOther` now hoists every
  `stateful: false` UDF to the FRONT of the compute body — after the state-slot
  allocations, before any non-UDF statement — ordered callee-before-caller by a
  topological sort over the call graph, so every helper precedes its first call
  site and a single shared function replaces Pine's per-call evaluation (a pure
  helper is referentially transparent). Params are emitted verbatim (registered
  as shadowing locals so a param/local never picks up an `inputs.*` / state-slot
  rewrite, while a free input/`var` reference in the body still rewrites);
  intermediate body locals lower to `let`s and the body's implicit-return last
  statement yields the `return`. A new `udf-emitted-function` (info) is raised
  per emitted UDF. Stateful UDFs are excluded (Task 4 inlines them at each call
  site); the statement walk's `function-declaration` arm stays a no-op shared by
  both paths. Package-internal; the user-visible converter surface bump is folded
  into Task 5's feature changeset.
- 382d1f1: Semantic registration + statefulness classification for Pine user-defined
  functions (T1 Task 2). `analyze` now hoists every top-level
  `FunctionDeclaration` into a `kind: "function"` symbol carrying `params` and a
  resolved `stateful` flag, walks each UDF body in a param-seeded child scope
  (so call sites stop raising `unknown-identifier` and free body identifiers are
  still flagged), and warns `udf-arity-mismatch` on an argument-count mismatch.

  Statefulness is computed transitively over the UDF call graph in a pre-pass
  (`semantic/statefulness.ts`): a UDF is stateful if its body uses a builtin
  stateful primitive (`plot`/`hline`/`alert`/`ta.*`/`draw.*`) or calls another
  stateful UDF — the flag Tasks 3/4 read to choose reuse (pure) vs. inline
  (stateful). Recursion (direct or mutual) is rejected with
  `udf-recursive-rejected` (error), one per cycle on the lexically-first member.
  The shared builtin stateful predicate moved from `transform/statefulNames.ts`
  into the neutral `semantic/statefulness.ts` (re-exported from the old path) to
  avoid a semantic→transform cycle. Package-internal; the user-visible converter
  surface bump is folded into Task 5's feature changeset.

- 382d1f1: Inline-expand STATEFUL Pine user-defined functions (`stateful: true`) at every
  call site (T1 Task 4), the complement of Task 3's pure-UDF reuse. A stateful
  helper cannot be emitted as a shared function — its `ta.*`/`state.*` would share
  ONE compiler slot across every caller and cross-contaminate state — so
  `udfInline.ts` expands the body at each call site instead: params bind to their
  arguments (a non-trivial / call-bearing arg is hoisted to a `const <tmp> =
<arg>;` evaluate-once temp; a bare identifier / literal substitutes inline),
  the body is cloned with params + body locals substituted (the new shared
  `substituteParams` / `substituteParamsStatement` in `controlFlow.ts`), each
  intermediate local lowers to a uniquely-named `let` emitted BEFORE the consuming
  statement, and the body's return expression splices into the call's position.
  Because each inlined `ta.*`/`state.*` lands at a DISTINCT generated source
  position, the compiler's `callsiteIdFor` mints an INDEPENDENT slot per call site
  — reproducing Pine's per-call-site state instancing with no compiler change (two
  calls to the same helper provably diverge). Nested stateful-UDF-calling-stateful
  -UDF composes; a recursive self-call (already `udf-recursive-rejected`) is left
  bare via an inline stack guard. New `udf-inlined` + `udf-arg-hoisted` (info)
  diagnostics fire. Package-internal; the user-visible converter surface bump is
  folded into Task 5's feature changeset.
- 382d1f1: Map the Pine `map.*` keyed-collection family onto the chartlang `state.map`
  handle surface and prove it across every adapter.

  - **Converter:** a new internal `MAP_BUILTIN_MAP` (`mapping/mapBuiltins.ts`)
    lowers `map.put` → `<slot>.set`, `map.get` → `(<slot>.get(k) ?? Number.NaN)`
    (na-bridged — chartlang returns `undefined`, Pine `na`), `map.contains` →
    `has`, `map.remove` → `delete`, `map.size` → `size`, and `map.clear` → `clear`
    onto a `state.map<number, number>(cap)` slot scanned by
    `transform/mapCollection.ts`. Pine maps are unbounded, so the converter
    **synthesizes** a literal capacity (default `1000`) + a
    `map-capacity-synthesized` info; a non-numeric value map raises
    `map-collection-non-numeric` (info) and is not lowered; `map.keys`/`map.values`
    (no v1 iterators) and any unmapped `map.*` over a slot emit a `Number.NaN`
    placeholder + `map-builtin-not-mapped` (warning) rather than hard-failing.
    `map` is now a recognised Pine namespace. Fixture `36-map-volume-by-level`
    covers the clean family.
  - **Conformance:** `map-accumulator` pins a per-rounded-price volume profile
    (value-at-key + tracked-level count) over a `state.map<number, number>(32)`
    store. `state.map` is pure compute that rides the existing `plot` hole — **no
    new wire primitive and no per-adapter code change** — so `pnpm conformance`
    replays the scenario through every adapter and asserts byte-stable output. No
    adapter diff is expected.

- 810125e: Publish the author-facing surface for the `str` string namespace: extend the
  Pine `str.*` converter mapping, prove the namespace is byte-stable across every
  adapter, and ship the docs / skill / example surfaces.

  Pine-converter changes:

  - `str.replace_all(s, t, r)` → `s.replaceAll(t, r)` and `str.split(s, sep)` →
    `s.split(sep)` (the snake_case Pine names lower to the native JS method).
    This rounds out the existing `str.tostring` / `str.format` / `str.length` /
    `str.contains` / `str.upper` / `str.lower` lowerings — the same
    native-where-native-exists shape `math.*` uses for bare `Math.*`.
  - A non-mask `str.tostring` format (grouping / `format.mintick`) or a styled
    `{n,number}` `str.format` placeholder continues to emit the existing
    `str-format-not-mapped` diagnostic and pass the call through, never a hard
    failure.

  The `str` namespace emits **no new wire primitive** — its outputs are plain
  `string`s that flow into the already-shipped `draw.text` / `draw.table` /
  `draw.marker` / `alert(...)` holes — so **no adapter code change is required**.
  The new `str-formatted-table` conformance scenario (a `draw.table` HUD built
  from `str.format` / `str.tostring("#.##")` / `str.upper`) is replayed through
  every adapter by `pnpm conformance`, which is the all-adapter byte-stability
  proof (the emitted text payload hash is byte-identical across canvas2d, echarts,
  konva, lightweight-charts, uplot, and webgl). The CLI primitive-docs generator
  gains a `str` page entry (`docs/primitives/str.md`) and the language-service
  hover registry is regenerated to include the deterministic `str` formatter
  helper entries.

## 0.2.0

### Minor Changes

- e620ba8: Add `bgcolor(color, opts?)` and `barcolor(color, opts?)` — Pine-ergonomic
  top-level aliases for the `bg-color` / `bar-color` plot styles. One call
  (`bgcolor(close > open ? "#16a34a" : "#dc2626", { transp: 80 })`) replaces
  the verbose `plot(NaN, { style: { kind: "bg-color", … } })`. Surfaced in the
  generated primitive reference and taught in the chartlang-coding skill.

  Deliverable 2 (per-bar dynamic color): `PlotEmission` gains an optional
  `colorValue: Color | null` channel; the runtime resolves the `bgcolor` /
  `barcolor` per-bar color into it (omitted on the static `plot` path → wire
  byte-identical, every pinned `plot-hash` untouched), validates it
  (non-empty color string or `null`), and dedups it last-write-wins per
  `(slotId, bar)` like `value`. Adapters prefer `colorValue` over the static
  `style.color` at render time — this precedence is now the normative
  adapter-kit contract (`PlotEmission.colorValue` JSDoc) and is implemented in
  the canvas2d reference renderer (`null` ⇒ paint-nothing gap; omitted ⇒ static
  fallback). The Pine converter emits the real per-bar dynamic color
  (`bgcolor(close > open ? "#16a34a" : "#dc2626")`) instead of a static
  `plot(NaN, …)`, so `bgcolor`/`barcolor` round-trip with per-bar semantics
  intact.

- 08cba38: Add `time.*` calendar accessors (`time.year/month/dayofmonth/dayofweek/hour/
minute/second/timestamp`), a `time.timeClose(t, tz?)` bar-close accessor
  (Pine's `time_close()` = bar start + interval), a `session.isOpen(t, spec, tz?)`
  helper, and an `input.session` kind. Calendar fields are derived from a `Time`
  epoch via the host (authors stay sandboxed — `Date`/`Intl` remain banned). v1
  is UTC + fixed-offset only; exchange-tz/DST is a scoped follow-up. The Pine
  converter lowers `dayofweek` / `time()` / `time_close()` / `input.session`.
- 1efb49c: Add multi-symbol support to `request.security`. `request.security({ symbol,
interval })` now reads a **different instrument** (not just a higher
  timeframe), e.g. `request.security({ symbol: "AMEX:SPY", interval: "1D" })`.
  `symbol` is optional (defaults to the chart symbol) and must be a compile-time
  literal (`input.symbol` / `input.enum` resolved). A new `multiSymbol` adapter
  capability gates non-chart-symbol requests: a different-symbol request against
  an adapter declaring `multiSymbol: false` degrades to an all-NaN
  bar/series with a single deduped `multi-symbol-not-supported` diagnostic,
  mirroring `multi-timeframe-not-supported` (the symbol gate precedes the
  timeframe gate, so a both-different request emits only the symbol diagnostic).
  The Pine converter now lowers `request.security("OTHER", tf, expr)`, and the
  `chartlang scaffold-adapter` template advertises `multiSymbol`.
- 1efb49c: Add `state.array<T>(capacity)` — a persistent, bounded FIFO collection. Push
  many values across bars (`a.push(v)`) into a fixed-capacity ring and read
  them back by element (`a.get(0)` = newest, `a.last()`, `a.size`,
  `a.capacity`, `a.clear()`). Bounded literal capacity keeps it
  serialization-clean. The Pine converter lowers a bounded numeric
  `var array<…>` Camp B ring to it.

  The compiler guards the capacity: it must be a compile-time numeric literal
  (a `const` numeric binding is accepted) that is a positive integer within
  `MAX_STATE_ARRAY_CAPACITY` (100_000). A non-literal capacity errors
  `state-array-capacity-not-literal`; an out-of-range / non-integer literal
  errors `state-array-capacity-exceeds-max`.

## 0.1.0

### Minor Changes

- ca19e20: Bidirectional plot `offset` — negative offsets shift a plotted series left.

  `offset` becomes a presentation-only **display shift** in bars with the
  fixed sign convention `+n` = right (future), `−n` = left (past); the
  numeric series value is unshifted. This replaces the old value-read model
  (where a positive offset made `series.current` read the value N bars ago
  and a negative offset resolved to `NaN`). The `*Opts` `offset` JSDoc (and
  ALMA's `barShift`) now describe both directions and drop the old
  "negative ⇒ NaN" wording (`AlmaOpts.offset`, the Gaussian-centre
  position, is unchanged).

  `PlotEmission` gains an optional presentation field `xShift?: number`
  (signed integer bars; omitted/`0` ≡ no shift, so a no-shift emission is
  byte-identical to today). `validateEmission` rejects a non-integer
  `xShift`. The compiler no longer counts `offset` toward `maxLookback`
  (the value is no longer read from a deeper slot). The runtime threads the
  declared offset onto the emission as `xShift` (reading a
  `WeakMap<Series, number>` offset tag set by `makeShiftedSeriesView`; ALMA
  tags `opts.barShift`) and stops the old value-read shift so
  `series.current` is unshifted; the reference adapter renders it by
  projecting `xShift` onto the x-axis (extending the viewport for
  future-shifted points).

  The Pine converter now maps `plot(<ta.* call>, offset=N)` onto the
  emitted `ta.*` call's `offset` opt (signed, both directions); a plot
  whose value is not a direct `ta.*` call drops the offset and emits the
  new `plot-offset-needs-ta-call` warning, and a plot-level offset
  replacing the ta call's own `offset=` emits `plot-offset-overrides-ta-offset`.

  The conformance harness's `plot-field` assertion gains an `xShift` field,
  and a new scenario pins both shift directions plus the unshifted value
  series.

- 3bf391a: Add the `draw.fillBetween(edgeA, edgeB, opts?)` drawing primitive — a
  native filled ribbon between two edges (the closed polygon `edgeA`
  forward then `edgeB` reversed). It is the chartlang equivalent of Pine's
  `linefill.new(line1, line2, color)` / `fill(plot1, plot2)`. The
  pine-converter now lowers static two-line `linefill.new` to it instead of
  approximating with `draw.rotatedRectangle`, retiring the
  `linefill-rotatedrect-approximated` diagnostic.
- 656390d: Ship the converter CLI surface and finalize the programmatic API. Add
  `convertFile(path, opts?)` to `@invinite-org/chartlang-pine-converter`: an async
  file-system wrapper around `convert` that reads the input as UTF-8, threads
  `ConvertOpts` through, and — when `opts.outPath` is set and the conversion
  yields a non-null `output` — writes the converted `.chart.ts` to disk. File I/O
  failures reject the promise (host-environment errors, distinct from converter
  diagnostics). Adds the `ConvertFileOpts` type (`ConvertOpts & { outPath? }`).

  Add the `chartlang pine-convert <input.pine>` subcommand to
  `@invinite-org/chartlang-cli`, a thin in-process layer over `convertFile` + the
  `@invinite-org/chartlang-pine-converter/diagnostics` formatters. Flags:
  `--out <path>` (write to file, else stream to stdout), `--report` /
  `--diagnostics-json` (human report to stderr vs JSON to stdout), `--strict`,
  `--bar-interval <ms>`, `--bar-index-origin <ms>`. Exit codes: `0` success,
  `1` error-severity diagnostics, `2` file I/O failure, `3` invalid CLI args.

- 656390d: Land the codegen back end (`src/codegen/`) and wire the full conversion pipeline into the public `convert()`. `convert(pineSource)` now returns a real chartlang `.chart.ts` source string instead of throwing `ConverterNotReadyError`: it lexes, parses, runs the semantic analysis, drives the eight transform passes (declaration, inputs, the Camp A/B/C drawing lowerings, tables, polyline/linefill, control-flow), then emits the assembled `ScriptScaffold` IR through `emit(scaffold)`.

  `emit` is a deterministic, pure-templating string emitter: an auto-generated header, a minimized `@invinite-org/chartlang-core` import (only the surfaces the body references, plus `type DrawingHandle` when handles are used), and the `export default defineIndicator/defineDrawing({ … })` block with its options + `compute` body. The converter OWNS the drawing-handle helper definitions (`useDrawingHandleSlot`, `useDrawingHandleRing`) and the state/handle/ring allocations, all emitted INSIDE `compute` where `draw`/`state` are in scope — the emitted source compiles cleanly through `@invinite-org/chartlang-compiler` (verified by a round-trip smoke test). Adds `scaffoldToManifest` for the `ConvertManifest`, the `codegen-output-invalid` diagnostic code, and `@invinite-org/chartlang-compiler` as a workspace dependency.

- 48c1b76: Add the new `@invinite-org/chartlang-pine-converter` package — first slice of the Pine Script v6 → chartlang source-to-source converter (drawings v1). This release ships the §22.4 scaffold and the stable public-surface stub (`convert`, `ConvertOpts`, `ConvertResult`, `Diagnostic`, `DiagnosticSeverity`, `SourceSpan`, `ConvertManifest`, `ConverterCapabilities`, `ConverterNotReadyError`) so downstream tasks have pinned types to import. `convert(...)` throws `ConverterNotReadyError("lexer")` until the pipeline lands across Tasks 2–16.
- 8086003: Add an optional presentation-only `z` (render-order / z-index) option to
  `plot()` and every `draw.*` primitive. Default `0`; higher renders on
  top, ties fall back to the existing group + declaration order. Finite
  numbers only. Affects stacking only — values, alerts, and `state.*` are
  unchanged.

  Adapter kit: `PlotEmission` and `DrawingEmission` gain the matching
  presentation-only `z?: number` wire field, validated by
  `validateEmission` as a finite number (NaN / ±Infinity rejected;
  fractional and negative allowed). Omitted/`0` stays byte-identical to a
  pre-feature emission, so existing goldens and conformance hashes are
  untouched.

  Runtime: `plotImpl` reads `opts.z`, and the drawing-emit path
  (`createDrawingHandle`) lifts `z` out of `state.style` — into a shallow
  clone with `z` removed, where the per-kind `draw.*` impls fold the opts
  bag — and threads it onto the top-level `PlotEmission.z` /
  `DrawingEmission.z` with the same omit-when-`0` conditional spread used
  for `xShift`. `z` is persisted **beside** the drawing slot's `state`
  (never inside `DrawingState`), so an `update` retains the last value. A
  no-`z` plot or drawing emits no `z` key — byte-identical to the
  pre-feature baseline. `draw.table` / `draw.group` do not carry `z` in
  v1.

  Pine converter: `explicit_plot_zorder` is now a recognized no-op instead
  of an unmapped warning. chartlang already layers marks by declaration
  order within their group (the normative ordering contract), which is
  exactly what Pine's `explicit_plot_zorder=true` makes authoritative — so
  the flag is satisfied by default and needs no chartlang option.
  `mapDeclarationArgs` no longer raises `indicator-arg-not-mapped` for it;
  instead it emits a single `explicit-plot-zorder-default` info note
  (covering both `explicit_plot_zorder=true` and the Pine-default
  `=false`). The converter still never _emits_ a numeric `z` — Pine has no
  per-element z source construct. Other unmapped `indicator(...)` args
  (`timeframe`, etc.) keep warning.

  Compiler: the ambient `@invinite-org/chartlang-core` `.d.ts` shim gains a
  `ZOrdered { z?: number }` mixin intersected into `PlotOpts` and every
  `draw.*` option type (mirroring core's `drawingStyle.ts`), so a compiled
  script's `plot(value, { z })` **and** `draw.*(…, { z })` type-check (the
  shim stays in lockstep with core).

  Conformance: a new `z-order` scenario pins the plot `z` →
  `PlotEmission.z` wire contract — a `plot(value, { z: -1 })` emits
  `z: -1`, a no-`z` plot omits the field (omit-when-`0` byte-identity), and
  a value-hash proves `z` never transforms the series. The `plot-field`
  assertion's `field` union widens to also accept `"z"`.

- 073f41b: Add the higher-timeframe expression/callback overload to `request.security`.
  Alongside the existing data form `request.security({ interval })` →
  `SecurityBar`, scripts can now write `request.security({ interval }, (bar) =>
…)` → `Series<number>`, where the callback runs on the **higher-timeframe
  clock** — `request.security({ interval: "1W" }, (bar) => ta.ema(bar.close, 20))`
  is a true weekly EMA(20) (20 weekly bars), not 20 main bars of a weekly-stepped
  series. The result is aligned no-lookahead down to the main timeline.

  - **core** — the `SecurityExpr` callback type (re-exported from the package
    root), the second `security` overload, and the shared `statefulPrimitives`
    entry annotated as covering both arities.
  - **compiler** — records one `SecurityExpressionDescriptor { slotId, interval,
paramName }` per expression callsite in `manifest.securityExpressions`
    (sorted by `slotId`, omitted for the data-only form), and validates each
    callback against the allowed subset — its `bar` parameter and body locals,
    the ambient `ta` / `inputs`, safe `Math.*` globals, and literals — rejecting
    any captured outer binding with the new
    `request-security-expr-captures-local` diagnostic.
  - **runtime** — mounts one `SecurityExprRunner` per manifest entry: the
    callback is captured lazily on the first main compute, driven once per HTF bar
    close through a dedicated fold `StreamState` so `ta.*` accumulate on the HTF
    clock, and one sampled value per HTF bar feeds a per-slot output buffer that
    `request.security(opts, expr)` returns aligned no-lookahead to the main
    timeline. Capability / interval / stream fallbacks return an all-NaN series
    with a deduped diagnostic.
  - **host-worker / host-quickjs** — boot the expression form unchanged; the
    `__manifest` sidecar already carries `securityExpressions`.
  - **pine-converter** — Pine's `request.security(sym, "D", ta.ema(close, 9))`
    now lowers to the chartlang callback form
    `request.security({ interval: "1d" }, (bar) => ta.ema(bar.close, 9))` (a bare
    OHLCV third arg keeps lowering to the data form).
  - **conformance** — new scenarios prove the weekly expression value differs
    from a same-length main-timeframe EMA, plus the `multiTimeframe: false` NaN
    fallback.

- 5a9c24d: Lower a history-indexed numeric Pine `var`/`varip` scalar to `state.series`
  instead of the non-compiling `state.float`/`int` + `<slot>.value[n]`. Pine's
  pervasive `var x := …; x[1]` idiom now converts to working chartlang (`const x =
state.series(<init>); … x.value = …; x[1]`). A numeric `var` never read with
  `[n]` keeps its leaner scalar slot. A `bool`/`string` history-indexed `var`
  stays out of v1 scope with a clear `series-history-non-numeric` diagnostic, and a
  non-literal series offset wires the `dynamic-series-index` error.
- 5a9c24d: Add `state.series(init)` — a writable, indexable user series. Store an
  arbitrary value each bar (`s.value = expr`) and read its history N bars
  back (`s[1]`). Number-coercible (`+s`, `s.current`) and usable as a `ta.*`
  source. The Pine converter lowers a history-indexed `var` to it.
- 08c536c: Add the `ta.highestbars` / `ta.lowestbars` primitives plus the cross-package
  wiring that makes them usable as drawing anchors and Pine-converter targets.

  - **core / runtime:** `ta.highestbars(source, length, opts?)` and
    `ta.lowestbars(source, length, opts?)` return the bar OFFSET (≤ 0) to the
    highest / lowest `source` value over the trailing `length` bars (window
    INCLUDES the current bar). `0` → current bar is the extreme; `-k` → the
    extreme occurred `k` bars ago. Ties resolve to the most recent bar; NaN
    inputs are skipped; warmup is `length − 1` bars; tick-mode replays the
    in-progress head as the offset-0 candidate. Registered in
    `STATEFUL_PRIMITIVES` (now 174 entries) and `TA_REGISTRY` (now 96 entries).
  - **compiler:** a literal-length `ta.highestbars` / `ta.lowestbars` call
    contributes `length − 1` toward `maxLookback`, so the runtime sizes the time
    ring buffer deep enough for a `bar.point(<that offset>, …)` anchor to resolve.
    A non-literal length contributes 0.
  - **pine-converter:** `ta.highestbars` / `ta.lowestbars` now map to the real
    chartlang primitives (previously lossy passthroughs to `ta.highest` /
    `ta.lowest`). **Behavior change:** a DYNAMIC `bar_index + <non-literal>`
    drawing-x anchor no longer raises the hard `requires-bar-interval` error —
    the offset is resolved by `bar.point` at runtime sign-agnostically (a
    negative runtime offset, e.g. what `ta.highestbars` returns, resolves to the
    historical timestamp via the time buffer). Only the literal `bar_index + N`
    future case still requires a bar interval.
  - **conformance:** new `TA_HIGHEST_LOWEST_BARS_SCENARIO` export pins both
    primitives end-to-end through the compiler + runtime over the bundled
    `goldenBars.json` fixture, and is added to `ALL_SCENARIOS`.

### Patch Changes

- 850ae21: Add `bar.point(offset, price)` — index authoring sugar for anchoring drawings
  by bar offset instead of an absolute timestamp.

  `bar.point` resolves the offset to the existing time-based `WorldPoint`
  (`{ time, price }`) at compute time, so it composes directly with every
  `draw.*` anchor argument and introduces no new wire format or anchor union:

  - `bar.point(0, price)` — the current bar.
  - `bar.point(-n, price)` — `n` bars back, using the real historical timestamp
    from the runtime's time ring buffer (`NaN` time past retained history; never
    throws).
  - `bar.point(n, price)` — a future bar, with the time extrapolated from the
    median recent bar spacing (falling back to the parsed bar interval when
    fewer than two bars are retained).

  The compiler's max-lookback analysis now counts a negative integer-literal
  `bar.point(-n, …)` offset toward `maxLookback` exactly like a `series[n]`
  lookback, so the runtime sizes the time buffer deeply enough; positive (future)
  offsets and dynamic offsets contribute no extra depth. The recogniser peels
  parentheses, so the converter's emitted form `bar.point(-(n), …)` is sized
  identically to a hand-written `bar.point(-n, …)` (without it, a converted
  historical tracking line sized its buffer to 0 and resolved to a NaN anchor).

  The Pine v6 converter now lowers `bar_index` drawing anchors to
  `bar.point(<signed offset>, <price>)` and drops the dead `__BAR_INTERVAL_MS`
  sentinel and its `bar.time ± (N * __BAR_INTERVAL_MS)` arithmetic — future
  anchors resolve at runtime instead of needing a host-supplied bar interval.

- 850ae21: Compact codegen for the common single-persistent-handle Camp A case. A plain
  `var <drawingType> h = na` handle that is created once and mutated each bar (no
  `*.delete`, not `varip`) now lowers to a bare `const <local> = draw.<kind>(…)`
  create + `<local>.update(…)` patch, exploiting the runtime's callsite-
  persistence instead of emitting the `useDrawingHandleSlot`/`__HandleSlot`
  generic helper, the `current()`/`set()` slot indirection, and the
  `DrawingHandle` type import. The emission-level behaviour is byte-identical
  (verified against the golden corpus and the compiler round-trip). Anything
  outside the clean idiom — a `*.delete`, a `varip` handle, tables, static
  polyline/linefill, and Camp B/C rings — falls back to the general slot
  machinery.
- 656390d: Move `@invinite-org/chartlang-compiler` from `dependencies` to
  `devDependencies`. The synchronous `convert` pipeline (lex → parse → semantic →
  transform → codegen) never imports the compiler — it is used only by the
  `emit-compile.test.ts` round-trip that verifies emitted output compiles. Keeping
  it as a runtime dependency wrongly pulled the compiler (and its esbuild/Node
  surface) into downstream bundlers' resolution graph; a devDependency is
  sufficient for the tests and keeps the runtime dependency set empty.
- b55d4c8: Add the package-internal coordinate resolver (`src/transform/coordinates.ts`) that bridges Pine's bar-index coordinate model to chartlang's absolute `(time, price)` `WorldPoint` anchors. `resolveCoordinates(semantic, opts)` walks every coordinate-bearing drawing call-site (`line.new`/`box.new`/`label.new`) and produces a `ReadonlyMap<ExpressionNode, ResolvedAnchor>` side-table the Task 16 codegen renders verbatim — the AST is never mutated. Anchors classify into literal world points, `xloc.bar_time` pass-throughs, historical `bar_index` / `bar_index[N]` / `bar_index - N` offsets, future `bar_index + N` anchors (flagged `requiresBarInterval`), and the four `chart.point.*` factory forms. A future `bar_index + N` anchor with a null `barInterval` raises a single `requires-bar-interval` error.

  Ships the Pine-expr → chartlang-TS-string emitter (`src/transform/exprEmit.ts`) that lowers every Pine expression node — remapping OHLCV/`time`/`bar_index` identifiers (`src/mapping/builtinIdentifiers.ts`), `and`/`or`/`not` to `&&`/`||`/`!`, and the context-sensitive `na` sentinel to `null` (handle) or `Number.NaN` (numeric) from its semantic annotation. Adds four `pine-converter/transform/...` diagnostic codes (`requires-bar-interval`, `dynamic-bar-index`, `unresolved-bar-index`, `chart-point-from-index-without-xloc`).

- 656390d: Formalize the diagnostics framework. Consolidate every Task 3–16 diagnostic into a single registry: `DIAGNOSTIC_CODE_ENTRIES` keeps the by-short-key object (driving `ParserDiagnosticCode`, `makeDiagnostic`, and the once-per-script dedup in Camp A/B), and a new `DIAGNOSTIC_CODES` exposes the same entries as a `ReadonlyMap<string, DiagnosticCodeEntry>` keyed by the full, stable code STRING for reporting code that only sees a `Diagnostic.code`. No code string changed — the strings remain the converter's stable public contract.

  Add the read/format side under `src/diagnostics/`: `DiagnosticReport` (a read-only wrapper over `readonly Diagnostic[]` with `errors()`/`warnings()`/`infos()`/`all()`/`frozen()`/`upgradeWarningsToErrors()`, distinct from the transform-layer mutable `DiagnosticCollector`), plus `formatDiagnostic` (rustc/tsc-style line+caret excerpt with a docs link), `formatDiagnosticReport` (grouped, counted report), and `formatDiagnosticsJson` (stable property order). `convert(source, { strictMode: true })` now honors the documented option by upgrading every warning in `ConvertResult.diagnostics` to an error (severity-only; `output` is unchanged — strict callers detect failure by scanning for any error). Adds a TS-Compiler-API test asserting every pushed diagnostic key is registered and a span-propagation property test over 30+ fixtures.

- 656390d: Add the Pine → chartlang end-to-end test suite: a 20-fixture Pine v6 corpus with
  byte-exact `.expected.chart.ts` + diagnostics goldens (generated from real
  `convert()` runs, regen via `UPDATE_FIXTURES=1`), determinism + strict-mode
  golden tests, and three conformance round-trip scenarios
  (`pine-converter-round-trip-camp-a`/`-camp-b`/`-table`) that ingest a Pine
  fixture, run `convert()`, compile the output through the chartlang compiler, run
  it through the runtime, and pin the full drawing-emission stream as a
  `drawing-hash`.
- 48c1b76: Add the package-internal Pine Script v6 lexer (`src/lexer/`). `lex(source)` tokenizes Pine v6 — keywords/identifiers, member access, int/float/scientific/hex numerics with `_` separators, single/double-quoted strings with escapes, `#RRGGBB[AA]` colors, operators/punctuation, line comments, and the `//@version=N` directive — and models Pine's significant indentation with synthetic `newline`/`indent`/`dedent` tokens (line-continuation aware via bracket depth and trailing commas). Malformed numerics, unterminated strings, invalid colors, illegal characters, and mixed/inconsistent indentation surface as structured `LexerDiagnostic`s rather than throwing. The lexer is package-internal (consumed by the Task 3 parser) and is not re-exported from the package root.
- 48c1b76: Add the declarative Pine v6 → chartlang mapping tables under
  `src/mapping/`: drawing constructors + setters, style enums, `input.*`
  primitives, and `ta.*` / `math.*` passthrough. Each table is an immutable
  lookup with a `chartlang: null` REJECT marker and a shared `lookup` helper
  that collapses missing keys and REJECTs to `null`. Every chartlang target
  symbol is verified against `@invinite-org/chartlang-core`.
- b55d4c8: Replace the Task 3 expression stub with a full Pine v6 Pratt expression parser in `src/parser/expressions.ts`: precedence-climbing for binary operators (`or` < `and` < equality < relational < additive < multiplicative), prefix unary (`+`/`-`/`not`), and the precedence-9 postfix operators — function calls with positional-then-named args, the history-reference operator `series[N]` (chainable, left-associative), and member access `a.b.c`. Identifiers, every literal kind, `na`, booleans, parenthesized groups, tuples `(a, b)`, and lambdas `(x) => expr` are the primary forms. The `ExpressionNode` union (`src/ast/expressions.ts`) expands accordingly. The top-level statement loop hard-rejects UDT (`type`), `method`, and library `import` declarations with the new `unsupported-udt` / `unsupported-method` / `unsupported-library-import` diagnostics and recovers past the whole block. Calls flag a positional argument after a named one with `mixed-named-positional-args`, and a chained ternary emits the informational `chained-ternary-warning`. A latent bug where the assignment parser left the `=`/`:=` operator unconsumed (masked by the greedy stub) is fixed. The parser still never throws; every `Expression` slot routes through the same `parseExpression(ctx)` entry, and an `unparse` round-trip helper backs the property tests.
- 48c1b76: Add the package-internal Pine Script v6 AST (`src/ast/`) and recursive-descent parser (`src/parser/`) for top-level declarations and statements. `parseStatements(tokens)` consumes the lexer's token stream and produces a `Script` AST plus structured diagnostics: it parses the `//@version=6` directive, `indicator(...)` declarations (rejecting `strategy(...)`/`library(...)` with `unsupported-strategy`/`unsupported-library` but still walking the body), `var`/`varip`/typed/bare variable declarations, `=`/`:=` assignments, `if`/`else if`/`else`, literal-bounded `for` loops, `switch`/`=>` arms, and `break`/`continue`/`return`. `for ... in` and `while` are rejected with `unsupported-for-in`/`unsupported-while` and the parser recovers past the whole compound statement. Expression slots are filled by an `UnknownExpression` stub (Task 4 substitutes the real expression grammar); every node carries a 1-based `SourceSpan` and the parser never throws. A single-source diagnostic-code registry lands in `src/diagnostics/codes.ts`. The parser and AST are package-internal and not re-exported from the package root.
- 850ae21: Broaden the plot-family and `ta.*` lowering: `plotshape`/`plotchar`/`plotarrow`
  map `location`/`style`/`char` enums, `ta.pivothigh`/`ta.pivotlow` project the
  `ta.pivotsHighLow` result fields, `input.*` reads carry an `as <type>` cast,
  generic type annotations (`array<line>`) parse, a standalone `polyline.new`
  lowers, and a fully-dead `if` (all branches owned-drawing-only) is dropped. A
  `ta.*` boolean used directly as a `plotshape`/`plotchar`/`plotarrow` condition
  now lowers with `.current` so the shape gates on the per-bar scalar instead of a
  perpetually-truthy `Series` object. New fixtures 21–24 exercise the SMA overlay,
  ATR pane, RSI bands, and EMA-cross conversions through the compile round-trip
  gate.
- 850ae21: Readable synthesized identifiers in the generated `.chart.ts`. The blanket
  `__` prefix is gone: a persistent handle from `var line trail = na` is now
  emitted as `const trail = draw.line(…)` (the Pine identifier reused), rings as
  their collection name, scalar state slots as their Pine name, the bar-index
  bridge as `barCount`/`barIndex`, the drawing-handle helper as
  `HandleSlot`/`useDrawingHandleSlot`/`HandleRing`/`useDrawingHandleRing`, and
  inline inputs as `inlineInput`. A new scope-aware `NameAllocator`
  (`transform/nameAllocator.ts`) seeds every in-scope identifier (compute-context
  params, JS reserved words, every Pine symbol) and disambiguates a clash with a
  numeric suffix (`trail2`) — never by reintroducing `__`. Output is purely
  lexical-renamed; runtime emissions are unchanged.
- b55d4c8: Add the package-internal semantic-analysis stage (`src/semantic/`) that walks the Pine v6 AST and produces the annotated `SemanticResult` every downstream transform (Tasks 8–15) consumes. It builds a scope tree seeded with the Pine v6 built-in symbol table, infers each expression's qualifier on the `const < input < simple < series` lattice, infers the `na` flavour (numeric sentinel vs drawing-handle `null`), disambiguates `=` declarations from accidental shadowing and `:=` reassignments, tracks `var`/`varip` lifetimes (reassignment / setter-mutation / delete sites), detects historical and future `bar_index` references, and — the load-bearing output — classifies every `line.new`/`label.new`/`box.new`/`polyline.new`/`linefill.new` call-site into Camp A (single handle), Camp B (bounded ring buffer with an extracted cap), Camp C-bounded (indicator-capped heuristic), or Camp C-unbounded (hard-reject). Six semantic diagnostics are added under `pine-converter/semantic/...`. Tuple destructuring (`[a, b] = f()`) is reported as out-of-v1-scope rather than wired into the parser, since the multi-return Pine surfaces are deferred for the drawing slice.
- 656390d: Add the Camp A drawing transform (`src/transform/campA.ts`) plus the reusable handle-slot + setter-fold infrastructure Task 11 (Camp B) shares. `transformCampA(site, analysis, scaffold, diagnostics)` lowers a single `var`/`varip` drawing handle created once and mutated each bar into chartlang's mutable `DrawingHandle` model: it registers a module-level handle slot (`appendHandleSlot({ name: "__<pine>_handle", kind })`, whose allocation + helper Task 16 codegen emits), synthesises a guarded `slot.set(draw.<kind>(...))` creation, folds every observed `*.set_*(handle, …)` mutation per straight-line block into one `slot.current()?.update({...})`, and emits `slot.current()?.remove(); slot.set(null);` at each `*.delete(handle)`.

  Ships the shared primitives `synthesizeDrawCall` / `handleSlotLocalName` (`src/transform/handleSlot.ts`), `foldSetters` / `renderEnumTarget` (`src/transform/setterFold.ts`), `resolveCampADrawKind` (`src/transform/drawKindResolve.ts`), `resolveYloc` (`src/transform/ylocResolve.ts`), and the new coordinate helpers `resolveAnchorExpr` / `anchorToWorldPoint` (`src/transform/coordinates.ts`). `label.new` maps to `draw.text` by default, or `draw.marker` / `draw.frame` / `draw.arrowMark{Up,Down}` per its `style=label.style_*` enum; `box.new` → `draw.rectangle`; `yloc.abovebar`/`belowbar` lower to bar-range padding arithmetic. Adds six `pine-converter/transform/...` diagnostic codes (`yloc-padding-approximated`, `varip-approximated`, `cross-mount-state-not-preserved`, `label-style-not-mapped`, `setter-fold-cross-branch`, `set-path-unsupported`).
  </content>

- 656390d: Add the Camp B drawing transform (`src/transform/campB.ts`) that lowers the bounded ring-buffer Pine idiom — a `var array<line|label|box>` filled by `array.push(coll, <draw>.new(...))` with FIFO eviction (`if array.size(coll) > K → *.delete(array.shift(coll))`) — into a chartlang ring buffer. `transformCampB(site, analysis, scaffold, diagnostics)` registers a module-level ring (`appendHandleRing`, whose `useDrawingHandleRing<K>(cap)` allocation + helper Task 16 codegen emits), emits exactly ONE `<ring>.push(draw.<kind>(...))` callsite at the fixed source position of the Pine `array.push` (inside its original guard, so the compiler's `stateful-call-inside-loop` gate never sees a `draw.*` in a loop), elides the explicit eviction block, and lowers each `for i = 0 to array.size(coll) - 1` update loop into a literal-bounded `for (… i < K …) { <ring>.at(i)?.update(...) }`. The ring capacity is `K = min(pineCap, CHARTLANG_BUCKET_CAP[bucket])` (lines/boxes/labels 500, polylines 100).

  Ships the reusable ring synthesis (`ringLocalName` / `registerRing` / `resolveRingCap` / `CHARTLANG_BUCKET_CAP`, `src/transform/ringHelper.ts`) and the `array.*` → ring accessor mapping (`mapArrayBuiltin`, `src/transform/arrayBuiltinMap.ts`) that Camp C (Task 12) and the table transform (Task 13) reuse: `array.first`→`at(0)`, `array.last`→`at(size()-1)`, `array.get(coll, i)`→`at(i)`, `array.size`→`size()`. Adds six `pine-converter/transform/...` diagnostic codes (`ring-eviction-implicit`, `cap-mismatch`, `anchor-mirror-required`, `ring-buffer-zero-cap`, `negative-array-index`, `linefill-over-ring`). `array.get(coll, -1)` rejects with `negative-array-index`; `linefill.new` over ring elements rejects with `linefill-over-ring` (Camp C territory); polyline collections are deferred to Task 14.

- 656390d: Add the Camp C drawing transform (`src/transform/campC.ts`) — the converter's safety net for dynamic drawing collections that don't fit the Camp B ring model. `transformCampC(site, analysis, scaffold, diagnostics)` self-filters to the two camp-c kinds the semantic classifier emits and either folds a reducible site into a bounded ring (REUSING `transformCampB` via a synthetic camp-b view of the same `.new()` call — no duplicated ring synthesis) or emits exactly one structured hard-reject with a context-specific suggested rewrite plus a `// [pine-converter] HARD-REJECT (...)` comment compute statement so no site is ever silently dropped.

  Ships three reducibility heuristics (`src/transform/campCHeuristics.ts`, `tryHeuristics`): **H1 implicit-cap-from-indicator** reads the chosen `K` from the scaffold's clamped `maxDrawings` for a `camp-c-bounded` site (Pine FIFO-evicts at the indicator cap anyway); **H2 bounded-by-loop-bound** recovers a literal / `input.int` `for i = 0 to L` bound around the push; **H3 single-use-collection** counts straight-line pushes. A heuristic returns `null` rather than guessing whenever the cap or push collection cannot be proven from the AST, and a fold only lands when the collection resolves at the root scope.

  Ships the reject registry (`src/transform/campCRejects.ts`, `CAMP_C_REJECTS` / `rejectSuggestion`) mapping each obstacle to a `SuggestionFn` templated over the inferred `K` and collection identifier. Adds seven `pine-converter/transform/...` diagnostic codes (`camp-c-heuristic-applied`, `dynamic-handle-index`, `cross-collection-linefill`, `polyline-dynamic-points`, `handle-copy`, `handle-store-in-udt`, `for-in-line-all`); the `unbounded-handle-collection` reject reuses the existing semantic-stage code. Strict-mode `output: null` suppression is left to Task 16 codegen, which reads the `error`-severity rejects + reject comments.

- 656390d: Add the control-flow + passthrough transform (`transformOther`), the last
  stage that populates the converted `compute` body for every non-drawing Pine
  statement: `if`/`else if`/`else`, literal- and `input.int`-bounded `for`
  (unrolled when the body calls a stateful primitive), `switch`/`case`,
  ternaries, scalar `var`/`varip`/`:=` lowered to `state.*` slots, `ta.*` /
  `math.*` / `str.*` passthrough, the `plot`/`plotshape`/`hline`/`bgcolor`
  family, `request.security` single-symbol MTF reads, and strategy-as-indicator
  signal alerts. Drawing statements already owned by the Camp A/B/C, table, and
  polyline/linefill transforms are skipped so the body never double-emits a
  drawing or lands a `draw.*` inside a loop.
- b55d4c8: Add the package-internal declaration transform that rewrites a Pine top-level `indicator(...)` / `strategy(...)` into the converter's `ScriptScaffold` IR — the mutable cross-task contract Tasks 9–15 populate. `transformDeclaration(decl, analysis, diagnostics)` (`src/transform/declaration.ts`) picks `defineIndicator` vs `defineDrawing` by scanning the body for plot-family calls (`plot`/`plotshape`/…/`hline`/`fill`/`bgcolor`/`barcolor`) vs drawing call-sites, downgrading to `defineDrawing` with a `drawing-only-script` info diagnostic when only drawings are emitted, and synthesizes a `defineIndicator` shell for `strategy(...)` (dropping backtester args, preserving `max_*_count`) with a `strategy-as-indicator` info. The §2 arg map (`src/transform/declarationArgs.ts`) lowers `title`/`shorttitle`/`overlay`/`format.*`/`precision`/`scale.*`/`max_*_count`/`max_bars_back` to chartlang options, defaults each `max_*_count` bucket to 50, clamps over-cap buckets (`max-count-out-of-range`), and warns on every unmapped arg (`indicator-arg-not-mapped`). A computed (non-literal) title raises `computed-indicator-title` and falls back to `"<unknown>"`.

  Introduces the shared `DiagnosticCollector` (`src/transform/diagnosticCollector.ts`) — a mutable `push`/`pushCode`/`has`/`toArray`/`size` accumulator that the `void`-returning Tasks 10–15 push into — and the `ScriptScaffold` IR (`src/transform/ir.ts`) plus its single mutation surface `appendInput`/`appendStateSlot`/`appendComputeStatement`/`appendHandleSlot`/`appendHandleRing` (`src/transform/scaffoldMutators.ts`). Adds five `pine-converter/transform/...` diagnostic codes (`indicator-arg-not-mapped`, `drawing-only-script`, `strategy-as-indicator`, `computed-indicator-title`, `max-count-out-of-range`). All new symbols re-exported from `src/transform/index.ts`.

- 656390d: Add the package-internal `input.*` transform that lowers every Pine `input.int`/`float`/`bool`/`string`/`color`/`source`/`symbol`/`timeframe`/`time`/`price`/`text_area` declaration into a chartlang `input.*(...)` source string appended to the `ScriptScaffold`'s `inputs` array. `transformInputs(analysis, scaffold, diagnostics)` (`src/transform/inputs.ts`) walks the analysed script body (including `if`/`for`/`switch`/block bodies and nested expression trees), keying a named declaration (`len = input.int(20)`) by its bound name and promoting an inline call (`ta.ema(close, input.int(20))`) to a synthesised `__input_<n>` name with an `inline-input-promoted` info. It consumes the Task 6 `INPUT_MAP` (`input.timeframe` → `input.interval`, `input.text_area` → `input.string` + `multiline: true`), maps `minval`/`maxval`/`step` → `min`/`max`/`step`, lowers `input.source` OHLCV built-ins to `SourceField` string literals, and accepts compile-time-literal defaults (including unary `+`/`-` on a numeric literal).

  Adds `src/transform/timeframeConvert.ts` with bidirectional `pineTimeframeToInterval` / `intervalToPineTimeframe` helpers (reused by Task 15's MTF support) and six `pine-converter/transform/...` diagnostic codes: `input-enum-rejected`, `unknown-input-primitive`, `non-literal-source-input`, `non-literal-input-default`, `input-arg-not-mapped`, and `inline-input-promoted`. `transformInputs` and the timeframe helpers are re-exported from `src/transform/index.ts` (package-internal).

- 656390d: Add the polyline + linefill transform (`src/transform/polylineLinefill.ts` + `src/transform/colorConvert.ts`). `transformPolylineLinefill(analysis, scaffold, diagnostics)` self-filters the `polyline.new` and static `linefill.new` drawing sites and lowers them into the `ScriptScaffold` IR.

  Polylines map to `draw.polyline` (straight), `draw.curve` (a 3-anchor `curved=true`), or `draw.path` with `closed: true` (a closed loop). Because the parser does not support Pine's `[...]` square-bracket array literal, the reachable anchor source is the `var array<chart.point>` build idiom: a literal-bounded `for i = 0 to N` loop that `array.push`es `chart.point.*` values unrolls (iterator-substituted) into a fixed anchor list rebuilt each `barstate.islast` tick; a non-literal (data-driven) bound is the finalised `polyline-dynamic-points` reject. A `>3`-anchor `curved=true` falls back to `draw.polyline` with a warning; `polyline.delete` emits the remove + slot-clear pattern.

  Static two-line `linefill.new(lineA, lineB, color)` is approximated as a filled `draw.rotatedRectangle(quad, { fill, fillAlpha })` over the two referenced lines' endpoints — `draw.path`/`PathOpts` carries no fill, so `ShapeStyle` on a rotated rectangle is the only fill-capable arbitrary-quad primitive. `linefill.set_color` folds into a style update, `linefill.delete` clears the slot, and a bar-by-bar two-series fill additionally raises `linefill-series-fill`. The shared `convertColor` / `transpToAlphaHex` helpers fold `color.new(base, transp)` into a `#RRGGBBAA` hex (`color.new(color.gray, 80)` → `#787B8633`).

  `transformCampC` now early-returns on `polyline.new` and the static (non-`array.get`) `linefill.new` so Task 14 solely owns them; a collection-driven `linefill.new(array.get(...))` cross-collection fill remains a Camp C `cross-collection-linefill` reject. Adds five `pine-converter/transform/...` diagnostic codes: `polyline-curved-anchors-warning`, `polyline-closed-info`, `linefill-series-fill`, `linefill-color-transp-approximated`, `linefill-rotatedrect-approximated`.

- 656390d: Add the tables transform (`src/transform/tables.ts`) — translates Pine's mutable-builder table API (`table.new` + `table.cell` + `table.cell_set_*` + `table.merge_cells` + `table.clear` + `table.delete`) into chartlang's immutable functional `draw.table({ position, cells })`. `transformTables(analysis, scaffold, diagnostics)` self-filters the `camp-a` `table.new` sites (one persistent handle per `var table`/`varip table`, REUSING the Camp A handle-slot naming via `handleSlotLocalName`), collects every observed `(col, row)` cell write into a last-write-wins map, and emits one `rows × columns` 2D `cells` array literal rebuilt each `barstate.islast` tick. `table.new` sites are NOT routed through `transformCampA` (its `draw.*` synthesis has no `table` method); Task 16 codegen hands them to this transform.

  Position and cell styling enums (`position.*`, `text.align_*`, `size.*`, `color.*`) lower through the shared mapping table; loop-driven cell writes (`for i = 0 to N`) unroll with literal-iterator substitution (`close[i]` → `bar.close[2]`); `merge_cells` keeps the top-left cell and blanks the span; `clear` is a rebuild-each-bar no-op; `delete` emits the slot-clear pattern; and the `other` drawing-bucket cap is widened to the table count. Adds seven `pine-converter/transform/...` diagnostic codes (`table-multi-init`, `table-cell-out-of-bounds`, `table-dynamic-loop`, `table-merge-fallback`, `table-clear-noop`, `table-bucket-cap-adjusted`, `table-formatting-not-mapped`). The core `draw.table` cell model (`text` + `bgColor`/`textColor`/`textHalign`/`textValign`/`textSize`) matches Pine's grid cleanly; only merge and Pine's `text_formatting`/`text_font_family`/`text_wrap` lack an analogue and are handled by fallback + warning.

- 850ae21: Promote every remaining `@experimental` symbol to `@stable`. The entire
  `pine-converter` public surface, the three `pineConverterRoundTrip*` conformance
  scenarios, and `runtime/barPoint.ts` now carry the stable maturity marker.
  Annotation-only — no behavior, API, or output changes; goldens and conformance
  reports are byte-identical. The hand-authored `docs/converter/index.md`
  stability line is updated to match.
