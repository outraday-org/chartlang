# Task 5 — Conformance: plot-visibility scenario

> **Status: TODO**

## Goal

Add a conformance scenario that pins the `visible` channel end-to-end: a script
emitting a `visible: false` plot produces an emission carrying `visible: false`
(asserted via a `plot-field` assertion, **not** a `plot-hash` change — the
numeric `value` stays byte-identical), and a visible/absent plot stays
unchanged. This is the cross-adapter contract test.

## Prerequisites

Task 1 (wire field), Task 3 (runtime sets it), Task 4 (adapters honour it).

## Current Behavior

- Conformance scenarios live in `packages/conformance/src/scenarios/` and are
  registered in `packages/conformance/src/index.ts`.
- The `plot-hash` assertion hashes `{ bar, value }` in emission order
  (conformance CLAUDE.md) — adding/reordering a wire field rebreaks every
  pinned hash, so a new optional field MUST be asserted via a field-level
  assertion, not folded into the numeric hash.
- The bgcolor/barcolor D2 design specifies a `plot-field` assertion on
  `colorValue` as the precedent for asserting an optional wire field without
  disturbing `plot-hash`.

## Desired Behavior

- A scenario script with two plots — one `plot(x)` and one
  `plot(y, { visible: false })` — asserts:
  - the visible plot's `plot-hash` is unchanged from the baseline,
  - the hidden plot's emission has `visible === false` (`plot-field`),
  - no `malformed-emission` / `unsupported-plot-kind` diagnostics.
- A second (optional) variant with `visible: true` asserts the field is
  **omitted** on the wire (byte-identical to absent).

## Requirements

### 1. Scenario (`packages/conformance/src/scenarios/plotVisible.scenario.ts`)

Author a scenario mirroring an existing optional-field scenario (use the
bgcolor/barcolor scenarios as the structural template). Drive a small bar
sequence; emit one always-visible plot and one `visible: false` plot. Assert:

- `plot-field` on the hidden slot: `visible === false`.
- `plot-hash` on the visible slot equals its baseline hash (compute + pin).
- Diagnostic absence (`malformed-emission`, `unsupported-plot-kind`).

### 2. Register (`packages/conformance/src/index.ts`)

Add the scenario to the registry list next to the plot-kind scenarios.

### 3. (Optional) omitted-when-visible variant

`plotVisibleOmitted.scenario.ts` — a `visible: true` plot asserts the wire
emission has no `visible` key (a `plot-field` "absent" assertion if the
harness supports it; otherwise assert the hash is byte-identical to the plain
plot baseline).

### 4. Run against every adapter

Confirm the scenario passes through the conformance runner for each registered
adapter (the reference canvas2d + any others), proving Task 4's skip is
contract-correct everywhere.

## Edge cases

- Pin the visible plot's hash from a clean run — do NOT hand-author the hash.
- Keep the bar sequence minimal/deterministic (no `Date`/random) per the
  conformance determinism rules.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/conformance/src/scenarios/plotVisible.scenario.ts` | Create | Pin `visible: false` via `plot-field`; visible-plot hash unchanged. |
| `packages/conformance/src/scenarios/plotVisibleOmitted.scenario.ts` | Create (optional) | Assert omitted-when-visible. |
| `packages/conformance/src/index.ts` | Modify | Register the scenario(s). |
| `packages/conformance/CLAUDE.md` | Modify (if it enumerates scenarios) | Note the visibility scenario. |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm -F @invinite-org/chartlang-conformance test`
- The conformance runner green for every registered adapter.

## Changeset

Covered by Task 1's shared T8 changeset (conformance is patch, or minor if it
publishes scenarios).

## Acceptance Criteria

- Scenario asserts `visible: false` via `plot-field`; the visible plot's
  `plot-hash` is unchanged.
- Passes for every adapter through the runner.
- No numeric `plot-hash` was altered to accommodate the new field.
