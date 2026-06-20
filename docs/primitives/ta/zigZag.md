# `ta.zigZag`

> **Stability:** stable
> **Since:** 0.2

ZigZag — streaming swing-pivot detector. Walks the close series
tracking a running candidate pivot; confirms a new pivot when the
price has reversed by at least `deviation %` from the candidate
AND `depth` bars have elapsed. The output `value` Series carries
the price of the most-recently-confirmed pivot (held constant
between confirmations); `direction` is `+1` (uptrend), `-1`
(downtrend), or NaN before the first confirmation. Returns a
cached `{ value, direction }` record (same identity every bar).

Streaming adaptation of invinite's batch ZigZag: invinite paints
a linearly-interpolated polyline between confirmed pivots and
supports `extendToLastBar` retro-painting from the last confirmed
pivot to the right edge. The append-only Series model cannot
rewrite older slots, so the streaming output is the closest
representable surface (a "trailing reference level" Pine authors
would use as a stop). Defaults: `deviation = 5`, `depth = 10`.

NaN close → NaN outputs and freezes the state machine. Tick-mode
replays the head from the snapshot captured at the start of the
current bar (mirrors PSAR / Supertrend).

## Formula

Confirm pivot when |Δ%| ≥ deviation AND barsSince ≥ depth :
up-trend: running peak updates on new highs ; flip on
|drop from peak| ≥ deviation ; flip-direction emits the
peak (the just-confirmed top) as `value`, sets new
`direction = −1`. Down-trend symmetric.

## Warmup

input-dependent (NaN until first confirmed pivot)

## Anchors

deviation, depth

## Signature

```ts
function zigZag(slotId: string, opts?: ZigZagOpts): ZigZagResult;
```

_The leading `slotId: string` parameter is injected by the chartlang compiler at every callsite — script authors call `ta.<id>(...)` without it._

## Parameters

| Name | Type | Default | Description |
|---|---|---|---|
| `slotId` | `string` | — | — |
| `opts` | `ZigZagOpts` | (optional) | — |

## Returns

`ZigZagResult`

## Example

```ts
// import { ta } from "@invinite-org/chartlang-core";
    // const z = ta.zigZag({ deviation: 5 });
    // plot(z.value);
```

## See also

- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/runtime/src/ta/zigZag.ts)
