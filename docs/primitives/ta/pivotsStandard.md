# `ta.pivotsStandard`

> **Stability:** stable
> **Since:** 0.2

Pivots Standard — classical daily pivot-point levels (P, R1..R3,
S1..S3) derived from the previous UTC-day's high / low / close.
Four formula systems supported: `"classic"` (default),
`"fibonacci"`, `"camarilla"`, `"woodie"`. Reads `bar.time` /
`bar.high` / `bar.low` / `bar.close` directly; session boundary
detection uses `Math.floor(bar.time / 86_400_000)` (UTC-day key).
Returns a cached seven-Series `{ pp, r1, s1, r2, s2, r3, s3 }`
record (same identity every bar).

The runtime aggregates the in-progress day's HLC on every close;
when a new UTC-day opens, the in-progress aggregate is promoted
to `prevDay` and the new day's pivot levels are computed via the
selected formula. Outputs are NaN at every bar in the FIRST UTC
day (no `prevDay` available) and finite from the SECOND UTC day
onward.

**Deferred:** R4 / R5 / S4 / S5 levels (Camarilla's full table
defines them; this primitive ships R1..R3 / S1..S3 only). DeMark /
Traditional formula systems also defer.

NaN bar leaves the day aggregate unchanged (NaN-aware max / min).
Tick-mode replays from the snapshot captured at the start of the
current bar.

## Formula

pp / r1..r3 / s1..s3 derived from prevDay HLC per system :
classic   — pp = (h+l+c)/3 ; r1 = 2p − l ; s1 = 2p − h ; r2 = p + (h−l) ; s2 = p − (h−l) ; r3 = p + 2(h−l) ; s3 = p − 2(h−l) ;
fibonacci — pp = (h+l+c)/3 ; r1/s1 = p ± 0.382·(h−l) ; r2/s2 = p ± 0.618·(h−l) ; r3/s3 = p ± (h−l) ;
camarilla — pp = (h+l+c)/3 ; r1/s1 = c ± 1.1·(h−l)/12 ; r2/s2 = c ± 1.1·(h−l)/6 ; r3/s3 = c ± 1.1·(h−l)/4 ;
woodie    — pp = (h+l+2c)/4 ; r1 = 2p − l ; s1 = 2p − h ; r2 = p + (h−l) ; s2 = p − (h−l) ; r3 = h + 2(p−l) ; s3 = l − 2(h−p)

## Warmup

1 UTC-day boundary (every output NaN until the second
UTC day opens)

## Anchors

system

## Signature

```ts
function pivotsStandard(slotId: string, opts?: PivotsStandardOpts): PivotsStandardResult;
```

_The leading `slotId: string` parameter is injected by the chartlang compiler at every callsite — script authors call `ta.<id>(...)` without it._

## Parameters

| Name | Type | Default | Description |
|---|---|---|---|
| `slotId` | `string` | — | — |
| `opts` | `PivotsStandardOpts` | (optional) | — |

## Returns

`PivotsStandardResult`

## Example

```ts
// import { ta } from "@invinite-org/chartlang-core";
    // const p = ta.pivotsStandard();
    // plot(p.pp);
    // plot(p.r1);
    // plot(p.s1);
```

## See also

- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/runtime/src/ta/pivotsStandard.ts)
