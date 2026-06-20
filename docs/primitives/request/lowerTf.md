# `request.lowerTf`

> **Stability:** stable
> **Since:** 0.6

Read **lower**-timeframe bars contained by each main-stream bar. The
result is a `Series<ReadonlyArray<Bar>>` — for every main bar, the array
of finer-grained bars that fall inside it (an empty frozen array for
out-of-range or unsupported reads). The requested `interval` must be a
compile-time literal and **strictly lower** than the chart interval; an
equal-or-higher ordering is rejected at compile time with
`lower-tf-not-lower` when statically known. Like `request.security`, it
degrades to empty arrays when the adapter lacks
`Capabilities.multiTimeframe`. See the multi-timeframe guide for the
contained-bar model and interval format.

## Signature

```ts
function lowerTf(_opts: RequestLowerTfOpts): Series<ReadonlyArray<Bar>> {
    return sentinel("request.lowerTf");
}
```

## Example

```ts
// Each main bar carries the array of intrabar 30-second candles.
    const intrabar = request.lowerTf({ interval: "30s" });
    const count = intrabar.current.length;
    void count;
```

## See also

- `request.*` namespace — [Multi-timeframe guide](/language/multi-timeframe)
- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/core/src/request/request.ts)
