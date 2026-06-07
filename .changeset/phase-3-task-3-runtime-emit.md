---
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-conformance": minor
---

Phase-3 Task 3 — runtime `draw.*` emission infrastructure.

**Runtime** — new `packages/runtime/src/emit/draw/` subtree:

- `createDrawingHandle(slotId, subId, kind, initialState)` allocates
  a per-handle slot in `ctx.drawingSlots` keyed by `slotId#subId`,
  emits the first `op: "create"`, and returns a `DrawingHandle`
  whose `update(patch)` re-emits the FULL merged state under
  `op: "update"` (PLAN.md §10.3 full-state semantic) and whose
  `remove()` emits one final `op: "remove"` and flags the slot
  `removed: true`. Subsequent `update` / `remove` calls on a removed
  handle no-op. Cross-bar re-entry at the same `slotId#subId`
  resurrects the slot and emits `op: "update"`.
- `pushDrawing(ctx, e)` enforces capability gating
  (`unsupported-drawing-kind`), wire-shape validation
  (`malformed-emission`), per-bucket budget on
  `op: "create"`/`"remove"` against
  `min(scriptMaxDrawings, adapter.maxDrawingsPerScript)`
  (`drawing-budget-exceeded`, clamped at zero on remove), and
  per-bar `(handleId, bar)` dedup (last-write-wins).
- `nextSubId(ctx, slotId)` / `resetSubIdCounters(ctx)` —
  per-callsite per-bar counter; reset at the top of every
  `onBarClose` / `onBarTick` so iteration `i` at the same callsite
  yields the same `slotId#i` across bars.
- `draw` re-exports core's throwing-stub Proxy verbatim. Per-kind
  Tasks 5–18 swap real impls into this seam (mirroring how the
  Phase-2 `ta` re-export switched to `TA_REGISTRY`).

`RuntimeContext` widens with four new fields: `drawingSlots`,
`drawingSubIdCounters`, `drawingBucketCounters`, `scriptMaxDrawings`.
`createScriptRunner` initialises them and reads
`compiled.manifest.maxDrawings` for the script-side cap. `dispose`
clears the slots and resets counters.

`buildComputeContext` now injects `draw` into the `ComputeContext`
the runner hands the compiled script.

**Core** — `ComputeContext.draw: DrawNamespace` field added (the
script-facing surface). Phase-1/-2 scripts that do not consume
`draw` keep compiling unchanged; new scripts pick up the namespace
through the same destructure pattern as `ta` / `plot` / `hline` /
`alert`.

**Conformance** — `ScenarioAssertion` grows a sixth `drawing-hash`
variant. `BufferedRun.drawings` carries the per-bar drained
emissions; `hashDrawingSeries(drawings, handleId?)` hashes
JSON-stringified `{ handleId, kind, op, state, bar }` tuples in
emission order. Failure messages mirror `plot-hash`:
`drawing-hash[<label>]: expected <pinned>, actual <computed>
(<N> emissions)` — copy `actual` to re-pin.

No behaviour change for Phase-1/-2 scenarios — the runtime still
emits no drawings until the per-kind ports (Tasks 5–18) land.
