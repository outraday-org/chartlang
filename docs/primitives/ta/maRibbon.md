# `ta.maRibbon`

> **Stability:** stable
> **Since:** 0.2

MA Ribbon — a fan of K moving averages of the same kind at different
lengths. Returns a dynamic-key record `{ ma_<length>: Series<number> }`
keyed by the resolved `lengths` array. Each output is composed through
`TA_REGISTRY`'s registered MA primitive (`sma` / `ema` / `wma` /
`smma`) via the sub-slot id `${slotId}/ma_<length>` — no private MA
copy, so a fix to any MA primitive flows in for free (matches the
`donchian` / `bb` / `macd` composition convention). Defaults:
`lengths = [10, 20, 30, 40, 50]`, `maType = "sma"`. Per-output warmup
matches the source MA's warmup at that length.

The sibling helper {@link maRibbonOutputKeys} returns the ordered
`ma_<length>` keys for stable iteration over the result record.
`TA_REGISTRY_METADATA.maRibbon` records the default primary key +
visible keys + `{ kind: "auto" }` y-domain for legend / pane sizing.

## Formula

out.ma_<length> = MA(source, length)  for length ∈ lengths

## Warmup

per-output : matches the source MA's warmup at `length` ;
ribbon as a whole : `max(lengths) − 1`

## Anchors

lengths, maType

## Signature

```ts
function maRibbon(slotId: string, source: ScalarOrSeries, opts?: MaRibbonOpts): MaRibbonResult;
```

_The leading `slotId: string` parameter is injected by the chartlang compiler at every callsite — script authors call `ta.<id>(...)` without it._

## Parameters

| Name | Type | Default | Description |
|---|---|---|---|
| `slotId` | `string` | — | — |
| `source` | `ScalarOrSeries` | — | — |
| `opts` | `MaRibbonOpts` | (optional) | — |

## Returns

`MaRibbonResult`

## Example

```ts
// import { ta } from "@invinite-org/chartlang-core";
    // const r = ta.maRibbon(bar.close, { lengths: [10, 20, 30], maType: "ema" });
    // plot(r.ma_10);
    // plot(r.ma_20);
    // plot(r.ma_30);
```

## See also

- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/runtime/src/ta/maRibbon.ts)
