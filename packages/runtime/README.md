# @invinite-org/chartlang-runtime

`experimental`

Execution engine, Series ring buffers, ta.* math primitives.

Phase 1 ships the data-structure layer + execution loop
(`RingBuffer<T>`, `Series<T>` Proxy, `StreamState`, `StateStore`,
`ACTIVE_RUNTIME_CONTEXT`, `createScriptRunner`). Phase 2 wires the
real `ta.*` primitive impls + `plot` / `hline` / `alert` emission
helpers. Phase 3 (this release) lands the `draw.*` emission
infrastructure — `createDrawingHandle`, `pushDrawing`, sub-id
counters, and `RuntimeContext` drawing fields. The script-facing
`draw` namespace is the throwing-stub seam; per-kind tasks 5–18
swap real impls in.

## Install

```bash
pnpm add @invinite-org/chartlang-runtime
```

## Public surface

- `createScriptRunner({ compiled, capabilities, stateStore? })` →
  `ScriptRunner` with `onHistory` / `onBarClose` / `onBarTick` /
  `drain` / `dispose`. Owns the per-bar lifecycle, the `bar` /
  `series` sync invariants, and the `ACTIVE_RUNTIME_CONTEXT` slot
  mutation around `compute` (PLAN §6.1 + §6.7).
- `RingBuffer<T>`, `Float64RingBuffer` — `RingBufferLike<T>`
  implementations sized to `manifest.maxLookback + 1`.
- `makeSeriesView(buf)` — the `Series<T>` Proxy whose identity does
  not change across bars (the contract that lets `const ema =
  ta.ema(...)` work per PLAN.md §6.6).
- `createStreamState({ interval, capacity, symbol })` — single-stream
  shape (`OhlcvBuffers` + `BarView` + cached `Series<number>` views +
  `taSlots`).
- `inMemoryStateStore()` — Phase-1 default `StateStore`. The
  Phase-5 IDB-backed variant (PLAN.md §6.9) is an additive
  `PersistentStateStore` superset, not breaking.
- `ACTIVE_RUNTIME_CONTEXT` — process-wide context slot the runner
  mutates around every `compute` call so primitive impls find the
  active `stream` / `stateStore` / `capabilities` / `emissions` /
  `barIndex` / `isTick` / `drawingSlots` / counters.
- `plot` / `hline` / `alert` — Phase-1 emission primitives. Each
  carries a script-facing overload (`(value, opts?)`) plus the
  compiler-injected slot-id overload (`(slotId, value, opts?)`);
  capability misses drop with PLAN §7.4 silent-no-op diagnostics;
  alerts get a deterministic FNV-1a `dedupeKey`.
- `draw` / `createDrawingHandle` / `pushDrawing` / `nextSubId` /
  `resetSubIdCounters` — Phase-3 drawing emission infrastructure.
  `draw` re-exports core's throwing-stub Proxy until Tasks 5–18 wire
  per-kind impls. `createDrawingHandle(slotId, subId, kind, state)`
  returns a `DrawingHandle` with `slotId#subId` cross-bar stability
  per PLAN §10.3; `update(patch)` re-emits the full merged state
  under `op: "update"`. `pushDrawing` enforces capability gating
  (`unsupported-drawing-kind`), wire-shape validation
  (`malformed-emission`), per-bucket budget
  (`drawing-budget-exceeded`), and per-bar `(handleId, bar)` dedup.

## Minimum-viable API call

```ts
import {
    createStreamState,
    Float64RingBuffer,
    inMemoryStateStore,
    makeSeriesView,
} from "@invinite-org/chartlang-runtime";

const stream = createStreamState({
    interval: "1D",
    capacity: 5,
    symbol: "AAPL",
});

stream.ohlcv.close.append(101);
stream.ohlcv.close.append(102);
stream.seriesViews.close.current; // 102
stream.seriesViews.close[1];      // 101

const buf = new Float64RingBuffer(8);
const view = makeSeriesView<number>(buf);
buf.append(42);
view.current; // 42

const store = inMemoryStateStore();
store.set("ta:ema:slot#0", { running: 1 });
store.get<{ running: number }>("ta:ema:slot#0");
```

## Docs

See [`docs/spec/semantics.md`](../../docs/spec/semantics.md) for the
per-bar execution contract and [`PLAN.md` §6.6](../../PLAN.md) for
the ring-buffer + Series Proxy contract.

## License

MIT
