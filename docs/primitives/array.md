# `array`

> **Stability:** stable
> **Since:** 1.4

## Signature

```ts
array = Object.freeze({
    sum: (a: MutableArraySlot<number>): number => a.sum(),
    avg: (a: MutableArraySlot<number>): number => a.avg(),
    min: (a: MutableArraySlot<number>): number => a.min(),
    max: (a: MutableArraySlot<number>): number => a.max(),
    range: (a: MutableArraySlot<number>): number => a.range(),
    variance: (a: MutableArraySlot<number>, biased?: boolean): number => a.variance(biased),
    stdev: (a: MutableArraySlot<number>, biased?: boolean): number => a.stdev(biased),
    median: (a: MutableArraySlot<number>): number => a.median(),
    percentile: (a: MutableArraySlot<number>, p: number): number => a.percentile(p),
    indexOf: (a: MutableArraySlot<number>, v: number): number => a.indexOf(v),
    includes: (a: MutableArraySlot<number>, v: number): boolean => a.includes(v),
    sort: (a: MutableArraySlot<number>, order?: "asc" | "desc"): ReadonlyArray<number> => a.sort(order),
})
```

## Example

```ts
const m = array.avg(win);
    void m;
```

## See also

- `array.*` namespace — [Series and indexing](/language/series-and-indexing)
- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/core/src/array/index.ts)
