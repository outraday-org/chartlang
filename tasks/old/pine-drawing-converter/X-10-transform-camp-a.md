# Task 10 — Transform: Camp A drawings (single-handle, mutated each bar)

> **Status: TODO**

## Goal

Convert the most common Pine drawing idiom — a single `var line` /
`var label` / `var box` handle created once, mutated on subsequent
bars, optionally deleted — into chartlang's mutable `DrawingHandle`
model wrapped in a converter-owned module-level handle closure. This task handles the bulk of
real-world indicator drawings and is the foundation Tasks 11–14 build
on (Camp B reuses Camp A's handle-creation pattern in a ring; tables
and polylines reuse Camp A's setter-fold logic).

## Prerequisites

Task 9 (input transform — needed because Camp A drawing args often
reference inputs).

## Current Behavior

The semantic analyzer (Task 5) classifies these sites as
`DrawingCamp.kind === "camp-a"`. The scaffold's `computeBody` does not
yet contain any drawing logic.

## Desired Behavior

A package-internal `transformCampA(site: DrawingCallSite, analysis:
SemanticResult, scaffold: ScriptScaffold, diagnostics:
DiagnosticCollector): void` API in `src/transform/campA.ts` mutates
the scaffold to:

1. Append a module-scope helper allocation storing the
   `DrawingHandle | null` sentinel.
2. Append `ComputeBodyIR` statements that create the drawing once
   (guarded by `barstate.isfirst` or the original `var` initialization
   gate), fold every observed setter mutation into one
   `handle.update({...})` per bar, and emit `handle.remove()` at the
   Pine `*.delete()` call-site.

## Requirements

### 1. Handle-slot synthesis

For each Camp A site whose `handleSymbol` is `var line lvl = na`:

```ts
// chartlang IR for the module-level helper allocation
HandleSlotIR {
    name: "__lvl_handle",
    drawingKind: "line",
    initial: "null",
}
```

chartlang's `state.*` does not ship a handle-typed slot constructor.
For v1, the converter emits a private TS pattern:

```ts
const __lvl_handle = useDrawingHandleSlot<"line">();
```

where `useDrawingHandleSlot` is a tiny converter-shipped helper module
emitted at the top of every converter-generated script (see §8). The
helper uses a module-level `let` closure, so the handle persists across
all `compute(...)` calls for the mounted script module. Creation is
guarded by `barstate.isfirst` when Pine initializes on first bar, or by
the original creation branch for scripts that lazily create on
`barstate.islast`.

### 2. Handle creation

For `var line lvl = na` followed by:

```pinescript
if barstate.islast
    if na(lvl)
        lvl := line.new(bar_index, close, bar_index, close,
                        color=color.red, width=2)
    line.set_xy1(lvl, bar_index, close * 1.01)
    line.set_xy2(lvl, bar_index + 5, close * 1.01)
```

Emit chartlang TS:

```ts
if (barstate.islast) {
    if (__lvl_handle.current() === null) {
        __lvl_handle.set(draw.line(
            { time: bar.time, price: bar.close },
            { time: bar.time, price: bar.close },
            { color: "#ff0000", lineWidth: 2 }
        ));
    }
    __lvl_handle.current()?.update({
        anchors: [
            { time: bar.time, price: bar.close * 1.01 },
            { time: bar.time + (5 * __BAR_INTERVAL_MS), price: bar.close * 1.01 },
        ],
    });
}
```

The future-bar arithmetic uses the coordinate resolver from Task 7.

### 3. Setter-fold algorithm

Multiple Pine setters targeting the same handle inside the same
straight-line block fold into one `handle.update({...})`:

- `line.set_xy1(lvl, x1, y1)` → patch `{ anchors: [point0, …] }`.
- `line.set_xy2(lvl, x2, y2)` → patch `{ anchors: […, point1] }`.
- `line.set_color(lvl, c)` → patch `{ style: { color: c } }`.
- `line.set_width(lvl, w)` → patch `{ style: { lineWidth: w } }`.
- `line.set_style(lvl, s)` → patch `{ style: { lineStyle: <enum-mapped> } }`.
- `line.set_extend(lvl, e)` → patch `{ style: { extendLeft, extendRight } }`.

Within a single straight-line block, the fold merges all observed
mutations into one `update({...})` call. When mutations span branches
of an `if`/`else if`/`else`, each branch emits its own merged
`update({...})`.

When the chartlang `DrawingState` patch path is `["anchors", N]` and
only one anchor is being patched (e.g. `set_xy1` without a matching
`set_xy2`), the converter reads the current anchor from the slot
(stored alongside the handle as `__lvl_anchors`) and emits the full
two-anchor array. The slot helper carries this anchor mirror.

### 4. `var label`, `var box` rewrites

Same logic as `var line` with mapping table differences from Task 6:

- `var label lbl = na` + `label.new(...)` → `draw.text(...)` (or
  `draw.marker(...)` / `draw.frame(...)` depending on
  `style` enum, per `ENUM_VALUE_MAP`).
- `var box bx = na` + `box.new(...)` → `draw.rectangle(...)`.

### 5. `yloc.abovebar` / `yloc.belowbar` translation

Pine `label.new(..., yloc=yloc.abovebar)` is converted to chartlang
by computing the y at draw time:

```ts
{ time: bar.time, price: bar.high + ((bar.high - bar.low) * 0.05) }
```

The `0.05` padding factor is a tunable; emit it as a top-level
`__YLOC_PAD_FRAC = 0.05` constant. Emit info
`yloc-padding-approximated` once per script using yloc.abovebar/below.

### 6. `*.delete()` translation

Pine `line.delete(lvl)` → chartlang:

```ts
__lvl_handle.current()?.remove();
__lvl_handle.set(null);
```

### 7. `varip` → `state.tick.*` slot

For scalar `varip` declarations, the converter uses
`state.tick.float` / `state.tick.int` instead of `state.float` /
`state.int` — preserving Pine's intra-bar persistence semantics. For
handle-typed `varip`, the module-level handle closure is reused and the
converter emits `varip-approximated` info because Pine's rollback-
escaping handle semantics have no exact chartlang analogue.

### 8. The handle-slot helper module

A small chartlang-side helper emitted by Task 16 at the top of every
generated script:

```ts
// Auto-generated by pine-converter. Do not edit.
type __HandleSlot<K extends string> = {
    current(): DrawingHandle | null;
    set(h: DrawingHandle | null): void;
};
function useDrawingHandleSlot<K extends string>(): __HandleSlot<K> {
    let h: DrawingHandle | null = null;
    return { current: () => h, set: (n) => { h = n; } };
}
```

Why a `let` and not `state.*`? Because chartlang's runtime imports
the compiled script module **once per mount**, so module-level `let`
closures persist across every `compute(...)` call within that mount
(proven by `packages/conformance/src/scenarios/drawInteractiveUpdate.scenario.ts`,
which uses `let handle: DrawingHandle | null = null` at module scope
and mutates it across 10 000 bars). chartlang's `state.*` API only
ships scalar slots (`float`/`int`/`bool`/`string`) — no
handle-typed slot exists, so closures are the lowest-overhead match.
A fresh mount (worker re-start, server restart) re-imports the
module and resets the closure to `null`; the `barstate.isfirst`
gate re-creates the handle on the next bar. State across mounts
(warm restart with replayed history) is out of scope for v1 — emit
`cross-mount-state-not-preserved` info when the script's `var` initial
value is non-`na`, since the converter cannot reproduce a non-na
initial value across cold restarts.

### 9. Diagnostic codes (added this task)

- `yloc-padding-approximated` (info)
- `varip-approximated` (info)
- `cross-mount-state-not-preserved` (info)
- `label-style-not-mapped` (warning) — `label.style_*` value with no
  chartlang analogue (e.g. `style_label_lower_left` with a directional
  callout).
- `setter-fold-cross-branch` (info) — same handle mutated across
  multiple if/else branches; converter emits one update per branch.

### 10. Tests (§16.3)

| File | Purpose |
|------|---------|
| `campA.test.ts` | Per-handle-type fixtures: `var line` + 2 setters, `var label` + 1 setter, `var box` + extend. Each asserts the generated `computeBody` IR shape. |
| `campA.property.test.ts` | Property: every Camp A site produces exactly one `HandleSlotIR` and a paired creation/update block. Property: number of emitted `handle.update` calls ≤ number of observed mutation sites. |
| `setter-fold.test.ts` | Multiple setters on same handle in same block → one merged update. Setters in different `if` branches → one update per branch. |
| `yloc-padding.test.ts` | `yloc=yloc.abovebar` produces `bar.high + (… * 0.05)` arithmetic. |
| `delete.test.ts` | `line.delete(lvl)` emits `remove()` + `set(null)`. |
| `varip-approx.test.ts` | Scalar `varip` produces `state.tick.*`; handle `varip` reuses the handle closure and emits `varip-approximated` info. |

Coverage 100% on `src/transform/campA.ts` and any helpers.

### 11. JSDoc

Every exported function/type carries `@since 0.1`, `@experimental`,
and an `@example`.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/pine-converter/src/transform/campA.ts` | Create | Camp A transform entry. |
| `packages/pine-converter/src/transform/setterFold.ts` | Create | Setter-fold helper (shared with Tasks 11, 13). |
| `packages/pine-converter/src/transform/handleSlot.ts` | Create | IR-side module-level handle-slot synthesis for handles. |
| `packages/pine-converter/src/transform/ylocResolve.ts` | Create | `yloc.abovebar`/`belowbar` → price arithmetic. |
| `packages/pine-converter/src/transform/index.ts` | Modify | Re-export. |
| `packages/pine-converter/src/diagnostics/codes.ts` | Modify | Add Task-10 codes. |
| `packages/pine-converter/src/transform/campA.test.ts` | Create | Per-handle-type tests. |
| `packages/pine-converter/src/transform/campA.property.test.ts` | Create | Property tests. |
| `packages/pine-converter/src/transform/setterFold.test.ts` | Create | Setter-fold tests. |
| `packages/pine-converter/src/transform/yloc-padding.test.ts` | Create | yloc tests. |
| `packages/pine-converter/src/transform/delete.test.ts` | Create | Delete tests. |
| `packages/pine-converter/src/transform/varip-approx.test.ts` | Create | Varip tests. |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (100% coverage)
- `pnpm docs:check`

## Changeset

`.changeset/pine-converter-transform-camp-a.md` — patch bump.

## Acceptance Criteria

- The canonical "var line + barstate.islast + set_xy1 + set_xy2" fixture
  produces exactly one `draw.line(...)` create and one
  `handle.update({ anchors: [...] })` per bar after first.
- `var label lbl = na; lbl := label.new(bar_index, high,
  style=label.style_label_down)` produces a `draw.frame(...)` (per
  Task 6 enum mapping) created once.
- `line.delete(lvl)` emits `remove()` + slot reset.
- Setter fold across two if branches produces two separate updates,
  one per branch.
- 100% coverage on the listed files.
- JSDoc + lint + typecheck gates green.
- Changeset committed.
