# `input.price`

> **Stability:** stable
> **Since:** 0.4

Build a price input descriptor.

## Signature

```ts
price(defaultValue: Price, opts?: {
    readonly title?: string;
} & CommonInputOpts): PriceDescriptor {
    return Object.freeze({ kind: "price" as const, defaultValue, ...opts });
}
```

## Example

```ts
const level = input.price(101.25);
    void level;
```

## See also

- `input.*` namespace
- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/core/src/input/input.ts)
