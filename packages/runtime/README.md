# @invinite-org/chartlang-runtime

`experimental`

Execution engine, Series ring buffers, primitive implementations, state slots,
views, inputs, request fallback, and emission buffering.

## Install

```bash
pnpm add @invinite-org/chartlang-runtime
```

## Public surface

- `createScriptRunner({ compiled, capabilities, stateStore?, symInfo?,
  inputOverrides? })` -> `ScriptRunner` with `onHistory`, `onBarClose`,
  `onBarTick`, `drain`, and `dispose`.
- Data structures: `RingBuffer<T>`, `Float64RingBuffer`,
  `makeSeriesView(buf)`, `createStreamState(...)`.
- State: `inMemoryStateStore()` plus runtime `state.*` slots with
  committed/tentative semantics; `state.tick.*` commits immediately during
  ticks.
- Views: per-step `barstate`, `timeframe`, and per-mount `syminfo` snapshots
  are wired into `ComputeContext`.
- Inputs: manifest input descriptors resolve through adapter/host overrides
  before `compute({ inputs })` runs.
- Request: `request.security({ interval })` returns a cached all-NaN
  `SecurityBar` when multi-timeframe support is unavailable and emits deduped
  capability diagnostics.
- Emissions: `plot`, `hline`, `alert`, `draw`, drawing handles, budget checks,
  and validation-backed diagnostic drops.
- Context: `ACTIVE_RUNTIME_CONTEXT` is set only around script steps.

## Minimum-viable API call

```ts
import { createScriptRunner, inMemoryStateStore } from "@invinite-org/chartlang-runtime";

const runner = createScriptRunner({
    compiled,
    capabilities,
    stateStore: inMemoryStateStore(),
});

await runner.onHistory(bars);
const emissions = runner.drain();
```

## Docs

See [`docs/spec/semantics.md`](../../docs/spec/semantics.md) and
[`PLAN.md` §6.6](../../PLAN.md).

## License

MIT
