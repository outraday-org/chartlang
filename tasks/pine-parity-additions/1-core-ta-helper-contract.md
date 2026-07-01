# Core contract for `ta` helpers (`rising`, `falling`, `cross`, `cum`)

> **Status: TODO**

## Goal

Declare the four new `ta.*` helper primitives on the frozen core `ta`
namespace: sentinel holes, option/signature types, `STATEFUL_PRIMITIVES`
entries, and the compiler ambient-shim mirror. No runtime math lands
here — this is the shared contract Tasks 2 and 3 consume.

## Prerequisites

None.

## Current Behavior

`packages/core/src/ta/ta.ts` declares every `ta.*` primitive as a
frozen sentinel hole that throws `"<name> called outside compiled
runtime"`; `packages/core/src/statefulPrimitives.ts` lists each as
`{ name: "ta.<id>", slot: true }`. There is no `rising` / `falling` /
`cross` / `cum`.

## Desired Behavior

The four primitives are callable in a script and type-check with the
signatures below; calling them outside a runtime step throws (as every
hole does). The compiler sees them as `slot: true` stateful callsites
and injects a slot id.

## Requirements

### 1. Signatures + option types (`packages/core/src/ta/ta.ts`)

Add near the existing `ChangeOpts` / crossover declarations. Signatures
(author form — the compiler injects the leading `slotId`):

```ts
export type RisingOpts = Readonly<{ /* reserved for future opts */ }>;
export type FallingOpts = Readonly<{ /* reserved */ }>;
export type CrossOpts = Readonly<{ /* reserved */ }>;
export type CumOpts = Readonly<{ /* reserved */ }>;

// on TaNamespace:
rising(source: ScalarOrSeries, length: number, opts?: RisingOpts): Series<boolean>;
falling(source: ScalarOrSeries, length: number, opts?: FallingOpts): Series<boolean>;
cross(a: ScalarOrSeries, b: ScalarOrSeries, opts?: CrossOpts): Series<boolean>;
cum(source: ScalarOrSeries, opts?: CumOpts): Series<number>;
```

Reuse the existing `ScalarOrSeries` / `Series` / `TaNamespace` types —
do **not** introduce parallel types. Empty opts bags keep the surface
forward-compatible (a later option is additive).

### 2. Sentinel holes (`packages/core/src/ta/ta.ts`)

Mirror the `change` hole exactly, inside the frozen `ta` object:

```ts
rising: () => { throw new Error("ta.rising called outside compiled runtime"); },
falling: () => { throw new Error("ta.falling called outside compiled runtime"); },
cross: () => { throw new Error("ta.cross called outside compiled runtime"); },
cum: () => { throw new Error("ta.cum called outside compiled runtime"); },
```

### 3. JSDoc on each hole (drives docs + skills generation)

Each hole carries the full JSDoc block the docs gate requires
(`@formula`, `@warmup`, `@since 1.6`, `@stable`, `@example`). The prose
here is the source of truth for the auto-generated page; keep it
consistent with the runtime JSDoc in Tasks 2/3. Suggested `@formula` /
`@warmup`:

- `rising` — `@formula out[t] = ⋀_{k=1..length} src[t−k+1] > src[t−k]`
  · `@warmup length`
- `falling` — `@formula out[t] = ⋀_{k=1..length} src[t−k+1] < src[t−k]`
  · `@warmup length`
- `cross` — `@formula out[t] = crossover(a,b)[t] ∨ crossunder(a,b)[t]`
  · `@warmup 1`
- `cum` — `@formula out[t] = Σ_{u=0..t} (isFinite(src[u]) ? src[u] : 0)`
  · `@warmup 0`

`@example` blocks are comment-only (not executed), e.g.
`// const up = ta.rising(bar.close, 3);`.

### 4. Registry entries (`packages/core/src/statefulPrimitives.ts`)

Append (order does not matter — additive):

```ts
{ name: "ta.rising", slot: true },
{ name: "ta.falling", slot: true },
{ name: "ta.cross", slot: true },
{ name: "ta.cum", slot: true },
```

`STATEFUL_PRIMITIVES_BY_NAME` derives from the same list, so both update
automatically. This is additive within `apiVersion: 1` (see
`packages/core/CLAUDE.md` → "additive within `apiVersion: 1`").

### 5. Compiler ambient shim (`packages/compiler/src/program.ts`)

The shim mirrors the `ta` namespace type the compiler type-checks
scripts against. Add the four members to the ambient `TaNamespace`
declaration in lockstep with step 1 (search the existing `change` /
`crossover` entries there). If the shim regenerates from core, run the
generator instead of hand-editing; otherwise mirror by hand and keep
the signatures byte-identical to step 1.

### 6. Type test (`packages/core/src/ta/*.types.test.ts`)

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
| `packages/core/src/statefulPrimitives.ts` | Modify | 4 `slot: true` entries |
| `packages/compiler/src/program.ts` | Modify | Ambient `TaNamespace` mirror |
| `packages/core/src/ta/ta.test.ts` | Modify | Sentinel-throw tests (4) |
| `packages/core/src/ta/*.types.test.ts` | Modify | `expect-type` signature checks |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (core + compiler 100% coverage)
- `pnpm docs:check` — JSDoc completeness on the 4 new holes
- `pnpm skills:gate` — regenerated `primitives.md` must be committed (run
  `pnpm skills:generate`). NOTE: skills generation reads the runtime
  JSDoc; the fully-consistent regen lands with Tasks 2/3. Keep the core
  JSDoc identical to the runtime JSDoc so the gate is stable.

## Changeset

`.changeset/ta-helper-contract.md` — `"@invinite-org/chartlang-core":
minor`, `"@invinite-org/chartlang-compiler": minor`. Body: "Add
`ta.rising` / `ta.falling` / `ta.cross` / `ta.cum` core declarations."

## Acceptance Criteria

- Four holes declared, typed, JSDoc-complete, and throwing when called
  outside a step.
- `STATEFUL_PRIMITIVES` + `_BY_NAME` include all four (`slot: true`).
- Compiler ambient shim mirrors the four signatures byte-identically.
- Sentinel-throw + type tests land; core coverage stays 100%.
- `pnpm docs:check` green; changeset committed.
- No existing snapshot / manifest changes (additive only).
