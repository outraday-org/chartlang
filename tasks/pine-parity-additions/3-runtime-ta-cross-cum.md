# Runtime `ta.cross` + `ta.cum`

> **Status: TODO**

## Goal

Implement the bidirectional cross (`ta.cross`, boolean, composed from
the existing `crossover` / `crossunder`) and the generic running sum
(`ta.cum`, numeric accumulator) with the full §22.10 set, wired into
`TA_REGISTRY`. Two small, independent primitives of different shape;
both fit one focused task.

## Prerequisites

Task 1 (core holes, `STATEFUL_PRIMITIVES`, signatures).

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
                   readonly series: Series<boolean>; };
```

On first call, allocate the parent slot; each bar call the registered
`crossover` / `crossunder` with the derived sub-slot ids and OR their
`.current`. Look at `aroonOsc.ts` for the exact sub-slot-id derivation
and how a composed boolean/number result is appended vs `replaceHead`
on tick. Return `slot.series`.

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
`@warmup`, `@since 1.6`, `@stable`, `@example`).

### 3. Registry wiring (`packages/runtime/src/ta/registry.ts`)

- Import `cross` / `cum`; add both to `TA_REGISTRY`.
- Add both to `RuntimeTaNamespace` (`cross` → `Series<boolean>`, `cum` →
  `Series<number>`).
- `TA_REGISTRY_METADATA`: `cross` gets `yDomain: { kind: "fixed", min:
  0, max: 1 }` (match the boolean convention from Task 2). `cum` is
  unbounded → `yDomain: { kind: "auto" }` (or omit if `auto` is the
  default — match how `obv` is keyed).

### 4. Test layers (§22.10, co-located)

**`cross`:**
- Unit: a crosses above (`true`), a crosses below (`true`), no cross
  (`false`), scalar `b`, NaN ⇒ `false`. Assert equality to
  `crossover||crossunder` on the same inputs.
- Property: `cross[t] === (crossover[t] || crossunder[t])` for random
  arrays; `cross` and (no-cross) are exhaustive.
- Golden: pin the boolean SHA for `syntheticBars(100, 42)` crossing two
  EMAs (mirror `crossover.golden`).
- Bench: mirror `crossover.bench`.

**`cum`:**
- Unit: cumulative of a known series equals the running total; NaN
  contributes 0 (total unchanged across a NaN bar); tick replay yields
  `prevClosedCum + tick` and does not advance the closed total.
- Property: `cum[t] − cum[t−1] === (finite(src[t]) ? src[t] : 0)`;
  monotonic when the source is non-negative.
- Golden: pin the SHA for `ta.cum(bar.volume)` over `syntheticBars(100,
  42)` (mirror a numeric golden, e.g. `change.golden`).
- Bench: O(1) per bar; mirror `change.bench`.

### 5. Conformance (`packages/conformance/src/scenarios/`)

`taCross.scenario.ts` (cross of two EMAs) + `taCum.scenario.ts`
(`ta.cum(bar.volume)`), mirroring `taChange.scenario.ts`. Export +
register in `scenarios/index.ts` alongside `TA_CHANGE_SCENARIO`.

### 6. Docs + skills regen

`pnpm docs:generate` + `pnpm skills:generate`; commit
`docs/primitives/ta/cross.md`, `cum.md`, and the regenerated
`primitives.md`.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/runtime/src/ta/cross.ts` (+ 4 test files) | Create | composed-boolean impl + tests |
| `packages/runtime/src/ta/cum.ts` (+ 4 test files) | Create | accumulator impl + tests |
| `packages/runtime/src/ta/registry.ts` | Modify | imports + `TA_REGISTRY` + namespace + metadata |
| `packages/conformance/src/scenarios/taCross.scenario.ts` / `taCum.scenario.ts` | Create | conformance |
| `packages/conformance/src/scenarios/index.ts` | Modify | export + register |
| `docs/primitives/ta/cross.md` / `cum.md` | Generate | auto docs |
| `skills/chartlang-coding/references/primitives.md` | Generate | skills regen |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm test` (runtime + conformance 100% coverage)
- `pnpm docs:check`, `pnpm skills:gate`
- `pnpm conformance`
- `pnpm bench:ci`

## Changeset

`.changeset/ta-cross-cum.md` — `"@invinite-org/chartlang-runtime":
minor`. Body: "Add `ta.cross` (bidirectional cross) and `ta.cum`
(running sum) primitives."

## Acceptance Criteria

- `cross` composes `crossover` + `crossunder` sub-slots (no private
  cross math); property test proves the OR equivalence.
- `cum` matches the `obv`/`adl` NaN-safe accumulator + tick-snapshot
  shape; property test proves the first-difference identity.
- Both wired into `TA_REGISTRY` + metadata + namespace; full §22.10 set
  landed; goldens pinned; conformance registered and green.
- Generated docs + skills committed; changeset committed; coverage 100%.
