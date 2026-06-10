# Inputs

Inputs are how a script declares user-tunable parameters. The script
author lists them in the `inputs:` field of `defineIndicator` /
`defineDrawing` / `defineAlert`; the compiler serialises each descriptor
into `manifest.inputs`; the host or adapter renders a settings form and
hands user overrides back to the runtime at mount.

## Declaring an input

```ts
import { defineIndicator, input, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "EMA",
    apiVersion: 1,
    overlay: true,
    inputs: {
        length: input.int(20, { min: 2, max: 200, title: "EMA length" }),
        color: input.color("#26a69a", { title: "Line color" }),
    },
    compute({ bar, inputs, ta, plot }) {
        const ema = ta.ema(bar.close, inputs.length as number);
        plot(ema, { color: inputs.color as string, title: "EMA" });
    },
});
```

`inputs.X` arrives at `compute` as a plain JS value. The script narrows
it with `as number` / `as string` / `as boolean` — the compiler does not
infer the resolved type from the descriptor in `apiVersion: 1`. This is
intentional: each input value is JSON-clean and the script is in charge
of its own assertion.

## Input kinds

The frozen v1 input kinds are listed below. Defaults and descriptor
options must be literals — the compiler reads them statically and writes
them into `manifest.inputs`. Non-literal defaults are rejected with
`input-default-not-literal`.

| Builder | Default type | Options | Reference |
| --- | --- | --- | --- |
| `input.int(default, opts?)` | finite number | `min`, `max`, `step`, `title` | [int](../primitives/input/int.md) |
| `input.float(default, opts?)` | finite number | `min`, `max`, `step`, `title` | [float](../primitives/input/float.md) |
| `input.bool(default, opts?)` | boolean | `title` | [bool](../primitives/input/bool.md) |
| `input.string(default, opts?)` | string | `multiline`, `title` | [string](../primitives/input/string.md) |
| `input.enum(default, options, opts?)` | string literal | `options: ReadonlyArray<string>`, `title` | [enum](../primitives/input/enum.md) |
| `input.color(default, opts?)` | CSS color string | `title` | [color](../primitives/input/color.md) |
| `input.source(default, opts?)` | `"open"\|"high"\|"low"\|"close"\|"hl2"\|"hlc3"\|"ohlc4"\|"hlcc4"` | `title` | [source](../primitives/input/source.md) |
| `input.time(default, opts?)` | UTC ms | `pickFromChart`, `title` | [time](../primitives/input/time.md) |
| `input.price(default, opts?)` | finite number | `title` | [price](../primitives/input/price.md) |
| `input.symbol(default, opts?)` | string | `title` | [symbol](../primitives/input/symbol.md) |
| `input.interval(default, opts?)` | string | `title` | [interval](../primitives/input/interval.md) |
| `input.externalSeries({ name, schema, title? })` | adapter-supplied feed | none | [external series](../primitives/input/externalSeries.md) |

Adapters declare which input families they can render via
`Capabilities.inputs`. An input whose kind is outside the adapter's
declared set is still resolved from the manifest default; the adapter
just won't expose an editor for it.

## Special-case rules

- **Only one `input.interval`.** It is the script's user-pickable main
  timeframe. The compiler rejects a second declaration with
  `multiple-input-interval`, and the manifest's `userPickableInterval`
  becomes `true`.
- **`input.enum` doubles as a literal source for `request.security`.**
  The compiler's
  [requested-intervals pass](../spec/grammar.md#requested-intervals)
  accepts either a string literal or a reference to an extracted
  `input.enum` as the `interval` argument to a request primitive.
  Every string option from that enum contributes one entry to
  `manifest.requestedIntervals`.
- **External series are different.** `input.externalSeries` carries an
  adapter feed name and an opaque schema instead of a default value;
  the runtime resolves it to a feed handle, not a scalar.

## How values reach `compute`

At mount the runtime:

1. Reads `manifest.inputs` defaults.
2. Merges adapter / host overrides (`Adapter.resolveInputs?`,
   per-script settings UI, etc.) over the defaults.
3. Coerces every override against its manifest descriptor. A value that
   cannot be coerced drops to the manifest default and emits
   `input-coercion-failed`.
4. Freezes the resolved record and passes it as `ctx.inputs` to every
   compute step for the lifetime of the runner.

Once resolved, input values are frozen — they do not mutate between
bars. Script-author logic that needs to react to a change should react
on the next remount.

## Cross-links

- The manifest field layout: [Script manifest § Input descriptors](../spec/manifest.md#input-descriptors).
- Compiler diagnostics: [grammar § Input Extraction](../spec/grammar.md#input-extraction).
- The per-builder reference pages under
  [Input primitives](../primitives/input/int.md).
