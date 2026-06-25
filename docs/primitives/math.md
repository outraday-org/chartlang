# `math`

> **Stability:** stable
> **Since:** 1.4

## Signature

```ts
math = Object.freeze({
    roundToMintick,
    roundTo,
    na,
    nz,
    fixnan,
    sign,
    clamp,
    avg,
    sum,
})
```

## Example

```ts
const price = math.roundToMintick(rawPrice, syminfo.mintick);
    void price;
```

## See also

- `math.*` namespace — [Math](/language/math)
- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/core/src/math/index.ts)
