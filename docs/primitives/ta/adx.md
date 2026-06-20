# `ta.adx`

> **Stability:** stable
> **Since:** 0.2

Wilder's Average Directional Index — single-line trend-strength
oscillator bounded in `[0, 100]`. Reads `bar.high` / `bar.low` /
`bar.close` directly (mirrors Pine's `ta.adx(length)` — no source
param). Composes onto the same Wilder directional-movement
recurrence `ta.dmi` runs (`+DI` / `−DI` from Wilder-smoothed `+DM`
/ `−DM` / TR), then folds DX = `100 · |+DI − −DI| / (+DI + −DI)`
into a second Wilder-smoothing window of length
`opts.smoothing` (default `14`).

## Formula

+DI, −DI per `ta.dmi(length)` ;
DX[t]  = (+DI + −DI) === 0 ? 0 : 100 · |+DI − −DI| / (+DI + −DI) ;
seed at first defined ADX bar = mean(DX over `smoothing` samples) ;
ADX[t] = wilderStep(ADX[t−1], DX[t], smoothing)

## Warmup

length + smoothing − 1

## Anchors

length, smoothing

## Signature

```ts
function adx(slotId: string, length: number, opts?: AdxOpts): Series<number>;
```

_The leading `slotId: string` parameter is injected by the chartlang compiler at every callsite — script authors call `ta.<id>(...)` without it._

## Parameters

| Name | Type | Default | Description |
|---|---|---|---|
| `slotId` | `string` | — | — |
| `length` | `number` | — | — |
| `opts` | `AdxOpts` | (optional) | — |

## Returns

`Series<number>`

## Example

```ts
// import { ta } from "@invinite-org/chartlang-runtime";
    // const a = ta.adx("slot", 14);
    // plot(a);
    // const lagged = ta.adx("slot2", 14, { offset: 5 });
```

## See also

- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/runtime/src/ta/adx.ts)
