# Precise buffer sizing for bounded-loop & const series indices

## Overview

chartlang series reads at a **non-literal** index (`series[i]`,
`series[k]`, `series[i + 1]`) are handled today by a single fallback:
the compiler emits a `dynamic-series-index` **warning** and sets
`manifest.seriesCapacities.dynamicFallback = 5000`, so the runtime sizes
its ring buffers to 5000 slots instead of the tight `maxLookback + 1`.

But chartlang already constrains the only legal `for` loop to a
**fully static, literal-bounded** shape
(`for (let i = <lit>; i </<= <lit>; i++)`, enforced by
`forbiddenConstructs.checkForStatement`), and `const`-bound numeric
literals are likewise known at compile time. That means a large class of
"dynamic" indices have a **provable compile-time upper bound** and need
no fallback at all.

This feature teaches `extractMaxLookback` to resolve those indices
precisely. After it lands, the canonical manual-SMA loop

```ts
let sum = 0;
for (let i = 0; i < 5; i++) sum += bar.close[i];
const manual = sum / 5;
```

compiles to `maxLookback: 4` (buffer = 5 slots, byte-identical to the
unrolled `(bar.close[0] + … + bar.close[4]) / 5`) with **no**
`dynamic-series-index` warning and **no** 5000-slot fallback. The
genuinely-unresolvable cases keep today's safe behaviour.

> **Baseline note.** This folder predates the
> **directly-indexable-bar-series** feature (`tasks/directly-indexable-bar-series/`,
> landed): the bar's OHLCV + derived fields are now `PriceSeries`
> (`number & Series<number>`), so `bar.close[i]` is the natural rolling-window
> source — no `ta.ema(bar.close, 1)` "make it indexable" helper. A **literal**
> `bar.close[2]` already sizes precisely; this feature extends that to a
> **loop/const/affine** index `bar.close[i]`, which today still trips the
> 5000-slot fallback.

The resolver is an **over-approximation**: it only emits a precise
`maxLookback` when it can prove an upper bound `≥` the true max index;
anything it cannot prove falls back to warn + 5000. The runtime buffer
is hard-bounded and returns `NaN` on out-of-range reads, so a correct
over-approximation never under-sizes and never reads stale memory.

References: root `CLAUDE.md` (per-folder-CLAUDE + skills-mirror rules),
`packages/compiler/CLAUDE.md` (static-analysis-on-original-AST +
`extractMaxLookback` invariants), `CONTRIBUTING.md` §16.1 (100%
coverage) / §16.3 (test layers), `docs/CLAUDE.md`
(`examples:generate` / `examples:gate`), `packages/conformance/CLAUDE.md`
(scenario shape, `inlineSource`, `plot-hash`).

## Current State

- **Compiler** (`packages/compiler/src/analysis/extractMaxLookback.ts`):
  the `ElementAccessExpression` walk (lines 74–94) accepts an index that
  `ts.isNumericLiteral(argument)` and contributes its value to
  `maxLookback`. Every **other** index expression falls into the `else`
  branch: it pushes a `dynamic-series-index` warning and sets
  `seriesCapacities.dynamicFallback = 5000`. There is **no** resolution
  of loop-induction variables or `const`-bound literals.
- **Loop bounds** (`packages/compiler/src/analysis/forbiddenConstructs.ts`,
  `checkForStatement` lines 70–90): the only legal `for` shape is parsed
  inline here — single `let i = <numericLiteral>` init, condition
  `i <comparison> <numericLiteral>` (id on left, literal on right),
  postfix `i++` incrementor. This logic is **private** to
  `forbiddenConstructs` and not reused anywhere.
- **No constant evaluator exists.** The compiler only pattern-matches
  literals locally (`extractInputs.readLiteral`,
  `extractMaxLookback`'s numeric-literal reads). There is no helper that
  evaluates `2 + 3`, resolves a `const k = 5` binding, or computes the
  range of an affine expression.
- **Runtime** (`packages/runtime/src/createScriptRunner.ts`):
  `capacity = max(1, ohlcv ?? (maxLookback + 1), dynamicFallback ?? 0)`.
  The `seriesView` proxy coerces any numeric key to `buf.at(n)`, and
  `Float64RingBuffer.at` returns `NaN` for `n < 0 || n >= filled`
  (`ringBuffer.ts:127`). `resolveCapacity` **now honours
  `seriesCapacities.dynamicFallback`** (the 5000-slot safety net the
  compiler emits for non-literal indices) — previously it read only
  `.ohlcv` and silently collapsed every dynamic-index callsite to a
  1-slot buffer, turning real history into `NaN` (the "forecast line
  never drawn" bug, fixed alongside this work). So a loop / const index
  **today reads correctly, but via the fat 5000-slot fallback + a
  `dynamic-series-index` warning**. This feature is purely compile-time
  buffer-sizing + warning accuracy; no further runtime change is
  required.
- **Docs / skill**: `docs/language/series-and-indexing.md`,
  `skills/chartlang-coding/SKILL.md`, and the canonical spec
  (`docs/spec/semantics.md`, `docs/spec/grammar.md`, `docs/spec/manifest.md`)
  all state that **any** non-literal index warns + forces the 5000-slot
  buffer. (The directly-indexable-bar-series feature already updated the
  series-and-indexing guide + skill to say the *bar* fields are series and
  index *literally* — but the **non-literal / loop** carve-out below is still
  unwritten there.) The hand-authored `docs/converter/*` and the generated
  `docs/converter/diagnostics.md` describe the converter's own separate
  convert-time diagnostic and are **unaffected** (Task 3 §6).
- **Example**: the `manual-sma` entry in
  `apps/site/src/components/demo/scripts.ts` is written (post
  directly-indexable-bar-series) as an unrolled
  `(bar.close[0] + … + bar.close[4]) / 5` — literal indices, no helper.
  This feature converts it to the equivalent bounded `for` loop
  (`for (let i = 0; i < 5; i++) sum += bar.close[i]`) to showcase precise
  loop-index sizing. `docs/examples/manual-sma.md` is the generated mirror.

## Target State

- `extractMaxLookback` routes **every** series index through a new
  `resolveIndexUpperBound(argument, …)` resolver that returns
  `number | null`:
  - a numeric literal → its value (subsumes today's literal branch);
  - a bare loop-induction variable `i` of an enclosing bounded `for`
    loop → the loop's max index (`limit − 1` for `<`, `limit` for `<=`);
  - a lexically visible `const`-bound numeric literal `k` → its value;
  - an **affine** combination of the above via `+`, `−`, `*`, unary `−`,
    and parentheses → the upper bound of its computed integer interval;
  - anything else, or any sub-term the resolver cannot prove → `null`.
- A resolved `number ≥ 0` contributes to `maxLookback` exactly like a
  literal; **no** warning, **no** `dynamicFallback`. A `null`
  resolution keeps today's behaviour (`dynamic-series-index` warning +
  `dynamicFallback = 5000`). A resolved negative upper bound contributes
  `0` (the read is always `NaN`/future, no buffer depth).
- The resolver is **sound (never under-sizes)**: it refuses
  (`→ null`) when a loop variable is reassigned in the body beyond its
  `++`, when the loop is non-terminating (`>`/`>=` with `++`), or when a
  binding is `let`/mutable rather than a `const` numeric literal.
- Docs + skill describe the carve-out: literal **and** provably-bounded
  (loop/const/affine) indices are sized precisely; only genuinely
  dynamic indices warn + fall back.
- The `manual-sma` example is a real `for` loop with an accurate comment
  and a regenerated docs page.
- A conformance scenario proves a loop-SMA is bar-for-bar identical to
  `ta.sma(close, 5)`.

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **Over-approximation, never under-size** | The runtime buffer is hard-bounded and returns `NaN` out of range. An upper bound that is too *large* only wastes a few slots; one too *small* silently turns real data into `NaN`. The resolver returns `null` (safe fallback) whenever it cannot prove a sound upper bound. |
| **One interval evaluator subsumes all cases** | Bare loop-var, const-fold, and affine are the same problem — "what is the max integer this expression can reach?" A single interval evaluator over literals + bound variables + `+`/`−`/`*`/unary-`−`/parens covers all three; the literal and bare-var cases are its trivial leaves. |
| **Extract a shared loop-bounds helper** | The legal-`for` shape is parsed today only inside `forbiddenConstructs`. The resolver needs the exact same parse. Extracting `parseBoundedForLoop` into one module keeps the two passes from drifting (a divergence would let the resolver size a loop `forbiddenConstructs` rejects, or vice-versa). |
| **`const` numeric literals only (not `let`)** | A `const k = 5` binding is immutable and foldable; a `let` could be reassigned anywhere. Folding only `const` numeric-literal initialisers (incl. unary `±`) keeps the analysis sound without dataflow. |
| **Resolve bindings at the use site** | A single scope-wide `const` map is unsound: it would see declarations after the read, declarations inside sibling blocks, and shadowed names. The resolver builds the numeric `const` environment for each series index from declarations lexically visible at that exact use site, and loop-variable resolution rejects shadowed identifiers. |
| **Reject `*` /`−` only when sign makes the bound unprovable** | Interval arithmetic for `+`/`−`/`*`/unary-`−` is exact over integer endpoints. Division/modulo/other operators (which can produce non-integers or unbounded results) → `null`. |
| **No runtime change** | `resolveCapacity` already honours `dynamicFallback` (5000-slot fallback) **and** the tight `maxLookback + 1`, so loop reads execute correctly today via the fat buffer. Shrinking the manifest's `maxLookback` / dropping `dynamicFallback` is automatically honoured — a precise `maxLookback` flows through the existing `ohlcv ?? (maxLookback + 1)` path, and an absent `dynamicFallback` contributes `0`. |
| **Split foundation vs affine** | Keeps each task spec tight: Task 1 builds the resolver skeleton + leaf cases (literal/loop-var/const) and the integration; Task 2 adds the operator interval arithmetic. Both are independently testable to 100%. |

## Dependency Graph

```
Task 1 (compiler: shared loop-bounds helper + resolver foundation —
        literal / bare loop-var / lexically-visible const-literal; wire into
        extractMaxLookback; warning suppression; CLAUDE.md)
  |
  v
Task 2 (compiler: affine index expressions — interval arithmetic over
        +, −, *, unary −, parens; extend resolver + tests; CLAUDE.md)
  |
  v
Task 3 (surface: convert manual-sma example, regenerate docs;
        conformance loop-SMA scenario; docs/language + skill update;
        changeset)
```

## Task Summary

| # | Title | Package(s) | Dependencies | Est. Complexity |
|---|-------|-----------|--------------|-----------------|
| 1 | [Compiler: loop-bounds helper + index-bound resolver foundation](./1-compiler-index-bound-resolver.md) | compiler | None | High |
| 2 | [Compiler: affine index expressions](./2-compiler-affine-index.md) | compiler | 1 | Medium |
| 3 | [Surface: example, conformance, docs (language + spec), skill, changeset](./3-surface-example-conformance-docs.md) | apps/site, docs (language + spec), conformance, skills | 1, 2 | Medium |

## Code Reuse

| Existing | Path | Reuse for |
|----------|------|-----------|
| `checkForStatement` (inline `for`-shape parse) | `packages/compiler/src/analysis/forbiddenConstructs.ts:70` | Extract into the shared `parseBoundedForLoop` helper (Task 1); `forbiddenConstructs` then consumes it so the two passes share one parse. |
| `extractMaxLookback` element-access walk | `packages/compiler/src/analysis/extractMaxLookback.ts:74` | Replace the `ts.isNumericLiteral` branch with `resolveIndexUpperBound`; build the lexical `const` environment at each index use; keep the `dynamic-series-index` + `dynamicFallback` path for `null`. |
| `unwrapParens` | `packages/compiler/src/analysis/extractMaxLookback.ts:129` | Reuse inside the resolver to peel parentheses before matching. |
| `readLiteral` numeric/unary parsing | `packages/compiler/src/analysis/extractInputs.ts:315` | Pattern to mirror (not import) for reading `const k = -3` numeric-literal initialisers in the const environment. |
| `seriesView` / `Float64RingBuffer.at` | `packages/runtime/src/seriesView.ts`, `ringBuffer.ts:127` | No change — confirms loop reads already execute correctly + bound-check to `NaN`. |
| `inlineSource` scenario file structure | `packages/conformance/src/scenarios/taDema.scenario.ts` | Template for the Task 3 loop-SMA scenario's hoisted `INLINE_SOURCE` / `ASSERTIONS` + `Scenario` literal (`bollingerBands.scenario.ts` uses `scriptPath`, so it is only the `plot-hash` assertion-shape reference). |
| `ALL_SCENARIOS` registration | `packages/conformance/src/scenarios/index.ts:498` | `ALL_SCENARIOS` is defined here (not `src/index.ts`); the Task 3 scenario is imported, re-exported, and appended to the frozen literal here. |
| `examples:generate` / `examples:gate` | `scripts/gen-examples-docs.ts`, `docs/CLAUDE.md` | Regenerate `docs/examples/manual-sma.md` after editing `DEMO_SCRIPTS` (Task 3). |

## Provenance

No `../invinite/` port. chartlang-native compiler-analysis improvement.

## Deferred / Follow-Up Work

- **Loop variable as a `bar.point(-i, …)` offset.**
  `readBarPointLookback` only resolves a negative *literal* offset; the
  same resolver could later size `bar.point(-i, …)` inside a bounded
  loop. Out of scope here (plot/series indexing only).
- **`ta.*` literal-length args via const folding.**
  `readHighestLowestBarsDepth` / a future length-aware primitive could
  fold a `const len = 14; ta.sma(close, len)`. The resolver built here
  is reusable for it, but wiring those call sites is separate.
- **Tighten `checkForStatement` to reject non-terminating `>`/`>=` with
  `++`.** A pre-existing gap (`for (let i = 0; i > 5; i++)` is accepted
  though it never enters / would be infinite). The resolver correctly
  refuses to size these; fixing the loop validator itself is a separate
  bugfix.
- **Pine converter: emit loops / relax the convert-time reject.** The
  converter (`packages/pine-converter`) is **verified unaffected** by this
  feature (compiler-only — Task 3 §6). The directly-indexable-bar-series
  feature already made a **literal** Pine `close[2]` compile (`bar.close[2]`);
  as a follow-up the converter could (a) emit a bounded `for`-loop rolling
  window instead of unrolling a stateless window, and (b) relax its
  convert-time `pine-converter/transform/dynamic-series-index` reject for a
  **bounded** Pine `x[i]` now that the compiler sizes it precisely. Both are
  converter-side enhancements, out of scope here.
