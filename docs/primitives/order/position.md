# `order.position`

> **Stability:** stable
> **Since:** 1.12

Read the nominal position. Pure — it allocates no per-callsite state, so
it is the one `order.*` member that is legal inside a bounded loop and
that does **not** make a script ask for the `orders` capability. Returns
the state as of the previous confirmed step (see the lag note on the
namespace).

## Signature

```ts
position(): OrderPosition {
    return sentinel("order.position");
}
```

## Example

```ts
const fn: typeof order.position = order.position;
    void fn;
```

## See also

- `order.*` namespace — [Orders](/language/orders)
- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/core/src/order/order.ts)
