# @invinite-org/chartlang-core

`experimental`

Types and primitives for chartlang scripts.

## Install

```bash
pnpm add @invinite-org/chartlang-core
```

## Public surface

- Constructors: `defineIndicator`, `defineAlert`.
- Callable holes the compiler retargets at the runtime: `ta.sma`, `ta.ema`,
  `ta.stdev`, `ta.bb`, `ta.rsi`, `ta.macd`, `ta.atr`, `ta.crossover`,
  `ta.crossunder`, `plot`, `hline`, `alert`.
- Registry: `STATEFUL_PRIMITIVES` — the immutable set of fully-qualified
  call names the compiler injects callsite ids into.
- Types: `Series<T>`, `Bar`, `Time`, `Price`, `Volume`, `Color`,
  `LineStyle`, `PlotLineStyle`, `AlertSeverity`, `IntervalDescriptor`,
  `InputSchema`, `CapabilityId`, `ScriptManifest`, `ComputeContext`,
  `ComputeFn`, `CompiledScriptObject`, `JsonValue`, plus per-primitive
  opts / result types.

Phase 2+ extends the primitive surface; the namespace shape is locked at
`0.1`.

## Minimum-viable API call

```ts
import { defineIndicator } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "EMA(20)",
    apiVersion: 1,
    compute: ({ ta, plot, bar }) => {
        // `bar.close` is the current close; the compiler wires `ta.ema` to
        // the real runtime implementation at build time.
        plot(bar.close);
    },
});
```

## Docs

See [`docs/language/overview.md`](../../docs/language/overview.md).

## License

MIT
