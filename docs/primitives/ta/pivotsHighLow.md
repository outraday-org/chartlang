# `ta.pivotsHighLow`

> **Stability:** stable
> **Since:** 0.2

Pivots High Low — centred-window swing-pivot detector with
asymmetric `(leftLength, rightLength)` confirmation windows. For
each centre bar `c`, marks an **up-pivot** if `bar.high(c)` is
strictly greater than every `bar.high` in the `leftLength`-bar
left window AND greater-or-equal to every `bar.high` in the
`rightLength`-bar right window (matches Pine `ta.pivothigh`
tie-break — equal-high plateaus resolve to the LATER bar).
Mirrors for **down-pivot** with `bar.low` (strict-less on left,
leq on right).

Output is centred — at live bar `t`, the value emitted at
`high.current` / `low.current` is the pivot status of bar `t −
rightLength` (when bar `t` closes, we now have enough right-
window bars to confirm bar `t − rightLength`). The most recent
`rightLength` slots of each Series are intentionally NaN
(pending right-window confirmation). Warmup is `leftLength +
rightLength` bars before the first confirmed centre.

Outputs encode **price levels**: `high.current` =
`bar.high(centre)` when up-pivot, NaN otherwise; `low.current` =
`bar.low(centre)` when down-pivot, NaN otherwise. NaN in any
window slot → no pivot at the centre. Returns a cached `{ high,
low }` record (same identity every bar).

## Formula

high = bar.high(centre) when bar.high(centre) > every left high AND ≥ every right high, NaN otherwise ;
low  = bar.low(centre)  when bar.low(centre)  < every left low  AND ≤ every right low,  NaN otherwise

## Warmup

leftLength + rightLength

## Anchors

leftLength, rightLength

## Signature

```ts
function pivotsHighLow(slotId: string, opts?: PivotsHighLowOpts): PivotsHighLowResult;
```

_The leading `slotId: string` parameter is injected by the chartlang compiler at every callsite — script authors call `ta.<id>(...)` without it._

## Parameters

| Name | Type | Default | Description |
|---|---|---|---|
| `slotId` | `string` | — | — |
| `opts` | `PivotsHighLowOpts` | (optional) | — |

## Returns

`PivotsHighLowResult`

## Example

```ts
// import { ta } from "@invinite-org/chartlang-core";
    // const p = ta.pivotsHighLow({ leftLength: 4, rightLength: 4 });
    // plot(p.high);
    // plot(p.low);
```

## See also

- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/runtime/src/ta/pivotsHighLow.ts)
