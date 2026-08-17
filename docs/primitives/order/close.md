# `order.close`

> **Stability:** stable
> **Since:** 1.12

Emit a market **close** intent: target flat from either side. The nominal
tracker always flattens fully — a partial-close `qty` rides the emission
for consumers that simulate partials but is ignored here.

## Signature

```ts
close(_opts?: OrderOpts): void {
    sentinel("order.close");
}
```

## Example

```ts
const fn: typeof order.close = order.close;
    void fn;
```

## See also

- `order.*` namespace — [Orders](/language/orders)
- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/core/src/order/order.ts)
