# @invinite-org/chartlang-runtime

`experimental`

Execution engine, Series ring buffers, ta.* math primitives.

Phase 1 lands the **data-structure layer** plus the **execution
loop**: `RingBuffer<T>` / `Float64RingBuffer` per [PLAN.md §6.6](../../PLAN.md),
the `Series<T>` Proxy, the per-interval `StreamState`, the in-memory
`StateStore` default, the `ACTIVE_RUNTIME_CONTEXT` slot, and
`createScriptRunner` driving `onHistory` / `onBarClose` / `onBarTick`
/ `drain` / `dispose`.

The `ta.*` primitive implementations land in Phase-1 Task 7; until
then the runner exposes throw-stub versions on the `ComputeContext`.
Task 8 (this release) adds the `plot` / `hline` / `alert` emission
primitives, the shared `emissionsQueue` push helpers, and the
FNV-1a-backed alert dedupe-key hash.

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
- `inMemoryStateStore()` — the Phase-1 default `StateStore`. The
  Phase-5 IDB-backed persistence variant (PLAN.md §6.9) ships as a
  superset `PersistentStateStore` sub-interface — additive, not
  breaking.
- `ACTIVE_RUNTIME_CONTEXT` — process-wide context slot the runner
  mutates around every `compute` call so Tasks 7-8 primitive
  implementations can find the active `stream` / `stateStore` /
  `capabilities` / `emissions` / `barIndex` / `isTick`.
- `plot` / `hline` / `alert` — Phase-1 emission primitives. Each
  carries a script-facing overload (`(value, opts?)`) plus the
  compiler-injected slot-id overload (`(slotId, value, opts?)`);
  capability misses drop with PLAN §7.4 silent-no-op diagnostics;
  alerts get a deterministic FNV-1a `dedupeKey`.

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
