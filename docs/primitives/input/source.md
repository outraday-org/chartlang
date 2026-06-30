# `input.source`

> **Stability:** stable
> **Since:** 0.4

Build a source-field input descriptor. `input.source` selects only the
built-in OHLC and derived bar fields (`open`, `high`, `low`, `close`,
`hl2`, `hlc3`, `ohlc4`, `hlcc4`). Host-supplied numeric series belong
in `input.externalSeries`.

## Signature

```ts
source(defaultValue: SourceField, opts?: {
    readonly title?: string;
} & CommonInputOpts): SourceDescriptor {
    return Object.freeze({ kind: "source" as const, defaultValue, ...opts });
}
```

## Example

```ts
const source = input.source("close");
    void source;
```

## See also

- `input.*` namespace
- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/core/src/input/input.ts)
