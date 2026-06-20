# Task 3 — Surface: example, conformance, docs, skill, changeset

> **Status: TODO**

## Goal

Land the user-facing payoff and the end-to-end proof of the Task 1–2
compiler change: convert the `manual-sma` demo to a real bounded `for`
loop (with an accurate comment) and regenerate its docs page, add a
conformance scenario proving a loop-SMA is bar-for-bar identical to
`ta.sma(close, 5)`, update the language docs + author skill to describe
the precise-sizing carve-out, and ship the single feature changeset.

## Prerequisites

Task 1 + Task 2 (the compiler resolves loop / const / affine indices
precisely, so the converted example compiles with `maxLookback: 4` and no
`dynamic-series-index` warning).

## Current Behavior

- `apps/site/src/components/demo/scripts.ts` `MANUAL_SMA` computes the mean
  as an **unrolled**
  `(bar.close[0] + bar.close[1] + bar.close[2] + bar.close[3] + bar.close[4]) / 5`
  (post directly-indexable-bar-series — `bar.close` is now an indexable
  `PriceSeries`, so the old `ta.ema(bar.close, 1)` helper is gone), with a
  comment noting indices must be literal integers so the window is unrolled.
  `docs/examples/manual-sma.md` is its generated mirror.
- `docs/language/series-and-indexing.md` §"Lookback is bounded — dynamic
  indices are flagged" (lines 169–179) states **any** dynamic index
  warns + forces the 5000-slot fallback.
- `skills/chartlang-coding/SKILL.md`: the indexing note (lines 95–106)
  says "Keep lookback literal" and any `series[i]` warns + falls back;
  the loops note (lines 207–213) describes the legal `for` shape but not
  that loop-variable indexing is sized precisely.
- No conformance scenario exercises a loop-driven series read.
- No `manual-sma` slotId is pinned anywhere (only `scripts.ts` + the
  generated docs reference it), so converting it needs **no** re-pin.

## Desired Behavior

- `manual-sma` is a real loop; the comment teaches that a bounded
  `for (let i = 0; i < 5; i++)` indexes the window precisely (same
  `maxLookback`, no warning) and is bar-for-bar identical to the unrolled
  form and to `ta.sma(close, 5)`.
- The regenerated `docs/examples/manual-sma.md` matches (gate green).
- A conformance scenario proves the loop-SMA == `ta.sma(close, 5)`.
- Docs + skill describe: literal **and** provably-bounded
  (bounded-loop / `const` / affine) indices are sized precisely; only
  genuinely-dynamic indices warn + fall back.

## Requirements

### 1. Convert the `manual-sma` example

In `apps/site/src/components/demo/scripts.ts`, rewrite the `MANUAL_SMA`
compute body's mean as a bounded loop and correct the comment. The
template string uses escaped backticks for inline code spans — match the
existing style:

```ts
        // Mean of the last 5 closes. \`bar.close\` is a price series, so a
        // bounded \`for\` loop indexes the window directly: chartlang resolves
        // \`bar.close[i]\` over the literal loop bounds, so the buffer is sized
        // to exactly 5 slots (maxLookback 4) with no dynamic-index warning —
        // identical to spelling out \`(bar.close[0] + ... + bar.close[4]) / 5\`.
        // Out-of-range reads are NaN, so this warms up over 4 bars,
        // bar-for-bar identical to ta.sma(close, 5).
        let sum = 0;
        for (let i = 0; i < 5; i++) {
            sum += bar.close[i];
        }
        const manual = sum / 5;
```

Keep the two `plot(...)` calls and the surrounding `defineIndicator`
shape unchanged. Do **not** hand-edit `docs/examples/manual-sma.md`.

### 2. Regenerate the example docs

Run `pnpm examples:generate` and commit the regenerated
`docs/examples/manual-sma.md` (and `docs/examples/index.md` if its
snippet/length shifts). `pnpm examples:gate` must be byte-clean
afterwards. (`apps/site/**` is Biome/Vitest/coverage/README/changeset
exempt per `apps/CLAUDE.md`, so the only gate impact is `examples:gate`.)

### 3. Conformance scenario — loop SMA == `ta.sma`

Add `packages/conformance/src/scenarios/loopSma.scenario.ts` using
`inlineSource` (the curated `examples/scripts/` set stays at three). For
the **`inlineSource` file structure** mirror an existing inline scenario —
`taDema.scenario.ts` is the canonical template: a hoisted
`const INLINE_SOURCE = \`…\``, a hoisted
`const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([…])`,
then the `Scenario` literal with `inlineSource: INLINE_SOURCE` and
`intervalCount`. Assertions are hoisted above the `Scenario` literal per
the conformance `CLAUDE.md` invariant (frozen-tuple narrowing). Use
`bollingerBands.scenario.ts` only as the reference for the **`plot-hash`
assertion shape**. The inline script plots the loop-SMA and
`ta.sma(bar.close, 5)`:

```ts
const INLINE_SOURCE = `
import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "loop-sma",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        let sum = 0;
        for (let i = 0; i < 5; i++) { sum += bar.close[i]; }
        plot(sum / 5, { title: "loop" });
        plot(ta.sma(bar.close, 5), { title: "builtin" });
    },
});
`;
```

Assertions:

- `plot-hash` on the loop-SMA slot **and** `plot-hash` on the `ta.sma`
  slot. Pin each to its own sha256 — they track to display precision but are
  **not** bit-identical (the loop re-sums `(c0+…+c4)/5` each bar while
  `ta.sma` keeps an incremental running sum, so their low-order float bits
  differ). The existing `bar-close-direct-index` scenario (the unrolled
  twin) hit exactly this and pins two distinct hashes — mirror it. Use the
  `<inline:loop-sma>.chart.ts:<line>:<col>#0` slotId format (conformance
  `CLAUDE.md`).

Do **not** add a `diagnostic-code-absent: dynamic-series-index` assertion.
The conformance runner's `diagnostic-code-absent` checks **runtime**
diagnostics only — `run.diagnostics` is populated solely from the runner's
per-bar `drain()` (`runConformanceSuite.ts:808`); the compiler's
compile-time diagnostics are never merged in. `dynamic-series-index` is a
compile-time **warning**, so such an assertion would be vacuously true
(the code can never appear) and would give false confidence. The
no-warning proof is owned by the Task 1 compiler unit test (which asserts
the `dynamic-series-index` diagnostic is absent from
`extractMaxLookback`'s output); the conformance scenario's job is the
plot-hash identity proof.

Register the scenario in
`packages/conformance/src/scenarios/index.ts` (the single place
`ALL_SCENARIOS` is **defined**, at `scenarios/index.ts:498` — `src/index.ts`
only re-exports it): add the `import { LOOP_SMA_SCENARIO } from
"./loopSma.scenario.js"`, the matching `export { … }` re-export, and
append `LOOP_SMA_SCENARIO` to the `ALL_SCENARIOS` `Object.freeze([…])`
literal. Do **not** add it to a phase array (`PHASE_2_INDICATORS` /
`PHASE_5_DEFERRED` are derived in `phase2Inventory.js` and scope Phase-2
indicator ports — a loop-SMA scenario is not one). `runConformanceSuite.test.ts`'s
default end-to-end pass iterates `ALL_SCENARIOS`, so adding it there
includes it automatically; only edit that test if it pins an explicit
scenario count. Pin both hashes by copying the runner's "expected vs
actual" failure-message value (per the conformance `CLAUDE.md` re-pin
workflow). Add the scenario's JSDoc (`@since`, `@stable`, `@example`).

**Regenerate the committed conformance report pair.** The repo tracks a
checked-in adapter report (`examples/canvas2d-adapter/conformance-report.json`
+ `examples/canvas2d-adapter/CONFORMANCE.md`, **238 scenarios** as of the
directly-indexable-bar-series landing — it added `bar-close-direct-index`)
that `pnpm conformance:check` (`run-conformance.ts --report --check`)
**byte-compares**. Adding `LOOP_SMA_SCENARIO` makes it 239, so the gate
fails until the pair is regenerated: run `pnpm conformance:report` and
commit both files. (`conformance:report` writes the pair via
`canvas2dReportPaths`; `changeset:version` also calls it, but the report
must already be in sync before that.)

### 4. Language & spec docs

Update `docs/language/series-and-indexing.md` §"Lookback is bounded —
dynamic indices are flagged": keep the dynamic-index fallback paragraph,
but add that a series index which the compiler can **prove bounded at
compile time** — a literal, a bounded-loop induction variable
(`for (let i = 0; i < N; i++) src[i]`), a `const` numeric literal, or an
**affine combination** of those (`src[i + 1]`, `src[K - i]`) — is sized
to the exact `maxLookback` with **no** warning and **no** 5000-slot
fallback. Only genuinely dynamic indices (an unbounded variable, an
unsupported operator, a value the compiler cannot bound) warn + fall
back. (`docs/language/**` is not byte-gated; just keep it accurate.)

Also update the **canonical spec** (`docs/spec/*` is hand-authored and
ungated — `docs:check` reads only `packages/**/src`; there is no
byte-gate on `spec/` — but it is the normative contract and must stay
accurate). Three spots currently assert the old unconditional behavior:

- **`docs/spec/semantics.md`** (the "Dynamic series indices are a
  compile-time diagnostic" paragraph, ≈ lines 66–70): it states the v1
  compiler emits `dynamic-series-index` + records `dynamicFallback: 5000`
  for a dynamic index. Reword so the warning + `dynamicFallback` fire only
  for indices the compiler **cannot prove bounded**; a literal,
  bounded-loop induction variable, `const` numeric literal, or affine
  combination of those folds into `maxLookback` precisely (the "runtime
  MUST treat capacities as hard bounds" sentence stays unchanged).
- **`docs/spec/grammar.md`**: (a) the allowed-subset bullet "Series
  indexing with a numeric literal …" (≈ lines 121–122) must broaden to
  literal **or** a provably-bounded expression (bounded-loop induction
  variable, `const` numeric literal, affine combination of those); (b)
  the `dynamic-series-index` row in the forbidden-/diagnostic-code table
  (≈ line 147) must redefine the trigger as "a series is indexed with a
  **non-provably-bounded** expression" rather than "a non-literal
  expression". (This row documents the **compiler** diagnostic — distinct
  from the converter's identically-named convert-time code; see §6.)
- **`docs/spec/manifest.md`** (the `seriesCapacities` row, ≈ line 28, and
  the `maxLookback` row, ≈ line 29): note that `dynamicFallback: 5000`
  appears **only** for non-provably-bounded indices, and that
  `maxLookback` now captures the largest **provably-bounded** lookback
  (literal, bounded-loop, `const`, or affine), not only literal lookbacks.

### 5. Author skill

Per the root `CLAUDE.md` skills-mirror rule, update
`skills/chartlang-coding/SKILL.md` in this PR:

- The indexing note (≈ lines 104–106, the **Literal indices only** bullet):
  replace "Keep lookback literal"
  /"any `series[i]` warns" with the precise-sizing carve-out — literal,
  bounded-loop-variable, `const`, and affine indices are sized exactly
  and do **not** warn; only unprovable indices warn + force the 5000-slot
  buffer.
- The loops note (≈ lines 207–213): add that reading a series at the loop
  variable (or an affine expression of it) inside the legal
  `for (let i = <lit>; i </<= <lit>; i++)` is sized precisely — a loop is
  now a first-class way to express a rolling window.

Check `skills/chartlang-coding/references/translating-from-pine.md`
(loop/lookback wording around lines 92–111) and adjust **only** a
statement that claims a *series index* (`src[i]`) always warns / falls
back. The lines ~104–111 wording is about `bar.point(<offset>, price)`
**literal** offsets and is **correct as-is** — do **not** change it:
`bar.point(-i, …)` dynamic offsets remain literal-only and are explicitly
out of scope (README → Deferred / Follow-Up). The same applies to
`skills/chartlang-coding/references/forbidden.md` §"Literal-index rule
extends to `bar.point`" (≈ lines 83–90) — it describes `bar.point`, not
`series[i]`, so it stays accurate and needs **no** edit. (A sweep
confirmed no other skill file states the old `series[i]` behaviour;
`skills/chartlang-setup/**` is unaffected — buffer sizing is invisible at
the integration surface.) `references/primitives.md` is generated by
`pnpm skills:generate` and is **not** affected (no primitive changed); do
not hand-edit it. Run `pnpm skills:gate` to confirm it stays clean.

### 6. Pine converter — verified unaffected (no change)

The Pine→chartlang converter (`packages/pine-converter`) needs **no code
or doc change** in this feature — it is a **compiler-only** change. The
converter emits whatever series reads are in the source; the compiler's
`extractMaxLookback` decides buffer size. A converted script that emits
`for (let i = 0; i < 5; i++) sum += src[i];` automatically benefits — the
new resolver sizes `src` to 5 slots instead of 5000 — with no converter
involvement. The converter's own convert-time
`pine-converter/transform/dynamic-series-index` diagnostic is a
**separate code** from the compiler's warning; its registry entry is
unchanged, so the **generated, gated** `docs/converter/diagnostics.md`
(owned by `pnpm converter:docs:generate`, byte-checked by
`converter:docs:check`) stays byte-identical — do **not** hand-edit it.
The hand-authored `docs/converter/{supported,rejects}.md` describe current
converter behaviour, which is unchanged, so they need no edit either.

Context: the **directly-indexable-bar-series** feature already made a
**literal** Pine `close[2]` → `bar.close[2]` compile cleanly (and removed
`14-polyline-rebuild` from the converter's `KNOWN_NON_COMPILING` skip list).
So the converter's remaining series-index gap is specifically the **bounded /
loop** `x[i]` form — which this feature's compiler resolver sizes precisely,
but the converter still rejects at convert time.

> **Deferred converter enhancements (out of scope, note only).** The
> converter could later (a) emit a bounded `for`-loop rolling window
> instead of unrolling a stateless window, and (b) relax its convert-time
> `pine-converter/transform/dynamic-series-index` reject for a bounded Pine
> `x[i]` now that the compiler sizes it precisely (its `docs/converter/`
> "Sources and history" note would then move `close[i]` from rejected to
> supported). Both are converter-side follow-ups, not part of this PR.

### 7. Changeset

Create `.changeset/bounded-loop-series-index.md`:

```md
---
"@invinite-org/chartlang-compiler": minor
"@invinite-org/chartlang-conformance": patch
---

Size series-index buffers precisely for provably-bounded indices.

`extractMaxLookback` now resolves a series read at a literal, a
bounded-`for` induction variable (`for (let i = 0; i < N; i++) src[i]`),
a `const` numeric literal, or an affine combination of those
(`src[i + 1]`, `src[K - i]`, `src[2 * i]`) to its exact `maxLookback`
contribution via a new compile-time interval resolver
(`resolveIndexUpperBound`) sharing one `parseBoundedForLoop` helper with
`forbiddenConstructs`. These indices no longer emit the
`dynamic-series-index` warning or force the 5000-slot `dynamicFallback`
buffer — they size the ring buffer exactly like a literal lookback. The
resolver over-approximates (never under-sizes); genuinely dynamic indices
(unbounded variables, unsupported operators, non-terminating loops,
reassigned loop variables) keep the warning + fallback. A new
`loop-sma` conformance scenario pins a `for`-loop SMA as bar-for-bar
identical to `ta.sma(close, 5)`.
```

The `apps/site` example change needs no changeset (private package).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `apps/site/src/components/demo/scripts.ts` | Modify | `MANUAL_SMA` → bounded `for` loop + accurate comment. |
| `docs/examples/manual-sma.md` | Regenerate | Via `pnpm examples:generate` (do not hand-edit). |
| `docs/examples/index.md` | Regenerate (if changed) | Same generator. |
| `packages/conformance/src/scenarios/loopSma.scenario.ts` | Create | Loop-SMA == `ta.sma` identity scenario. |
| `packages/conformance/src/scenarios/index.ts` | Modify | Import + re-export the scenario and append it to the `ALL_SCENARIOS` literal (defined here, not in `src/index.ts`). |
| `packages/conformance/src/runConformanceSuite.test.ts` | No change (verified) | Default pass asserts `ALL_SCENARIOS.length` dynamically (`toBe(ALL_SCENARIOS.length)`), not a hard-coded number — the new scenario is counted automatically. |
| `examples/canvas2d-adapter/conformance-report.json` | Regenerate | Via `pnpm conformance:report` — committed report grows 238 → 239; `conformance:check` byte-compares it. |
| `examples/canvas2d-adapter/CONFORMANCE.md` | Regenerate | Markdown sibling of the report pair (same `conformance:report` run). |
| `docs/language/series-and-indexing.md` | Modify | Document the precise-sizing carve-out. |
| `docs/spec/semantics.md` | Modify | Dynamic-index paragraph: warning + `dynamicFallback` only for non-provably-bounded indices. |
| `docs/spec/grammar.md` | Modify | Broaden the allowed series-index subset; redefine the `dynamic-series-index` diagnostic trigger. |
| `docs/spec/manifest.md` | Modify | Clarify when `dynamicFallback: 5000` appears; `maxLookback` now captures provably-bounded lookbacks. |
| `skills/chartlang-coding/SKILL.md` | Modify | Indexing + loops notes. |
| `skills/chartlang-coding/references/translating-from-pine.md` | Modify (only `series[i]` wording, if any; leave `bar.point` text) | Loop/lookback wording. |
| `docs/converter/**`, `packages/pine-converter/**` | No change | Converter is compiler-only-unaffected; `diagnostics.md` is generated + gated (§6). |
| `.changeset/bounded-loop-series-index.md` | Create | compiler `minor` + conformance `patch`. |

## Gates

- `pnpm examples:gate` (regenerated example pages byte-clean)
- `pnpm -F @invinite-org/chartlang-conformance test` (scenario green,
  100% coverage)
- `pnpm conformance` (the new `ALL_SCENARIOS` member passes against the
  reference adapter)
- `pnpm conformance:check` (the committed report stays in sync if this
  repo tracks one)
- `pnpm skills:gate` (generated `primitives.md` unchanged)
- `pnpm converter:docs:check` (generated `docs/converter/diagnostics.md`
  unchanged — confirms the converter registry was not touched)
- `pnpm typecheck`
- `pnpm changeset status` (lists the new changeset)

## Acceptance Criteria

- `manual-sma` is a bounded `for` loop with a correct comment; it
  compiles with `maxLookback: 4` and **no** `dynamic-series-index`
  warning (a direct consequence of Tasks 1–2).
- `pnpm examples:generate` produces a byte-clean tree; `examples:gate`
  passes.
- The `loop-sma` scenario passes, pinning the loop-SMA and `ta.sma` slots
  to their own (distinct, float-summation-divergent) hashes; registered in
  the `ALL_SCENARIOS` literal in `scenarios/index.ts`; conformance coverage
  stays 100%. (The no-warning proof lives in the Task 1 compiler unit test,
  not the scenario — the runner surfaces runtime diagnostics only.)
- The committed report pair
  (`examples/canvas2d-adapter/{conformance-report.json,CONFORMANCE.md}`)
  is regenerated via `pnpm conformance:report` and committed; `pnpm
  conformance:check` is byte-clean with the new 239-scenario total.
- `docs/language/series-and-indexing.md`, the spec trio
  (`docs/spec/{semantics,grammar,manifest}.md`), and
  `skills/chartlang-coding/SKILL.md` describe the precise-sizing
  carve-out; `skills:gate` + `converter:docs:check` clean.
- The Pine converter is confirmed unaffected: no `packages/pine-converter`
  or hand-authored `docs/converter/*` edit, and the generated
  `diagnostics.md` is byte-unchanged.
- `.changeset/bounded-loop-series-index.md` committed (compiler minor +
  conformance patch).
