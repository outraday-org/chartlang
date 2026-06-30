# `input.interval`

> **Stability:** stable
> **Since:** 0.4

Build a main-interval input descriptor.

## Signature

```ts
interval(defaultValue: string, opts?: {
    readonly title?: string;
} & CommonInputOpts): IntervalDescriptorInput {
    return Object.freeze({ kind: "interval" as const, defaultValue, ...opts });
}
```

## Example

```ts
const interval = input.interval("1D");
    void interval;
```

## See also

- `input.*` namespace
- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/core/src/input/input.ts)
