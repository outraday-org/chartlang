# Task 1 — Core: `StateSnapshot` / `StreamSnapshot` / `StateStoreKey` types

> **Status: TODO**

## Goal

Land the canonical PLAN §6.1 + §6.9 snapshot type declarations in
`@invinite-org/chartlang-core` so every downstream consumer (runtime,
host-worker IDB store, host-quickjs server backings, conformance
suite) imports a single source of truth. Pure type-level work — no
runtime behaviour changes.

## Prerequisites

- Phase 4 (`0.4`) shipped — Phase-4 closeout asserted
  `STATEFUL_PRIMITIVES.size === 163` and the full Phase-4 `Capabilities`
  triad.

## Current Behavior

- `packages/core/src/types.ts` declares `JsonValue`, `IntervalDescriptor`,
  `ScriptManifest`, `ComputeContext`, `CompiledScriptObject`. Has no
  `StateSnapshot` / `StreamSnapshot` / `StateStoreKey` types.
- `packages/runtime/src/stateStore.ts` JSDoc names a forthcoming
  `PersistentStateStore` sub-interface but defines only the Phase-1
  `StateStore.{get,set,has,clear}` slot store.
- `packages/compiler/src/program.ts` `CORE_AMBIENT_SHIM` pins every core
  symbol the compiler resolves against — `StateSnapshot` etc. not yet
  declared there.

## Desired Behavior

- `@invinite-org/chartlang-core` exports three new types — `StateSnapshot`,
  `StreamSnapshot`, `StateStoreKey` — with the exact §6.1 + §6.9 shapes.
- All three are `JsonValue`-clean by construction (every field is a
  primitive, a `Readonly<Record<string, JsonValue>>`, or a typed
  numeric-array view that round-trips through `JSON.stringify`).
- `snapshotVersion: 1` is a literal type — bumping it is a future
  migration event.
- The compiler's ambient shim mirrors the new declarations so scripts
  that reference these types (typically authored by adapter writers,
  not script authors) typecheck under the compiler's TS program.

## Requirements

### 1. `packages/core/src/state/snapshot.ts` (new file)

Two-line MIT header, then:

```ts
import type { JsonValue } from "../types";

/**
 * Per-stream snapshot captured during state persistence
 * (PLAN.md §6.1, §6.9). Carries everything needed to rehydrate
 * a ring buffer for one timeframe — main or HTF secondary.
 *
 * `buffers` is keyed by the canonical OHLCV field names; each value
 * is a `JsonValue`-clean array of `number | null` (null preserves
 * NaN holes through `JSON.stringify`). `headIndex` and `filled`
 * mirror the ring-buffer's internal state at snapshot time.
 *
 * @since 0.5
 * @example
 *     const s: StreamSnapshot = {
 *         interval: "1D",
 *         headIndex: 4999,
 *         filled: 5000,
 *         buffers: { time: [], open: [], high: [], low: [], close: [], volume: [] },
 *     };
 *     void s;
 */
export type StreamSnapshot = Readonly<{
    interval: string;
    headIndex: number;
    filled: number;
    buffers: Readonly<{
        time: ReadonlyArray<number | null>;
        open: ReadonlyArray<number | null>;
        high: ReadonlyArray<number | null>;
        low: ReadonlyArray<number | null>;
        close: ReadonlyArray<number | null>;
        volume: ReadonlyArray<number | null>;
    }>;
}>;

/**
 * Canonical persistent-store snapshot (PLAN.md §6.9). Written on
 * `dispose()` and on every `kind: "close"` event when stale ≥60s.
 * `slots` carries every stateful primitive's per-callsite payload
 * keyed by the compiler-injected slot id (§5.5). Each value is
 * `JsonValue` — primitive authors with non-JSON internal state
 * register `{ serialiseState, deserialiseState }` hooks (Task 2).
 *
 * `snapshotVersion: 1` is the only currently-supported wire
 * version. A future schema change must bump this literal — the
 * runtime drops snapshots with a mismatched version on `load()`.
 *
 * @since 0.5
 * @example
 *     const s: StateSnapshot = {
 *         lastBarTime: 1700000000_000,
 *         streams: {},
 *         slots: {},
 *         savedAt: 1700000060_000,
 *         snapshotVersion: 1,
 *     };
 *     void s;
 */
export type StateSnapshot = Readonly<{
    lastBarTime: number;
    streams: Readonly<Record<string, StreamSnapshot>>;
    slots: Readonly<Record<string, JsonValue>>;
    savedAt: number;
    snapshotVersion: 1;
}>;

/**
 * Canonical persistent-store identity tuple (PLAN.md §6.9).
 * Every field contributes to the cache key — any change invalidates
 * the snapshot. The store treats the tuple opaquely as a string key;
 * the typical implementation is `JSON.stringify(key)` with sorted
 * fields.
 *
 * - `scriptHash` — `sha256` of the compiled `moduleSource`.
 * - `compilerVersion` — `PACKAGE_VERSION` of `@invinite-org/chartlang-compiler`.
 * - `apiVersion` — script header pin (`1` today).
 * - `capabilitiesHash` — `sha256` of the normalised adapter `Capabilities`.
 * - `symbol` — the adapter's loaded ticker.
 * - `mainInterval` — primary stream interval.
 * - `requestedIntervals` — frozen array of secondary stream intervals.
 *
 * @since 0.5
 * @example
 *     const k: StateStoreKey = {
 *         scriptHash: "abc",
 *         compilerVersion: "0.5.0",
 *         apiVersion: 1,
 *         capabilitiesHash: "def",
 *         symbol: "BTCUSD",
 *         mainInterval: "1m",
 *         requestedIntervals: [],
 *     };
 *     void k;
 */
export type StateStoreKey = Readonly<{
    scriptHash: string;
    compilerVersion: string;
    apiVersion: 1;
    capabilitiesHash: string;
    symbol: string;
    mainInterval: string;
    requestedIntervals: ReadonlyArray<string>;
}>;
```

### 2. `packages/core/src/state/index.ts` (new file)

Two-line MIT header, then a single line:

```ts
export type { StateSnapshot, StateStoreKey, StreamSnapshot } from "./snapshot";
```

### 3. `packages/core/src/index.ts` — append the re-exports

Mirror the established barrel pattern (one line each):

```ts
export type { StateSnapshot, StateStoreKey, StreamSnapshot } from "./state";
```

Place under the existing `request` / `state` clusters; keep
alphabetised within the cluster.

### 4. `packages/core/src/state/snapshot.types.test.ts` (new file)

Type-only assertions (Phase-2 / Phase-3 `.types.test.ts` pattern):

- Construct a representative `StateSnapshot` literal and assert
  `expectType<JsonValue>(snapshot)` compiles — the snapshot is
  `JsonValue`-assignable by structure.
- Assert `snapshotVersion: 0` is a type error (`@ts-expect-error`).
- Assert `apiVersion: 2` on `StateStoreKey` is a type error
  (`@ts-expect-error`).
- Assert `buffers.bogus: …` on `StreamSnapshot` is a type error
  (`@ts-expect-error`).
- Assert `readonly` widening (`as const`-style) compiles — every field
  is `Readonly`-marked.

### 5. `packages/core/src/state/snapshot.test.ts` (new file)

Runtime test (Phase-2 minimal-coverage pattern):

- A single `it("type module has no runtime surface", () => { … })`
  that imports the module and asserts nothing about its runtime —
  the file is type-only, so coverage is satisfied by the `index.ts`
  re-export alone. Reference the snapshot type once via a `void`
  expression to keep TS happy.

### 6. `packages/compiler/src/program.ts` — extend `CORE_AMBIENT_SHIM`

Append the three new type declarations to the in-program shim so the
compiler's bundled TS program resolves script-side references:

```ts
// in CORE_AMBIENT_SHIM:
export type StreamSnapshot = { … }
export type StateSnapshot = { … }
export type StateStoreKey = { … }
```

Mirror the exact field shapes (the compiler's shim is text, not
imported types — keep both files in lockstep). Phase-4 set the
precedent of treating the shim as a parallel source of truth that
must stay in sync.

### 7. JSDoc tags

Each new export carries:

- `@since 0.5`
- `@example` with a compileable literal (per the snippets above)
- An `@experimental` stability marker (Phase 5 surfaces stay
  experimental until 1.0).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/state/snapshot.ts` | Create | Declare `StateSnapshot`, `StreamSnapshot`, `StateStoreKey` |
| `packages/core/src/state/index.ts` | Create | Barrel re-export |
| `packages/core/src/state/snapshot.types.test.ts` | Create | Type-level assertions |
| `packages/core/src/state/snapshot.test.ts` | Create | Runtime smoke test (type-only module) |
| `packages/core/src/index.ts` | Modify | Re-export the three new types |
| `packages/compiler/src/program.ts` | Modify | Mirror the new types in `CORE_AMBIENT_SHIM` |

(Note: `packages/core/src/state/` already exists from Phase 4's
`state.*` slot builders. Add the snapshot files alongside — do not
overwrite the existing `defineState`/`stateTickSlot` files.)

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (coverage 100% on core; the new file is type-only and
  rides the existing `types.ts`-style exclusion via `vitest.config.ts`).
- `pnpm docs:check` (JSDoc `@example` / `@since` / stability marker
  on every new export).
- `pnpm readme:check` (no README changes expected).

## Changeset

`.changeset/phase5-core-snapshot-types.md` — `minor` bump for
`@invinite-org/chartlang-core` and `@invinite-org/chartlang-compiler`
(the compiler shim update). Body cites PLAN §6.1 + §6.9.


- [x] Three new types exported from `@invinite-org/chartlang-core` with
      JSDoc carrying `@since 0.5`, `@example`, `@experimental`.
- [x] `expectType<JsonValue>(snapshotLiteral)` compiles — proves
      JsonValue-cleanliness at the type level.
- [x] `@ts-expect-error` assertions cover the `snapshotVersion: 0`,
      `apiVersion: 2`, and unknown-field cases.
- [x] `CORE_AMBIENT_SHIM` in the compiler mirrors the three new types
      verbatim; `pnpm -F @invinite-org/chartlang-compiler test` stays
      green.
- [x] `pnpm -F @invinite-org/chartlang-core test --coverage` reports
      100% on the touched files.
- [x] `pnpm docs:check` green (JSDoc on the three new exports passes
      the gate). No auto-generated docs page expected — `scripts/gen-docs.ts`
      walks function primitives in `packages/runtime/src/ta/` only;
      type-only modules under `packages/core/src/state/` are out of
      scope for the generator.
- [x] Changeset committed; `pnpm changeset status` lists the bump.
