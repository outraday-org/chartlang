# Persistent bounded collection — `state.array`

## Overview

Add a **writable, bounded, across-bars FIFO collection** primitive,
`state.array<T>(capacity)`, so a script author can push many values into a
fixed-capacity ring that persists across bars — the one persistent-collection
capability chartlang has deliberately deferred until now. The returned handle
is a **mutable ring buffer**, not a slot-shaped scalar:

```ts
const win = state.array<number>(20);

compute({ bar }) {
    win.push(bar.close.current);   // FIFO; oldest evicted once full

    const newest = win.get(0);     // 0 = newest
    const oldest = win.get(win.size - 1);
    const last   = win.last();     // === win.get(0)
    const n      = win.size;       // filled count (≤ capacity)
    const cap    = win.capacity;   // 20 (the literal you allocated with)

    // pushes/reads are HANDLE METHODS, so they are legal inside a bounded loop:
    let sum = 0;
    for (let i = 0; i < win.size; i++) sum += win.get(i);
    plot(sum / win.size);          // rolling mean over the window
}
```

This is the **close sibling of `state.series`** (`tasks/state-series/`) — both
land a persistent, bounded, snapshot-clean store backed by the same
ring-buffer machinery. They are **not the same primitive** and must not read as
redundant:

| | `state.series<T>(init)` (`tasks/state-series/`) | `state.array<T>(capacity)` (this) |
|---|---|---|
| **Shape** | The history of **ONE** value | A **collection** of many values |
| **You write** | This bar's single value (`s.value = expr`), once per bar | Push as many values as you like (`a.push(v)`) |
| **You read** | `s[n]` = the value `n` **bars** ago | `a.get(n)` = the `n`-th **element** from newest |
| **Sizing** | Sized to the script's deepest **lookback** (`s[N]`) | Sized to the **capacity** literal you pass |
| **Lifecycle index** | One ring slot **per bar close** (script-invisible advance) | Ring slots are **author-driven pushes** within a bar |
| **Identity** | `MutableSlot<number> & Series<number>` (number-coercible) | `MutableArraySlot<T>` (a plain handle; NOT number-coercible) |

The one-line distinction, to bake into every doc and example:

> **`state.series` = "what was this value N **bars** ago?"**
> **`state.array` = "a bounded bag of the last K things I **pushed**."**

A `state.series` ring advances exactly once per bar regardless of writes;
`s[1]` is "one committed bar back". A `state.array` ring advances only when the
**author** calls `push`; `a.get(1)` is "the second-newest thing I pushed,"
which may be from this bar, an earlier bar, or never (a rolling window, an
event log, a multi-value-per-bar accumulator). Neither expresses the other.

### Why it also matters for Pine conversion

Pine's `var array<T>` with FIFO eviction (`array.push` + `array.size > K` →
`array.shift`) — the **Camp B ring** in
`skills/chartlang-coding/references/translating-from-pine.md` (§"Camp B — a
bounded ring of handles") and `docs/converter/supported.md` — already lowers
for **drawing-handle** rings (the converter rotates handle rings internally and
elides the eviction block). But a Camp B ring holding **numeric values** has no
lowering target today: chartlang has no persistent numeric collection. `state.array`
**is that target.** A bounded `var array<float>`/`var array<int>` with the
Camp B eviction signature lowers to `const a = state.array<number>(K); …
a.push(v)`, and the eviction block is elided exactly as the handle-ring case does.

### Relationship to the deferred serialization policy

`docs/spec/pine-migration.md` (§"Persistent Collections and Large Arrays",
line ~380, and the support-table row at line ~344) explicitly defers
`state.array(...)`, `state.map(...)`, matrices, and large mutable collections
**"until a serialization policy is agreed."** This task **is that policy, for
the bounded array case**:

- **Bounded by a required `capacity` literal.** Unlike Pine's growable arrays,
  `state.array` capacity is a compile-time numeric literal (Task 3 guards it),
  so the backing store is fixed-size and snapshot size is bounded — the same
  property that let `state.series` sidestep the open question.
- **Serializes via the existing ring snapshot hooks.** `Float64RingBuffer`
  already ships `serialiseSnapshotBuffer()` / `restoreFromSnapshotBuffer()`
  (`packages/runtime/src/ringBuffer.ts:136-180`) producing the JSON-clean
  `{ headIndex, filled, values }` shape that `RunnerSnapshot.slots`
  (`packages/core/src/state/snapshot.ts:61`, typed `JsonValue`) already
  accepts. There is **no new wire format** — the policy is "bounded literal
  capacity + reuse the ring's own snapshot hooks."

`state.map`, matrices, and bool/string/object-`T` arrays stay deferred
(see Deferred / Follow-Up).

References: `packages/core/CLAUDE.md` (sentinel holes, `STATEFUL_PRIMITIVES`
additive rule), `packages/runtime/CLAUDE.md` (`state.*` slot lifecycle,
`slotIdPrefix`, ring buffers), `packages/compiler/CLAUDE.md` (core-shim
lockstep, callsite-id injection, `STATEFUL_PRIMITIVES` shape),
`packages/pine-converter/CLAUDE.md` (Camp B ring classification, KNOWN GAPS),
`docs/spec/pine-migration.md` (the deferral this task closes).

## Current State

- `state.*` (`packages/core/src/state/state.ts:25-102`) is a frozen object of
  sentinel holes — `float`/`int`/`bool`/`string` (lines 35-76), each returning
  a scalar `MutableSlot<T>` (`packages/core/src/state/mutableSlot.ts:24`,
  `{ get value(): T; set value(v: T) }`, "no `.history()`, no indexing") — plus
  the nested `tick.*` object (lines 88-101). `StateNamespace = typeof state`
  (line 114). There is **no** collection / array primitive.
- `STATEFUL_PRIMITIVES` (`packages/core/src/statefulPrimitives.ts:18-201`,
  canonical array `STATEFUL_PRIMITIVE_ENTRIES`) lists the eight
  `state.*` / `state.tick.*` entries (lines 184-191) as `{ slot: true }`.
  Appending an entry is additive within `apiVersion: 1`
  (`packages/core/CLAUDE.md`). `STATEFUL_PRIMITIVES_BY_NAME` (line 263)
  derives from the same list.
- `packages/compiler/src/program.ts` ambient shim declares `StateNamespace`
  (lines 995-1006) as a `Readonly<{ … }>` of the eight methods, `MutableSlot`
  (line 992), and `state` (line 1007) — must stay in lockstep with core.
- The compiler injects a leading `slotId` string literal at every
  `{ slot: true }` callsite
  (`packages/compiler/src/transformers/callsiteIdInjection.ts:121-172`):
  `state.array<T>(cap)` → `state.array("<id>", cap)`. The in-loop ban
  (`packages/compiler/src/analysis/statefulCallInLoop.ts:40-55`) errors
  `stateful-call-inside-loop` for **registry callsites** — that is the
  **allocation** call only.
- `state.*` slots live in `RuntimeContext.stateSlots`
  (`packages/runtime/src/runtimeContext.ts:166`,
  `Map<string, StateSlot<unknown>>`), keyed `${slotIdPrefix}${slotId}:state`
  via `stateKey` (`packages/runtime/src/state/stateNamespace.ts:25`) and
  allocated by `getOrAllocate` (line 36). Each is a `StateSlot`
  (`packages/runtime/src/state/stateSlot.ts:41-81`) with a committed/tentative
  split: `onBarClose` (line 66) commits tentative→committed, `onBarTick`
  (line 72) resets tentative←committed (discarding in-progress tick writes).
  `asMutableSlot` (line 93) builds the `{ get value; set value }` proxy.
- Lifecycle (`packages/runtime/src/state/lifecycle.ts`):
  `resetTentativeStateSlots` (line 35), `commitStateSlots` (line 51),
  `flushStateSlots` (line 67), `serialiseStateSlots` (line 86),
  `restoreStateSlots` (line 107) each iterate `ctx.stateSlots`.
- `Float64RingBuffer` (`packages/runtime/src/ringBuffer.ts:104-187`) is a
  `Float64Array`-backed ring with `append` (113), `replaceHead` (119),
  `at` (127, `NaN` out-of-range), `length` (132), `reset` (182), and the
  snapshot hooks `serialiseSnapshotBuffer` (136) / `restoreFromSnapshotBuffer`
  (152) producing/consuming `{ headIndex, filled, values }`. `RingBuffer<T>`
  (lines 46-83) is the object-payload sibling (no snapshot hooks).
- `docs/spec/pine-migration.md` defers `state.array(...)` / `state.map(...)` /
  matrices (line ~380, §"Persistent Collections and Large Arrays"; support-table
  row at line ~344) "until a serialization policy is agreed."
- The converter classifies a `var array<line>` Camp B ring of **drawing
  handles** (`packages/pine-converter/CLAUDE.md`, drawing-camp classification)
  but has **no** numeric-collection lowering target.

## Target State

- `state.array<T>(capacity)` returns a `MutableArraySlot<T>` — a bounded FIFO
  ring with: `push(v): void` (oldest-evict once full), `get(n: number): T`
  (`n = 0` newest; out-of-range ⇒ the element type's empty value), `last(): T`
  (=== `get(0)`), `size: number` (filled count, ≤ capacity), `capacity: number`
  (the literal you allocated with), and `clear(): void`. v1: **`T = number`**
  (Float64-backed).
- `capacity` is a **required compile-time numeric literal** (Task 3 guards it,
  mirroring series index bounds). The ring self-bounds at runtime regardless.
- The collection persists across bars with the `state.*` committed/tentative
  discipline: writes during a tick are tentative and discarded if a later tick
  replaces the head bar; on bar close the tentative collection commits.
- `state.array` slots snapshot/restore per-runner via the ring's existing
  `Float64RingBuffer.serialiseSnapshotBuffer` / `restoreFromSnapshotBuffer`
  hooks — bounded capacity ⇒ bounded, JSON-clean snapshot.
- `.push()` / `.get()` / `.last()` are **handle methods**, NOT registry
  callsites, so they are callable inside a bounded `for` loop (the whole point
  of a collection). Only the **allocation** `state.array(...)` call is a
  registry callsite subject to the in-loop ban.
- `docs/spec/pine-migration.md` is updated: the deferral becomes a supported
  feature for the bounded-array case (support-table row + the
  "Persistent Collections" section), with `state.map` / matrices / non-number
  `T` still listed as deferred.
- The Pine converter lowers a bounded numeric `var array<float|int>` (Camp B
  ring with FIFO eviction) to `state.array<number>(K)`; a new docs/conformance
  example shows the round-trip.
- Docs (a new `state.array` primitive page, a `series-and-indexing` /
  collections guide section), the chartlang-coding skill, a new example script
  + live demo entry, and the un-deferred `pine-migration.md` all show it.

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **`MutableArraySlot<T>` is a plain handle, NOT a `MutableSlot`/`Series` intersection** | `state.series` is "one value's history" → number-coercible `MutableSlot<number> & Series<number>`. `state.array` is a **collection** — `push`/`get`/`size`/`capacity`/`clear` — so it is a distinct interface. It is **not** number-coercible (`+a` is meaningless): no `valueOf` / `Symbol.toPrimitive`. This is the cleanest signal to authors that the two primitives are different shapes. |
| **`capacity` is a REQUIRED compile-time numeric literal** | This is the load-bearing safety decision. A collection is bounded-execution-safe ONLY because its size is fixed at compile time: it caps memory, caps snapshot size, and — crucially — caps the per-tick rollback cost (next row). A growable array would reopen the serialization-policy question this task closes. Task 3 adds a compile-time `state-array-capacity-not-literal` / `state-array-capacity-exceeds-max` guard; the ring self-bounds at runtime regardless. |
| **Tick rollback = a two-ring buffer copy (`committedRing`/`tentativeRing`)** | THE HARDEST DECISION. A scalar `state.*` slot rolls back a tick with one assignment (`tentative = committed`). A collection must roll back the **whole buffer** on every tick (`onBarTick` discards in-progress pushes). Options weighed: (a) **journaling** push/clear ops and replaying — O(ops) but complex and unbounded-op-count; (b) **copy-on-tick** the committed ring into the tentative ring — O(capacity) per tick. We choose **(b), the two-ring copy.** For `T = number` this is a single `Float64Array.prototype.set()` (a fast typed-array memcpy), and capacity is a bounded literal, so the cost is `O(capacity)` with a small constant and a hard ceiling — it **preserves the bounded-execution invariant**. Journaling's complexity and unbounded op-count are not worth the saving when capacity is already small and bounded. |
| **`ArrayStateSlot` mirrors `StateSlot`'s `onBarClose`/`onBarTick`/`serialise` interface so `lifecycle.ts` needs NO change** | If the new slot implements the same three lifecycle methods `StateSlot` exposes, and is stored in the same `ctx.stateSlots` map (or a parallel `ctx.arraySlots` map iterated by the SAME lifecycle helpers), the execution-loop wiring in `lifecycle.ts` (`resetTentativeStateSlots`/`commitStateSlots`/`serialiseStateSlots`/`restoreStateSlots`) is reused structurally. Prefer a shared `stateSlots` map with a `kind` tag if `StateSlot`'s `<T>` generic can be widened cleanly; otherwise a parallel `arraySlots` map walked by the same loop sites (the `state.series` precedent uses a parallel map). Decide in Task 2 and document the choice in the runtime CLAUDE.md. |
| **`onBarClose` copies tentative→committed; `onBarTick` copies committed→tentative** | Identical discipline to `StateSlot` (`stateSlot.ts:66`/`72`), just on rings instead of scalars. `push` during a tick mutates the tentative ring; a head-bar-replacing tick resets it from committed; a close commits it. Reuses `Float64RingBuffer.reset` + `append` (or a typed-array `set()` copy) — do NOT fork the ring. |
| **Compiler: ZERO new lowering logic — just the registry entry + an optional capacity guard** | `state.array` is `{ slot: true }`, so `callsiteIdInjection` injects the slot id with no change; the in-loop ban already covers the allocation callsite. The only optional addition is the capacity-literal analysis guard (Task 3). `.push`/`.get` are method calls on a value, invisible to every existing pass (`forbiddenConstructs`, `statefulCallInLoop`, `extractMaxLookback`). |
| **`T = number` (Float64-backed) in v1** | Numeric collections (rolling windows, event-value logs, percentile/median windows) are the dominant case and reuse `Float64RingBuffer` + its snapshot hooks verbatim. `bool`/`string`/object `T` need the object-backed `RingBuffer<T>` (no snapshot hooks yet) — deferred. `state.map` needs a key model — deferred. |
| **`get(n)` is element-indexed (`0` = newest), NOT bar-indexed** | A collection's index is "the n-th element I pushed," not "n bars ago." This is the read-surface that most distinguishes it from `state.series`'s bar-indexed `s[n]`. `get(out-of-range)` returns `NaN` for number `T` (the ring's `at` contract), never throws. |

## Dependency Graph

```
Task 1 (core: MutableArraySlot type + hole + registry + shim + type tests)
  |
  v
Task 2 (runtime: ArrayStateSlot two-ring + namespace allocator + lifecycle + snapshot)
  |
  v
Task 3 (compiler: optional capacity-literal guard)        [optional]
  |
  v
Task 4 (conformance: rolling-window collector == reference)
  |
  v
Task 5 (pine-converter: bounded numeric var array Camp B ring -> state.array)
  |
  v
Task 6 (docs: un-defer pine-migration.md + new primitive page + skills + example + demo)
```

## Task Summary Table

| # | Title | Package | Dependencies | Est. Complexity |
|---|-------|---------|--------------|-----------------|
| 1 | [Core type + `state.array` hole + registry + shim](./1-core-type-and-shim.md) | core, compiler | None | Medium |
| 2 | [Runtime `ArrayStateSlot` + allocator + snapshot](./2-runtime-array-slot.md) | runtime | 1 | High |
| 3 | [Compiler capacity-literal guard (optional)](./3-compiler-capacity-guard.md) | compiler | 1 | Medium |
| 4 | [Conformance scenario: rolling-window collector](./4-conformance-rolling-window.md) | conformance | 2 | Low |
| 5 | [Pine converter: bounded numeric `var array` → `state.array`](./5-converter-var-array.md) | pine-converter | 1, 2 | High |
| 6 | [Docs (un-defer), primitive page, skills, example, demo](./6-docs-skills-examples.md) | docs, skills, apps/site, examples | 1–5 | Medium |

## Code Reuse

| Existing | Path | Use |
|----------|------|-----|
| `sentinel(name)` hole pattern | `packages/core/src/state/state.ts:6` | `state.array` is a sentinel hole like every sibling. |
| `MutableSlot<T>` | `packages/core/src/state/mutableSlot.ts:24` | Reference shape; `MutableArraySlot` is a sibling interface (NOT an intersection with it). |
| `STATEFUL_PRIMITIVES` registry | `packages/core/src/statefulPrimitives.ts:184-191` | Append `{ name: "state.array", slot: true }` in the `state.*` region. |
| `STATEFUL_PRIMITIVES_BY_NAME` | `packages/core/src/statefulPrimitives.ts:263` | Derives the new entry automatically. |
| `Float64RingBuffer` | `packages/runtime/src/ringBuffer.ts:104-187` | Backing store for both rings (`append`/`at`/`length`/`reset`) + `serialiseSnapshotBuffer`/`restoreFromSnapshotBuffer` (136-180) — the JSON-clean snapshot the policy reuses. |
| `StateSlot` committed/tentative + `onBarClose`/`onBarTick`/`serialise` | `packages/runtime/src/state/stateSlot.ts:41-81` | Lifecycle interface `ArrayStateSlot` mirrors so `lifecycle.ts` is reused. |
| `stateKey` / `getOrAllocate` | `packages/runtime/src/state/stateNamespace.ts:25,36` | Per-callsite slot identity + `slotIdPrefix` + store-consult. |
| `resetTentativeStateSlots`/`commitStateSlots`/`serialiseStateSlots`/`restoreStateSlots` | `packages/runtime/src/state/lifecycle.ts:35,51,86,107` | The loop hooks; reused unchanged if the array slot shares the interface. |
| `RunnerSnapshot.slots` (`JsonValue`) | `packages/core/src/state/snapshot.ts:61` | The snapshot section the ring's `{ headIndex, filled, values }` lands in. |
| `callsiteIdInjection` slot-id injection | `packages/compiler/src/transformers/callsiteIdInjection.ts:121-172` | Injects the leading `slotId` for `{ slot: true }` — no change needed. |
| `barCloseDirectIndex.scenario.ts` / `stateSeriesHistory.scenario.ts` | `packages/conformance/src/scenarios/` | Scenario shape to mirror. |
| Camp B ring classification | `packages/pine-converter/CLAUDE.md` (drawing-camp), `skills/.../translating-from-pine.md:52` | The existing handle-ring lowering whose numeric analogue Task 5 adds. |
| `DEMO_SCRIPTS` + `gen-examples-docs.ts` + `generate-skills-reference.ts` | `apps/site/src/components/demo/scripts.ts`, `scripts/` | Demo + generated docs + skills reference. |

## Provenance

No `../invinite/` port. This is a chartlang-native **serialization-policy**
decision (the bounded-array case of the deferred persistent-collection
question in `docs/spec/pine-migration.md`) plus a **Pine-fidelity** target
(the numeric Camp B ring in `translating-from-pine.md`).

## Deferred / Follow-Up Work

- **`state.array<bool>` / `<string>` / object `T`** — needs the object-backed
  `RingBuffer<T>` (`ringBuffer.ts:46`) plus new snapshot hooks on it (it has
  none today). The two-ring tick-copy would be a structured-clone, not a
  typed-array `set()`.
- **`state.map<K, V>`** — needs a key model + a bounded-key serialization
  policy. Stays deferred in `pine-migration.md`.
- **Matrices / large mutable collections** — stay deferred in
  `pine-migration.md`.
- **Per-slot dynamic capacity** (a runtime-resolved capacity rather than a
  required literal) — would reopen the bounded-execution + snapshot-size
  guarantees; out of scope.
- **`state.tick.array`** (varip-persistent collection) — if a use case appears.
- **Richer collection API** (`insert`, `removeAt`, `indexOf`, `slice`,
  `forEach`, `reduce`) — v1 ships the minimal FIFO surface; add on demand.
