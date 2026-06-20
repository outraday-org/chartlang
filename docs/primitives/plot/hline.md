# `hline`

> **Stability:** stable
> **Since:** 0.1

Compile-time callable hole for `hline(price, opts?)`. Same semantics as
`plot` but pinned to a fixed price across all bars.

## Signature

```ts
export function hline(_price: number, _opts?: HLineOpts): void {
    throw new Error("hline called outside compiled runtime");
}
```

## Example

```ts
// Inside a compiled `compute`:
    //   hline(70, { color: "#ef4444" });
    import { hline } from "@invinite-org/chartlang-core";
    try { hline(70); } catch {}
```

## See also

- `plot.*` namespace
- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/core/src/plot/plot.ts)
