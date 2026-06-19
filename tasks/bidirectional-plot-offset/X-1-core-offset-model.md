# Task 1 — Core + adapter-kit: offset model + emission `xShift` field

> **Status: TODO**

## Goal

Land the type surface for the **decided** model — Option A
(unified display-shift), **A-stay** (`offset` stays on `ta.*` opts);
see `README.md` "Mechanism (DECIDED)". This task lands the `offset`
option's redefined meaning (core, `ta.ts` JSDoc), the plot-emission
`xShift` presentation field **+ its validation** (adapter-kit, where
`PlotEmission` and `validateEmission` actually live), and the
bidirectional JSDoc. Everything downstream keys off it.

## Prerequisites

None. The model is already decided (Option A / A-stay); this task
encodes it in the core + adapter-kit types.

## Current Behavior

- `offset?: number` lives on most `*Opts` in `packages/core/src/ta/ta.ts`
  and is documented as a value-shift (`series.current` = value `offset`
  bars ago). Negative is documented as NaN. **Exception:**
  `AlmaOpts.offset` is the **Gaussian-centre position** (`[0, 1]`,
  default `0.85`), NOT the universal bar-shift — ALMA's universal shift
  is the distinct `AlmaOpts.barShift` field. ALMA's `offset` must not be
  touched by this task.
- `PlotStyle` / plot opts (`packages/core/src/plot/plot.ts`) carry no
  offset / x-shift.
- **`PlotEmission` is defined in `packages/adapter-kit/src/types.ts`
  (≈ line 491), NOT in core** — `packages/core/src/types.ts` only holds
  a doc comment referencing `PlotEmission.slotId`. It has no presentation
  x-shift field. `validateEmission`
  (`packages/adapter-kit/src/validation/validateEmission.ts`) validates
  plot fields field-by-field (e.g. `plot.visible: must be a boolean`).

## Desired Behavior (Option A)

- `offset` is bidirectional and presentation-only, with the **fixed sign
  convention `+n` = right (future), `−n` = left (past)** (see README
  "Sign convention (DECIDED)" — not re-litigated here); the numeric
  series value is unshifted.
- `offset` **stays on the `ta.*` opts** (A-stay, decided): the runtime
  threads the declared offset to the plot emission as `xShift`; the
  `sma-offset` example keeps `ta.sma(…, { offset })`. (A-move — moving
  `offset` to `plot`/`hline` opts — is the documented follow-up, not v1.)
- Add the presentation field to `PlotEmission` **in
  `packages/adapter-kit/src/types.ts`** (e.g. `readonly xShift?: number`
  — bars, signed integer; omitted/0 ≡ no shift) so a no-shift emission is
  byte-identical to today, and extend `validateEmission` to reject a
  non-integer `xShift`.

## Requirements

1. Update the universal `offset` JSDoc on the `*Opts` types in
   `packages/core/src/ta/ta.ts` to describe the bidirectional display
   semantics + the sign convention; drop the "negative ⇒ NaN" wording.
   **Do NOT touch `AlmaOpts.offset`** (Gaussian-centre, not a bar-shift);
   instead update `AlmaOpts.barShift`'s JSDoc, which is ALMA's universal
   shift, to the same bidirectional-display wording.
2. Add the `PlotEmission.xShift?` field (signed integer bars) in
   `packages/adapter-kit/src/types.ts` with JSDoc stating omitted ⇒ no
   shift, `+n` right, `−n` left, and that it is presentation-only (does
   not affect `value` or alert bars). Add a `types.types.test.ts` type
   assertion if the existing one enumerates `PlotEmission` fields.
3. Extend `validateEmission`
   (`packages/adapter-kit/src/validation/validateEmission.ts`): when
   `e.xShift !== undefined`, require `Number.isInteger(e.xShift)` else
   return `bad("plot.xShift: must be an integer")`. Add the matching
   unit case to `validateEmission.test.ts`. (Task 3's runtime only
   *sets* the field; the validation contract lives here.)
4. No plot-opts change (A-stay): `offset` stays on the `ta.*` opts and
   the runtime reads it to emit `xShift` (Task 3). Do not add `offset` to
   plot/hline opts in v1. The compiler shim (`program.ts`) needs **no**
   change — it never declares `PlotEmission` (only the script-facing
   `PlotOpts`/`HLineOpts`, which are unchanged here).
5. `@since`/`@stable` tags per §22.10 on the new/edited exported symbols.
   (`packages/core` has no root `CLAUDE.md`; no per-folder doc update is
   required for this task.)

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/ta/ta.ts` | Modify | offset JSDoc → bidirectional display (skip `AlmaOpts.offset`; update `AlmaOpts.barShift`) |
| `packages/adapter-kit/src/types.ts` | Modify | `PlotEmission.xShift?` field + JSDoc |
| `packages/adapter-kit/src/validation/validateEmission.ts` | Modify | reject non-integer `xShift` |
| `packages/adapter-kit/src/validation/validateEmission.test.ts` | Modify | `xShift` validation unit case |
| `packages/adapter-kit/src/types.types.test.ts` | Modify (if it enumerates `PlotEmission`) | type-level `xShift` coverage |

## Gates

- `pnpm typecheck`
- `pnpm -F @invinite-org/chartlang-core test` (100% cov)
- `pnpm -F @invinite-org/chartlang-adapter-kit test` (unit + type +
  conformance; 100% cov)
- `pnpm docs:check` (JSDoc gate on new/edited exported symbols)

## Changeset

Rides the feature changeset created/finalised in Task 6:
`.changeset/bidirectional-plot-offset.md` — `minor` on **core** (offset
semantics) and **adapter-kit** (`PlotEmission.xShift` + validation),
with the full package set added there.

## Acceptance Criteria

- The changeset package set and summary are captured in Task 6's final
  feature changeset.
- `PlotEmission.xShift?` exists in adapter-kit with JSDoc; a no-shift
  emission is byte-identical to today; `validateEmission` rejects a
  non-integer `xShift` (with a unit test).
- `offset` JSDoc describes both directions; `AlmaOpts.offset` is
  untouched and `AlmaOpts.barShift` carries the bidirectional wording.
- core + adapter-kit tests + JSDoc gate green.
