# `input.externalSeries`

> **Stability:** stable
> **Since:** 0.4

Build a host-supplied external numeric series input descriptor. Use this
for another indicator output, another script output, fundamentals, or
app data aligned by the host to the primary chart stream. Missing feed
values read as `NaN`.

## Signature

```ts
externalSeries<T>(args: ExternalSeriesArgs<T>): ExternalSeriesDescriptor<T> {
    return Object.freeze({
        kind: "external-series" as const,
        name: args.name,
        schema: args.schema,
        ...definedExternalSeriesMetadata(args),
    });
}
```

## Example

```ts
const earnings = input.externalSeries({
        name: "earnings",
        schema: { kind: "external-series-schema" },
    });
    void earnings;
```

## See also

- `input.*` namespace
- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/core/src/input/input.ts)
