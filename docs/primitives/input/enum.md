# `input.enum`

> **Stability:** stable
> **Since:** 0.4 — numeric (`number`) options added in 1.6

Build an enum input descriptor (a fixed-options dropdown). Options are
either string labels or numeric values; the default must be one of the
options.

## Signature

```ts
enum<T extends string | number>(defaultValue: T, options: ReadonlyArray<T>, opts?: {
    readonly title?: string;
}): EnumDescriptor<T> {
    return Object.freeze({
        kind: "enum" as const,
        defaultValue,
        options: Object.freeze(options.slice()),
        ...opts,
    });
}
```

## Example

```ts
const mode = input.enum("fast", ["fast", "slow"]);
    const length = input.enum(21, [8, 21, 30, 50, 100]);
    void mode;
    void length;
```

## See also

- `input.*` namespace
- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/core/src/input/input.ts)
