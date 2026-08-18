---
"@invinite-org/chartlang-adapter-kit": minor
---

`orders`: a first-class emission channel, and a REQUIRED `Capabilities.orders`

`RunnerEmissions` gains `orders: ReadonlyArray<OrderEmission>` — the third
additive channel after Phase 5's `alertConditions` + `logs`, not a new
mechanism. It sits after `alertConditions` and before `logs`, which is the
normative queue position `docs/spec/semantics.md` states; the type, the spec
roster and the conformance buffer are read as one list.

`OrderEmission` is `{ kind, slotId, action, qty, label, bar, time, meta,
dedupeKey }`, every field required. A brand-new type has no back-compat tail to
protect, and the retrofit-optional `alertConditions?` beside it is the
counter-example — it seeded `?? []` fallbacks across the codebase for a state
that could not occur. `qty` is `number | null`, where `null` is the distinct
"author gave none" state and a present value is a finite magnitude `> 0`.
`OrderOpts.marker` is deliberately absent from the wire: it is render-side only,
and the channel records the intent, not how it was drawn.

**The channel is APPEND-ONLY.** Unlike plots and alerts (which collapse per
`(slotId, bar)`, last-write-wins) it preserves append order, matching
`alertConditions` and `logs`. An order is an *event* the runtime's nominal
position folds, so a dropped duplicate would leave the emitted stream and the
reported position disagreeing. Hosts that dispatch asynchronously use
`dedupeKey` for idempotency, exactly as they already do for `AlertEmission`.

**BREAKING for hand-written capability bags.** `Capabilities.orders: boolean`
is a REQUIRED key, so any `Capabilities` literal outside this workspace stops
compiling until it declares one. That is the intended upgrade: an adapter has to
answer the question. `capabilities.orders(enabled)` builds the fragment.
Declaring `false` is a supported posture — a headless server-side evaluator
ignores this channel exactly as it already ignores drawings — and it costs
nothing to render `true`, because order markers arrive as ordinary `arrow` /
`label` plot emissions. `false` drops the order, emits no markers, and yields
one new `unsupported-orders` diagnostic **per slot per mount** (one per order per
bar would turn a 10 000-bar backfill into a denial of service on the diagnostic
channel).

Also fixes a pre-existing validator bug: `tz-dst-unsupported` was in the
`DiagnosticCode` union but missing from `validateEmission`'s accepted set, so the
one validator that exists to accept it rejected it. The hand-listed array is
replaced by an exhaustive `Readonly<Record<DiagnosticCode, true>>` presence map —
a code in the union but absent here is now a compile error, and a code here the
union does not carry is an excess-property error. `OrderAction` gets the same
shape.
