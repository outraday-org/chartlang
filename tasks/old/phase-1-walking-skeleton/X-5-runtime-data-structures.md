# Task 5 — Runtime: RingBuffer, Series Proxy, StreamState, StateStore

> **Status: TODO**

## Goal

Land the runtime's **data-structure layer**: the ring buffers per
§6.2 / §6.6, the `Series<T>` Proxy that wraps them, the
`StreamState` that holds an interval's OHLCV plus its derived
`BarView`, the in-memory `StateStore` (Phase-5 persistence is
additive), and the `RuntimeContext` slot the next task's
execution loop and primitives close over. No execution loop, no
primitives — those land in Task 6 and Tasks 7-8 against this
foundation.

## Prerequisites

- Task 1 (core types: `Series<T>`, `Bar`, `JsonValue`).
- Task 4 (adapter-kit: `Capabilities`, `CandleEvent`,
  `RunnerEmissions`, `RuntimeDiagnostic`).

## Desired Behavior

After this task:

- `RingBuffer<T>` and `Float64RingBuffer` implement the §6.6
  contract — `append`, `replaceHead`, `at(n)`, `length`, `reset`.
  Float buffer returns `NaN` on OOR; object buffer returns
  `undefined`.
- `makeSeriesView(buf)` produces a stable-identity `Series<T>`
  Proxy.
- `createStreamState({ interval, capacity, symbol })` produces an
  `OhlcvBuffers` set (`time/open/high/low/close/volume/hl2/hlc3/
  ohlc4/hlcc4`), a mutable `BarView`, an empty `taSlots` map, and
  cached `seriesViews` for each source field.
- `inMemoryStateStore()` returns a `Map`-backed implementation of
  the `StateStore` interface.
- `ACTIVE_RUNTIME_CONTEXT.current` is the runtime's globally
  accessible context slot — Task 6 writes it during `compute`;
  Tasks 7-8 read it inside primitive implementations.
- 100% coverage per §16.1.

## Requirements

### 1. `src/ringBuffer.ts` (§6.6)

Two classes sharing a `RingBufferLike<T>` interface:

```ts
export interface RingBufferLike<T> {
    readonly capacity: number;
    readonly length: number;
    append(v: T): void;
    replaceHead(v: T): void;
    at(n: number): T | undefined;
    reset(): void;
}

export class RingBuffer<T> implements RingBufferLike<T> {
    private buf: T[];
    private head = -1;
    private filled = 0;
    constructor(public readonly capacity: number) {
        this.buf = new Array<T>(capacity);
    }
    append(v: T): void {
        this.head = (this.head + 1) % this.capacity;
        this.buf[this.head] = v;
        if (this.filled < this.capacity) this.filled += 1;
    }
    replaceHead(v: T): void {
        if (this.head === -1) { this.append(v); return; }
        this.buf[this.head] = v;
    }
    at(n: number): T | undefined {
        if (n < 0 || n >= this.filled) return undefined;
        return this.buf[(this.head - n + this.capacity) % this.capacity];
    }
    get length(): number { return this.filled; }
    reset(): void {
        this.buf = new Array<T>(this.capacity);
        this.head = -1; this.filled = 0;
    }
}

export class Float64RingBuffer implements RingBufferLike<number> {
    private buf: Float64Array;
    private head = -1;
    private filled = 0;
    constructor(public readonly capacity: number) {
        this.buf = new Float64Array(capacity);
    }
    /* append/replaceHead identical shape; at() returns NaN on OOR */
    at(n: number): number {
        if (n < 0 || n >= this.filled) return Number.NaN;
        return this.buf[(this.head - n + this.capacity) % this.capacity];
    }
    /* length getter and reset() mirror RingBuffer */
}
```

`Float64RingBuffer.at` narrows the interface's
`T | undefined` return to plain `number` (NaN is the OOR sentinel
rather than `undefined`). TypeScript's covariant return position
accepts this. Callers that want the `number` type — Task 6's
`onBarClose`, Task 7's primitives — must hold the concrete
`Float64RingBuffer` reference (already the case via
`OhlcvBuffers`), not the wider `RingBufferLike<number>` interface.

Property tests:
- A buffer of capacity `C` filled with `K` values has
  `length === min(C, K)`.
- After appending `K` values, `at(0)` is the last, `at(min(C, K) -
  1)` is the oldest in range.
- `at(-1)` and `at(length)` return the OOR sentinel (`undefined`
  for object, `NaN` for number).
- `replaceHead` on an empty buffer behaves like `append`.
- `reset` returns to `length: 0`.

### 2. `src/seriesView.ts` (§6.6)

```ts
export function makeSeriesView<T>(buf: RingBufferLike<T>): Series<T> {
    return new Proxy({} as Series<T>, {
        get(_, prop) {
            if (prop === "current") return buf.at(0);
            if (prop === "length")  return buf.length;
            if (typeof prop === "string") {
                const n = Number(prop);
                if (Number.isInteger(n) && n >= 0) return buf.at(n);
            }
            return undefined;
        },
    });
}
```

Identity is stable per `Series<T>` — created **once per backing
buffer** at `streamState` construction (or once per primitive
output buffer at slot creation in Task 7). Critical for
§6.6's "`const ema = ta.ema(...)` works across bars" contract.

Property tests:
- Same Proxy identity across N steps.
- `series[0] === series.current`.
- `series[1000]` on a 10-bar buffer returns the OOR sentinel.
- `series.foo` returns `undefined` for arbitrary string keys.
- `series.length` reflects buffer state through Proxy.

### 3. `src/streamState.ts` (§6.8 — single-stream shape, Phase-1)

```ts
export type OhlcvBuffers = {
    readonly time: Float64RingBuffer;
    readonly open: Float64RingBuffer;
    readonly high: Float64RingBuffer;
    readonly low: Float64RingBuffer;
    readonly close: Float64RingBuffer;
    readonly volume: Float64RingBuffer;
    readonly hl2: Float64RingBuffer;
    readonly hlc3: Float64RingBuffer;
    readonly ohlc4: Float64RingBuffer;
    readonly hlcc4: Float64RingBuffer;
};

export type BarView = {
    time: number; open: number; high: number; low: number;
    close: number; volume: number;
    hl2: number; hlc3: number; ohlc4: number; hlcc4: number;
    symbol: string; interval: string;
};

export type StreamState = {
    readonly interval: string;
    readonly ohlcv: OhlcvBuffers;
    readonly bar: BarView;
    readonly seriesViews: {
        readonly time: Series<number>;
        readonly open: Series<number>;
        readonly high: Series<number>;
        readonly low: Series<number>;
        readonly close: Series<number>;
        readonly volume: Series<number>;
        readonly hl2: Series<number>;
        readonly hlc3: Series<number>;
        readonly ohlc4: Series<number>;
        readonly hlcc4: Series<number>;
    };
    readonly taSlots: Map<string, unknown>;
};

export function createStreamState(args: {
    interval: string;
    capacity: number;     // max(1, manifest.maxLookback + 1)
    symbol: string;
}): StreamState;
```

`createStreamState` constructs each `Float64RingBuffer(capacity)`,
the `BarView` (all fields initialized to `NaN` for prices and `0`
for time / `""` for symbol), and one Proxy per source field via
`makeSeriesView`. `taSlots` is an empty `Map<string, unknown>`.

`BarView` is mutated in place per bar by Task 6's execution loop —
the identity remains stable across the run, so consumers
destructuring it (the user's `compute({ bar })`) see fresh values
without rebinding.

### 4. `src/stateStore.ts`

```ts
/**
 * Persistence contract. Phase 1 ships an in-memory default; Phase 5
 * extends with snapshot load/save (`StateSnapshot` from §6.9) without
 * renaming this interface. Snapshot methods live on a `PersistentStateStore`
 * sub-interface that the Phase-5 IDB-backed store implements.
 */
export type StateStore = {
    get<T>(slotId: string): T | undefined;
    set<T>(slotId: string, value: T): void;
    has(slotId: string): boolean;
    clear(): void;
};

export function inMemoryStateStore(): StateStore {
    const store = new Map<string, unknown>();
    return {
        get<T>(id: string) { return store.get(id) as T | undefined; },
        set<T>(id: string, v: T) { store.set(id, v); },
        has(id: string) { return store.has(id); },
        clear() { store.clear(); },
    };
}
```

Tests cover every method against a fresh store. Property test:
N random `set`/`get` operations preserve last-write-wins semantics.

### 5. `src/runtimeContext.ts`

The contract the primitives (Tasks 7-8) read to find their state
and emission destination, and that Task 6's execution loop writes
on every step.

```ts
export type MutableRunnerEmissions = {
    plots: PlotEmission[];
    drawings: DrawingEmission[];
    alerts: AlertEmission[];
    diagnostics: RuntimeDiagnostic[];
    fromBar: number;
    toBar: number;
};

export type RuntimeContext = {
    readonly stream: StreamState;
    readonly stateStore: StateStore;
    readonly capabilities: Capabilities;
    readonly emissions: MutableRunnerEmissions;
    readonly barIndex: () => number;
    /** True while the active step is a `tick` event. Set by Task 6's
     *  `onBarTick` before invoking compute; cleared on return. */
    isTick: boolean;
};

export const ACTIVE_RUNTIME_CONTEXT: { current: RuntimeContext | null } = {
    current: null,
};
```

`ACTIVE_RUNTIME_CONTEXT` is a process-wide singleton slot. Task 6
mutates it inside a try/finally around `compute`. The `compute`
body, which runs synchronously, can only see one active context at
a time — JS's single-threaded execution model makes this safe.

Tests:
- `ACTIVE_RUNTIME_CONTEXT.current` starts `null`.
- Mutation + read round-trips.
- The slot is **just a holder** — no class methods, no validation;
  responsibility for setting/clearing lives in Task 6.

### 6. Benchmarks (§16.3 row: bench column)

`ringBuffer.bench.test.ts` measures the hot read/write loop:

```ts
bench("Float64RingBuffer.append + at(0)", () => {
    const buf = new Float64RingBuffer(64);
    for (let i = 0; i < 100_000; i++) {
        buf.append(i);
        buf.at(0);
    }
});
```

Each bench file declares `THRESHOLD_MS = ceil(median × 3)` after a
warm-up baseline. Bench files participate in coverage per §16.1
(they exercise the buffer code).

`seriesView.bench.test.ts` mirrors with Proxy reads.

### 7. Tests (§16.3 row: unit + property + type + bench)

- **Unit:** every method in every module.
- **Property (`fast-check`):**
  - `RingBuffer` invariants (capacity, OOR, identity).
  - `seriesView` Proxy reads against a backing buffer with random
    appends.
  - `inMemoryStateStore` get/set N times preserves equality.
- **Type tests:** `expect-type` over `StateStore`,
  `RuntimeContext`, `StreamState`, `Series<T>`'s structural
  match.
- **Bench:** two files above.

100% coverage. Excluded: barrels (`index.ts`), the
`types`-only `runtimeContext.ts` exported types (the
`ACTIVE_RUNTIME_CONTEXT` constant IS code, covered).

### 8. Public exports

Modify `packages/runtime/src/index.ts`:

```ts
export { RingBuffer, Float64RingBuffer } from "./ringBuffer";
export type { RingBufferLike } from "./ringBuffer";
export { makeSeriesView } from "./seriesView";
export type { OhlcvBuffers, BarView, StreamState } from "./streamState";
export { createStreamState } from "./streamState";
export type { StateStore } from "./stateStore";
export { inMemoryStateStore } from "./stateStore";
export type {
    MutableRunnerEmissions, RuntimeContext,
} from "./runtimeContext";
export { ACTIVE_RUNTIME_CONTEXT } from "./runtimeContext";
```

Task 6 extends this barrel with `createScriptRunner` + execution
exports.

### 9. Remove `PACKAGE_VERSION`

Delete the Phase-0 placeholder + Task-3 JSDoc shim.

### 10. JSDoc per §17.2

Every export has `@since 0.1` + `@example`. The
`RingBuffer.append` example is non-script (just illustrative
buffer usage), so docs-check skips compilation. `makeSeriesView`'s
example imports from `@invinite-org/chartlang-runtime` but uses
the runtime-internal surface — keep the example body in commented
form so docs-check skips it.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/runtime/src/ringBuffer.ts` | Create | RingBuffer + Float64RingBuffer. |
| `packages/runtime/src/seriesView.ts` | Create | Proxy-backed Series<T>. |
| `packages/runtime/src/streamState.ts` | Create | OHLCV buffers + BarView + cached views. |
| `packages/runtime/src/stateStore.ts` | Create | StateStore interface + in-memory default. |
| `packages/runtime/src/runtimeContext.ts` | Create | RuntimeContext type + ACTIVE_RUNTIME_CONTEXT slot. |
| `packages/runtime/src/index.ts` | Modify | Export new surface (replace `PACKAGE_VERSION`). |
| `packages/runtime/src/index.test.ts` | Delete | Replaced by per-module tests. |
| `packages/runtime/src/ringBuffer.test.ts` | Create | Unit + property. |
| `packages/runtime/src/seriesView.test.ts` | Create | Unit + property. |
| `packages/runtime/src/streamState.test.ts` | Create | Unit. |
| `packages/runtime/src/stateStore.test.ts` | Create | Unit + property. |
| `packages/runtime/src/runtimeContext.test.ts` | Create | Unit. |
| `packages/runtime/src/ringBuffer.bench.test.ts` | Create | Bench. |
| `packages/runtime/src/seriesView.bench.test.ts` | Create | Bench. |
| `packages/runtime/src/types.types.test.ts` | Create | `expect-type` over public types. |
| `packages/runtime/package.json` | Modify | Add `@invinite-org/chartlang-core` + `@invinite-org/chartlang-adapter-kit` workspace deps; add `fast-check ^3.20.0` as a devDep here (first consumer — Tasks 6 and 7 reuse it). Root `package.json` does **not** ship `fast-check`; per-package devDep is sufficient and keeps non-runtime packages lean. |
| `packages/runtime/README.md` | Modify | Replace placeholder with the data-structures surface; Task 6 will add execution surface. |

## Acceptance Criteria

- `pnpm -F @invinite-org/chartlang-runtime typecheck && pnpm -F
  @invinite-org/chartlang-runtime test` pass with 100% coverage.
- Property tests pin the §6.6 ring-buffer invariants over random
  sequences.
- `Float64RingBuffer.at(n)` returns `NaN` for any `n >= length`.
- `makeSeriesView` produces a Proxy with stable identity that
  reads through to the backing buffer; `series[0] === series.current`.
- `ACTIVE_RUNTIME_CONTEXT.current` starts `null`; mutating it
  round-trips.
- Bench thresholds set on local Apple-silicon.
- `pnpm docs:check`, `readme:check`, `lint`, `format:check`,
  `conformance` (still 0 scenarios), `coverage:report` all pass.
- Earlier-phase + Tasks 1-4 gates remain green.
