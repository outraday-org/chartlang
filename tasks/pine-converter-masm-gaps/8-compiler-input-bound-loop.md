# Input-Bound Runtime Loop

> **Status: TODO**

## Goal

Let a Pine `for` loop whose bound is an `input.int` emit a **real
runtime loop** that follows the input at runtime, instead of unrolling
at the input's default. Today `for i = 0 to consol_tolerance`
(`consol_tolerance = input.int(...)`) is unrolled and the iteration
count is frozen (`loop-unroll-frozen-at-input-default`), a real
semantic divergence. The runtime already supports dynamic history
indexing (`series[i]`); the blocker is the **compiler's** literal-bound
requirement and compile-time ring-buffer sizing. This task relaxes the
compiler (sizing the buffer from `input.maxval`) and switches the
converter to emit the runtime loop.

## Prerequisites

None (independent of Tasks 1–7). Largest task; sequenced last.

## Current Behavior

### Converter unrolls because the compiler forbids the loop

```ts
// pine-converter/src/transform/controlFlow.ts
emitFor(...)                    // (~line 508) dispatcher
resolveBound(...)              // (~line 80) literal OR input-default → {value, fromInputDefault}
emitLiteralLoop(...)          // (~line 577) runtime `for`, but ONLY for a true numeric literal
unroll(...)                   // (~line 619) substitutes the body N times
// diagnostic pushed at ~line 632 when from/to/step.fromInputDefault
```

An input-default bound is not a true literal, so `emitLiteralLoop`
returns `null` and control reaches `unroll`. The comment at
`controlFlow.ts:485` states the reason: *"a runtime loop with a
non-literal bound is rejected by chartlang."*

### The compiler is the binding constraint

```ts
// compiler/src/analysis/loopBounds.ts (~line 67)
parseBoundedForLoop(node)  // requires: init `let i = <numericLiteral>`,
                           //   condition `i <cmp> <numericLiteral>` (line ~75),
                           //   postfix `i++`
// compiler/src/analysis/forbiddenConstructs.ts (~line 119)
//   any `for` where parseBoundedForLoop(node) === null → `unbounded-loop` (hard error)
```

So an emitted `for (let i=0; i<=inputs.consolTolerance; i++)` is a hard
compile error today.

### History indexing already works; buffer sizing is the gap

- Runtime: `runtime/src/seriesView.ts:44` — `series[n]` for any runtime
  integer dispatches to `buf.at(n)`; out-of-range → `NaN`. No runtime
  change needed.
- Compiler ring-buffer depth: `extractMaxLookback.ts:104` +
  `resolveIndexBound.ts:79` (`resolveIndexUpperBound` → `evalInterval`)
  resolve a bounded-loop induction var to `[start, max]` **only because
  `parseBoundedForLoop` gave a literal `max`**. There is no path from an
  `input.int` descriptor's `maxval` to the loop bound / buffer depth
  today.
- The converter already captures `input.int` `maxval`:
  `inputs.ts:33` `RANGE_ARG_TO_OPTION` maps `maxval → max`, emitted onto
  the input descriptor `{ min, max }`.

## Desired Behavior

`for i = 0 to consol_tolerance` (with `consol_tolerance =
input.int(4, maxval=20)`) emits:

```ts
for (let i = 0; i <= (inputs.consolTolerance as number); i++) {
    ... ma_slope[i] ...
}
```

and compiles, with the `ma_slope` ring buffer sized to the input's
`maxval` (worst case 20). No `loop-unroll-frozen-at-input-default` for
this path; iteration count follows the input at runtime.

## Requirements

### 1. compiler — accept an input-bounded loop (`packages/compiler`)

In `src/analysis/loopBounds.ts`, extend `parseBoundedForLoop` to accept
a condition right-hand side that is an `inputs.<name>` access (property
access on the inputs object) bound to an integer input, in addition to a
numeric literal. Carry the resolved input name and its **declared
`maxval`** (from the manifest / input descriptor) as the loop's upper
bound. Update `forbiddenConstructs.ts` so such a loop is no longer
`unbounded-loop`.

`parseBoundedForLoop` is the single source of truth for both
forbidden-construct checking and lookback sizing — keep them consistent
by returning the `maxval` as the bound's static upper limit.

### 2. compiler — size the ring buffer from `maxval`

In `resolveIndexBound.ts` (`resolveIndexUpperBound` / `evalInterval`)
and `extractMaxLookback.ts`, resolve a loop induction variable whose
loop upper bound is an input to the input's `maxval`, so `series[i]`
inside the loop sizes the buffer to `[0, maxval]`. If the input has **no
`maxval`**, fall back to the existing dynamic fallback (5000 slots) —
emit no new error, but the converter should warn (see §4).

The input descriptor's `max` must be reachable from compiler analysis.
**Verified: it is not today** — `resolveIndexBound` resolves bounds only
from loop-header numeric literals, and there is no path from an
`input.int` `maxval` to the loop bound. There are two ways to thread it;
pick the smaller-blast-radius one after inspecting the code:

- **AST route (preferred if feasible):** `resolveIndexBound` already runs
  over the emitted TS AST, where the input is declared as
  `const consolTolerance = input.int(4, { max: 20 })`. Resolve
  `inputs.<name>` back to that declaration and read `max` from the
  options object literal — **no manifest or core change needed**.
- **Manifest route (only if the AST route is impractical):** surface the
  input descriptor's `max` on the `ScriptManifest` / input-descriptor
  type in `packages/core`, have the converter emit it, and have
  `resolveIndexBound` read it. **This touches `packages/core` and
  therefore needs its own `@invinite-org/chartlang-core` changeset** (add
  it alongside compiler + pine-converter).

Verify where the compiler obtains input descriptors and extend that
path. State which route you took in the PR description.

### 3. converter — emit the runtime loop (`packages/pine-converter`)

In `controlFlow.ts`, add a branch to `emitFor`: when the body is
non-stateful and the bound resolves with `fromInputDefault`, emit a
runtime `for` (analogous to `emitRuntimeForFromBounds`) rendering the
bound as the `inputs.<name>` reference rather than the frozen literal.
Drop `loop-unroll-frozen-at-input-default` for this path.

Keep unrolling for: stateful bodies (still must unroll), and bounds that
are neither literal nor input-bound (still rejected).

### 4. converter — warn when `maxval` is absent

If the loop bound input has **no `maxval`**, the compiler falls back to
the 5000-slot buffer. Emit a new converter diagnostic
`loop-bound-input-unbounded` (severity **warning**) advising the author
to set `maxval` on the input to size the history buffer precisely.
Append it to `codes.ts`; regenerate `docs/converter/diagnostics.md`.

### 5. Tests

- compiler: unit tests for `parseBoundedForLoop` accepting an
  input-bound condition; `resolveIndexBound` sizing from `maxval`;
  `forbiddenConstructs` no longer flagging the loop. Keep 100% coverage.
- runtime: confirm (existing or new) that a runtime-variable `for` with
  `series[i]` reads correct history and returns `NaN` past buffer depth.
- converter: golden fixture trio:
  ```pine
  //@version=6
  indicator("input-bound loop")
  tol = input.int(4, "Tolerance", maxval=20)
  count = 0.0
  ma = ta.sma(close, 5)
  for i = 0 to tol
      count := count + ma[i]
  plot(count)
  ```
  Regenerate with `UPDATE_FIXTURES=1`; confirm a runtime `for` over
  `inputs.tol`, a `state.series` slot for `ma` sized to maxval, no
  frozen-default info. Must compile (`fixtures-compile.test.ts`).
  Add a second fixture without `maxval` asserting
  `loop-bound-input-unbounded`.

### 6. CLAUDE.md updates

`packages/compiler/CLAUDE.md` (loop-bound + lookback invariants now
accept input bounds, sized from `maxval`) and
`packages/pine-converter/CLAUDE.md` (new emit branch + new diagnostic).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/compiler/src/analysis/loopBounds.ts` | Modify | Accept input-bound condition |
| `packages/compiler/src/analysis/forbiddenConstructs.ts` | Modify | Stop flagging input-bound loop |
| `packages/compiler/src/analysis/resolveIndexBound.ts` | Modify | Resolve bound from input `maxval` |
| `packages/compiler/src/analysis/extractMaxLookback.ts` | Modify | Size buffer from `maxval` |
| `packages/compiler/src/**/*.test.ts` | Modify | Coverage |
| `packages/pine-converter/src/transform/controlFlow.ts` | Modify | Emit runtime loop from input bound |
| `packages/pine-converter/src/diagnostics/codes.ts` | Modify | Append `loop-bound-input-unbounded` |
| `packages/pine-converter/src/transform/controlFlow.test.ts` | Modify | Coverage |
| `packages/pine-converter/fixtures/NN-input-bound-loop*.{pine,expected.chart.ts,expected.diagnostics.json}` | Create | Two golden trios |
| `packages/pine-converter/src/tests/golden.test.ts` | Modify | Bump fixture count assertion |
| `docs/converter/diagnostics.md` | Regenerate | New diagnostic |
| `packages/compiler/CLAUDE.md`, `packages/pine-converter/CLAUDE.md` | Modify | Invariant notes |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (compiler + pine-converter 100% coverage, incl. `fixtures-compile`)
- `pnpm converter:docs:check`
- `pnpm conformance` / `pnpm conformance:check` (loop sizing affects emitted runtime behavior — verify no golden drift)

## Changeset

`.changeset/compiler-input-bound-loop.md` — `@invinite-org/chartlang-compiler: minor`, `@invinite-org/chartlang-pine-converter: minor`. **If the manifest route in §2 is taken** (core input-descriptor type change), add `@invinite-org/chartlang-core: minor` to the same changeset.

## Acceptance Criteria

- Input-bounded `for` loops (non-stateful body) emit a runtime loop that
  follows the input; ring buffer sized from `input.maxval`.
- Missing `maxval` → 5000-slot fallback + `loop-bound-input-unbounded`
  warning (no compile error).
- Stateful-body and non-resolvable bounds unchanged.
- Both golden fixtures compile; conformance shows no unexpected drift.
- 100% coverage on compiler + pine-converter; docs regenerated.
- Both `CLAUDE.md` files updated; changeset committed.
