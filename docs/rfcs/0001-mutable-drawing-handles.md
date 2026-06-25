# RFC 0001 — Mutable drawing handles

- **Status:** Proposed (decision-ready)
- **Author:** chartlang maintainers
- **Created:** 2026-06-25
- **Scope:** language surface (`draw.*`), runtime slot lifecycle, adapter
  contract, Pine converter, skills, docs, examples, react-starter
- **Supersedes / informs:** `tasks/future/drawing-handles/`,
  `tasks/future/state-array/`, `tasks/future/map-collection/`,
  `tasks/old/plot-draw-z-order/`

> All code sketches in this RFC are **non-normative illustration**. No code
> ships with this document; it changes no package, type, or test.

---

## 0. Decision summary (read this first)

**The premise that motivated this folder is partly stale.** The folder
`README.md` states "No addressable cross-bar drawing object exists." That was
true at Phase 1. It is **not** true today: the Phase-3 drawing-handle substrate
already shipped end-to-end.

- Every `draw.<kind>(...)` already returns a **mutable, cross-bar
  `DrawingHandle`** with `update(patch)` and `remove()`
  (`packages/core/src/draw/handle.ts:31-35`, `packages/core/src/draw/draw.ts:61-107`).
- The runtime already persists a `DrawingSlot` keyed `slotId#subId` across bars,
  emitting `op:"create"` once and `op:"update"`/`op:"remove"` thereafter
  (`packages/runtime/src/emit/draw/handle.ts:120-193`).
- The **wire is already a mutation protocol**: `DrawingEmission` carries
  `handleId` + `op:"create"|"update"|"remove"` + full merged state, with
  per-`(handleId, bar)` last-write-wins dedup
  (`packages/adapter-kit/src/types.ts:736-764`,
  `packages/runtime/src/emit/draw/pushDrawing.ts:105-113`).
- **All six adapters already consume it**: each keeps a per-`handleId` drawing
  map and deletes on `op:"remove"`
  (canvas2d `examples/canvas2d-adapter/src/createCanvas2dAdapter.ts:1091-1093`;
  the other five share the geometry layer per
  `packages/adapter-kit/CLAUDE.md`).
- The **Pine converter already lowers** `line.new`/`set_*`/`delete`/`max_*_count`
  to this model via a static Camp A/B/C analysis
  (`packages/pine-converter/src/semantic/drawingCamp.ts`,
  `packages/pine-converter/src/mapping/drawingKinds.ts:96-113`), and it is taught
  in `skills/chartlang-coding/references/translating-from-pine.md:9-125`.

So this is **not** an architectural fork. The adapter contract needs **zero**
change. What is missing is narrow and concrete:

1. **Snapshot/restore + tick discipline for `drawingSlots`** — the one real
   correctness gap (§7).
2. **Identity ergonomics** — today identity is the *source callsite*
   (`slotId#subId`); Pine's `line.new()` mints *allocation-identity* objects you
   can store in a variable. The converter bridges this statically (Camp A/B/C);
   authors writing chartlang directly cannot yet store a handle that outlives its
   callsite (§3, §5).
3. **Typed convenience setters** — only a generic `update(patch)` exists; Pine
   has `set_xy1` / `set_text` (§5).
4. **A bounded, auto-evicting object set** for the "last N pivots" budget,
   reusing the just-landed `state.array` two-ring discipline (§5).

**Recommendation: Option C (Hybrid).** Keep the shipped callsite-anchored
declarative `DrawingHandle` as the default and the canonical converter target.
Add an **opt-in** `draw.<kind>.new()` minting surface plus a bounded
`state.drawings(...)` object-set helper, both built as a *thin layer over the
existing substrate* — not a parallel object system. Close the four gaps above.
**v1 ships `line` + `label`; defer `box` / `polyline` / `table`.** The wire,
the `DrawingEmission` shape, and all six adapters are untouched (verification
only). The only *new code* lands in core + runtime + converter + skills/docs;
adapters, conformance, and react-starter are **verification-only** under this
choice.

The maintainer's decision in §13 is therefore narrow: **approve closing the four
gaps with an opt-in handle layer, or keep the declarative-only status quo and
let the converter's Camp A/B/C remain the only handle-shaped API.**

---

## 1. Problem statement & motivation

`draw.*` is *declarative-per-bar in ergonomics* but *stateful-per-handle on the
wire*. A script re-issues a drawing from its callsite each `compute` step; the
runtime maps that callsite to a stable `handleId` and emits `op:"update"` so the
adapter mutates the existing object rather than re-creating it. This already
serves the common cases:

- **Anchored / extending line** — `examples/scripts/anchored-line.chart.ts`
  pins a line's start to the first bar's `{time, price}` (captured in
  `state.float` slots) while the end tracks `bar.point(0, bar.close)`,
  re-emitted each bar from one callsite. This *works today* (commit `6f7fc72`).
- **Trailing stop line** — same pattern: one callsite, `update` the price each
  bar.
- **Live HUD label** — one `draw.text(...)` callsite, new text each bar.

What the callsite-anchored model serves **awkwardly or not at all**:

- **"Last N pivots with a fixed budget."** As each pivot forms, create a new
  line; keep the most recent N; auto-remove the oldest. Today this is a `for`
  loop over a `state.array` ring of geometry, re-emitting `draw.line(...)` per
  retained pivot with loop-stable sub-ids (`nextSubId`,
  `packages/runtime/src/emit/draw/subIdAllocator.ts:24-46`). It works (it is
  exactly the converter's Camp B output) but the author must (a) maintain the
  ring by hand and (b) detect eviction to call `.remove()` — there is no
  auto-eviction.
- **A handle that outlives its callsite.** Pine's
  `var line lvl = na … lvl := line.new(...)` stores the handle in a variable and
  mutates it later from arbitrary code. chartlang cannot store a handle across
  bars: `state.float/int/bool/string/series/array` hold `JsonValue` /
  `number` only (`packages/core/src/state/state.ts`,
  `packages/core/CLAUDE.md`), and a `DrawingHandle` is an opaque object, not a
  number/string. The only cross-bar persistence is re-deriving the handle from
  its callsite.

The motivating gap, then, is **dynamic object sets with a budget** and
**handle-as-stored-value ergonomics** — not the basic "create once, mutate"
loop, which already ships.

---

## 2. Survey of the Pine model

Pine v6's drawing objects (`line`, `label`, `box`, `polyline`, plus `table`,
`linefill`):

- **Constructor** `line.new(x1, y1, x2, y2, …)` mints a *new* object with
  **allocation identity** — the returned `line` is a first-class value storable
  in `var` and `array<line>`. Two `line.new` calls in the same bar are two
  distinct objects.
- **Setters** mutate by reference from anywhere: `line.set_xy1`, `set_xy2`,
  `set_x1`, `set_color`, `set_width`, `set_style`, `set_extend`;
  `label.set_text`, `set_xy`, `set_color`, `set_textcolor`, `set_size`,
  `set_style`; `box.set_top/bottom/left/right`, `set_bgcolor`, `set_border_*`.
- **Deletion** `line.delete(h)` frees the object.
- **Budget** the `indicator(max_lines_count = K, max_labels_count = …,
  max_boxes_count = …, max_polylines_count = …)` header bounds each family;
  when exceeded, Pine **auto-deletes the oldest** object of that family.
- **Implicit GC** objects with no live reference are eventually collected; in
  practice scripts rely on the `max_*_count` ring.

chartlang's existing mapping (already in code, `drawingKinds.ts:30-113`):

| Pine | chartlang `DrawingKind` | Setters mapped |
|---|---|---|
| `line.new` | `line` | `set_xy1`→`anchors[0]`, `set_xy2`→`anchors[1]`, `set_x1/y1/x2/y2`, `set_color/width/style/extend` |
| `box.new` | `rectangle` | `set_top/bottom/left/right`, `set_bgcolor`, `set_border_*` |
| `label.new` | `text` (or `marker` by style) | `set_xy`→`anchors[0]`, `set_text`, `set_color`, `set_textcolor`, `set_size` |
| `polyline.new` | `polyline` | array-anchor build |
| `table.new` | `table` | declarative (HUD overlay) |

**What to match:** the constructor + setter + delete + per-family budget triad.
**What to deliberately trim:** allocation-identity GC (chartlang is
deterministic and snapshot-bound, so a bounded explicit budget replaces implicit
GC); `polyline`/`box`/`table` setters (defer to v2 — see §4).

---

## 3. Options analysis

Three options, each evaluated against the seven axes the task requires.
"Already ships" annotations cite the live substrate.

### Option A — Allocation-identity object store (`draw.line.new()` returns a stored handle)

A new runtime object store mints objects with allocation identity (a monotonic
id), independent of callsite. Handles are storable in a new `state` cell;
`h.setXY1(...)` / `h.delete()` mutate by reference. Closest Pine parity.

### Option B — Declarative reconciler (author re-issues with a stable id each bar)

Author re-issues drawings each bar from a callsite with a stable
author-or-loop-supplied id; the runtime diffs against the last bar and emits
create/update/remove. **This is exactly today's model** — identity is
`slotId#subId`, the reconciler is `createDrawingHandle` + `pushDrawing`'s
per-`(handleId, bar)` dedup, and the loop-stable sub-id covers fixed-N sets.

### Option C — Hybrid (recommended)

Keep B as the default and the converter target. Add a *thin* opt-in handle
layer that gives the **ergonomics** of A (`draw.line.new()`, typed setters,
handle-in-state, bounded auto-eviction) **without** a parallel object system:
the "new" handle is the same `DrawingSlot` + `handleId` machinery, with
identity minted from a per-callsite allocation counter instead of a loop index,
and stored in a bounded `state.drawings(...)` set that reuses `state.array`'s
two-ring eviction.

### Comparison

| Axis | A — Object store | B — Reconciler (status quo) | **C — Hybrid (rec.)** |
|---|---|---|---|
| **Ergonomics** | Best (full Pine parity) | Poor for dynamic sets; good for fixed callsites | Good — opt-in `.new()` + setters for the dynamic cases; declarative stays for the simple ones |
| **Adapter-contract impact** | Possibly new "allocate" message unless mapped onto `handleId` | **Zero** — already shipped | **Zero** — reuses `handleId`/`op`/full-state (`types.ts:736-764`) |
| **Snapshot/restore + tick-replay** | New object store must be made snapshot-clean from scratch | `drawingSlots` not snapshotted, single-buffer (gap, §7) | Same gap, but **scoped**: only the opt-in set needs the two-ring + snapshot treatment `state.array` already has |
| **Conformance cost** | New scenarios for allocation semantics | None new | One new scenario for `.new()` + eviction; existing drawing scenarios unchanged |
| **Converter feasibility** | Camp A/B/C could target `.new()` directly | Camp A/B/C already target B and ship | Camp B can *optionally* target the bounded set; Camp A keeps targeting declarative — **no converter regression** (§9) |
| **Z-order** | Same `z` sourcing question | `z` already threaded (`handle.ts:splitZ`) | Identical to B — `z` rides `state.style`→top-level (§8) |
| **Net new surface** | Largest (parallel identity + store + setters + snapshot + converter retarget) | None | Smallest delta that closes the four gaps |

**Why not A:** it duplicates a substrate that already exists and works. A
separate allocation-identity store would fork object lifetime away from
`drawingSlots`, double the snapshot surface, and tempt a wire change. The only
thing A buys over C is implicit-GC semantics, which chartlang deliberately
rejects (determinism + bounded snapshots).

**Why not B alone:** B is the floor, not the ceiling. It cannot express
handle-in-state or auto-evicting budgets without hand-rolled ring bookkeeping,
so the "last N pivots" idiom stays a footgun and the converter's Camp B output
stays clunky for authors to read or hand-write.

---

## 4. Recommendation

Adopt **Option C (Hybrid)**.

- **Declarative `draw.*` stays the default and is unchanged.** The shipped
  `DrawingHandle` (`update`/`remove`) remains; this RFC does not deprecate it.
- **Add an opt-in handle layer** for the persist-and-mutate / dynamic-budget
  cases only:
  1. `draw.<kind>.new(...)` — mints an allocation-identity handle (callsite +
     allocation counter), returning a **typed** handle (`MutableLineHandle`,
     `MutableLabelHandle`) with Pine-shaped setters plus the generic `update`.
  2. `state.drawings<Kind>(maxCount)` — a bounded, auto-evicting handle set that
     reuses `state.array`'s two-ring committed/tentative discipline; pushing past
     `maxCount` emits `op:"remove"` for the evicted handle (the `max_*_count`
     analogue).
- **v1 scope:** `line` + `label` only (the two highest-demand Pine families and
  the converter's most common Camp A/B sites).
- **Deferred to a v2 follow-up:** `box` / `polyline` setters and storage;
  `table` (stays declarative HUD — it carries no `z` and is corner-anchored,
  `packages/core/CLAUDE.md`); `linefill`-style cross-handle fills;
  `state.tick.drawings` (varip handles).

Rationale: this delivers Pine parity for the cases authors actually hit, reuses
every already-shipped layer, and confines new correctness work to one bounded
collection type whose pattern (`state.array`) is already proven.

---

## 5. Proposed API sketch (recommended option only)

> Non-normative. Types illustrate intent; exact names are an impl-task decision.

### Typed handles (extend the existing `DrawingHandle`)

```ts
// core/src/draw/handle.ts — additive; today's DrawingHandle stays as the base.
type MutableLineHandle = DrawingHandle & {
    setXY1(p: WorldPoint): void;   // → update({ anchors: [p, prevAnchors[1]] })
    setXY2(p: WorldPoint): void;
    setColor(c: Color): void;      // → update({ style: { color: c } })
    setWidth(w: number): void;
    setExtend(e: LineExtend): void;
};

type MutableLabelHandle = DrawingHandle & {
    setXY(p: WorldPoint): void;
    setText(s: string): void;
    setColor(c: Color): void;
    setTextColor(c: Color): void;
    setSize(n: number): void;
};
```

The setters are sugar over the already-shipped `update(patch)` merge
(`packages/runtime/src/emit/draw/handle.ts:159-177`) — **no new wire path**.

### The `.new()` minting surface

```ts
// core/src/draw/draw.ts — additive members on the existing DrawNamespace.
interface DrawNamespace {
    line: ((a: WorldPoint, b: WorldPoint, opts?: LineDrawStyle) => DrawingHandle) & {
        new(a: WorldPoint, b: WorldPoint, opts?: LineDrawStyle): MutableLineHandle;
    };
    text: ((anchor: WorldPoint, body: string, opts?: TextOpts) => DrawingHandle) & {
        new(anchor: WorldPoint, body: string, opts?: TextOpts): MutableLabelHandle;
    };
    // …existing flat methods unchanged.
}
```

`draw.line.new(...)` differs from `draw.line(...)` only in **identity**: the
runtime mints `handleId = slotId#alloc<N>` from a per-callsite *allocation*
counter (not the per-bar loop sub-id), so each `.new()` call is a distinct
persistent object even at the same callsite. Implementation reuses
`createDrawingHandle` verbatim, swapping the sub-id source.

### Bounded object set (the `max_*_count` analogue)

```ts
// core/src/state/state.ts — additive state.* member.
interface StateNamespace {
    drawings<H extends DrawingHandle>(maxCount: number): MutableDrawingSet<H>;
}

type MutableDrawingSet<H> = {
    add(handle: H): void;   // evicts + h.remove()s the oldest past maxCount
    get(n: number): H;      // 0 = newest
    readonly size: number;
    readonly capacity: number;
    clear(): void;          // remove() all
};
```

`state.drawings(maxCount)` is `state.array`'s two-ring slot
(`packages/runtime/src/state/arrayStateSlot.ts`, see
`packages/runtime/CLAUDE.md` "`state.array` slots") specialised to hold
`handleId`s, not floats. Eviction emits `op:"remove"` for the dropped handle —
the deterministic, snapshot-clean replacement for Pine's implicit GC.
`maxCount` is a required compile-time numeric literal (the `state.array`
bound rule), so the set serializes.

### "Last N pivots" with the recommended API

```ts
const pivots = state.drawings<MutableLineHandle>(50); // max_lines_count = 50
if (pivotFormed) {
    pivots.add(draw.line.new(bar.point(0, pivotHigh), bar.point(5, pivotHigh)));
}
```

Compare today's hand-rolled Camp-B ring — same wire output, far less bookkeeping.

---

## 6. Adapter contract impact

**No wire change. No capability key added. No adapter migration.**

- `DrawingEmission` already carries `handleId` + `op:"create"|"update"|"remove"`
  + full merged state + top-level `z` (`packages/adapter-kit/src/types.ts:736-764`).
  `.new()` handles and `state.drawings` eviction emit the *same* three ops.
- Budgets already exist: `Capabilities.maxDrawingsPerScript` +
  `ScriptManifest.maxDrawings` are enforced per family in `pushDrawing`
  (`packages/runtime/src/emit/draw/pushDrawing.ts:84-103`,
  `packages/adapter-kit/src/types.ts:359-371`). `state.drawings(maxCount)` is a
  *script-author* cap layered above the adapter cap — the runtime already takes
  `min(scriptCap, adapterCap)` (`pushDrawing.ts:11-15`). The author cap simply
  drives eviction *before* the adapter cap drops with `drawing-budget-exceeded`.
- Adapters already keep a per-`handleId` drawing map and delete on `op:"remove"`
  (canvas2d `createCanvas2dAdapter.ts:1091-1093`; the five library adapters share
  the `decomposeDrawing` geometry layer, `packages/adapter-kit/CLAUDE.md`).

The **only** capability consideration: an adapter that advertises a family in
`Capabilities.drawings` but a `maxDrawingsPerScript` of `0` already silently
no-ops that family (`pushDrawing.ts:84-98`). `.new()` inherits this gating
unchanged — capability gating stays the source of truth, emit stays a no-op for
unsupported families (the §7.4 silent-no-op contract). **Conclusion: the six
adapters keep working with zero edits; their only obligation is the conformance
re-run (§12).**

---

## 7. Lifecycle & sandbox correctness

This is the **one real correctness gap** and the bulk of the v1 build effort.

### Current state of `drawingSlots` (the gap)

- `DrawingSlot` is **single-buffer**: `{ handleId, kind, state, z, removed }`,
  mutated in place (`packages/runtime/src/runtimeContext.ts:63-69`,
  `handle.ts:148-152`). There is **no committed/tentative two-ring** like
  `state.array` (`packages/runtime/CLAUDE.md` "`state.array` slots") or
  `state.series`.
- `drawingSlots` / `drawingSubIdCounters` / `drawingBucketCounters` are
  constructed once per mount and cleared **only on dispose**
  (`packages/runtime/src/createScriptRunner.ts:349-353`,
  `packages/runtime/src/execution/dispose.ts:50`). They are **not** reset on
  tick (`resetBarEmissions` clears only emission queues) and are **absent from
  `StateSnapshot`** (`packages/core/src/state/snapshot.ts` carries only
  per-runner `slots: JsonValue`; no drawing section).

**Why today's declarative path tolerates this:** the callsite re-passes full-ish
state each bar/tick, so `mergeState` is last-write-wins and a replaced head
tick simply overwrites; warm restart re-runs `compute` over history, so
declarative drawings re-emit from scratch. **Why the handle layer breaks it:** a
stored handle mutated by *partial* `set_*` patches that accumulate across ticks
has no rollback — a head-bar-replacing tick would double-apply the prior tick's
patch, and a warm restart would lose the object set entirely.

### Required v1 work (scoped to the opt-in layer)

1. **Two-ring tick discipline** for `.new()`/`state.drawings` slots, mirroring
   `state.array`: `onBarClose` copies tentative→committed,
   `onBarTick` copies committed→tentative
   (`packages/runtime/CLAUDE.md` "`state.array` slots", `arrayStateSlot.ts`).
2. **Snapshot/restore** of the opt-in drawing set under a new key suffix
   (`:drawings`, parallel to `:array` / `:series` / `:state`), routed in
   `restoreRunnerSlots` exactly like arrays; a script-edited `maxCount`
   (ring-shape mismatch) or malformed entry degrades to a fresh slot without
   throwing (the `arrayPersistence.ts` precedent).
3. **Structural-clone safety** — the stored value is a `handleId` *string* plus
   the slot's `DrawingState` (numbers/strings/booleans only); no functions, no
   live handle object. This mirrors `state.array`'s "bounded so it serializes"
   and the snapshot's `JsonValue` round-trip constraint
   (`packages/core/src/state/snapshot.ts`, `packages/core/CLAUDE.md`
   "`state.array`"). The handle *object* returned to the script is transient and
   re-minted on restore from the persisted `handleId` + state — it never crosses
   the worker `postMessage` boundary. (Today's declarative `drawingSlots` map is
   `DrawingState`-valued and already JSON-clean except for not being persisted.)

The plain declarative `drawingSlots` may stay single-buffer and unsnapshotted in
v1 (it is correct under re-issue); only the opt-in set gains the two-ring +
snapshot treatment. Promoting declarative `drawingSlots` to snapshotted is a
*separate, optional* hardening noted as an open question (§13).

---

## 8. Z-order interaction

No new mechanism. `z` is already a presentation-only render-order key threaded
through the handle path:

- The `draw.*` opts bag carries `z` via core's `ZOrdered` mixin
  (`packages/core/src/draw/drawingStyle.ts`, `packages/core/CLAUDE.md`).
- `createDrawingHandle`'s `splitZ` lifts `z` out of `state.style` into the
  top-level `DrawingEmission.z`, persists it on the slot, and an
  `update`/`set_*` that re-specifies a non-zero `z` overrides while an
  omitted/`0` `z` retains the slot's last value
  (`packages/runtime/src/emit/draw/handle.ts:40-52, 144-176`).
- Adapters compute the global order from `(z ?? 0, groupBand, declarationSeq)`
  via the shared comparator `sortByRenderOrder`
  (`packages/adapter-kit/src/geometry/renderOrder.ts`; `RENDER_BAND =
  { series:0, glyph:1, hline:2, drawing:3 }`,
  `packages/adapter-kit/CLAUDE.md`).

A long-lived `.new()` object **sources its `z` exactly like a declarative
handle**: from the opts bag at `.new()` time, overridable by a later
`setColor`-style setter that re-specifies `z`, or by a dedicated `setZ(n)`.
Its `declarationSeq` is its `op:"create"` order — stable across bars because the
slot persists. **Nothing in z-order changes.**

---

## 9. Converter feasibility

**The converter already maps the entire Pine drawing surface** — this RFC only
asks whether Camp B should *optionally* retarget the new bounded set.

Current state (`packages/pine-converter/src/semantic/drawingCamp.ts`,
`mapping/drawingKinds.ts:96-113`, taught in
`skills/chartlang-coding/references/translating-from-pine.md:9-125`):

- **Camp A** — a single `var` handle mutated by `set_*` → one declarative
  `draw.<kind>` callsite whose state machine re-emits each bar. Stays as-is.
- **Camp B** — a bounded `array<line>` with `max_*_count`/`array.shift` eviction
  → a loop re-emitting from one callsite with loop-stable sub-ids and a ring of
  geometry. **Under this RFC, Camp B may *optionally* lower to
  `state.drawings(K)` + `draw.line.new()`** — strictly more readable output, the
  same wire. This is a *converter quality* improvement, not a feasibility
  unlock; Camp B already works.
- **Camp C** — unbounded / heuristically-unanalyzable lifetimes → reject (the
  `cross-collection` / unbounded diagnostics). Unchanged: chartlang's bounded
  determinism means an unbounded Pine handle set still has no faithful target.

**Feasibility verdict:** trivially feasible — the mapping table and setter
lowering (`set_xy1`→`anchors[0]`, etc., `drawingKinds.ts:30-113`) already exist.
**Diagnostics strategy:** no new diagnostic codes required for v1; if Camp B
retargets `state.drawings`, the existing `max_*_count`→capacity inference
(`drawingCamp.ts:BUCKET_DEFAULT_CAP`, `analyze.ts:419`) feeds the literal
`maxCount`. The converter is **verification-only** in v1 unless the maintainer
opts into the Camp B retarget (then it is a small code change confined to the
transform pass).

---

## 10. Skills surface impact

- **`SKILL.md`** gains a short **"Mutable drawing handles"** subsection
  (sibling to the existing layering/`z` prose at
  `skills/chartlang-coding/SKILL.md:151-160`) covering: declarative `draw.*` is
  the default; `draw.<kind>.new()` + `state.drawings(K)` for dynamic
  budgeted sets; the typed setters; and the rule that `maxCount` is a
  compile-time literal. Folded *into* the `draw.*` narrative, not a new
  top-level skill.
- **Generated `references/primitives.md`** — the generator
  (`scripts/generate-skills-reference.ts`) walks `packages/runtime/src/emit/draw`
  and **already skips `handle.ts`** (`DRAW_SKIP_BASENAMES` includes
  `handle.ts`, line 45-48), emitting one block per `draw.<kind>` from JSDoc.
  Adding `.new()` overloads to the existing per-kind `draw.*` JSDoc means the
  generator picks them up **with no generator change** — the signature it prints
  is whatever the source declares. A dedicated "handles" section would only be
  needed if we want the *setter* methods enumerated separately; recommendation:
  document setters by hand in `SKILL.md` and let the generator emit the
  `.new()` signatures inline. **`skills:generate` / `skills:gate` need no
  generator code change**; they will require a regenerate-and-commit once the
  new JSDoc lands (the gate byte-diffs).
- **`references/translating-from-pine.md`** gains mapping rows making the
  `line.new`/`label.new` + `set_*` + `delete` + `max_*_count` → `draw.*.new()` /
  setters / `.remove()` / `state.drawings(K)` correspondence explicit (it
  currently shows the Camp-A/B *declarative* lowering at lines 43-125; the new
  rows show the *handle* lowering as the readable alternative).

---

## 11. react-starter surface impact

**The seam is unaffected; the feature flows through the compiler automatically.**

- The library-agnostic seam (`apps/react-starter/src/lib/chart/activeAdapter.ts`
  + `seamVariants.ts`) wraps `createActiveAdapter` / `runActiveLoop` — it does
  not touch the `draw.*` surface, the compiler output, or the emission wire.
  Because v1 adds **no wire change** (§6), a script using `draw.line.new()` /
  `state.drawings` compiles to a bundle that emits the same
  `op:"create"|"update"|"remove"` `DrawingEmission`s every existing adapter
  already renders.
- **Verification, not migration:** add a `tests/compile.spec.ts` case compiling a
  `draw.line.new()` + `state.drawings` script (asserting it compiles and emits),
  and confirm the existing `tests/adapter-matrix.spec.ts` (which re-builds all
  six seam variants and asserts byte-identity) stays green. No change to any of
  the six seam variants.

If a future v2 ever introduced an *incremental mutation wire* (it will not under
this recommendation), the seam and host would need per-variant migration — this
RFC explicitly avoids that by reusing the full-state `op` protocol.

---

## 12. Implementation plan outline & risks

> Authored as a separate `tasks/future/drawing-handles-impl/` folder **only
> after this RFC is accepted.** Below is the anticipated split across **all six
> surfaces**, with the code-vs-verification call under the recommended wire.

| Surface | v1 work | Code or verify? | Rough size |
|---|---|---|---|
| **core** | `MutableLineHandle`/`MutableLabelHandle` types; `.new()` overloads on `DrawNamespace`; `state.drawings` hole + `MutableDrawingSet` type; `STATEFUL_PRIMITIVES` entry; `program.ts` shim mirror | **Code** | M |
| **runtime** | `.new()` allocation-id sub-id source (reuse `createDrawingHandle`); typed setters over `update`; `state.drawings` two-ring slot (clone `arrayStateSlot.ts`); snapshot key `:drawings` + restore routing; tick discipline; eviction→`op:"remove"` | **Code** (the bulk; §7) | L |
| **adapter-kit / adapters** | — | **Verify** (wire unchanged; conformance re-run) | XS |
| **conformance** | One scenario: `.new()` create/update/remove + eviction op stream; golden bar-by-bar | **Code** (one scenario) | S |
| **converter** | Optional Camp B retarget to `state.drawings`; mapping rows | **Verify** (or small **code** if retarget opted-in) | XS–S |
| **docs / skills** | `SKILL.md` subsection; `translating-from-pine.md` rows; regenerate `primitives.md`; JSDoc (`@since`, `@stable`, `@example` on every new export; `@formula`/`@anchors` on `draw.*.new`) | **Code** (docs) | S |
| **examples / demos** | A "last N pivots" demo script in `apps/site` `DEMO_SCRIPTS` (auto-flows to `docs/examples` via `examples:generate`) | **Code** (one script) | S |

**Top risks:**

1. **Snapshot correctness (highest).** The two-ring + restore for the opt-in set
   must exactly mirror `state.array`, or warm restart / tick-replay diverges. Mitigation:
   clone `arrayStateSlot.ts` + `arrayPersistence.ts` patterns wholesale;
   property-test tick-replay determinism.
2. **Identity collisions.** The allocation-id sub-id source must not collide with
   the loop sub-id allocator (`subIdAllocator.ts`). Mitigation: distinct id
   namespace (`#alloc<N>` vs `#<loopIndex>`), property-tested for uniqueness.
3. **Conformance surface growth.** Each new family multiplies scenarios.
   Mitigation: v1 caps at `line` + `label`; defer the rest.
4. **Adapter-contract *non*-break is load-bearing** — the whole "zero migration"
   claim rests on the wire staying full-state `op`. Any impl tempted to add an
   incremental message invalidates §6/§11; that temptation must be rejected at
   review.

**Non-goals for v1:** `box`/`polyline`/`table` handles; `linefill` cross-handle
fills; `state.tick.drawings`; promoting declarative `drawingSlots` to
snapshotted.

---

## 13. Decision

**Proposal:** Adopt Option C (Hybrid). Ship an opt-in `draw.line.new()` /
`draw.text.new()` handle layer with typed setters and a bounded
`state.drawings(maxCount)` set, reusing the shipped `DrawingHandle` substrate and
`state.array`'s two-ring snapshot discipline. **No wire change, no adapter
migration.** v1 = `line` + `label`; defer `box`/`polyline`/`table`.

- [ ] **Accept** — author `tasks/future/drawing-handles-impl/` per §12.
- [ ] **Accept with revisions** — note them below.
- [ ] **Reject** — keep declarative-only; the converter's Camp A/B/C stays the
      only handle-shaped path.

### Open questions for the maintainer

1. **Stale-premise confirmation.** This RFC contradicts the folder README's "No
   addressable cross-bar drawing object exists." Confirm the README should be
   updated to reflect the shipped Phase-3 handle, and that the feature is
   "close the four gaps," not "build from scratch."
2. **`.new()` vs reusing `draw.*` + handle-in-state.** Is a distinct `.new()`
   member worth the surface, or would the maintainer prefer *only*
   `state.drawings(K).add(draw.line(...))` (no `.new()`), accepting that two
   `draw.line(...)` at one callsite in one bar would then collide on
   `slotId#subId`? (Recommendation keeps `.new()` precisely to avoid that
   collision.)
3. **Declarative `drawingSlots` hardening.** Should v1 *also* snapshot the plain
   declarative `drawingSlots` (so a warm restart need not replay all history to
   rebuild drawings), or is replay-rebuild acceptable to keep v1 small?
   (Recommendation: defer.)
4. **Converter Camp B retarget.** Opt into lowering Camp B to
   `state.drawings(K)` in v1 (nicer output, small converter change), or keep
   Camp B's current loop lowering and treat the converter as verification-only?
5. **Budget interaction.** Confirm `state.drawings(maxCount)` author cap should
   drive eviction *before* the adapter `maxDrawingsPerScript` cap fires
   `drawing-budget-exceeded` (the recommended, Pine-like behaviour).
