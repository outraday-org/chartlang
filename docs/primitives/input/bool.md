# `input.bool`

> **Stability:** stable
> **Since:** 0.4

Build a boolean input descriptor.

## Signature

```ts
bool(defaultValue: boolean, opts?: {
    readonly title?: string;
}): BoolDescriptor {
    return Object.freeze({ kind: "bool" as const, defaultValue, ...opts });
}
```

## Example

```ts
const enabled = input.bool(true);
    void enabled;
```

## See also

- `input.*` namespace
- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/core/src/input/input.ts)
