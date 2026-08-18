---
"@invinite-org/chartlang-runtime": minor
---

Emit the `orders` channel, fold a nominal position, and auto-render its markers

`order.buy` / `order.sell` / `order.close` are now live primitives. `pushOrder`
validates and **appends** (the `pushAlertCondition` / `pushLog` shape, not
`pushAlert`'s `(slotId, bar)` last-write-wins) and every queue-lifecycle site
carries the new array, including `onHistory`'s accumulator — the easiest one to
miss, and the one whose omission would report only the last bar's orders after a
1000-bar backfill.

`order.position()` reads a **nominal** position folded at one seam, the tail of
`runComputeBody`, per runner — so a sibling's reported position matches the
stream it actually forwards. A tick emits its intent but does not fold (ticks are
replaced, and a folding tick would double-apply on re-tick); a `runtime.error()`
halt and a dep error discard the bar's orders *and* its pending fold together, so
the position can never apply an intent the wire never carried. Absent `qty` is
one unit, `close` always flattens fully, a partial reduce keeps `avgPrice` and
`entryBar` (only added units move a VWAP), and a warmup `NaN` close stores
`avgPrice: null` rather than poisoning snapshot JSON-cleanliness.

**Entry / exit markers render with zero adapter code.** An accepted order also
lowers to ordinary `arrow` + `label` plot emissions on synthetic
`${slotId}#marker` / `${slotId}#label` slots, so every existing adapter draws
them. Per-call `marker: false` opts out. The markers ride the plot queue and
therefore inherit its last-write-wins collapse while the `orders` channel keeps
every event — two dedup policies on one event, on purpose.

`RunnerSnapshot.orderPosition` is optional and **omitted while flat**, so every
pre-`orders` snapshot stays byte-identical and the version stays `2` with no
migration. A dep DROPS orders (a data dependency must not trade through its
consumer); a sibling FORWARDS them with the `export:<name>/` slot prefix and an
**untouched `dedupeKey`**, which embeds the original slot id and would break host
idempotency across a remount if rewritten.

**Two changes to surfaces that predate this feature, worth reading even if you
never call `order.*`:**

- **`AlertEmission.meta` is now DEEP-FROZEN.** There were two divergent private
  `meta` snapshot implementations — `alert` deep-cloned without freezing, and
  `logEmission` froze but passed non-plain objects by reference. They are now one
  helper (`emit/snapshotMeta.ts`) that clones *and* freezes every level, shared
  by `alert`, `runtime.log.*` and `order.*`. Wire-neutral (the conformance suite
  matches unchanged across all six adapters), but a consumer that MUTATES
  `alert.meta` after receiving it now throws in strict mode. Copy before
  mutating.
- **New root exports `ORDER_MARKER_SLOT_SUFFIX` (`"#marker"`) and
  `ORDER_LABEL_SLOT_SUFFIX` (`"#label"`).** They already existed inside
  `emit/`; lifting them to the barrel lets a consumer pinning or filtering an
  order's courtesy plots compose `${slotId}${SUFFIX}` from a constant instead of
  re-spelling the literal at a second site. New exports only.
