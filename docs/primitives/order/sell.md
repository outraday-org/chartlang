# `order.sell`

> **Stability:** stable
> **Since:** 1.12

Emit a market **sell** intent: open or add to a short, reversing an
existing long that it crosses through. `qty` is unsigned magnitude.

## Signature

```ts
sell(_opts?: OrderOpts): void {
    sentinel("order.sell");
}
```

## Example

```ts
const fn: typeof order.sell = order.sell;
    void fn;
```

## See also

- `order.*` namespace — [Orders](/language/orders)
- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/core/src/order/order.ts)
