# Runtime `ta.rising` + `ta.falling`

> **Status: TODO**

## Goal

Implement the two monotonic-direction boolean primitives in the runtime
with the full §22.10 set, and wire them into `TA_REGISTRY`. They are
mirror siblings (like `crossover` / `crossunder`), so they land in one
task sharing a private helper.

## Prerequisites

Task 1 (core holes, `STATEFUL_PRIMITIVES`, signatures).

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

### 1. Shared kernel (`packages/runtime/src/ta/_lib/` or inline)

A pure helper `monotonic(window, length, dir: 1 | -1): boolean` that
walks the trailing `length` deltas and returns whether every step has
the required sign, short-circuiting to `false` on any non-finite slot or
insufficient history. Search `packages/runtime/src/ta/lib/` for an
existing window/monotonic helper first (reuse if present); otherwise add
one there and property-test it as the reference. Do **not** duplicate
math between `rising` and `falling` — both call this helper with
opposite `dir`.

### 2. `rising.ts` / `falling.ts` (`packages/runtime/src/ta/`)

Mirror `change.ts`:

```ts
type DirSlot = {
    readonly outBuffer: RingBuffer<boolean>;
    readonly series: Series<boolean>;
    readonly length: number;
    readonly sourceWindow: Float64RingBuffer; // trailing length+1 values
};
```

`closeValue` appends the source, then emits `monotonic(...)` once the
window holds `length + 1` values (else `false`). `tickValue` substitutes
the tick's source for the age-0 slot before evaluating, leaving the
closed window untouched. Read the source via the shared
`readSourceValue` helper `change.ts` uses. Return `slot.series`.

Copy the JSDoc block from the Task-1 core hole verbatim (`@formula`,
`@warmup length`, `@since 1.6`, `@stable`, `@example`) — the docs gate
reads the runtime source.

### 3. Registry wiring (`packages/runtime/src/ta/registry.ts`)

- `import { rising } from "./rising.js";` / `import { falling } from
  "./falling.js";`
- Add `rising` / `falling` to the `TA_REGISTRY` frozen object.
- Add the two methods to the `RuntimeTaNamespace` interface with the
  `Series<boolean>` return.
- `TA_REGISTRY_METADATA`: boolean primitives render as 0/1 markers in
  their own sub-pane. Add a `yDomain: { kind: "fixed", min: 0, max: 1 }`
  entry for each (mirror how existing boolean primitives, e.g.
  `crossover`, are keyed — check whether they carry metadata; match
  that convention exactly rather than inventing one).

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
- **Golden** (`*.golden.test.ts`): pin the SHA of the boolean output for
  `syntheticBars(100, 42)` at `length: 3`. Use the repo's boolean-hash
  helper (mirror an existing boolean golden, e.g. `crossover.golden`).
- **Bench** (`*.bench.ts` + `*.bench.test.ts`): mirror `change.bench` —
  O(length) per-bar walk; assert the bench runs (no perf regression
  gate beyond `bench:ci`).

### 5. Conformance (`packages/conformance/src/scenarios/`)

Add `taRising.scenario.ts` + `taFalling.scenario.ts` mirroring
`taChange.scenario.ts` (inline `defineIndicator` calling the primitive,
`intervalCount: 1`, assertions: `alert-count: 0`,
`diagnostic-code-absent: lookback-exceeded`,
`diagnostic-code-absent: malformed-emission`). Export from
`packages/conformance/src/scenarios/index.ts` and register in the suite
wherever `TA_CHANGE_SCENARIO` is enumerated.

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
| `packages/runtime/src/ta/lib/<monotonic>.ts` | Create/Reuse | shared kernel |
| `packages/runtime/src/ta/registry.ts` | Modify | imports + `TA_REGISTRY` + namespace + metadata |
| `packages/conformance/src/scenarios/taRising.scenario.ts` / `taFalling.scenario.ts` | Create | conformance |
| `packages/conformance/src/scenarios/index.ts` | Modify | export + register |
| `docs/primitives/ta/rising.md` / `falling.md` | Generate | auto docs |
| `skills/chartlang-coding/references/primitives.md` | Generate | skills regen |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm test` (runtime + conformance 100% coverage)
- `pnpm docs:check`, `pnpm skills:gate`
- `pnpm conformance`
- `pnpm bench:ci`

## Changeset

`.changeset/ta-rising-falling.md` — `"@invinite-org/chartlang-runtime":
minor`. Body: "Add `ta.rising` / `ta.falling` monotonic-direction
boolean primitives."

## Acceptance Criteria

- Both primitives implemented against the shared `monotonic` kernel (no
  duplicated math), wired into `TA_REGISTRY` + metadata + namespace.
- Full §22.10 set landed; property test proves equivalence to a
  brute-force reference and the mutual-exclusion invariant.
- Warmup emits `false`; NaN-in-window ⇒ `false`; tick replay does not
  pollute the next close.
- Golden hashes pinned; conformance scenarios registered and green.
- Generated docs + skills committed; changeset committed; coverage 100%.
