# `ta.psar`

> **Stability:** stable
> **Since:** 0.2

Parabolic SAR — Wilder's classic stop-and-reverse oscillator with
extreme-point + acceleration-factor tracking. Reads `bar.high` /
`bar.low` / `bar.close` directly (no `source` arg — mirrors Pine).
Returns a cached `{ sar, direction }` record (same identity every
bar). `direction` is `+1` (uptrend) / `-1` (downtrend), NaN during
NaN-suspension. Warmup is `1` — bar 0 emits the seed value
(`sar = bar.low`, `direction = +1`); bar 1 decides the initial
direction from `close[1] >= close[0]` and runs the recurrence; bar
2+ continues the recurrence.

NaN inputs SUSPEND the recurrence: any non-finite OHL emits NaN /
NaN and freezes the live state so the next finite bar resumes from
the prior state. Replay-mode (`replaceHead`) recomputes from the
snapshot captured at the start of the current bar, so a final tick
cannot poison the next close's seed.

## Formula

candidateSar = prevSar + prevAf · (prevEp − prevSar) ;
up-trend clamp: candidateSar ≤ min(prevLow, priorLow) ;
down-trend clamp: candidateSar ≥ max(prevHigh, priorHigh) ;
flip (up→down): bar.low ≤ candidateSar → sar = prevEp, ep = low, af = accStart ;
flip (down→up): bar.high ≥ candidateSar → sar = prevEp, ep = high, af = accStart ;
EP advance: new extreme widens ep, af = min(af + accStep, accMax)

## Warmup

1

## Anchors

accelerationStart, accelerationStep, accelerationMax

## Signature

```ts
function psar(slotId: string, opts?: PsarOpts): PsarResult;
```

_The leading `slotId: string` parameter is injected by the chartlang compiler at every callsite — script authors call `ta.<id>(...)` without it._

## Parameters

| Name | Type | Default | Description |
|---|---|---|---|
| `slotId` | `string` | — | — |
| `opts` | `PsarOpts` | (optional) | — |

## Returns

`PsarResult`

## Example

```ts
// import { ta } from "@invinite-org/chartlang-core";
    // const p = ta.psar({ accelerationStart: 0.02, accelerationStep: 0.02, accelerationMax: 0.2 });
    // plot(p.sar);
```

## See also

- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/runtime/src/ta/psar.ts)
