# Runtime `ta.rising` + `ta.falling`

> **Status: TODO**

## Goal

Implement the two monotonic-direction boolean primitives in the runtime
with the full §22.10 set, and wire them into `TA_REGISTRY`. They are
mirror siblings (like `crossover` / `crossunder`), so they land in one
task sharing a private helper.

## Prerequisites

Task 1 (core holes + signatures + compiler-shim mirror). The
`STATEFUL_PRIMITIVES` registry entries land **here** (not Task 1 — see
Task 1's Goal note on the `skills:gate` ordering constraint).

## Current Behavior

No `rising` / `falling` runtime implementation. Authors hand-roll a
bounded `for` loop over `source[i]` to test monotonicity.

## Desired Behavior

`ta.rising(source, length)` → `Series<boolean>` that is `true` at bar
`t` iff each of the trailing `length` consecutive deltas is strictly
positive; `ta.falling` is the strict-negative mirror. `false` (never
NaN) during warmup and whenever any windowed value is NaN — the
boolean-series convention `crossover` already uses.

## Semantics (Pine v6 parity)

- **Definition.** `rising[t] = ⋀_{k=1..length} (src[t−k+1] > src[t−k])`;
  `falling[t] = ⋀_{k=1..length} (src[t−k+1] < src[t−k])`. Equality
  breaks the run (non-strict is neither rising nor falling).
- **Warmup.** `length` (needs `length` prior bars to form `length`
  deltas). Warmup bars emit `false`, not NaN — booleans do not carry
  NaN (mirror `crossover`).
- **NaN.** Any non-finite value inside the trailing `length + 1` window
  ⇒ `false` (NaN does not bubble through a boolean series).
- **Tick mode.** Replay the in-progress head against a snapshot of the
  prior-closed source so a partial-bar tick does not seed the next
  close's window — mirror `change.ts` `tickValue` / the `crossover`
  prev-snapshot pattern.

## Requirements

### 1. Shared kernel (`packages/runtime/src/ta/lib/`)

The runtime ta helper dir is `packages/runtime/src/ta/lib/` (NOT
`_lib/` — that dir does not exist here). A pure helper
`monotonic(window, length, dir: 1 | -1): boolean` that walks the
trailing `length` deltas and returns whether every step has the
required sign, short-circuiting to `false` on any non-finite slot or
insufficient history. No existing window/monotonic helper lives in
`lib/` today (`sourceValue.ts`, `smaFloat64.ts`, `rollingStddev.ts`, …
are the current inventory) — add one there and property-test it as the
reference, following the co-located `lib/*.test.ts` convention. Do
**not** duplicate math between `rising` and `falling` — both call this
helper with opposite `dir`.

### 2. `rising.ts` / `falling.ts` (`packages/runtime/src/ta/`)

Mirror `change.ts` (whose `ChangeSlot` is at `change.ts:15-25`), plus
the boolean-series construction from `crossover.ts` — note the
crossover slot also carries
`readonly shiftedViews: Map<number, Series<boolean>>` (crossover.ts:16-28)
for shifted-view (`[n]`) reads; build the `Series<boolean>` exactly the
way `crossover` does:

```ts
type DirSlot = {
    readonly outBuffer: RingBuffer<boolean>;
    readonly series: Series<boolean>;
    readonly length: number;
    readonly sourceWindow: Float64RingBuffer; // trailing length+1 values
    readonly shiftedViews: Map<number, Series<boolean>>;
};
```

`closeValue` appends the source, then emits `monotonic(...)` once the
window holds `length + 1` values (else `false`). `tickValue` substitutes
the tick's source for the age-0 slot before evaluating, leaving the
closed window untouched. Read the source via the shared
`readSourceValue` helper from `./lib/sourceValue.js` (the import
`change.ts:13` uses). Return `slot.series`.

Copy the JSDoc block from the Task-1 core hole verbatim (`@formula`,
`@warmup length`, `@since 1.8`, `@stable`, `@example`) — the generated
`docs/primitives/ta/*.md` pages and the skills `primitives.md` are
built from this runtime source (`scripts/docs-gate.ts` /
`scripts/generate-skills-reference.ts`).

### 3. Registry wiring (runtime + core + cardinality gates)

**Runtime** (`packages/runtime/src/ta/registry.ts`):

- `import { rising } from "./rising.js";` / `import { falling } from
  "./falling.js";`
- Add `rising` / `falling` to the `TA_REGISTRY` frozen object.
- Add the two methods to the `RuntimeTaNamespace` type
  (`registry.ts:254`) with the `Series<boolean>` return.
- `TA_REGISTRY_METADATA`: add **no** entries. The existing boolean
  primitives (`crossover` / `crossunder`) carry no metadata entry —
  they fall back to the auto `yDomain` default. Match that convention.

**Core** (`packages/core/src/statefulPrimitives.ts`) — moved here from
Task 1:

```ts
{ name: "ta.rising", slot: true },
{ name: "ta.falling", slot: true },
```

`STATEFUL_PRIMITIVES_BY_NAME` derives from the same list. Additive
within `apiVersion: 1`.

**Cardinality gates** (the entries above break two pinned counts —
update in the same PR):

- `packages/compiler/src/program.test.ts:222` pins
  `STATEFUL_PRIMITIVES.size` (currently `194`) — bump by 2.
- `packages/conformance/src/scenarios/phase2Coverage.test.ts` pins both
  the `STATEFUL_PRIMITIVES.size` sum and the `Object.keys(TA_REGISTRY)
  .length` sum via per-feature additions constants — append a
  `PINE_PARITY_TA_ADDITIONS`-style constant (mirror
  `HIGHEST_LOWEST_BARS_TA_ADDITIONS` /
  `..._STATEFUL_ADDITIONS`) carrying `ta.rising` / `ta.falling` and
  fold it into both sums.

### 4. Test layers (§22.10, co-located)

- **Unit** (`rising.test.ts` / `falling.test.ts`): hand-curated series —
  strictly increasing (rising `true` after warmup), a single equal step
  breaks the run (`false`), a decreasing series (rising all `false`,
  falling `true`), NaN mid-window ⇒ `false`. Symmetric cases for
  `falling`.
- **Property** (`*.property.test.ts`): (a) warmup — first `length` bars
  are `false`; (b) `rising` and `falling` are never both `true` at the
  same bar; (c) equivalence to a brute-force bounded-loop reference over
  random bar arrays (`fast-check`, `numRuns: 30`).
- **Golden** (`*.golden.test.ts`): pin the hash of the boolean output
  for `syntheticBars(100, 42)` at `length: 3`. Both helpers live in
  `packages/runtime/src/ta/__fixtures__/syntheticBars.ts`:
  `syntheticBars(n, seed = 1)` and `hashBoolArray(values)` (mirror
  `crossover.golden.test.ts`).
- **Bench** (`*.bench.ts` + `*.bench.test.ts`): mirror `change.bench` —
  O(length) per-bar walk; assert the bench runs (no perf regression
  gate beyond `bench:ci`).

### 5. Conformance (`packages/conformance/src/scenarios/`)

Add `taRising.scenario.ts` + `taFalling.scenario.ts` mirroring
`taChange.scenario.ts` (inline `defineIndicator` calling the primitive,
`intervalCount: 1`, assertions: `alert-count: 0`,
`diagnostic-code-absent: lookback-exceeded`,
`diagnostic-code-absent: malformed-emission`). Wire them the way
`TA_CHANGE_SCENARIO` is wired in
`packages/conformance/src/scenarios/index.ts`: import (~line 177),
re-export (~line 435), and append to the `ALL_SCENARIOS` array
(~line 596).

### 6. Docs + skills regen

Run `pnpm docs:generate` (emits `docs/primitives/ta/rising.md` /
`falling.md`) and `pnpm skills:generate` (updates
`skills/chartlang-coding/references/primitives.md`). Commit both
generated artifacts.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/runtime/src/ta/rising.ts` (+ 4 test files) | Create | impl + unit/property/golden/bench |
| `packages/runtime/src/ta/falling.ts` (+ 4 test files) | Create | impl + tests |
| `packages/runtime/src/ta/lib/monotonic.ts` (+ tests) | Create | shared kernel |
| `packages/runtime/src/ta/registry.ts` | Modify | imports + `TA_REGISTRY` + namespace (no metadata) |
| `packages/core/src/statefulPrimitives.ts` | Modify | 2 `slot: true` entries (moved from Task 1) |
| `packages/compiler/src/program.test.ts` | Modify | `STATEFUL_PRIMITIVES.size` pin +2 |
| `packages/conformance/src/scenarios/phase2Coverage.test.ts` | Modify | additions constant (both cardinality sums) |
| `packages/conformance/src/scenarios/taRising.scenario.ts` / `taFalling.scenario.ts` | Create | conformance |
| `packages/conformance/src/scenarios/index.ts` | Modify | import + export + `ALL_SCENARIOS` |
| `docs/primitives/ta/rising.md` / `falling.md` | Generate | auto docs |
| `skills/chartlang-coding/references/primitives.md` | Generate | skills regen |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm test` (runtime + conformance 100% coverage)
- `pnpm docs:check`, `pnpm docs:gate` (generated ta pages committed),
  `pnpm skills:gate`
- `pnpm conformance`
- `pnpm bench:ci`

## Changeset

`.changeset/ta-rising-falling.md` — `"@invinite-org/chartlang-runtime":
minor`, `"@invinite-org/chartlang-core": minor` (registry entries).
Body: "Add `ta.rising` / `ta.falling` monotonic-direction boolean
primitives."

## Acceptance Criteria

- Both primitives implemented against the shared `monotonic` kernel (no
  duplicated math), wired into `TA_REGISTRY` + namespace (no metadata
  entries — the `crossover` convention).
- `STATEFUL_PRIMITIVES` gains both entries; the compiler size pin and
  the conformance `phase2Coverage` cardinality sums are updated and
  green.
- Full §22.10 set landed; property test proves equivalence to a
  brute-force reference and the mutual-exclusion invariant.
- Warmup emits `false`; NaN-in-window ⇒ `false`; tick replay does not
  pollute the next close.
- Golden hashes pinned (`hashBoolArray`); conformance scenarios in
  `ALL_SCENARIOS` and green.
- Generated docs + skills committed; changeset committed; coverage 100%.
