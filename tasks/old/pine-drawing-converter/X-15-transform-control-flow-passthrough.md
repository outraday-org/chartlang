# Task 15 — Transform: control flow + minimal `ta.*` / `math.*` passthrough

> **Status: TODO**

## Goal

Rewrite Pine control-flow statements (`if`/`else if`/`else`,
literal-bounded `for`, `switch`/`case`, `break`/`continue`,
ternaries) into chartlang TS-IR shapes the codegen (Task 16) can
emit verbatim, and translate Pine `ta.*`, `math.*`, `str.*`, and OHLCV
identifier references using the mapping tables from Task 6. The result
is a fully-populated `ScriptScaffold.computeBody` ready for codegen.

## Prerequisites

Task 14 (all drawing transforms complete — the compute body needs to
hold drawing logic alongside this task's other-statement rewrites).

## Current Behavior

`scaffold.computeBody` contains drawing-related statements from
Tasks 10–14. Control flow and non-drawing call-sites are
unprocessed.

## Desired Behavior

A package-internal `transformOther(analysis: SemanticResult, scaffold:
ScriptScaffold, diagnostics: DiagnosticCollector): void` API in
`src/transform/other.ts`:

1. Walks every Pine `Statement` in source order.
2. For non-drawing statements, rewrites them into the corresponding
   chartlang TS-IR statement.
3. Resolves every `IdentifierExpression` via the Task 5 scope graph
   and emits the chartlang-side name (built-in remap + input rewrite).
4. Resolves every `CallExpression` against `TA_PASSTHROUGH_MAP` /
   `MATH_PASSTHROUGH_MAP` / built-in plot family — emits the chartlang
   call or a passthrough warning.
5. Maintains correct order of statements relative to the drawing
   transforms (Tasks 10–14 each set a `sourceIndex` on their IR
   statements; this task interleaves the other statements at their
   own source indices, producing a single ordered list).

## Requirements

### 1. Control-flow rewrites

| Pine | chartlang TS |
|---|---|
| `if cond\n    body` | `if (cond) { body }` |
| `if cond1\n    a\nelse if cond2\n    b\nelse\n    c` | `if (cond1) { a } else if (cond2) { b } else { c }` |
| `for i = a to b\n    body` | `for (let i = a; i <= b; i++) { body }` (a, b must be literals or input.int defaults — Task 5 enforces). **If the body contains a stateful primitive call (`draw.*`, `plot`, `hline`, `alert`, `ta.*`), the loop MUST be unrolled at convert time** — see §1a. |
| `for i = a to b by s\n    body` | `for (let i = a; i <= b; i += s) { body }` (same unroll requirement) |
| `for x in arr\n    body` | REJECT (Task 3 diagnostic) |
| `while cond\n    body` | REJECT (Task 3 diagnostic) |
| `switch x\n    a => b\n    c => d\n    => e` | `switch (x) { case a: b; break; case c: d; break; default: e; break; }` |
| `switch\n    a => b\n    c => d\n    => e` | chain of `if/else if/else` (switch without expression evaluates each case condition) |
| `break` | `break;` |
| `continue` | `continue;` |
| `var x = expr` | hoisted into a `state.<type>(expr)` if `x` is series-typed; otherwise `let x = expr` at the top of compute |
| `varip x = expr` | `state.tick.<type>(expr)` |
| `x := expr` | reassignment via the corresponding state slot or `let` |

### 1a. Loop-body unrolling for stateful primitives

chartlang's compiler has a `stateful-call-inside-loop` gate
(`packages/compiler/src/analysis/statefulCallInLoop.ts`) that rejects
**any** stateful primitive call (`draw.*`, `plot`, `hline`, `alert`,
`ta.*`) inside **any** loop — there is no literal-bound carveout.
The Pine source `for i = 0 to 9\n    plot(close[i])` therefore cannot
be emitted as a runtime `for` loop; the converter must unroll it:

```ts
plot(bar.close[0]);
plot(bar.close[1]);
// ... through plot(bar.close[9])
```

Rules:
- Detect stateful primitive calls in the loop body via the same
  `STATEFUL_PRIMITIVES_BY_NAME` registry the compiler uses (or a
  hand-mirrored copy in `src/transform/statefulNames.ts`).
- If at least one is present AND the bounds are literal/input.int → unroll.
- If at least one is present AND the bounds are non-literal → emit
  error `loop-bounds-not-literal-for-stateful-body` with the
  recommended Pine rewrite (lift the stateful call out of the loop).
- If no stateful primitive is present → emit a runtime `for` loop as normal.

This rule also applies to Task 11's loop-driven ring updates (which
only call `.update()` on handles — `.update()` is a method, NOT a
stateful primitive, so it's permitted inside loops).

| Pine | chartlang TS |
|---|---|
| `and` | `&&` |
| `or` | `\|\|` |
| `not` | `!` |
| `==`, `!=`, `<`, `<=`, `>`, `>=` | same |
| `+`, `-`, `*`, `/`, `%` | same |
| `?:` (ternary) | same |
| `:=` (Pine reassignment) | `=` in chartlang |
| `=` (Pine reassignment when shadowing) | `let x =` (declaration) per Task 5 classification |

### 3. `ta.*` passthrough

For each `ta.<name>(...)` call:

- Look up in `TA_PASSTHROUGH_MAP` (Task 6).
- If found → emit chartlang `ta.<chartlangName>(...)` with arg
  passthrough (recursively transformed).
- If found with `signatureNote` → emit warning `ta-signature-divergence`
  with the note's text.
- If not found → emit warning `ta-not-mapped` + passthrough call with
  `/* TODO unmapped */` comment.

Pine `ta.*` arg conventions: chartlang has `opts` objects for many
calls (e.g. `ta.bb(source, length, { multiplier: 2 })` vs Pine's
positional `ta.bb(source, length, mult)`). The transform reshapes
positional args into the opts-object form via per-entry mapping
metadata in `TA_PASSTHROUGH_MAP`.

### 4. `math.*` passthrough

Identical pattern with `MATH_PASSTHROUGH_MAP`. Constants (`math.pi`,
`math.e`) inline as numeric literals. `math.random` emits hard error
per Task 6's REJECT marker.

### 5. `str.*` minimal mapping

For v1, support the common subset:

- `str.tostring(x)` → `String(x)`
- `str.tostring(x, format)` → `x.toFixed(precision)` for `format` like
  `"#.##"` (Pine format strings are parsed by a small helper in
  `src/transform/strFormat.ts`).
- `str.format(fmt, ...args)` → template-literal synthesis where
  possible; complex format strings → warning `str-format-not-mapped`.
- `str.length(s)` → `s.length`.
- `str.contains(haystack, needle)` → `haystack.includes(needle)`.
- `str.upper(s)` → `s.toUpperCase()`.
- `str.lower(s)` → `s.toLowerCase()`.
- Anything else → `str-not-mapped` warning + passthrough.

### 6. Plot family (when generating `defineIndicator`)

| Pine | chartlang |
|---|---|
| `plot(value, title, color, linewidth, style)` | `plot(value, { title, color, lineWidth, style: { kind: "line" } })` |
| `plotshape(condition, ..., location=, style=, color=)` | `plot(condition ? value : NaN, { style: { kind: "shape", shape, size, location } })` |
| `plotchar(condition, ..., char=)` | `plot(... , { style: { kind: "character", char, size } })` |
| `plotcandle(open, high, low, close, bull, bear)` | `plot(..., { style: { kind: "candle-override", bull, bear } })` |
| `plotbar(...)` | `plot(..., { style: { kind: "bar-override", color } })` |
| `plotarrow(value)` | `plot(value, { style: { kind: "arrow", direction: ... } })` |
| `hline(price, title, color, linestyle, linewidth)` | `hline(price, { title, color, lineWidth, lineStyle })` |
| `fill(plot1, plot2, color)` | REJECT (`fill-not-mapped` — chartlang has no plot-fill in v1) |
| `bgcolor(color)` | `plot(NaN, { style: { kind: "bg-color", color } })` |
| `barcolor(color)` | `plot(NaN, { style: { kind: "bar-color", color } })` |

### 7. `request.security` partial support

For v1, support the **single-symbol same-symbol intraday MTF** case:

```pinescript
htf = request.security(syminfo.tickerid, "1D", close)
```

Convert to chartlang:

```ts
const htf = request.security({ interval: "1d" }).close;
```

Note: `request.security({ interval }).close` returns `Series<Price>`,
NOT a scalar — Pine's `htf` is also a series, so the assignment is
series-to-series. Downstream references to `htf` follow the same
series-vs-current-value rules as `bar.close` (history op `htf[n]`
works; reading a scalar requires `htf.current`). When a downstream
mutation expects a scalar (e.g. inside a `draw.line(...)` price arg),
emit `htf.current` instead of `htf` and record an
`mtf-series-to-scalar-conversion` info diagnostic.

When `request.security` is called with:
- A different symbol than `syminfo.tickerid` → warning
  `request-security-different-symbol` (chartlang's `request.security`
  v1 only supports same-symbol).
- The `lookahead` parameter set → warning
  `request-security-lookahead-not-supported`.
- A series expression as the source → passthrough with note.

Anything more complex → `request-security-not-mapped` error.

### 8. Strategy-as-indicator signal emission

For scripts downgraded from `strategy(...)` (Task 8), translate
strategy entries/exits into `alert(...)` calls:

- `strategy.entry("Long", strategy.long)` → `alert("Long entry", {
  severity: "info" })` when the surrounding condition is true.
- `strategy.exit(...)` → `alert("Exit", { ... })`.
- Detailed args (size, price, stop, limit) → meta object on the alert.

This is a lossy translation; emit `strategy-signal-only` info per
emit site.

### 9. Series indexing `x[n]`

Direct passthrough — `x[n]` works in chartlang for series with literal
n. When `n` is non-literal:
- If `x` is a built-in OHLCV → REJECT `dynamic-series-index` (Task 5
  flagged this).
- If `x` is a ta.* result series → REJECT same.
- If `x` is a plain variable → REJECT.

### 10. Diagnostic codes (added this task)

- `ta-signature-divergence` (warning)
- `ta-not-mapped` (warning)
- `math-not-mapped` (warning)
- `str-format-not-mapped` (warning)
- `str-not-mapped` (warning)
- `fill-not-mapped` (error)
- `request-security-different-symbol` (warning)
- `request-security-lookahead-not-supported` (warning)
- `request-security-not-mapped` (error)
- `strategy-signal-only` (info)
- `dynamic-series-index` (error)
- `loop-bounds-not-literal-for-stateful-body` (error) — body has a
  stateful primitive call but bounds are non-literal so the unroll
  isn't possible.
- `loop-body-unrolled` (info) — emitted once per unrolled loop so the
  user sees how the source-to-source rewrite differs from a 1:1 mapping.
- `mtf-series-to-scalar-conversion` (info) — `request.security(...).close`
  used where a scalar is expected; converter inserts `.current`.

### 11. Tests (§16.3)

| File | Purpose |
|------|---------|
| `other.test.ts` | Per-construct fixtures: every control flow + every operator. |
| `ta-passthrough.test.ts` | Each entry in `TA_PASSTHROUGH_MAP` round-trips correctly. |
| `math-passthrough.test.ts` | Each entry round-trips; rejects emit errors. |
| `str-mapping.test.ts` | `str.tostring`, `str.format`, etc. |
| `plot-family.test.ts` | Each Pine plot variant maps to its chartlang style discriminator. |
| `request-security.test.ts` | Single-symbol MTF + various rejected cases. |
| `strategy-signals.test.ts` | strategy.entry/exit → alert() emit. |
| `other.property.test.ts` | Property: every Pine call-site is either mapped or has a diagnostic emitted. |

Coverage 100% on `src/transform/other.ts` and helper files.

### 12. JSDoc

Every exported function/type carries `@since 0.1`, `@experimental`,
and an `@example`.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/pine-converter/src/transform/other.ts` | Create | Top-level "everything else" transform. |
| `packages/pine-converter/src/transform/controlFlow.ts` | Create | If/for/switch rewriters. |
| `packages/pine-converter/src/transform/strFormat.ts` | Create | Pine format-string parser. |
| `packages/pine-converter/src/transform/plotFamily.ts` | Create | Plot variant mapping. |
| `packages/pine-converter/src/transform/requestSecurity.ts` | Create | MTF mapping. |
| `packages/pine-converter/src/transform/strategySignals.ts` | Create | Strategy → alert mapping. |
| `packages/pine-converter/src/transform/index.ts` | Modify | Re-export. |
| `packages/pine-converter/src/diagnostics/codes.ts` | Modify | Add Task-15 codes. |
| Tests (per the table above) | Create | §16.3 layer set. |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (100% coverage)
- `pnpm docs:check`

## Changeset

`.changeset/pine-converter-transform-other.md` — patch bump.

## Acceptance Criteria

- `if close > open\n    plot(close)` produces `if (bar.close > bar.open)
  { plot(bar.close); }`.
- `for i = 0 to 9\n    plot(close[i])` produces a literal-bounded `for`
  loop in the output.
- `ta.ema(close, 9)` → `ta.ema(bar.close, 9)`.
- `math.random()` emits error per Task 6 REJECT.
- `request.security(syminfo.tickerid, "1D", close)` produces
  `request.security({ interval: "1d" }).close`.
- `strategy.entry("Long", strategy.long)` emits an `alert(...)` call +
  `strategy-signal-only` info.
- 100% coverage on the listed files.
- JSDoc + lint + typecheck gates green.
- Changeset committed.
