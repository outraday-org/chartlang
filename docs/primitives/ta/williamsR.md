# `ta.williamsR`

> **Stability:** stable
> **Since:** 0.2

Williams %R — momentum oscillator bounded in `[-100, 0]`. Sources
from `bar.high` / `bar.low` / `bar.close` directly (no `source`
arg — matches Pine). Composes `ta.highest` + `ta.lowest` over the
trailing `length` bars; `hh === ll` (flat-line window) emits `NaN`.

The registry records `yDomain: { kind: "fixed", min: -100, max: 0 }`
via `TA_REGISTRY_METADATA`.

## Formula

hh = highest(bar.high, length) ;
ll = lowest(bar.low, length) ;
wr = -100 · (hh − bar.close) / (hh − ll) ; NaN if hh === ll

## Warmup

length − 1

## Signature

```ts
function williamsR(slotId: string, length: number, _opts?: WilliamsROpts): Series<number>;
```

_The leading `slotId: string` parameter is injected by the chartlang compiler at every callsite — script authors call `ta.<id>(...)` without it._

## Parameters

| Name | Type | Default | Description |
|---|---|---|---|
| `slotId` | `string` | — | — |
| `length` | `number` | — | — |
| `_opts` | `WilliamsROpts` | (optional) | — |

## Returns

`Series<number>`

## Example

```ts
// import { ta } from "@invinite-org/chartlang-runtime";
    // const w = ta.williamsR("slot", 14);
    // plot(w);
```

## See also

- [Source on GitHub](https://github.com/outraday-org/chartlang/blob/main/packages/runtime/src/ta/williamsR.ts)
