# `ta.cmf`

> **Stability:** stable
> **Since:** 0.2

Chaikin Money Flow — trailing-window sum of money-flow volume
divided by trailing-window sum of volume. Bounded between -1 and
+1 mathematically. Zero-range bars (`high === low`) contribute 0
to the numerator (matches invinite's CLV guard); NaN OHLC / volume
bars contribute 0 to both numerator and denominator.

**Tick mode.** Substitutes the tick's per-bar (mfv, volume)
contribution for the head slot's stored values without mutating the
trailing-window rings — mirrors the `ulcerIndex.ts` substitution
shape ("hypSum = sum − head + tick").

## Formula

cmf[t] = Σ_{u ∈ window(t)} mfv[u] / Σ_{u ∈ window(t)} volume[u]
where mfv = ((C − L) − (H − C)) / (H − L) · volume

## Warmup

length − 1

## Signature

```ts
function cmf(slotId: string, length: number, _opts?: CmfOpts): Series<number>;
```

_The leading `slotId: string` parameter is injected by the chartlang compiler at every callsite — script authors call `ta.<id>(...)` without it._

## Parameters

| Name | Type | Default | Description |
|---|---|---|---|
| `slotId` | `string` | — | — |
| `length` | `number` | — | — |
| `_opts` | `CmfOpts` | (optional) | — |

## Returns

`Series<number>`

## Example

```ts
// import { ta, plot } from "@invinite-org/chartlang-core";
    // const c = ta.cmf(20);
    // plot(c);
```

## See also

- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/runtime/src/ta/cmf.ts)
