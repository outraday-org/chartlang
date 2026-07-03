# Runtime `ta.cross` + `ta.cum`

> **Status: TODO**

## Goal

Implement the bidirectional cross (`ta.cross`, boolean, composed from
the existing `crossover` / `crossunder`) and the generic running sum
(`ta.cum`, numeric accumulator) with the full §22.10 set, wired into
`TA_REGISTRY`. Two small, independent primitives of different shape;
both fit one focused task.

## Prerequisites

Task 1 (core holes + signatures + compiler-shim mirror). The
`STATEFUL_PRIMITIVES` registry entries for `cross` / `cum` land
**here** (not Task 1 — see Task 1's Goal note on the `skills:gate`
ordering constraint).

## Current Behavior

No `cross` / `cum`. Authors compose `crossover(a,b).current ||
crossunder(a,b).current` by hand, and hand-roll a `state.float`
accumulator for a running total (only the specialized `obv` / `adl` /
`pvt` cumulatives exist).

## Desired Behavior

- `ta.cross(a, b)` → `Series<boolean>`, `true` at the bar where `a`
  crosses `b` in **either** direction.
- `ta.cum(source)` → `Series<number>`, the cumulative sum of `source`
  from bar 0, NaN-safe.

## Semantics (Pine v6 parity)

### `ta.cross`
- **Definition.** `cross[t] = crossover(a,b)[t] ∨ crossunder(a,b)[t]`.
  `b` may be a scalar (constant series), like `crossover`.
- **Composition.** Reuse the registered primitives via sub-slots
  `${slotId}/over` and `${slotId}/under` — the `aroonOsc` / `donchian`
  seam — so a fix to either flows in for free. **No private cross math.**
- **Warmup.** `1` (needs one prior bar). NaN inputs ⇒ `false` (inherited
  from the sub-slots).
- **Tick mode.** The sub-slots own their tick replay; the parent slot
  just re-reads `.current` from each and `replaceHead`s the OR — mirror
  the `aroonOsc` / `chaikinOsc` parent-recompute pattern.

### `ta.cum`
- **Definition.** `cum[t] = cum[t−1] + (isFinite(src[t]) ? src[t] : 0)`,
  `cum[−1] = 0`. NaN source contributes 0 (carry the total forward) —
  matches Pine `ta.cum` and the `obv` / `adl` accumulator convention.
- **Warmup.** `0` — finite from bar 0.
- **Tick mode.** Replay the head contribution against a snapshot of the
  prior-closed accumulator (`prevClosedCum`), so a partial-bar tick does
  not pollute the next close — mirror `adl.ts` / `obv.ts` exactly.

## Requirements

### 1. `cross.ts` (`packages/runtime/src/ta/`)

```ts
type CrossSlot = { readonly outBuffer: RingBuffer<boolean>;
                   readonly series: Series<boolean>;
                   readonly shiftedViews: Map<number, Series<boolean>>; };
```

(`shiftedViews` mirrors `crossover.ts:16-28` — build the
`Series<boolean>` the way `crossover` does so `[n]` reads work.)

On first call, allocate the parent slot; each bar call the registered
`crossover` / `crossunder` with the derived sub-slot ids and OR their
`.current`. The sub-slot-id seam is `aroonOsc.ts:62` — it calls
`aroon("${slotId}/aroon", length)` (template literal); derive
`${slotId}/over` / `${slotId}/under` the same way. Mirror how
`aroonOsc` appends a composed result vs `replaceHead`s on tick. Return
`slot.series`.

### 2. `cum.ts` (`packages/runtime/src/ta/`)

Mirror `obv.ts` accumulator shape:

```ts
type CumSlot = { readonly outBuffer: Float64RingBuffer;
                 readonly series: Series<number>;
                 cum: number;           // running total (closed)
                 prevClosedCum: number; // tick-replay snapshot
};
```

`closeValue`: `slot.cum += finite ? src : 0; return slot.cum` and
snapshot `prevClosedCum` before mutating. `tickValue`: return
`prevClosedCum + (finite ? src : 0)` without mutating `cum`. Read the
source via `readSourceValue`.

Copy the Task-1 core JSDoc verbatim onto each runtime file (`@formula`,
`@warmup`, `@since 1.8`, `@stable`, `@example`) — the generated docs +
skills pages read this runtime source.

### 3. Registry wiring (runtime + core + cardinality gates)

**Runtime** (`packages/runtime/src/ta/registry.ts`):

- Import `cross` / `cum`; add both to `TA_REGISTRY`.
- Add both to `RuntimeTaNamespace` (`registry.ts:254`; `cross` →
  `Series<boolean>`, `cum` → `Series<number>`).
- `TA_REGISTRY_METADATA`: add **no** entries. Neither `crossover` /
  `crossunder` (booleans) nor `obv` (unbounded accumulator) carries a
  metadata entry — both fall back to the auto `yDomain` default. Match
  that convention.

**Core** (`packages/core/src/statefulPrimitives.ts`) — moved here from
Task 1:

```ts
{ name: "ta.cross", slot: true },
{ name: "ta.cum", slot: true },
```

**Cardinality gates** (update in the same PR — mirror Task 2):

- `packages/compiler/src/program.test.ts:222` — bump the pinned
  `STATEFUL_PRIMITIVES.size` by 2.
- `packages/conformance/src/scenarios/phase2Coverage.test.ts` — extend
  the pine-parity additions constants (Task 2 introduced them) with
  `ta.cross` / `ta.cum` in both the `STATEFUL_PRIMITIVES.size` and
  `TA_REGISTRY` key-count sums.

### 4. Test layers (§22.10, co-located)

**`cross`:**
- Unit: a crosses above (`true`), a crosses below (`true`), no cross
  (`false`), scalar `b`, NaN ⇒ `false`. Assert equality to
  `crossover||crossunder` on the same inputs.
- Property: `cross[t] === (crossover[t] || crossunder[t])` for random
  arrays; `cross` and (no-cross) are exhaustive.
- Golden: pin the boolean hash for `syntheticBars(100, 42)` crossing
  two EMAs, via `hashBoolArray` from
  `packages/runtime/src/ta/__fixtures__/syntheticBars.ts` (mirror
  `crossover.golden.test.ts`).
- Bench: mirror `crossover.bench`.

**`cum`:**
- Unit: cumulative of a known series equals the running total; NaN
  contributes 0 (total unchanged across a NaN bar); tick replay yields
  `prevClosedCum + tick` and does not advance the closed total.
- Property: `cum[t] − cum[t−1] === (finite(src[t]) ? src[t] : 0)`;
  monotonic when the source is non-negative.
- Golden: pin the hash for `ta.cum(bar.volume)` over `syntheticBars(100,
  42)` via `hashFloat64Array` (same fixtures module; mirror
  `change.golden.test.ts`).
- Bench: O(1) per bar; mirror `change.bench`.

### 5. Conformance (`packages/conformance/src/scenarios/`)

`taCross.scenario.ts` (cross of two EMAs) + `taCum.scenario.ts`
(`ta.cum(bar.volume)`), mirroring `taChange.scenario.ts`. Wire like
`TA_CHANGE_SCENARIO` in `scenarios/index.ts`: import (~177), re-export
(~435), append to `ALL_SCENARIOS` (~596).

### 6. Docs + skills regen

`pnpm docs:generate` + `pnpm skills:generate`; commit
`docs/primitives/ta/cross.md`, `cum.md`, and the regenerated
`primitives.md`.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/runtime/src/ta/cross.ts` (+ 4 test files) | Create | composed-boolean impl + tests |
| `packages/runtime/src/ta/cum.ts` (+ 4 test files) | Create | accumulator impl + tests |
| `packages/runtime/src/ta/registry.ts` | Modify | imports + `TA_REGISTRY` + namespace (no metadata) |
| `packages/core/src/statefulPrimitives.ts` | Modify | 2 `slot: true` entries (moved from Task 1) |
| `packages/compiler/src/program.test.ts` | Modify | `STATEFUL_PRIMITIVES.size` pin +2 |
| `packages/conformance/src/scenarios/phase2Coverage.test.ts` | Modify | extend pine-parity additions constants |
| `packages/conformance/src/scenarios/taCross.scenario.ts` / `taCum.scenario.ts` | Create | conformance |
| `packages/conformance/src/scenarios/index.ts` | Modify | import + export + `ALL_SCENARIOS` |
| `docs/primitives/ta/cross.md` / `cum.md` | Generate | auto docs |
| `skills/chartlang-coding/references/primitives.md` | Generate | skills regen |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm test` (runtime + conformance 100% coverage)
- `pnpm docs:check`, `pnpm docs:gate` (generated ta pages committed),
  `pnpm skills:gate`
- `pnpm conformance`
- `pnpm bench:ci`

## Changeset

`.changeset/ta-cross-cum.md` — `"@invinite-org/chartlang-runtime":
minor`, `"@invinite-org/chartlang-core": minor` (registry entries).
Body: "Add `ta.cross` (bidirectional cross) and `ta.cum` (running sum)
primitives."

## Acceptance Criteria

- `cross` composes `crossover` + `crossunder` sub-slots (no private
  cross math); property test proves the OR equivalence.
- `cum` matches the `obv`/`adl` NaN-safe accumulator + tick-snapshot
  shape; property test proves the first-difference identity.
- Both wired into `TA_REGISTRY` + namespace (no metadata entries — the
  `crossover`/`obv` convention); `STATEFUL_PRIMITIVES` gains both
  entries; compiler size pin + conformance cardinality sums updated
  and green.
- Full §22.10 set landed; goldens pinned; conformance scenarios in
  `ALL_SCENARIOS` and green.
- Generated docs + skills committed; changeset committed; coverage 100%.
