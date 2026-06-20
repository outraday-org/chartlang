# `ta.dpo`

> **Stability:** stable
> **Since:** 0.2

Detrended Price Oscillator — strips the SMA trend out of price so
the remaining oscillator visualises the short-cycle component.
Non-centered (default) mode: `dpo[i] = source[i − displacement]
− sma[i]` with `displacement = floor(length / 2) + 1`. Composes
`ta.sma(${slotId}/sma, src, length)`; a per-slot source window
carries the trailing `displacement + 1` bars so the
`source[i − displacement]` lookback is O(1) per close.

## Formula

displacement = floor(length / 2) + 1 ;
sma[i]        = mean(source[i − length + 1 ..= i]) ;
dpo[i]        = source[i − displacement] − sma[i]

## Warmup

length

## Signature

```ts
function dpo(slotId: string, source: ScalarOrSeries, length: number, opts?: DpoOpts): Series<number>;
```

_The leading `slotId: string` parameter is injected by the chartlang compiler at every callsite — script authors call `ta.<id>(...)` without it._

## Parameters

| Name | Type | Default | Description |
|---|---|---|---|
| `slotId` | `string` | — | — |
| `source` | `ScalarOrSeries` | — | — |
| `length` | `number` | — | — |
| `opts` | `DpoOpts` | (optional) | — |

## Returns

`Series<number>`

## Example

```ts
// import { ta } from "@invinite-org/chartlang-runtime";
    // const d = ta.dpo("slot", bar.close, 21);
    // const head = d.current;
```

## See also

- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/runtime/src/ta/dpo.ts)
