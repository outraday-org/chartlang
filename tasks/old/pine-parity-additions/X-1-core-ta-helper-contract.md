# Core contract for `ta` helpers (`rising`, `falling`, `cross`, `cum`)

> **Status: TODO**

## Goal

Declare the four new `ta.*` helper primitives on the frozen core `ta`
namespace: sentinel holes, option/signature types, and the compiler
ambient-shim mirror. No runtime math lands here — this is the shared
contract Tasks 2 and 3 consume.

**Deliberately NOT here:** the `STATEFUL_PRIMITIVES` registry entries.
The skills generator's `crossCheckTa`
(`scripts/generate-skills-reference.ts:99-114`) throws for any `ta.*`
registry entry that has no documented runtime source file, so
registering the names before Tasks 2/3 land their `packages/runtime/
src/ta/*.ts` files would fail `pnpm skills:gate`. Each registry entry
lands in the task that lands its runtime impl (Task 2: `rising` /
`falling`; Task 3: `cross` / `cum`).

## Prerequisites

None.

## Current Behavior

`packages/core/src/ta/ta.ts` declares every `ta.*` primitive as a
frozen sentinel hole that throws `"<name> called outside compiled
runtime"` (see `change` at `ta.ts:2567-2569`);
`packages/core/src/statefulPrimitives.ts` lists each as
`{ name: "ta.<id>", slot: true }`. There is no `rising` / `falling` /
`cross` / `cum`.

## Desired Behavior

The four primitives are declared and type-check with the signatures
below; calling them outside a runtime step throws (as every hole does).
Slot injection activates when Tasks 2/3 add the `slot: true` registry
entries alongside the runtime impls.

## Requirements

### 1. Signatures + option types (`packages/core/src/ta/ta.ts`)

Add near the existing `ChangeOpts` (`ta.ts:197`) / crossover
declarations. Signatures (author form — the compiler injects the
leading `slotId`). Core's source alias is **`TaSource`**
(`ta.ts:23`, `TaSource = number | Series<number>`) — NOT
`ScalarOrSeries`, which is the same union's name in the compiler shim
and the runtime (the documented three-way lockstep; see
`packages/core/CLAUDE.md` → "Every numeric `ta.*` source is the shared
`TaSource`"):

```ts
export type RisingOpts = Readonly<{ /* reserved for future opts */ }>;
export type FallingOpts = Readonly<{ /* reserved */ }>;
export type CrossOpts = Readonly<{ /* reserved */ }>;
export type CumOpts = Readonly<{ /* reserved */ }>;

// on TaNamespace (ta.ts:2389):
rising(source: TaSource, length: number, opts?: RisingOpts): Series<boolean>;
falling(source: TaSource, length: number, opts?: FallingOpts): Series<boolean>;
cross(a: TaSource, b: TaSource, opts?: CrossOpts): Series<boolean>;
cum(source: TaSource, opts?: CumOpts): Series<number>;
```

Reuse the existing `TaSource` / `Series` / `TaNamespace` types — do
**not** introduce parallel types. `cross`'s two operands mirror
`crossover(a, b)` exactly. Empty opts bags keep the surface
forward-compatible (a later option is additive).

### 2. Sentinel holes (`packages/core/src/ta/ta.ts`)

Mirror the `change` hole exactly, inside the frozen `ta` object:

```ts
rising: () => { throw new Error("ta.rising called outside compiled runtime"); },
falling: () => { throw new Error("ta.falling called outside compiled runtime"); },
cross: () => { throw new Error("ta.cross called outside compiled runtime"); },
cum: () => { throw new Error("ta.cum called outside compiled runtime"); },
```

### 3. JSDoc on each hole (docs:check completeness + hover registry)

Each hole carries the full JSDoc block the docs gate requires
(`@formula`, `@warmup`, `@since 1.8`, `@stable`, `@example`). Note the
scoping: the generated `docs/primitives/ta/*.md` pages and the skills
`primitives.md` are generated from the **runtime** JSDoc
(`scripts/docs-gate.ts:37` reads `packages/runtime/src/ta`;
`scripts/generate-skills-reference.ts:23` likewise) — the core JSDoc
here satisfies `pnpm docs:check` completeness and feeds the
language-service **hover registry** (step 6). Keep it byte-identical
to the runtime JSDoc in Tasks 2/3. Suggested `@formula` / `@warmup`:

- `rising` — `@formula out[t] = ⋀_{k=1..length} src[t−k+1] > src[t−k]`
  · `@warmup length`
- `falling` — `@formula out[t] = ⋀_{k=1..length} src[t−k+1] < src[t−k]`
  · `@warmup length`
- `cross` — `@formula out[t] = crossover(a,b)[t] ∨ crossunder(a,b)[t]`
  · `@warmup 1`
- `cum` — `@formula out[t] = Σ_{u=0..t} (isFinite(src[u]) ? src[u] : 0)`
  · `@warmup 0`

`@example` blocks are comment-only (not executed), matching the
existing convention (see `change`'s runtime JSDoc), e.g.
`// const up = ta.rising(bar.close, 3);`.

### 4. Registry entries land with the runtime impls (Tasks 2/3)

Do **not** touch `packages/core/src/statefulPrimitives.ts` here — see
the Goal note. Task 2 appends `ta.rising` / `ta.falling` and Task 3
appends `ta.cross` / `ta.cum` (each `slot: true`), together with the
cardinality-gate bumps those entries force
(`packages/compiler/src/program.test.ts:222` pins
`STATEFUL_PRIMITIVES.size`;
`packages/conformance/src/scenarios/phase2Coverage.test.ts` pins both
registry sizes via additions constants).

### 5. Compiler ambient shim (`packages/compiler/src/program.ts`)

The shim is the **hand-written** `CORE_AMBIENT_SHIM` template literal
(`program.ts:28-1601`) — there is no generator; edit it by hand. Add
the four members to the ambient `TaNamespace` type (`program.ts:633-765`;
`change` is at line 660, `crossover`/`crossunder` at 641-650) in
lockstep with step 1. The shim's source union is named `ScalarOrSeries`
(the shim-side name for core's `TaSource` — keep the signatures
structurally identical, using each layer's own alias name).

### 6. Hover registry regen (`pnpm gen-hover-registry`)

The language-service hover registry
(`packages/language-service/src/hoverRegistry.generated.ts`) is
generated from **core JSDoc** and byte-diff-gated by `pnpm hover:check`.
Adding the four JSDoc'd holes makes the committed registry stale — run
`pnpm gen-hover-registry` and commit the regenerated file.

### 7. Type test (`packages/core/src/ta/*.types.test.ts`)

Extend the existing `ta` type-test coverage (or the root
`types.types.test.ts`) with `expect-type` assertions that each new
member has the declared signature and that a numeric enum/scalar source
is assignable. Sentinel-throw behavior is asserted in the co-located
`ta.ts` unit test (mirror the existing `change`-hole throw test) — this
is what preserves core's 100% line coverage on the holes.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/ta/ta.ts` | Modify | 4 signatures + opts types + holes + JSDoc |
| `packages/compiler/src/program.ts` | Modify | Ambient `TaNamespace` mirror (hand-edit `CORE_AMBIENT_SHIM`) |
| `packages/language-service/src/hoverRegistry.generated.ts` | Generate | `pnpm gen-hover-registry` (core JSDoc changed) |
| `packages/core/src/ta/ta.test.ts` | Modify | Sentinel-throw tests (4) |
| `packages/core/src/ta/*.types.test.ts` | Modify | `expect-type` signature checks |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (core + compiler 100% coverage)
- `pnpm docs:check` — JSDoc completeness on the 4 new holes
- `pnpm hover:check` — regenerated hover registry committed
- `pnpm skills:gate` — stays green as a NO-OP here: the generator keys
  its `ta.*` list off `STATEFUL_PRIMITIVES`, which this task does not
  touch (the registry entries + fully-consistent skills regen land with
  Tasks 2/3).

## Changeset

`.changeset/ta-helper-contract.md` — `"@invinite-org/chartlang-core":
minor`, `"@invinite-org/chartlang-compiler": minor`,
`"@invinite-org/chartlang-language-service": patch` (regenerated hover
registry is a `src/` diff). Body: "Add `ta.rising` / `ta.falling` /
`ta.cross` / `ta.cum` core declarations."

## Acceptance Criteria

- Four holes declared, typed (`TaSource` sources), JSDoc-complete
  (`@since 1.8`), and throwing when called outside a step.
- `STATEFUL_PRIMITIVES` deliberately untouched (entries land in
  Tasks 2/3 — see Goal note).
- Compiler ambient shim mirrors the four signatures (shim-side
  `ScalarOrSeries` alias) by hand-edit.
- Hover registry regenerated + committed; `pnpm hover:check` green.
- Sentinel-throw + type tests land; core coverage stays 100%.
- `pnpm docs:check` green; changeset committed.
- No existing snapshot / manifest changes (additive only).
