# `ta.ao`

> **Stability:** stable
> **Since:** 0.2

Awesome Oscillator — `SMA(hl2, fastLength) − SMA(hl2, slowLength)`.
Sources from `bar.hl2` directly (no `source` arg — matches Pine
`ta.ao()`). Defaults to `fastLength = 5`, `slowLength = 34`.
Composes two `ta.sma` sub-slots (`${slotId}/fastSma`,
`${slotId}/slowSma`); a fix to `sma` flows in for free. Warmup is
`slowLength − 1` bars (the longer SMA dominates).

## Formula

AO[t] = SMA(hl2, fastLength)[t] − SMA(hl2, slowLength)[t]

## Warmup

slowLength − 1

## Signature

```ts
function ao(slotId: string, opts?: AoOpts): Series<number>;
```

_The leading `slotId: string` parameter is injected by the chartlang compiler at every callsite — script authors call `ta.<id>(...)` without it._

## Parameters

| Name | Type | Default | Description |
|---|---|---|---|
| `slotId` | `string` | — | — |
| `opts` | `AoOpts` | (optional) | — |

## Returns

`Series<number>`

## Example

```ts
// import { ta } from "@invinite-org/chartlang-runtime";
    // const a = ta.ao("slot");
    // const head = a.current;
```

## See also

- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/runtime/src/ta/ao.ts)
