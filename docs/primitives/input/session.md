# `input.session`

> **Stability:** stable
> **Since:** 1.5

Build a session-window input descriptor (`"HH:MM-HH:MM"`). The value is
a free string in v1 (the grammar is parsed at runtime by
`session.isOpen`), mirroring `input.string`.

## Signature

```ts
session(defaultValue: string, opts?: {
    readonly title?: string;
}): SessionDescriptor {
    return Object.freeze({ kind: "session" as const, defaultValue, ...opts });
}
```

## Example

```ts
const sess = input.session("0930-1600", { title: "Session" });
    void sess;
```

## See also

- `input.*` namespace
- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/core/src/input/input.ts)
