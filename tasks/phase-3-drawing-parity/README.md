# Phase 3 — `0.3` Full Drawing Parity

> **Plan reference:** PLAN.md §19 Phase 3, with cross-cuts into §10
> (full `draw.*` namespace), §3.1 (drawing schema references), §7.4
> (silent no-op semantics).
> **Prerequisite:** Phase 2 indicator parity shipped.
> **Version target:** `0.3`.

## Goal

Add the full `draw.*` namespace so scripts can imperatively place
the 61 drawing kinds invinite supports. Adapters that don't support
a given kind degrade silently with a `drawing-kind-unsupported`
diagnostic.

## Deliverables

- `draw` namespace per §10.2 covering all 61 drawing kinds derived
  from `../invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts`
  typedefs.
- `DrawingState` discriminated union per §10.4 (chartlang strips
  collab-only fields — Yjs ids, layer ids, intervals — from the
  invinite shapes).
- Coordinate system per §10.1 (world-point conventions, anchor
  semantics).
- `DrawingHandle` per §10.3 — script can update/delete previously
  placed drawings.
- `defineDrawing` constructor (per §4.1) for interactive drawing
  tools.
- Canvas2d reference adapter extended with rendering support for
  every new `DrawingKind` so conformance covers them. Includes the
  4th example script from Phase 1's deferred set:
  `fib-retracement.chart.ts`.
- Schema serialisation per §10.4 — JsonValue-clean, surviving
  postMessage + QuickJS membrane unchanged.
- `validateEmission` + `decodeDrawing` in adapter-kit extended to
  cover every new kind, including the variant collapses (pitchfork
  family, ray/extendedLine into LineDrawing, etc., per §3.1 table).

## Done criteria

- All 61 invinite drawing kinds emittable from scripts via `draw.*`.
- Canvas2d ref adapter renders every kind at acceptable fidelity
  (matches conformance golden).
- `pnpm conformance` green for every drawing primitive.
- Per-script drawing budget (`maxDrawings`, §4.1) honoured by the
  runtime — excess emissions dropped with `drawing-budget-exceeded`
  diagnostic.
- Silent no-op semantics verified: a script targeting an adapter
  that omits a kind gets one diagnostic + the rest of the script
  still renders.
- Docs (§17): every drawing kind has a JSDoc + page under
  `docs/primitives/draw/`.

## Notes for `/write-tasks`

- Use §3.1's "Drawing schemas" / "Drawing tool behavior" /
  "Drawing system docs" references — they're the source of truth
  for anchor semantics and edit handles.
- 4 pitchfork tools collapse to one `PitchforkDrawing` with a
  `variant` discriminator; `ray`/`extendedLine` collapse into
  `LineDrawing` with `extendLeft`/`extendRight` flags; pin these
  collapses in §10.4.
- camelCase kind strings in invinite become kebab-case on the wire;
  `decodeDrawing()` normalises. Don't drift on this convention.
- Group tasks by category (lines, channels, fibs, elliott, harmonic
  patterns, annotations, etc.) — flat 61-task list is hard to
  review.
