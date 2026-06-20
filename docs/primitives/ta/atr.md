# `ta.atr`

> **Stability:** stable
> **Since:** 0.1

Wilder's Average True Range. Sources from `bar.high` / `bar.low` /
`bar.close` directly (no `source` arg — matches Pine). Seeds at bar
`length − 1` as the simple mean of the first `length` TR values;
subsequent slots use the Wilder recurrence with α = 1/length.

## Formula

TR[t] = max(high − low, |high − prevClose|, |low − prevClose|) ;
seed at bar length − 1 = mean(TR[0 .. length − 1]) ;
ATR[t] = (ATR[t − 1] · (length − 1) + TR[t]) / length

## Warmup

length − 1

## Signature

```ts
function atr(slotId: string, length: number, opts?: AtrOpts): Series<number>;
```

_The leading `slotId: string` parameter is injected by the chartlang compiler at every callsite — script authors call `ta.<id>(...)` without it._

## Parameters

| Name | Type | Default | Description |
|---|---|---|---|
| `slotId` | `string` | — | — |
| `length` | `number` | — | — |
| `opts` | `AtrOpts` | (optional) | — |

## Returns

`Series<number>`

## Example

```ts
// import { ta } from "@invinite-org/chartlang-runtime";
    // const a = ta.atr("slot", 14);
    // const head = a.current;
    // const lagged = ta.atr("slot2", 14, { offset: 5 });
```

## See also

- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/runtime/src/ta/atr.ts)
