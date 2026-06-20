# `state.string`

> **Stability:** stable
> **Since:** 0.4

Allocate or read a persistent string slot.

## Signature

```ts
string(_init: string): MutableSlot<string> {
    return sentinel("state.string");
}
```

## Example

```ts
const fn: typeof state.string = state.string;
    void fn;
```

## See also

- `state.*` namespace
- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/core/src/state/state.ts)
