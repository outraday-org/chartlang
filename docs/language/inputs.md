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
| `input.externalSeries({ name, schema, title? })` | host-supplied numeric series | `name`, `schema`, `title` | [external series](../primitives/input/externalSeries.md) |

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
- **`input.source` is OHLC-only.** It selects built-in OHLC and derived
  bar fields only: `open`, `high`, `low`, `close`, `hl2`, `hlc3`,
  `ohlc4`, or `hlcc4`.
- **External series are host feeds.** `input.externalSeries` is for
  host-supplied numeric series such as another indicator output,
  another script output, fundamentals, or app data. The host is
  responsible for alignment to the primary chart stream. Missing values
  are `NaN`.

## How values reach `compute`

At mount the runtime:

1. Reads `manifest.inputs` defaults.
2. Merges adapter / host overrides (`Adapter.resolveInputs?`,
   per-script settings UI, etc.) over the defaults.
3. Coerces every override against its manifest descriptor. A value that
   cannot be coerced drops to the manifest default and emits
   `input-coercion-failed`.
4. Freezes the resolved scalar-input record and passes it as
   `ctx.inputs` to every compute step for the lifetime of the runner.

Once resolved, scalar input values are frozen — they do not mutate
between bars. Script-author logic that needs to react to a scalar input
change should react on the next remount.

`input.externalSeries` is the exception to the scalar rule. Its resolved
value is an indexable numeric `Series<number>` whose backing feed can be
replaced live by the host with `setExternalSeries(feeds)`. The
replacement is whole-map, not a partial merge.

Inputs tune `compute` and are frozen at mount. For presentation-only
recolor / show-hide of individual plots from the embedder — without
editing the script or remounting — see
[plot overrides](../adapters/contract.md#plot-overrides).

## Cross-links

- The manifest field layout: [Script manifest § Input descriptors](../spec/manifest.md#input-descriptors).
- Compiler diagnostics: [grammar § Input Extraction](../spec/grammar.md#input-extraction).
- The per-builder reference pages under
  [Input primitives](../primitives/input/int.md).
- Embedder presentation overrides: [Plot overrides](../adapters/plot-overrides.md).
