# `input.int`

> **Stability:** stable
> **Since:** 0.4

Build an integer input descriptor.

## Signature

```ts
int(defaultValue: number, opts?: {
    readonly min?: number;
    readonly max?: number;
    readonly step?: number;
    readonly title?: string;
} & CommonInputOpts): IntDescriptor {
    return Object.freeze({ kind: "int" as const, defaultValue, ...opts });
}
```

## Example

```ts
const length = input.int(20, { min: 1, max: 200 });
    void length;
```

## See also

- `input.*` namespace
- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/core/src/input/input.ts)
