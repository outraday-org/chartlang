# `ta.adl`

> **Stability:** stable
> **Since:** 0.2

Accumulation Distribution Line — cumulative money-flow volume
`Σ CLV · volume`, where CLV is the close location value
`((C − L) − (H − C)) / (H − L)`. Zero-range bars (`high === low`)
contribute 0 (matches invinite's guard); NaN OHLC / volume bars
contribute 0 (carry the accumulator forward without polluting it).

Renders in its own pane (volume category). No warmup — every slot
finite from bar 0.

**Tick mode.** Replays the head bar's contribution against a
snapshot of the prior-close `cumAdl` so a partial-bar tick doesn't
pollute the next close's accumulator.

## Formula

adl[t] = adl[t − 1] + ((C[t] − L[t]) − (H[t] − C[t])) / (H[t] − L[t]) · V[t]

## Warmup

0

## Signature

```ts
function adl(slotId: string, _opts?: AdlOpts): Series<number>;
```

_The leading `slotId: string` parameter is injected by the chartlang compiler at every callsite — script authors call `ta.<id>(...)` without it._

## Parameters

| Name | Type | Default | Description |
|---|---|---|---|
| `slotId` | `string` | — | — |
| `_opts` | `AdlOpts` | (optional) | — |

## Returns

`Series<number>`

## Example

```ts
// import { ta, plot } from "@invinite-org/chartlang-core";
    // const a = ta.adl();
    // plot(a);
```

## See also

- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/runtime/src/ta/adl.ts)
