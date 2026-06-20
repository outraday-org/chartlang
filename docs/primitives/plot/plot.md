# `plot`

> **Stability:** stable
> **Since:** 0.1

Compile-time callable hole for `plot(value, opts?)`. The compiler rewrites
every callsite to dispatch to the runtime's `plot` implementation;
calling this outside a compiled runtime throws the sentinel.

Accepts `number | Series<number>` — scalars emit a single bar value;
series emissions pull from `series.current`.

## Signature

```ts
export function plot(_value: number | Series<number>, _opts?: PlotOpts): void {
    throw new Error("plot called outside compiled runtime");
}
```

## Example

```ts
// Inside a compiled `compute`:
    //   plot(bar.close, { color: "#3b82f6" });
    import { plot } from "@invinite-org/chartlang-core";
    try { plot(0); } catch {}
```

## See also

- `plot.*` namespace
- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/core/src/plot/plot.ts)
