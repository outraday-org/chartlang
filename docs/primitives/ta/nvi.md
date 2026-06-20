# `ta.nvi`

> **Stability:** stable
> **Since:** 0.2

Negative Volume Index — cumulative percentage-change in close on
bars whose volume is strictly LOWER than the prior bar's; bars with
equal-or-higher volume carry the prior NVI value unchanged. Seeded
at 1000 (anchor — see `SEED_VALUE`); the property tests pin the
seed at bar 0.

NaN volume is treated as 0 (matches invinite's `safeVolume` shape) —
a NaN-volume bar is "lower" than any positive-volume bar, so the
comparison is exercised. NaN close carries every accumulator field
forward without advancing — the next finite close differences
against the last finite one.

**Tick mode.** Replays the head bar's contribution against a
snapshot of the prior-close `(value, prevClose, prevVolume)` tuple.

## Formula

nvi[0] = 1000 ;
nvi[t] = (volume[t] < volume[t − 1] && prevClose != 0)
       ? nvi[t − 1] · (1 + (close[t] − close[t − 1]) / close[t − 1])
       : nvi[t − 1]

## Warmup

1 (bar 0 emits the 1000 seed)

## Anchors

seedValue

## Signature

```ts
function nvi(slotId: string, opts?: NviOpts): Series<number>;
```

_The leading `slotId: string` parameter is injected by the chartlang compiler at every callsite — script authors call `ta.<id>(...)` without it._

## Parameters

| Name | Type | Default | Description |
|---|---|---|---|
| `slotId` | `string` | — | — |
| `opts` | `NviOpts` | (optional) | — |

## Returns

`Series<number>`

## Example

```ts
// import { ta, plot } from "@invinite-org/chartlang-core";
    // const n = ta.nvi();
    // plot(n);
```

## See also

- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/runtime/src/ta/nvi.ts)
