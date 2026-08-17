# `order.buy`

> **Stability:** stable
> **Since:** 1.12

Emit a market **buy** intent: open or add to a long, reversing an
existing short that it crosses through. `qty` is unsigned magnitude.

## Signature

```ts
buy(_opts?: OrderOpts): void {
    sentinel("order.buy");
}
```

## Example

```ts
const fn: typeof order.buy = order.buy;
    void fn;
```

## See also

- `order.*` namespace — [Orders](/language/orders)
- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/core/src/order/order.ts)
