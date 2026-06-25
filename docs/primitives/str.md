# `str`

> **Stability:** stable
> **Since:** 1.4

## Signature

```ts
str = Object.freeze({
    tostring: (value: number | boolean | string, format?: string): string => typeof value === "number" ? formatNumber(value, format) : String(value),
    format: (template: string, ...args: ReadonlyArray<string | number>): string => applyFormat(template, args),
    length: (s: string): number => s.length,
    contains: (s: string, sub: string): boolean => s.includes(sub),
    startsWith: (s: string, sub: string): boolean => s.startsWith(sub),
    endsWith: (s: string, sub: string): boolean => s.endsWith(sub),
    replace: (s: string, target: string, repl: string): string => s.replace(target, repl),
    replaceAll: (s: string, target: string, repl: string): string => s.split(target).join(repl),
    split: (s: string, sep: string): ReadonlyArray<string> => s.split(sep),
    substring: (s: string, start: number, end?: number): string => s.substring(start, end),
    upper: (s: string): string => s.toUpperCase(),
    lower: (s: string): string => s.toLowerCase(),
    trim: (s: string): string => s.trim(),
    repeat: (s: string, count: number): string => s.repeat(Math.max(0, Math.trunc(count))),
})
```

## Example

```ts
const label = str.format("{0}={1,number,#.##}", str.upper("eth"), 12.349);
    void label; // "ETH=12.35"
```

## See also

- `str.*` namespace — [Strings](/language/strings)
- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/core/src/str/index.ts)
