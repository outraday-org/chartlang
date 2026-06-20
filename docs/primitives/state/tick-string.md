# `state.tick.string`

> **Stability:** stable
> **Since:** 0.4

Tick-persistent state slots, Pine `varip` semantics. Writes commit
immediately, even during a tick.

## Signature

```ts
string(_init: string): MutableSlot<string> {
    return sentinel("state.tick.string");
}
```

## Example

```ts
const fn: typeof state.tick.float = state.tick.float;
    void fn;
```

## See also

- `state.tick.*` namespace
- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/core/src/state/state.ts)
