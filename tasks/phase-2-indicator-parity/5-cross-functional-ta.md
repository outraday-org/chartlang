# Task 5 — Cross-functional `ta.*` primitives (nz / highest / lowest / change / valuewhen / barssince)

> **Status: TODO**

## Goal

Land the six cross-functional `ta.*` primitives §9 enumerates as
"used by scripts but not in the registry by category." These back
~30 of the §9.2 ports (aroon, donchian, williamsR, pivots-*,
supertrend, chandelier, fractal, momentum, roc, etc.). Each ships
with the full §22.10 set.

## Prerequisites

- Tasks 3-4 (helpers in place).

## Current Behavior

`packages/core/src/ta/ta.ts` exports `TaNamespace` with nine
Phase-1 surfaces (sma, ema, stdev, bb, rsi, macd, atr, crossover,
crossunder). No `nz`, `highest`, `lowest`, `change`, `valuewhen`,
`barssince`. Scripts that want a rolling max have to inline
`Math.max(...)` loops — which the analysis pass forbids
(stateful-call-in-loop).

## Desired Behavior

After this task:

- `TaNamespace` extends with six new methods (signatures below).
- `STATEFUL_PRIMITIVES` (`packages/core/src/statefulPrimitives.ts`)
  gains `ta.nz`, `ta.highest`, `ta.lowest`, `ta.change`,
  `ta.valuewhen`, `ta.barssince`.
- Runtime exports six implementations under
  `packages/runtime/src/ta/<id>.ts` with the §22.10 set.
- `TA_REGISTRY` cardinality grows from 9 to 15.
- One conformance scenario per primitive in
  `packages/conformance/src/scenarios/`.
- `docs/primitives/ta/<id>.md` auto-generated per primitive.

## Requirements

### 1. Signatures

```ts
// core/src/ta/ta.ts — extended
ta.nz(value: number, replacement?: number): number;
ta.highest(source: Series<number>, length: number, opts?: HighestOpts): Series<number>;
ta.lowest(source: Series<number>, length: number, opts?: LowestOpts): Series<number>;
ta.change(source: Series<number>, opts?: ChangeOpts): Series<number>;
ta.valuewhen(condition: Series<boolean>, source: Series<number>, occurrence?: number): Series<number>;
ta.barssince(condition: Series<boolean>): Series<number>;
```

Per-primitive opts bags (each `Readonly<{ offset?: number }>` at
minimum so universal `opts.offset` is wired from day one):

- `HighestOpts`, `LowestOpts`: `{ offset?: number }`.
- `ChangeOpts`: `{ length?: number; offset?: number }` (default
  `length = 1`).
- `ValuewhenOpts`: none — `occurrence` is a positional param.
- `BarssinceOpts`: none.

### 2. Math + warmup

| Primitive | Math | Warmup |
|---|---|---|
| `ta.nz` | `Number.isNaN(value) ? (replacement ?? 0) : value`. Pure (not stateful, no slot). | 0 |
| `ta.highest` | Rolling max over the last `length` source values. | `length - 1` |
| `ta.lowest` | Rolling min over the last `length` source values. | `length - 1` |
| `ta.change` | `source[0] − source[length]`. Defaults `length = 1`. | `length` |
| `ta.valuewhen` | "Value of `source` at the bar of the n-th most recent `condition === true`." If fewer than `occurrence + 1` matches, NaN. Default `occurrence = 0`. | depends on input — first `false` block emits NaN |
| `ta.barssince` | Count of bars since `condition === true` last fired. NaN until first true. | depends on input — NaN until first true |

`ta.nz` is the only non-stateful primitive in the set — it does
not allocate a slot. Wire it through the runtime as a plain
function under `packages/runtime/src/ta/nz.ts`; the
`RuntimeTaNamespace` cast treats it as a method with no leading
`slotId`. The compiler does NOT inject a slot id for `ta.nz` calls;
update Phase-1 Task-2's callsite-id transformer to skip
`STATEFUL_PRIMITIVES` entries that lack the `slot:true`
classification.

> Implementation seam: extend `STATEFUL_PRIMITIVES` to carry a
> two-shape entry (`name` + `slot: boolean`) — keep it a
> `ReadonlySet<{ name: string; slot: boolean }>` so `.size`
> still works in the cardinality tests. Phase-1 entries flip
> to `slot: true`. `ta.nz` carries `slot: false`. Update the
> compiler transformer to test `entry.slot` before injecting the
> id literal. Cascade the shape change through **every consumer**:
>
> - `packages/compiler/src/api.ts` (passes the set to transformers
>   + analysis passes as `statefulSet`).
> - `packages/compiler/src/program.ts` (the embedded type
>   declaration for the core import).
> - `packages/compiler/src/transformers/callsiteIdInjection.ts`
>   (reads entries and rewrites only `slot: true` ones).
> - `packages/compiler/src/transformers/callsiteIdInjection.test.ts`
>   + `…callsiteIdInjection.property.test.ts` (regression).
> - `packages/compiler/src/analysis/statefulCallInLoop.ts` (the
>   loop-body check — should flag both `slot: true` and
>   `slot: false` entries because the stateless ones still don't
>   belong in loops, but the rationale changes: `slot: false` is
>   non-stateful so the rejection is style-only).
> - `packages/compiler/src/analysis/statefulCallInLoop.test.ts`
>   (regression).

### 3. Slot value shapes (stateful primitives)

| Primitive | Slot value |
|---|---|
| `ta.highest` | `{ outBuffer: Float64RingBuffer, series: Series<number>, window: Float64RingBuffer of size length, currentMax: number }` (deque-style monotonic implementation kept JSON-clean by serialising the deque as a `ReadonlyArray<number>`). |
| `ta.lowest` | Mirror of `highest` (monotonic min). |
| `ta.change` | `{ outBuffer, series, sourceWindow: Float64RingBuffer of size length+1 }`. |
| `ta.valuewhen` | `{ outBuffer, series, ringOfLastMatches: ReadonlyArray<number> of size occurrence+1, count: number }`. |
| `ta.barssince` | `{ outBuffer, series, sinceTrue: number, seenTrue: boolean }`. |

Slot value invariants per §16.2 — JSON-clean, no class instances.

### 4. NaN handling

- `ta.highest` / `ta.lowest`: skip NaN inputs from the window;
  emit NaN until the window is warm.
- `ta.change`: NaN in either operand → NaN output.
- `ta.valuewhen`: NaN source at the matching bar → NaN output
  (matches Pine).
- `ta.barssince`: NaN condition treated as `false` — does NOT
  reset the counter.

### 5. `replaceHead` mode

Each stateful primitive must implement the
`RuntimeContext.isTick === true` branch: recompute the head slot
from the previous closed state without mutating the prev-bar
snapshot. Property test asserts append vs replaceHead equivalence
for any final-tick sequence.

### 6. Tests (§22.10 five-file set) per primitive

For each of the six:

| File | Purpose |
|---|---|
| `<id>.ts` | Impl. |
| `<id>.test.ts` | Hand-curated unit tests against a 100-bar baseline fixture. |
| `<id>.property.test.ts` | `fast-check` — length invariance, warmup NaN, range invariants, determinism, append-vs-replaceHead equivalence, NaN propagation. |
| `<id>.golden.test.ts` | Hash output against the shared `goldenBars.json` (10 000 bars). The pinned hash is captured at task-execution time and committed. |
| `<id>.bench.ts` + `<id>.bench.test.ts` | Bench pair. |

`ta.nz` ships the four test layers but no `replaceHead` branch
(stateless). Bench is still required — the `nz` call is in the
inner loop of many scripts and any unexpected overhead matters.

### 7. Conformance scenarios

One scenario per primitive in
`packages/conformance/src/scenarios/`, each wrapping the body
below in the standard `defineIndicator` shell and assigning it
to the scenario's `inlineSource` field (the new Task-1 extension):

| File | Body (`compute` body, wrapped in `defineIndicator`) |
|---|---|
| `taNz.scenario.ts` | `plot(ta.nz(ta.change(bar.close).current, 0))` — NaN-correctness over the goldenBars fixture's warmup. |
| `taHighest.scenario.ts` | `plot(ta.highest(bar.high, 20))`. |
| `taLowest.scenario.ts` | `plot(ta.lowest(bar.low, 20))`. |
| `taChange.scenario.ts` | `plot(ta.change(bar.close, { length: 5 }))`. |
| `taValuewhen.scenario.ts` | `plot(ta.valuewhen(ta.crossover(ta.sma(bar.close, 10), ta.sma(bar.close, 30)), bar.close))`. |
| `taBarssince.scenario.ts` | `plot(ta.barssince(ta.crossover(ta.ema(bar.close, 12), ta.ema(bar.close, 26))))`. |

Phase-2 convention: every scenario uses `inlineSource: string`
introduced in Task 1. Example shape:

```ts
export const TA_HIGHEST_SCENARIO: Scenario = Object.freeze({
    id: "ta-highest",
    title: "ta.highest(high, 20)",
    inlineSource: `
        import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
        export default defineIndicator({
            name: "highest(high, 20)",
            apiVersion: 1,
            compute: ({ bar, ta, plot }) => {
                plot(ta.highest(bar.high, 20));
            },
        });
    `,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
```

Each scenario registers in `scenarios/index.ts`; its expected
emissions are pinned via the scenario runner's snapshot mechanism.
`slotId` references use the virtual path `<inline:ta-highest>.chart.ts:line:col#0`
(see Task 1 §12 — the runner falls back to that path when
`scriptPath` is absent).

### 8. JSDoc per primitive (§17.2)

Each export carries:
- One-line description.
- `@formula`.
- `@warmup` (count formula).
- `@since 0.2`.
- `@experimental`.
- One `@example` block using the script-author surface.

### 9. Compiler updates

Phase-1's `extractCapabilities` pass emits a coarse `"indicators"
| "drawings" | "alerts"` `CapabilityId` — **not** per-primitive
names. Phase 2 keeps that shape; per-primitive capability emit is
deferred (no editor / language-service work in Phase 2). So this
task does **not** modify `extractCapabilities.ts`.

The compiler updates required by Task 5 are:

1. **`callsiteIdInjection.ts`** — read `entry.slot` (or however
   the new shape is destructured); skip the id-literal injection
   when `slot === false`. The bundled output for
   `ta.nz(NaN, 0)` stays as `ta.nz(NaN, 0)` — no slot id prefix.
2. **`statefulCallInLoop.ts`** — keep flagging every entry in
   `STATEFUL_PRIMITIVES` inside a loop body. `slot: false`
   primitives can technically run safely inside loops, but
   Pine-parity says they can't (and the diagnostic message stays
   the same).
3. **`api.ts` + `program.ts`** — the `STATEFUL_PRIMITIVES`
   parameter type widens. `api.ts` passes the value verbatim;
   `program.ts` updates the embedded type declaration to match
   the new shape.

Add regression tests in:
- `transformers/callsiteIdInjection.test.ts` — assert
  `ta.nz(...)` is **not** prefixed; assert `ta.highest(...)`
  **is** prefixed.
- `transformers/callsiteIdInjection.property.test.ts` — same
  invariant under fast-check generation.
- `analysis/statefulCallInLoop.test.ts` — assert both `ta.nz(...)`
  and `ta.highest(...)` calls inside loops fail.

### 10. Coverage

100% on every new file. Compiler tests cover both the `slot: true`
and `slot: false` paths.

## Files to Create / Modify

| File | Action | Purpose |
|---|---|---|
| `packages/core/src/ta/ta.ts` | Modify | Extend `TaNamespace` + throw stubs. |
| `packages/core/src/ta/ta.test.ts` | Modify | Cover new throw stubs. |
| `packages/core/src/statefulPrimitives.ts` | Modify | Extend entries with `slot: boolean`. |
| `packages/core/src/statefulPrimitives.test.ts` | Modify | Cover new entries. |
| `packages/compiler/src/transformers/callsiteIdInjection.ts` | Modify | Honour `slot: false`. |
| `packages/compiler/src/transformers/callsiteIdInjection.test.ts` | Modify | Regression — `ta.nz` not prefixed; `ta.highest` is. |
| `packages/compiler/src/transformers/callsiteIdInjection.property.test.ts` | Modify | Fast-check regression covering the slot flag. |
| `packages/compiler/src/analysis/statefulCallInLoop.ts` | Modify | Read the new entry shape; keep flagging both slot-true and slot-false primitives in loops. |
| `packages/compiler/src/analysis/statefulCallInLoop.test.ts` | Modify | Regression — `ta.nz` and `ta.highest` both fail in loops. |
| `packages/compiler/src/api.ts` | Modify | Update parameter type for the new `STATEFUL_PRIMITIVES` shape. |
| `packages/compiler/src/program.ts` | Modify | Update embedded `STATEFUL_PRIMITIVES` type declaration. |
| `packages/runtime/src/ta/nz.ts` | Create | Pure impl. |
| `packages/runtime/src/ta/highest.ts` | Create | Stateful impl. |
| `packages/runtime/src/ta/lowest.ts` | Create | Stateful impl. |
| `packages/runtime/src/ta/change.ts` | Create | Stateful impl. |
| `packages/runtime/src/ta/valuewhen.ts` | Create | Stateful impl. |
| `packages/runtime/src/ta/barssince.ts` | Create | Stateful impl. |
| `packages/runtime/src/ta/<id>.{test,property.test,golden.test,bench,bench.test}.ts` | Create (×6 primitives × 5 = 30 files; nz skips replaceHead-related tests but ships all five layers) | Test layers. |
| `packages/runtime/src/ta/registry.ts` | Modify | Add six entries; assert cardinality 15. |
| `packages/runtime/src/ta/registry.test.ts` | Modify | Update cardinality assertions. |
| `packages/conformance/src/scenarios/<id>.scenario.ts` | Create (×6) | Scenarios. |
| `packages/conformance/src/scenarios/index.ts` | Modify | Re-export. |
| `packages/conformance/src/scenarios/scenarios.test.ts` | Modify | Add scenarios. |
| `docs/primitives/ta/<id>.md` | Generate (×6) | Auto-generated pages. |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (100% coverage on core, compiler, runtime, conformance)
- `pnpm bench:ci`
- `pnpm docs:check`
- `pnpm docs:gate` (Task-2 gate picks up new pages)
- `pnpm readme:check`
- `pnpm conformance`

## Changeset

`.changeset/phase-2-cross-functional-ta.md` — `minor` for
`@invinite-org/chartlang-core`,
`@invinite-org/chartlang-compiler`,
`@invinite-org/chartlang-runtime`, and
`@invinite-org/chartlang-conformance`.

## Acceptance Criteria

- Six new `ta.*` primitives exported, typed, registry-registered.
- `TA_REGISTRY` cardinality = 15.
- `STATEFUL_PRIMITIVES` carries the new `slot: boolean` shape;
  Phase-1 entries set `slot: true`, `ta.nz` sets `slot: false`.
- Compiler skips slot-id injection for `slot: false` entries; the
  capability is still recorded.
- All six §22.10 sets land in this PR (5 test files + scenario +
  JSDoc + auto-generated doc page).
- 100% coverage on every touched package.
- Changeset committed.
