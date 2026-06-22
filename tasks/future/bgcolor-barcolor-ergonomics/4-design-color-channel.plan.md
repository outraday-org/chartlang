# Task 4 plan — per-bar `colorValue` channel on `PlotEmission` (wire/type design)

## Context

Deliverable 2, Task 4. Product decision RATIFIED: add the optional parallel
`colorValue: Color | null` channel on `PlotEmission` (NOT overloading numeric
`value`, NOT a new style arm). This task is the WIRE/TYPE design only — runtime
resolve is Task 5, adapters/conformance/converter is Task 6.

The chosen shape (README *Architecture Decisions*, RECOMMENDED row): an optional
field APPENDED to `PlotEmission` after `z` (the last current optional field),
mirroring the proven `xShift` / `visible` / `z` "omit-when-default ⇒
byte-identical wire" pattern. Omitted ⇒ adapter uses the static color; present ⇒
overrides the static color for this `(slotId, bar)`; `null` ⇒ explicit "no color
this bar" gap.

## Pre-existing work (do NOT touch / revert)

The working tree already carries three uncommitted in-flight features. My diff
must be Task-4-only and coexist with all of them:

- **bgcolor-task-1** (Deliverable 1): `packages/core/src/plot/plot.ts`,
  `statefulPrimitives.ts`, `index.ts`, compiler `program.ts`, etc., plus
  `.changeset/bgcolor-barcolor.md` (core/compiler/runtime/pine-converter). This
  is the SEPARATE Deliverable-1 changeset — I must NOT edit it; Task 4 adds its
  own Deliverable-2 changeset.
- **multi-symbol-security**: added `Capabilities.multiSymbol` +
  `multi-symbol-not-supported` to adapter-kit. Coexist — I only append a field
  to `PlotEmission`.
- **state-array**: `.changeset/state-array.md`. Unrelated.

## Issues / decisions verified against the codebase

1. **`Color` is ALREADY imported** into `packages/adapter-kit/src/types.ts`
   (line 7, `import type { Color, ... } from "@invinite-org/chartlang-core"`).
   No new import needed — confirmed by `grep -n "Color" types.ts`.
2. **Append point.** `PlotEmission` ends at `:580` with `z?` as the last field
   (`:579`). The README/task example says "append after `xShift`", but `z`
   (`@since 1.4`) and `visible` were appended AFTER `xShift` since the task was
   written. Appending after `z` is the correct interpretation of "additive /
   wire-order preserved" — the field goes LAST, after every existing optional
   field. This keeps JSON key order additive vs every prior baseline.
3. **`ColorSeries` decision: DEFER (no core change).** Task §3 default position
   and README confirm: a per-bar conditional scalar (`cond ? green : red`) is
   ALREADY a `Color`-typed expression the runtime re-evaluates each step
   (`bgcolor`/`barcolor` first arg + `plot`'s `opts.color` are already `Color`).
   No `Series<Color>` author input is in scope for v1. Therefore NO change to
   `packages/core/src/types.ts`, `index.ts`, or `packages/compiler/src/program.ts`.
   Recorded here as the design conclusion.
4. **Hash-preservation invariant (conformance CLAUDE.md).** `plot-hash` SHA-256
   covers `{ bar, value }` tuples ONLY, in emission order. `colorValue` is a
   separate optional field; it NEVER enters the hash, and omitting it leaves the
   serialized emission byte-identical to the pre-feature wire. The wire-order
   invariant holds because the field APPENDS.
5. **Validator.** Task lands TYPE only. No runtime validation branch
   (`colorValue` finite-color-or-null check) — that is Task 5. The validator's
   `PlotEmission` shape just needs to type-check with the new optional field
   (it does — optional field, no new required surface).
6. **Precedence contract** must be documented in the field JSDoc even though
   render is Task 6: `colorValue` (when present) WINS over the static
   `style.color` (for `bg-color`/`bar-color`) and the static top-level `color`
   (for line-family plots) at render time.

## Steps

1. `packages/adapter-kit/src/types.ts` — append `readonly colorValue?: Color | null;`
   after `z?` (`:579`), with full JSDoc: rationale (rejected alternatives —
   overload `value`, new style arm), `null`-vs-omitted distinction, precedence
   contract, orthogonality to numeric `value`, `@since 1.5`, `@stable`,
   `@example`. Update the `PlotEmission` `@example` block (`:510-521`) with a
   one-line note that `colorValue` is the optional per-bar dynamic color.
2. `packages/adapter-kit/src/types.types.test.ts` — add a type test:
   `PlotEmission["colorValue"]` is `Color | null | undefined`, sibling to the
   `xShift` test (`:53-55`). Add a byte-identity note (an emission omitting
   `colorValue` still satisfies `PlotEmission`).
3. `packages/adapter-kit/CLAUDE.md` — add a wire-invariant bullet documenting
   the `colorValue` append + the precedence + the omit-byte-identity + the
   `null`-vs-omitted distinction (so Task 5/6 read it as the source of truth).
4. `.changeset/bgcolor-barcolor-d2.md` — NEW separate Deliverable-2 changeset
   (adapter-kit minor; runtime + pine-converter minor for the channel they
   consume in Tasks 5/6 per the task's changeset block). Distinct from the
   existing `bgcolor-barcolor.md` (Deliverable 1).

## Files table

| File | Action | Purpose |
|------|--------|---------|
| `packages/adapter-kit/src/types.ts` | Modify | Append `PlotEmission.colorValue?: Color \| null` + JSDoc; note in `@example`. |
| `packages/adapter-kit/src/types.types.test.ts` | Modify | `colorValue` type assertion + omitted-field-still-valid. |
| `packages/adapter-kit/CLAUDE.md` | Modify | New wire invariant (append + precedence + byte-identity + null-vs-omitted). |
| `.changeset/bgcolor-barcolor-d2.md` | Create | Deliverable-2 changeset (separate from D1). |
| `packages/core/*` | NOT modified | `ColorSeries` deferred — recorded conclusion. |

## Gates to keep green

- `pnpm typecheck` (or `npx tsc --noEmit -p packages/adapter-kit/tsconfig.json`)
- `pnpm lint`
- `pnpm -F @invinite-org/chartlang-adapter-kit test`
- `pnpm docs:check` (JSDoc: `@since 1.5`, `@example`, `@stable` on the field)

## Changeset

`.changeset/bgcolor-barcolor-d2.md` — adapter-kit minor, runtime minor,
pine-converter minor (per task changeset block).

## Acceptance criteria

- `PlotEmission.colorValue?: Color | null` added, APPENDED (last field), fully
  JSDoc'd; omitted-emission byte-identity preserved; wire order additive.
- Rejected alternatives (overload `value`, new style arm) recorded in the field
  JSDoc rationale.
- `ColorSeries` decision recorded: DEFERRED (no core change).
- adapter-kit type test green; no `value` widening; no style arm; no core change.
- `plot-hash` / wire-order invariant explicitly preserved when omitted.
- Separate Deliverable-2 changeset created.
