# `state.float`

> **Stability:** stable
> **Since:** 0.4

Allocate or read a persistent number slot.

## Signature

```ts
float(_init: number): MutableSlot<number> {
    return sentinel("state.float");
}
```

## Example

```ts
const fn: typeof state.float = state.float;
    void fn;
```

## See also

- `state.*` namespace
- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/core/src/state/state.ts)
