# `input.symbol`

> **Stability:** stable
> **Since:** 0.4

Build a symbol input descriptor.

## Signature

```ts
symbol(defaultValue: string, opts?: {
    readonly title?: string;
} & CommonInputOpts): SymbolDescriptor {
    return Object.freeze({ kind: "symbol" as const, defaultValue, ...opts });
}
```

## Example

```ts
const ticker = input.symbol("AAPL");
    void ticker;
```

## See also

- `input.*` namespace
- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/core/src/input/input.ts)
