# Task 3 — host-worker: `idbStateStore` subpath export

> **Status: TODO**

## Goal

Ship the browser-default `PersistentStateStore` backing — an IDB-
backed implementation exposed at the `@invinite-org/chartlang-host-worker/idb`
subpath. One IDB record per `StateStoreKey`, default 50 MB cap with
oldest-first eviction, dispose + 60s-cadence writes inherited from
the runtime's save cadence (Task 2).

## Prerequisites

- Task 2: `PersistentStateStore` sub-interface available from
  `@invinite-org/chartlang-runtime`.

## Current Behavior

- `packages/host-worker/src/` ships the Phase-1 wire protocol +
  `createWorkerHost` + sandbox tests. No IDB code path.
- `packages/host-worker/package.json` has no `"./idb"` subpath
  export.
- Browser hosts have no Phase-5 persistence story — every script
  re-replays full history on mount.

## Desired Behavior

- A new `packages/host-worker/src/idbStateStore.ts` module exports
  `idbStateStore({ dbName, capBytes? })` returning a
  `PersistentStateStore`.
- One IDB object store (`chartlangSnapshots`) keyed by the
  stringified `StateStoreKey`; one record per key carrying the
  `StateSnapshot` blob + `bytesEstimate` metadata.
- Default cap `capBytes = 50 * 1024 * 1024` (50 MB). On write, if
  cumulative bytes exceed the cap, evict snapshots in
  `savedAt`-ascending order until under cap.
- `package.json` declares an `"./idb"` subpath export pointing at the
  built `dist/idb.js` + `dist/idb.d.ts`.
- Unit tests run against `fake-indexeddb` (existing dev dep — confirm
  in step 1) so the IDB path executes under Node + vitest.

## Requirements

### 1. Dependency audit

- Confirm `fake-indexeddb` is in `packages/host-worker/package.json`
  `devDependencies`. If not, append it. Use a version pin matching
  the rest of the monorepo's dev deps (check root
  `pnpm-lock.yaml` for the existing peer's version if any other
  package uses it; otherwise pin to `^6.0.0`).
- No new runtime dependencies — `idbStateStore` uses the platform
  `indexedDB` global (provided by the browser or
  `fake-indexeddb/auto`).

### 2. `packages/host-worker/src/idbStateStore.ts` (new file)

Two-line MIT header, then:

```ts
import type {
    PersistentStateStore,
    inMemoryPersistentStateStore as _,
} from "@invinite-org/chartlang-runtime";
import type { StateSnapshot, StateStoreKey } from "@invinite-org/chartlang-core";

const DEFAULT_DB_NAME = "chartlang";
const DEFAULT_CAP_BYTES = 50 * 1024 * 1024;
const OBJECT_STORE = "chartlangSnapshots";

type StoredRecord = Readonly<{
    keyString: string;
    snapshot: StateSnapshot;
    bytesEstimate: number;
}>;

/**
 * IDB-backed {@link PersistentStateStore}. One record per
 * `StateStoreKey`, capped at `capBytes` total with oldest-first
 * eviction by `snapshot.savedAt`. Reads on mount, writes on
 * dispose + 60s cadence (cadence enforced by the runtime, not the
 * store). Identity-safe: `load()` returns `null` for any
 * non-matching key; `clear()` deletes only this key's record.
 *
 * @since 0.5
 * @example
 *     // import { idbStateStore } from "@invinite-org/chartlang-host-worker/idb";
 *     // const store = idbStateStore({ dbName: "chartlang", key });
 *     // await store.save(snapshot);
 */
export function idbStateStore(opts: Readonly<{
    key: StateStoreKey;
    dbName?: string;
    capBytes?: number;
}>): PersistentStateStore {
    const dbName = opts.dbName ?? DEFAULT_DB_NAME;
    const capBytes = opts.capBytes ?? DEFAULT_CAP_BYTES;
    const keyString = stringifyKey(opts.key);
    // … implementation
}
```

Implementation details:

- `stringifyKey(key)`: `JSON.stringify` with a stable field order —
  `scriptHash`, `compilerVersion`, `apiVersion`, `capabilitiesHash`,
  `symbol`, `mainInterval`, then `requestedIntervals.join(",")`.
- IDB connection management:
  - Lazy `openDb()` that resolves a singleton `IDBDatabase` per
    `dbName`. Reuses an in-module `Map<string, Promise<IDBDatabase>>`.
  - `onupgradeneeded` creates the `chartlangSnapshots` object store
    with `keyPath: "keyString"` and an index on `savedAt` (used by
    eviction).
- `load()`:
  - Open a `readonly` transaction.
  - `store.get(keyString)` → resolves the `StoredRecord` or
    `undefined`.
  - Returns `record?.snapshot ?? null`.
- `save(snapshot)`:
  - Compute `bytesEstimate = JSON.stringify(snapshot).length * 2`
    (UTF-16 byte estimate — good enough for cap heuristics).
  - Open a `readwrite` transaction over the store.
  - Sum existing `bytesEstimate` for all records **excluding** the
    one being written. If `sum + newBytes > capBytes`, walk the
    `savedAt` index in ascending order and delete until under.
  - `store.put({ keyString, snapshot, bytesEstimate })`.
- `clear()`:
  - `readwrite` transaction; `store.delete(keyString)`.
- All three methods return `Promise<void | StateSnapshot | null>`
  that resolves on IDB transaction `oncomplete` and rejects on
  `onerror`.

### 3. `packages/host-worker/package.json` — declare the subpath

Append to the `exports` map:

```json
"./idb": {
  "types": "./dist/idb.d.ts",
  "import": "./dist/idb.js"
}
```

And add an `idb.ts` re-export at `src/idb.ts` (one line):

```ts
export { idbStateStore } from "./idbStateStore";
```

Update `tsconfig.json` / build script to emit `dist/idb.{js,d.ts}`.
Mirror the bundling pattern used by the existing `dist/worker-boot.js`
build script — see `packages/host-worker/scripts/`.

### 4. `packages/host-worker/src/idbStateStore.test.ts` (new file)

Use `fake-indexeddb/auto` (sets up `globalThis.indexedDB` before any
test runs):

- `load()` returns `null` on first call for a fresh key.
- `save(snap)` → `load()` returns the same snapshot (deep-equal).
- `save(s1); save(s2)` → `load()` returns `s2` (last-write-wins).
- `clear()` → `load()` returns `null`.
- Two distinct keys are isolated — saving under key A does not affect
  key B.
- Eviction: configure `capBytes: 1024`, write three snapshots large
  enough to exceed the cap; assert the oldest two are evicted (by
  `savedAt`).
- Concurrent reads + writes do not corrupt the store (use an
  `await Promise.all([…])` for 5 simultaneous saves; assert the
  final state is one of the saved snapshots).
- IDB rejection path: stub `indexedDB.open` to throw asynchronously;
  assert `load()` / `save()` reject with an `Error` carrying the
  underlying message. (Restore the stub in `afterEach`.)

### 5. `packages/host-worker/src/idbStateStore.bench.ts` (+ pair)

Bench-pair pattern (per `packages/runtime/CLAUDE.md`):

- `idbStateStore.bench.ts`: vitest `bench()` measuring `save(snapshot)`
  for a representative 5,000-bar snapshot + `load()` round-trip.
- `idbStateStore.bench.test.ts`: vitest `it()` asserting a
  `THRESHOLD_MS` (target ≤ 50 ms for save + load on
  `fake-indexeddb`; document why this is the bound — real IDB is
  faster).

### 6. JSDoc

- `idbStateStore` — `@since 0.5`, `@example`, `@experimental`.
- Internal helpers (`stringifyKey`, `openDb`, eviction walk) carry
  short `@internal` JSDoc.

### 7. README

Add a 4-line stanza to `packages/host-worker/README.md` documenting
the new subpath import + a one-liner on the 50 MB cap. Stay within
the 100-line cap.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/host-worker/src/idbStateStore.ts` | Create | IDB-backed `PersistentStateStore` |
| `packages/host-worker/src/idb.ts` | Create | Subpath re-export entry |
| `packages/host-worker/src/idbStateStore.test.ts` | Create | Unit tests (fake-indexeddb) |
| `packages/host-worker/src/idbStateStore.bench.ts` | Create | Bench (vitest bench mode) |
| `packages/host-worker/src/idbStateStore.bench.test.ts` | Create | `THRESHOLD_MS` gate |
| `packages/host-worker/package.json` | Modify | Add `./idb` subpath export, add `fake-indexeddb` dev dep |
| `packages/host-worker/tsconfig.json` | Modify | Include `idb.ts` in emit |
| `packages/host-worker/scripts/<bundle>` | Modify | Emit `dist/idb.{js,d.ts}` |
| `packages/host-worker/README.md` | Modify | Document the subpath |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm -F @invinite-org/chartlang-host-worker test --coverage` (100%)
- `pnpm docs:check`
- `pnpm readme:check` (host-worker README ≤ 100 lines)
- `pnpm bench:ci` (idbStateStore bench within threshold)

## Changeset

`.changeset/phase5-host-worker-idb-state-store.md` — `minor` bump for
`@invinite-org/chartlang-host-worker`. Body cites PLAN §6.9 + §8.2.


- [x] `idbStateStore({ dbName?, key, capBytes? })` exported from
      `@invinite-org/chartlang-host-worker/idb`.
- [x] IDB object store creation, key isolation, round-trip, eviction,
      concurrent writes all tested against `fake-indexeddb`.
- [x] Bench pair lands under `THRESHOLD_MS`.
- [x] Subpath export declared in `package.json`; the import works
      from a consumer test (verify via the conformance suite Task 5
      smoke).
- [x] README updated, ≤ 100 lines.
- [x] 100% coverage maintained; `pnpm docs:check` green.
- [x] Changeset committed.
