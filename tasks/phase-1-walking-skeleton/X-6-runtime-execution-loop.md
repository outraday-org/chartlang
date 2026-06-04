# Task 6 — Runtime: `ScriptRunner` + `onHistory` / `onBarClose` / `onBarTick` / `drain` / `dispose`

> **Status: TODO**

## Goal

Land the **per-bar execution loop** per §6.1 and §6.7 on top of
Task 5's data structures. The runner owns the lifecycle (`load →
history → close × N → tick × M → drain → dispose`), the
`RuntimeContext` slot mutation around `compute`, and the
bar↔series sync invariants from §6.7. No primitives — Tasks 7-8
plug into the engine via the `ACTIVE_RUNTIME_CONTEXT` slot.

## Prerequisites

- Task 5 (RingBuffer, Series Proxy, StreamState, StateStore,
  RuntimeContext slot).
- Task 1 (`CompiledScriptObject`, `ComputeFn`, `ScriptManifest`).
- Task 4 (`Capabilities`, `CandleEvent`, `RunnerEmissions`).

## Desired Behavior

After this task:

- `createScriptRunner({ compiled, capabilities, stateStore? })`
  returns a `ScriptRunner` per §6.1.
- `onHistory(bars)` advances ring buffers in bulk and runs
  `compute` once per historical bar in forward order.
- `onBarClose(bar)` appends every OHLCV ring buffer, mutates the
  shared `bar` view, runs `compute`, and accumulates emissions for
  this bar.
- `onBarTick(bar)` replaces the head slot in place, mutates
  `bar`, sets `isTick: true`, runs `compute` — series length
  must NOT advance.
- `drain()` returns the accumulated emissions and clears the
  queues.
- `dispose()` clears every buffer, the slot map, and the state
  store.
- The four §6.7 invariants hold under property tests.
- 100% coverage including the determinism test.

## Requirements

### 1. `src/createScriptRunner.ts` (§6.1)

```ts
export type ScriptRunner = {
    onHistory(bars: ReadonlyArray<Bar>): Promise<void>;
    onBarClose(bar: Bar): Promise<void>;
    onBarTick(bar: Bar): Promise<void>;
    drain(): RunnerEmissions;
    dispose(): void;
};

export type CreateScriptRunnerArgs = {
    compiled: CompiledScriptObject;
    capabilities: Capabilities;
    stateStore?: StateStore;
};

export function createScriptRunner(args: CreateScriptRunnerArgs): ScriptRunner;
```

Internal state:

```ts
type RunnerState = {
    readonly manifest: ScriptManifest;
    readonly compute: ComputeFn;
    readonly capabilities: Capabilities;
    readonly stateStore: StateStore;
    readonly mainStream: StreamState;
    readonly runtimeContext: RuntimeContext;
    readonly emissions: MutableRunnerEmissions;
    barIndex: number;
};
```

`createScriptRunner` constructs `RunnerState` by:

1. Resolving `stateStore`: use `args.stateStore` if provided, else
   `inMemoryStateStore()` (imported from `./stateStore`). Phase 1's
   in-memory default keeps `createScriptRunner({ compiled, capabilities })`
   callable without any persistence wiring.
2. Computing `capacity = Math.max(1, manifest.maxLookback + 1)`.
   Phase 1 reads `manifest.seriesCapacities` if present to pick a
   per-stream capacity, falling back to `maxLookback + 1`.
3. Calling `createStreamState({ interval: "", capacity, symbol:
   "" })`. The placeholder strings are overwritten on the first
   `onBarClose` (which writes `bar.interval` / `bar.symbol` from
   the incoming `Bar`).
4. Building the `RuntimeContext`: `stream` points at the
   constructed `StreamState`, `emissions` at the runner's mutable
   queues, `barIndex` returns `state.barIndex`, `isTick` starts
   `false`.
5. Returning a `ScriptRunner` whose methods close over
   `RunnerState`.

### 2. `src/execution/onBarClose.ts` (§6.7)

Verbatim §6.7 pseudocode:

```ts
export async function onBarClose(state: RunnerState, rawBar: Bar): Promise<void> {
    // 1. Append to every OHLCV ring buffer FIRST.
    const { ohlcv, bar } = state.mainStream;
    ohlcv.time.append(rawBar.time);
    ohlcv.open.append(rawBar.open);
    ohlcv.high.append(rawBar.high);
    ohlcv.low.append(rawBar.low);
    ohlcv.close.append(rawBar.close);
    ohlcv.volume.append(rawBar.volume);
    ohlcv.hl2.append((rawBar.high + rawBar.low) / 2);
    ohlcv.hlc3.append((rawBar.high + rawBar.low + rawBar.close) / 3);
    ohlcv.ohlc4.append((rawBar.open + rawBar.high + rawBar.low + rawBar.close) / 4);
    ohlcv.hlcc4.append((rawBar.high + rawBar.low + rawBar.close + rawBar.close) / 4);

    // 2. Mutate the shared `bar` view in place. Derived fields are
    // computed from rawBar directly — `Float64RingBuffer.at(0)` is
    // also fine (returns `number`, no `!` needed) but the direct
    // form is cheaper and side-steps biome's `noNonNullAssertion`.
    bar.time = rawBar.time;     bar.open = rawBar.open;
    bar.high = rawBar.high;     bar.low = rawBar.low;
    bar.close = rawBar.close;   bar.volume = rawBar.volume;
    bar.hl2   = (rawBar.high + rawBar.low) / 2;
    bar.hlc3  = (rawBar.high + rawBar.low + rawBar.close) / 3;
    bar.ohlc4 = (rawBar.open + rawBar.high + rawBar.low + rawBar.close) / 4;
    bar.hlcc4 = (rawBar.high + rawBar.low + rawBar.close + rawBar.close) / 4;
    bar.symbol   = rawBar.symbol;
    bar.interval = rawBar.interval;

    // 3. INVARIANT: bar.X === series.X[0] for every field.

    // 4. Reset per-bar emission queues.
    state.emissions.plots = [];
    state.emissions.drawings = [];
    state.emissions.alerts = [];
    state.emissions.diagnostics = [];
    state.emissions.fromBar = state.barIndex;
    state.emissions.toBar = state.barIndex;

    // 5. Run user's compute under the active runtime context.
    ACTIVE_RUNTIME_CONTEXT.current = state.runtimeContext;
    state.runtimeContext.isTick = false;
    try {
        await Promise.resolve(state.compute(buildComputeContext(state)));
    } finally {
        ACTIVE_RUNTIME_CONTEXT.current = null;
    }

    state.barIndex += 1;
}
```

`buildComputeContext(state)` returns the `ComputeContext` shape
the compute body receives — Phase 1 passes the runtime's `bar`
view, empty `inputs`, and the runtime's `ta` / `plot` / `hline` /
`alert` exports (which Tasks 7-8 ship). The compiled bundle
already imports these from `@invinite-org/chartlang-runtime`; the
context object is supplied for forward-compat with §4.2's
destructure pattern.

### 3. `src/execution/onBarTick.ts` (§6.7 tick path)

```ts
export async function onBarTick(state: RunnerState, rawBar: Bar): Promise<void> {
    const { ohlcv, bar } = state.mainStream;
    // Replace head — do NOT advance. time / open are NOT replaced;
    // only close-side data ticks within the in-progress bar.
    ohlcv.close.replaceHead(rawBar.close);
    ohlcv.high.replaceHead(rawBar.high);
    ohlcv.low.replaceHead(rawBar.low);
    ohlcv.volume.replaceHead(rawBar.volume);
    ohlcv.hl2.replaceHead((rawBar.high + rawBar.low) / 2);
    ohlcv.hlc3.replaceHead((rawBar.high + rawBar.low + rawBar.close) / 3);
    ohlcv.ohlc4.replaceHead((rawBar.open + rawBar.high + rawBar.low + rawBar.close) / 4);
    ohlcv.hlcc4.replaceHead((rawBar.high + rawBar.low + rawBar.close + rawBar.close) / 4);

    bar.close = rawBar.close; bar.high = rawBar.high; bar.low = rawBar.low;
    bar.volume = rawBar.volume;
    bar.hl2   = (rawBar.high + rawBar.low) / 2;
    bar.hlc3  = (rawBar.high + rawBar.low + rawBar.close) / 3;
    bar.ohlc4 = (rawBar.open + rawBar.high + rawBar.low + rawBar.close) / 4;
    bar.hlcc4 = (rawBar.high + rawBar.low + rawBar.close + rawBar.close) / 4;

    state.emissions.plots = [];
    state.emissions.drawings = [];
    state.emissions.alerts = [];
    state.emissions.diagnostics = [];

    ACTIVE_RUNTIME_CONTEXT.current = state.runtimeContext;
    state.runtimeContext.isTick = true;
    try {
        await Promise.resolve(state.compute(buildComputeContext(state)));
    } finally {
        state.runtimeContext.isTick = false;
        ACTIVE_RUNTIME_CONTEXT.current = null;
    }
}
```

Task 7's `ta.*` primitives read `runtimeContext.isTick` to switch
between `append` and `replaceHead` slot updates. The engine just
exposes the flag — primitive logic lives in Task 7.

### 4. `src/execution/onHistory.ts`

```ts
export async function onHistory(state: RunnerState, bars: ReadonlyArray<Bar>): Promise<void> {
    for (const bar of bars) {
        await onBarClose(state, bar);
    }
}
```

Phase 1 keeps this simple — no parallel pre-roll. The determinism
contract requires `compute` to see every bar in forward order
(§6.4). A Phase-2 optimisation could batch-fill ring buffers
without re-running compute, but stay correct first.

### 5. `src/execution/drain.ts` and `dispose.ts`

```ts
export function drain(state: RunnerState): RunnerEmissions {
    const out: RunnerEmissions = Object.freeze({
        plots: state.emissions.plots,
        drawings: state.emissions.drawings,
        alerts: state.emissions.alerts,
        diagnostics: state.emissions.diagnostics,
        fromBar: state.emissions.fromBar,
        toBar: state.emissions.toBar,
    });
    state.emissions.plots = [];
    state.emissions.drawings = [];
    state.emissions.alerts = [];
    state.emissions.diagnostics = [];
    return out;
}

export function dispose(state: RunnerState): void {
    for (const buf of Object.values(state.mainStream.ohlcv)) buf.reset();
    state.mainStream.taSlots.clear();
    state.stateStore.clear();
    state.emissions.plots = [];
    state.emissions.drawings = [];
    state.emissions.alerts = [];
    state.emissions.diagnostics = [];
}
```

### 6. Determinism test (§6.4 / §16.2)

`src/determinism.test.ts` — a 500-bar synthetic stream against a
minimal compiled script that calls nothing primitive-shaped (just
`bar.close` reads, no `ta.*` / `plot` / `alert`). Run the runner
twice; assert each `drain()` returns structurally identical
content across runs.

Tasks 7-8 extend this test with primitive emission determinism
once those surfaces ship.

### 7. Tests (§16.3 row: unit + property + bench + type)

- **Unit:** every execution module (`onHistory`, `onBarClose`,
  `onBarTick`, `drain`, `dispose`), `createScriptRunner`,
  `buildComputeContext`.
- **Property (`fast-check`) — the four §6.7 invariants:**
  - After `onBarClose` step 3: `bar.X === series.X[0]` for every
    OHLCV field (over arbitrary bar sequences).
  - After `compute` returns: every series referenced has the
    same `.length`.
  - Two consecutive `onBarTick` calls without intervening
    `onBarClose` do NOT advance `series.X.length`.
  - Emission queues are cleared at the start of every step (a
    second `drain` immediately after the first returns empty
    arrays).
- **Bench:** `onBarClose.bench.test.ts` — empty-compute step
  throughput.
- **Type tests (`expect-type`):** `createScriptRunner`'s return,
  `CreateScriptRunnerArgs`'s shape.

100% coverage. The `buildComputeContext` helper is a single small
function — every branch covered.

### 8. Public exports

Extend `packages/runtime/src/index.ts` (Task 5 set up the barrel):

```ts
export { createScriptRunner } from "./createScriptRunner";
export type { ScriptRunner, CreateScriptRunnerArgs } from "./createScriptRunner";
```

### 9. JSDoc per §17.2

`createScriptRunner` carries `@since 0.1` + `@example` showing
the lifecycle:

```ts
/**
 * @example
 *     // Build a runner from a compiled script and drive bars through it.
 *     // import { createScriptRunner } from "@invinite-org/chartlang-runtime";
 *     // const runner = createScriptRunner({ compiled, capabilities });
 *     // await runner.onHistory(historyBars);
 *     // const emissions = runner.drain();
 */
```

Commented imports keep docs-check off compilation (the consumer of
`createScriptRunner` is the host, not a script).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/runtime/src/createScriptRunner.ts` | Create | `ScriptRunner` factory. |
| `packages/runtime/src/buildComputeContext.ts` | Create | Builds the `ComputeContext` passed to user `compute`. |
| `packages/runtime/src/execution/onHistory.ts` | Create | Bulk-fill loop. |
| `packages/runtime/src/execution/onBarClose.ts` | Create | §6.7 step 1-6 main path. |
| `packages/runtime/src/execution/onBarTick.ts` | Create | §6.7 replaceHead path. |
| `packages/runtime/src/execution/drain.ts` | Create | Drain + reset queues. |
| `packages/runtime/src/execution/dispose.ts` | Create | Buffer/state teardown. |
| `packages/runtime/src/execution/index.ts` | Create | Barrel. |
| `packages/runtime/src/index.ts` | Modify | Add `createScriptRunner` + `ScriptRunner` types to the barrel. |
| `packages/runtime/src/createScriptRunner.test.ts` | Create | Unit + property tests. |
| `packages/runtime/src/execution/onBarClose.test.ts` | Create | §6.7 invariants. |
| `packages/runtime/src/execution/onBarTick.test.ts` | Create | Tick path tests. |
| `packages/runtime/src/execution/onHistory.test.ts` | Create | Bulk-fill tests. |
| `packages/runtime/src/execution/drain.test.ts` | Create | Drain semantics. |
| `packages/runtime/src/execution/dispose.test.ts` | Create | Teardown semantics. |
| `packages/runtime/src/execution/onBarClose.bench.test.ts` | Create | Bench. |
| `packages/runtime/src/determinism.test.ts` | Create | 500-bar determinism skeleton. |
| `packages/runtime/README.md` | Modify | Add execution-loop section to public surface. |

## Acceptance Criteria

- `pnpm -F @invinite-org/chartlang-runtime typecheck && pnpm -F
  @invinite-org/chartlang-runtime test` pass with 100% coverage.
- Property tests assert the four §6.7 invariants over arbitrary
  candle sequences.
- `onBarClose.bench.test.ts` reports a finite median + threshold.
- A no-primitive `compute` (e.g. `({ bar }) => { void bar.close;
  }`) compiled by Task 3 and driven via `mockCandleSource` from
  Task 4 runs end-to-end through `onHistory → onBarClose → drain →
  dispose` without errors.
- The determinism test passes on identical inputs across runs.
- `pnpm docs:check`, `readme:check`, `lint`, `format:check`,
  `conformance`, `coverage:report` pass on the whole workspace.
- Earlier-phase + Task 5 gates remain green.
