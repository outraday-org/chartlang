# @invinite-org/chartlang-core

`experimental`

Types and script-facing primitives for chartlang indicators, alerts, drawings,
inputs, state slots, views, and secondary-timeframe requests.

## Install

```bash
pnpm add @invinite-org/chartlang-core
```

## Public surface

- Constructors: `defineIndicator`, `defineAlert`, `defineDrawing`.
- Inputs: `input.int`, `float`, `bool`, `string`, `enum`, `color`, `source`,
  `time`, `price`, `symbol`, `interval`, `externalSeries`.
- Stateful slots: `state.float`, `int`, `bool`, `string`, plus
  `state.tick.*` for tick-persistent `varip` semantics.
- Views: `barstate`, `syminfo`, `timeframe`.
- Secondary stream: `request.security({ interval })` typed surface.
- Emissions: `plot`, `hline`, `alert`, and the 61-kind `draw.*` namespace.
- Registry: `STATEFUL_PRIMITIVES` for compiler slot-id injection.
- Indicator composition (Phase 7): `CompiledScriptObject.output(title)` /
  `.withInputs(overrides)` accessors for binding one indicator's output to
  another. Both are compiler-rewritten sentinels — direct invocation throws.
  `isCompiledScriptBundle(v)` narrows the multi-script bundle.
- Types: `Series<T>`, `Bar`, `InputDescriptor`, `MutableSlot<T>`,
  `ScriptManifest`, `ComputeContext`, `DrawingState`, `DrawingHandle`,
  `DrawingCounts`, `SecurityBar`, view types, option/result types, plus
  `DependencyDeclaration`, `OutputDeclaration`, `CompiledScriptBundle`.

## Minimum-viable API call

```ts
import { defineIndicator, input, state } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Session High",
    apiVersion: 1,
    inputs: { length: input.int(20, { min: 1 }) },
    compute: ({ bar, plot }) => {
        const high = state.float(bar.high);
        high.value = Math.max(high.value, bar.high);
        plot(high.value);
    },
});
```

## Docs

See [`docs/language/overview.md`](../../docs/language/overview.md) and
generated primitive pages under [`docs/primitives/`](../../docs/primitives/).

## License

MIT
