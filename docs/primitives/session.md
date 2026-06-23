# `session`

> **Stability:** stable
> **Since:** 1.5

## Signature

```ts
session = Object.freeze({
    isOpen(_t: Time, _spec: string, _tz?: string): boolean {
        return sentinel("session.isOpen");
    },
})
```

## Example

```ts
const ns: typeof session = session;
    void ns;
```

## See also

- `session.*` accessors — [Time and sessions](/language/time-and-sessions)
- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/core/src/time-accessors/sessionAccessors.ts)
