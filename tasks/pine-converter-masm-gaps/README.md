# Pine Converter — MASM Strategy Gaps

## Overview

Land a set of **general** Pine Script → chartlang converter fixes (and
two cross-package runtime/compiler features) surfaced by converting the
real-world **MA Slope Master Strat 2.3** indicator (repo-root
`MASM_Strat.md`). None are special-cased to that one script — MASM is
used only as the *forcing function*: a large, feature-heavy Pine **v5**
strategy that today produces **16 errors / 13 warnings** and an emitted
file that does not type-check, exercising every gap at once.

After these tasks any script using these constructs converts cleanly;
MASM is the manual end-to-end check (`pnpm chartlang pine-convert
MASM_Strat.md --report` then `pnpm chartlang compile <out>`), **not** a
committed regression fixture — every gap gets its own minimal golden
fixture instead.

All findings are **verified by reproduction** (converter run + compile
of the emitted output). The diagnosis — exact files, line numbers, and
why each construct fails — is captured in the conversation research
report that produced this folder. Anchors are inlined per task.

Relevant contracts: root `CLAUDE.md`; `packages/pine-converter/CLAUDE.md`
(pipeline + diagnostics + mapping invariants); `packages/core/CLAUDE.md`,
`packages/runtime/CLAUDE.md`, `packages/compiler/CLAUDE.md`
(determinism, loop-bound, and lookback invariants).

## Current State

Converting `MASM_Strat.md` today:

- **`unsupported-pine-version`** — the script is `//@version=5`; the
  converter only accepts v6 (a pure header check).
- **`non-literal-input-default` ×4** — `input.color(color.rgb(...), …)`
  and `input.color(color.yellow, …)`: a `color.rgb(...)` call / named
  color constant is not recognised as a compile-time literal default.
- **free-expression `color.new` / `color.rgb`** — used in assignments
  / ternaries (e.g. `ma_slope_clr = color.new(clr_green, 0)`); the
  color lowering pass is only wired into plot/hline/table arg
  positions, so the call leaks verbatim and the emitted file fails to
  compile (`Property 'new' does not exist on type …color`).
- **`unknown-identifier` ×8** — bar-time builtins `timestamp(...)` and
  `timenow` are unmapped (cascading through `time >= timestamp(...)`
  and `time_close - timenow`).
- **`request-security-not-mapped` ×3** — symbol is a runtime variable
  (`input.string` dropdown) or a string-concatenation template; the
  daily `"D"` timeframe is *not* the blocker.
- **`var string alert_msg = na`** → emitted `let … : string | null =
  null`; later `:=` assignments don't narrow, so `alert(alert_msg)`
  fails to compile (`'string | null' not assignable to 'string'`).
- **`loop-unroll-frozen-at-input-default`** — `for i = 0 to
  consol_tolerance` (an `input.int`) is unrolled at the input's
  default; runtime input changes don't change the iteration count.

Cosmetic diagnostics (`history-on-non-series`, `nested-ta-lowered`,
`plot-display-approximated`, `alert-frequency-not-mapped`,
`input-arg-not-mapped`, `color-transp-approximated`,
`request-security-lookahead-not-supported`) are **expected residuals**
documented in `packages/pine-converter/CLAUDE.md` and get **no task**.

## Target State

- `MASM_Strat.md` (and any v5 script in the supported subset) converts
  with no error-severity diagnostics for these constructs, and the
  emitted `.chart.ts` type-checks via `pnpm chartlang compile`.
- New surface: `time.now()` (core/runtime), a `timenow`/`timestamp`
  builtin mapping, color-literal input defaults, color lowering in free
  expressions, `input.string`/literal-concat security symbols, an
  empty-string default for `var string = na`, and an input-bound
  runtime `for` loop (compiler accepts the bound; buffer sized from
  `input.maxval`).

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **Accept v5 with a warning, not silent acceptance** | The gate is a pure header check and the transform pipeline is version-agnostic; but un-modelled v5/v6 semantic deltas could exist, so emit a `pine-version-downlevel` warning rather than silently treating v5 as v6. |
| **`time.now()` reuses the existing `args.now` seam** | `createScriptRunner` already injects `now: () => number` (defaults to `Date.now`), used today for snapshot cadence. Exposing it via the `time` sentinel pattern keeps determinism (now is a host input, never serialised). |
| **`request.security` symbol scope = dropdown + literal-concat** | The runtime accepts any symbol string already; relaxing the converter's `input.symbol`-only guard to also accept `input.string` and fold literal `+` concatenation covers both MASM forms with converter-only changes. `ignore_invalid_symbol` stays a silent drop (no runtime contract). |
| **Loop buffer sized from `input.maxval` (precise)** | The runtime already supports dynamic history indexing; the blocker is the compiler's literal-bound rule. Threading `input.int` `maxval` to size the ring buffer avoids the wasteful 5000-slot fallback. |
| **One minimal golden fixture per gap** | MASM is not committed; each behavior change lands a small, targeted `NN-*.pine`/`.expected.chart.ts`/`.expected.diagnostics.json` trio. |
| **Diagnostic code strings are append-only** | Per `codes.ts` contract — new codes are appended, never reordered or renamed (stable public contract). |

## Dependency Graph

```
Task 1 (accept v5)            Task 2 (na string default)
Task 3 (timestamp builtin)    Task 4 (color literal input defaults)
Task 5 (security symbols)     Task 6 (color.new free expr)
   — all six are independent converter-only changes —

Task 7 (time.now wall-clock: core → runtime → converter mapping)
   └ shares the builtin-mapping touch-point with Task 3 (sequence after it)

Task 8 (input-bound loop: compiler loopBounds + maxval sizing → converter emit)
   └ independent of 1-7; largest, sequenced last
```

All tasks are independently landable; the numbering is the recommended
execution order (cheap/unblocking first, cross-package features last).

## Task Summary Table

| # | Title | Package(s) | Dependencies | Est. Complexity |
|---|-------|-----------|--------------|-----------------|
| 1 | [Accept Pine v5 scripts](./1-converter-accept-pine-v5.md) | pine-converter | None | Low |
| 2 | [`var string = na` empty-string default](./2-converter-na-string-default.md) | pine-converter | None | Low |
| 3 | [`timestamp()` builtin mapping](./3-converter-timestamp-builtin.md) | pine-converter | None | Low |
| 4 | [Color-literal input defaults](./4-converter-color-literal-input-defaults.md) | pine-converter | None | Medium |
| 5 | [Dropdown + concat security symbols](./5-converter-security-dropdown-concat-symbols.md) | pine-converter | None | Medium |
| 6 | [`color.new` in free expressions](./6-converter-color-new-free-expressions.md) | pine-converter | None | High |
| 7 | [`time.now()` wall-clock + `timenow`](./7-runtime-time-now-wallclock.md) | core, runtime, pine-converter | 3 | Medium |
| 8 | [Input-bound runtime loop](./8-compiler-input-bound-loop.md) | compiler, pine-converter | None | High |

## Code Reuse

| Existing | Path | Used by |
|----------|------|---------|
| Color folding helpers (`convertColorWith`, `convertColorNew`, `convertColorRgb`, `baseHex`, `transpToAlphaHex`) | `packages/pine-converter/src/transform/colorConvert.ts:137` | Tasks 4, 6 |
| Core color API (`withAlpha`, `rgb`, `hsl`, named palette) | `packages/core/src/color/index.ts:23` | Tasks 4, 6 |
| `literalDefault()` input-default checker | `packages/pine-converter/src/transform/inputs.ts:81` | Task 4 |
| `time.timestamp` / sentinel pattern (already in core) | `packages/core/src/time-accessors/timeAccessors.ts:6,134` | Tasks 3, 7 |
| Builtin maps (`BUILTIN_IDENTIFIER_MAP`, `BUILTIN_CALL_MAP`) | `packages/pine-converter/src/mapping/builtinIdentifiers.ts:34`, `builtinCalls.ts:38` | Tasks 3, 7 |
| Host `now` injection seam | `packages/runtime/src/createScriptRunner.ts:187,312` | Task 7 |
| `time` namespace factory/builder | `packages/runtime/src/time-accessors/timeAccessors.ts:50,147` | Task 7 |
| Security feed-input axis registry (`feedAxisOfValue`) + symbol resolver (`resolveSymbolSource`) | `packages/pine-converter/src/transform/securityShape.ts:113,192` | Task 5 |
| Bounded-loop parser (single source of truth) | `packages/compiler/src/analysis/loopBounds.ts:67` | Task 8 |
| Lookback / ring-buffer sizing | `packages/compiler/src/analysis/extractMaxLookback.ts:104`, `resolveIndexBound.ts:79` | Task 8 |
| Loop emit (`emitFor`, `emitRuntimeForFromBounds`, `unroll`) | `packages/pine-converter/src/transform/controlFlow.ts:508,577,619` | Task 8 |
| Golden harness + `UPDATE_FIXTURES=1` | `packages/pine-converter/src/tests/golden.test.ts:20,54` | all tasks |

## Provenance

No `../invinite/` ports. All work is net-new converter/runtime/compiler
logic verified against `MASM_Strat.md` reproduction.

## Deferred / Follow-Up Work

- **`timenow` historical-replay semantics** — `time.now()` returns the
  host's injected clock at call time; on a historical replay this is
  not the bar's wall-clock. Documented, not "fixed" (Pine behaves the
  same on replay).
- **Arbitrary computed `request.security` symbols** (non-foldable
  expressions) — out of scope; only literal-foldable concatenation is
  supported (Task 5).
- **`ignore_invalid_symbol`** real runtime contract — deferred
  (silent-drop retained).
- **`alert.freq_*` frequency contract** in `AlertOpts` — deferred
  (cosmetic).
- **`plot(display=…)` targets beyond all/none** — deferred (no
  chartlang analogue).
