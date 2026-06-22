# `state.array`

> **Stability:** stable
> **Since:** 1.3

Allocate or read a persistent **bounded collection** slot — a
fixed-capacity FIFO ring you push values into across bars. `a.push(v)`
appends (evicting the oldest once full); `a.get(n)` reads the `n`-th
element from the newest; `a.last()` is the newest; `a.size` is the
filled count; `a.capacity` is the bound; `a.clear()` empties it.
`capacity` must be a compile-time numeric literal (the slot is bounded
so it serializes). Unlike {@link state}.series (one value's bar-indexed
history), this is a collection of many pushed values. v1 supports
`number` element type.

## Signature

```ts
array<T>(_capacity: number): MutableArraySlot<T> {
    return sentinel("state.array");
}
```

## Example

```ts
const fn: typeof state.array = state.array;
    void fn;
```

## See also

- `state.*` namespace
- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/core/src/state/state.ts)
