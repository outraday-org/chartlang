# Tier 2/3: Conformance Z-Order Scenario

> **Status: TODO**

## Goal

Add a conformance scenario that pins the `z` field on the wire — proving
the runtime emits `z` on both a plot and a drawing, that omitted `z`
stays byte-identical, and that `z` never perturbs values. Models the
existing `plotOffsetXshift.scenario.ts`.

## Prerequisites

- Task 4 (runtime emits `z` on plot + drawing emissions).

## Current Behavior

`packages/conformance/src/scenarios/plotOffsetXshift.scenario.ts` is the
template: an inline source `defineIndicator`, a frozen `ASSERTIONS`
array (`plot-hash` + `plot-field` checks), and a frozen `Scenario`
export wired into `packages/conformance/src/scenarios/index.ts`. There
is no scenario asserting `z`.

Note the harness asserts **emission** fields (`plot-field`,
`plot-hash`), not pixel render order. Render-order (the global sort) is
verified in the adapter tests (Task 5); conformance pins the *emission
contract* the adapter depends on.

**Harness facts confirmed (do not re-discover):**
- The `ScenarioAssertion` union is defined in
  `packages/conformance/src/runConformanceSuite.ts` (≈line 216).
- `plot-field`'s `field` is currently
  `"visible" | "color" | "lineWidth" | "xShift"` — it does **not**
  include `"z"`. **This task must add `"z"`** to that union (Requirement 0).
- There is **no** `drawing-field` assertion kind. `drawing-hash` exists
  but hashes `DrawingState`, and `z` is a **top-level** emission field
  (Task 3), **not** part of `DrawingState` — so `drawing-hash` cannot
  observe a drawing's `z`. Therefore drawing-`z` is **not assertable in
  conformance**; it is covered by the runtime unit test (Task 4) and the
  adapter render test (Task 5). This scenario is **plots-only** for `z`.

## Desired Behavior

A **plots-only** `z-order` scenario that asserts (via `plot-field`, after
Requirement 0 adds `"z"` to that assertion's field union):
- A plot declared with `{ z: -1 }` emits `z: -1`.
- A plot with no `z` emits **no** `z` field (`expected: undefined`),
  pinning byte-identity.
- The unshifted/un-`z`'d numeric series is hash-stable (a `plot-hash`
  on a plain `plot(bar.close)`), proving `z` does not transform values.

(Drawing-`z` is **not** asserted here — there is no `drawing-field` kind
and `drawing-hash` cannot see the top-level `z`; it is covered by the
Task 4 runtime test and the Task 5 adapter test.)

## Requirements

### 0. Extend the `plot-field` assertion to accept `"z"`

In `packages/conformance/src/runConformanceSuite.ts`, widen the
`plot-field` assertion's `field` union from
`"visible" | "color" | "lineWidth" | "xShift"` to also include `"z"`,
and ensure the field-reader that resolves `emission[field]` handles `z`
(it should already, since it reads the field by name). Without this the
scenario below will not type-check. Add/extend a unit test for the new
field if the suite tests the reader directly.

### 1. Scenario source

Create `packages/conformance/src/scenarios/zOrder.scenario.ts` mirroring
the xShift scenario. Keep it **plots-only** (drawing-`z` is not
assertable in conformance — see *Current Behavior*):

```ts
const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "Z order",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        plot(bar.close, { title: "Close" });                  // no z
        plot(ta.sma(bar.close, 5), { title: "SMA behind", z: -1 });
    },
});
`;
```

(`draw` is available on the `compute` context — confirmed at
`packages/core/src/types.ts` `ComputeContext.draw`, with
`bar.point(offset, price)` and `draw.line(a, b, opts?)` — but a drawing
adds no assertable signal here, so leave it out to keep the scenario
focused. Drawing-`z` emission is exercised by the Task 4 runtime unit
test and the Task 5 adapter render test.)

### 2. Assertions

```ts
const ASSERTIONS = Object.freeze([
    // unshifted/un-z'd value series is hash-stable (values untouched by z)
    { kind: "plot-hash", slotId: "<inline:z-order>...#0", sha256: "<fill-after-first-run>" },
    // plot with z:-1
    { kind: "plot-field", slotIndex: 1, bar: 6, field: "z", expected: -1 },
    // plot without z → field absent
    { kind: "plot-field", slotIndex: 0, bar: 6, field: "z", expected: undefined },
]);
```

Drawing-`z` is **deferred to the Task 4 runtime unit test + Task 5
adapter render test** (decision (b) — `drawing-hash` cannot observe a
top-level `z`, and adding a `drawing-field` kind is out of scope). Note
this in the PR.

Fill `sha256` and the exact `slotId` after a first run (copy the pattern
from xShift, where `slotId` encodes the inline source path + line:col +
slot index).

### 3. Wire into the index

Export `Z_ORDER_SCENARIO` (frozen `Scenario` with `id: "z-order"`,
`title`, `inlineSource`, `intervalCount`, `candleLimit`, `assertions`)
and add it to `packages/conformance/src/scenarios/index.ts` alongside
the others.

### 4. Regenerate conformance report

If the canvas2d adapter's `examples/canvas2d-adapter/conformance-report.json`
is generated from the scenario set, regenerate and commit it (the repo
already shows this file tracked).

### 5. Edge cases / invariants

- The `plot-hash` slot MUST be a plot with **no** `z` and **no**
  `offset`, so the hash proves values are independent of presentation
  fields.
- Pin `expected: undefined` for the no-`z` slot to lock byte-identity
  (this is the regression guard against a stray `z: 0` leaking onto the
  wire).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/conformance/src/runConformanceSuite.ts` | Modify | Add `"z"` to the `plot-field` assertion `field` union (Req 0) |
| `packages/conformance/src/scenarios/zOrder.scenario.ts` | Create | The z-order scenario |
| `packages/conformance/src/scenarios/index.ts` | Modify | Register the scenario |
| `examples/canvas2d-adapter/conformance-report.json` | Modify | Regenerated report (if generated) |
| `examples/canvas2d-adapter/CONFORMANCE.md` | Modify (if it lists scenarios) | Add z-order row |
| `.changeset/plot-draw-z-order.md` | Modify | Append `@invinite-org/chartlang-conformance: minor` |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm conformance` (the new scenario must pass against the host +
  reference adapter)

## Changeset

Append `"@invinite-org/chartlang-conformance": minor` (additive: a new scenario
**and** a widened `plot-field` assertion union — minor, not patch) to
`.changeset/plot-draw-z-order.md`.

## Acceptance Criteria

- `plot-field`'s `field` union includes `"z"` (Req 0) and type-checks.
- `z-order` scenario asserts `z: -1` on a plot, `expected: undefined`
  for the no-`z` plot, and a value-hash proving `z` doesn't change
  values.
- Drawing `z` is explicitly deferred to the Task 4 runtime test + Task 5
  adapter test (documented in the PR), since it is unassertable in the
  conformance harness.
- Scenario registered in `index.ts`; conformance report regenerated.
- `pnpm conformance` green; changeset updated.
