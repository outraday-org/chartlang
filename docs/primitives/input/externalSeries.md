# `input.externalSeries`

> **Stability:** stable
> **Since:** 0.4

Build an adapter-supplied external series input descriptor.

## Signature

```ts
externalSeries<T>(args: {
    readonly name: string;
    readonly schema: Schema<T>;
    readonly title?: string;
}): ExternalSeriesDescriptor<T> {
    return Object.freeze({
        kind: "external-series" as const,
        name: args.name,
        schema: args.schema,
        ...(args.title === undefined ? {} : { title: args.title }),
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
