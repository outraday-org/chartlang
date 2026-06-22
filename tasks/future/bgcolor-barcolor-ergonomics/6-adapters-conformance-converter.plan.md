# Task 6 — Adapters + conformance + converter dynamic color — VALIDATED PLAN

## Context

Deliverable 2, final task. Tasks 4/5 are landed (uncommitted):
- `PlotEmission.colorValue?: Color | null` appended last (adapter-kit
  `types.ts:615`); JSDoc already states the precedence "every adapter
  implements in Task 6: colorValue wins over style.color".
- Runtime `bgcolor`/`barcolor` resolve per-bar color into `colorValue`
  via `plotImpl`'s `dynamicColor` arg (`runtime/src/emit/plot.ts`,
  `bgcolor.ts`, `barcolor.ts`); validator at
  `adapter-kit/src/validation/validateEmission.ts:464-466`; last-write-wins
  dedup confirmed by `barcolor.test.ts:135`.
- Deliverable 1: core `bgcolor`/`barcolor` holes exist
  (`core/src/index.ts:233`), so converter output `bgcolor("#FF5252")`
  COMPILES and round-trips.

This task: (1) canvas2d reference renderer prefers `colorValue` over
`style.color`; (2) adapter-kit contract docs already state precedence —
flip the "Task 6 implements" wording to present tense; (3) a conformance
`plot-kind-bg-color-dynamic` scenario pinning per-bar color via a
`plot-field: colorValue` assertion (NEW field on the assertion union +
reader) plus a numeric `plot-hash`; (4) converter `emitBackground` emits
`bgcolor(<color>)` / `barcolor(<color>)` sugar; (5) a pine fixture triple.

## Pre-existing work (do NOT touch)

- The four static bg/bar-color hashes stay byte-identical (`colorValue`
  omitted on the static `plot(...)` path).
- Multi-symbol-security work touched example adapters' `capabilities.ts`
  + conformance — coexist.
- The changeset `.changeset/bgcolor-barcolor.md` already lists the published
  packages with the D2 description; extend its prose, do not add canvas2d
  (private).

## Issues found / resolved

1. **Fixture numbering conflict.** `30-explicit-plot-zorder` AND
   `30-var-series-history` both exist. Next FREE number is **33**.
   New fixture: `33-bgcolor-dynamic`.
2. **"byte-identical value series" wording is about colorValue not entering
   the hash, NOT equality to the static `5fbfff9c` hash.** The static
   bg-color scenario plots `bar.close` (FINITE value series). My dynamic
   scenario uses `bgcolor(...)` ⇒ `value: null` for every bar. So the
   numeric series is all-null and gets its OWN minted `plot-hash`. The
   invariant being proved: the per-bar `colorValue` does NOT alter the
   `{bar,value}` hash (colorValue is excluded from the tuple). I will mint
   the all-null hash via the harness message.
3. **`plot-field` reader has no `colorValue` case.** The assertion union
   (`runConformanceSuite.ts:259`) and reader switch (`:524-540`) cover
   `visible|color|lineWidth|xShift|z`. Add `colorValue` to both (append-only).
4. **`plotKindSource` hardcodes `compute({ bar, plot })`.** The dynamic
   scenario calls `bgcolor`, so it needs a custom inline source with
   `bgcolor` imported + destructured. Write the source inline in the
   scenario file (Phase-2 inline precedent).

## Steps (verified paths)

1. **canvas2d `bgColor.ts`** — extend `BgColorArgs` with
   `colorValue?: string | null`; in `drawBgColor` resolve
   `const paint = args.colorValue !== undefined ? args.colorValue : args.color;`
   and skip the fill when `paint === null` (the explicit gap).
2. **canvas2d `createCanvas2dAdapter.ts`** —
   `renderBackgroundOverlays` (:412) spreads
   `...(plot.colorValue === undefined ? {} : { colorValue: plot.colorValue })`
   into the `drawBgColor` args (the stored emission already carries it).
   `renderBarOverlays` (:453) `bar-color` case: prefer
   `plot.colorValue ?? plot.style.color`, skipping when `colorValue === null`.
   `drawBarColor` takes `color: string`; a `null` gap ⇒ skip the call.
3. **canvas2d tests** — add `bgColor.test.ts` cases (colorValue wins;
   null skips; omitted ⇒ static) + a `createCanvas2dAdapter` render test for
   the bar-color colorValue path. The pinned integration hash is UNCHANGED
   (EMA-cross emits no bg/bar overlays + no colorValue).
4. **adapter-kit `types.ts`** — flip "implements in Task 6" → present-tense
   normative "Adapters MUST prefer colorValue …". Update adapter-kit
   `CLAUDE.md` wire invariant (Task 6 now done). No logic, type test from
   Task 4 stands.
5. **`docs/spec/emissions.md`** — add a `colorValue` row to the PlotEmission
   table (after `z`, :72) with the precedence + null-gap semantics.
6. **conformance `runConformanceSuite.ts`** — add `"colorValue"` to the
   `plot-field` union + a `case "colorValue": actual = emission.colorValue ?? undefined;`
   to the reader. Update the JSDoc list.
7. **conformance `plotKindBgColorDynamic.scenario.ts`** (CREATE) — inline
   source: `bgcolor(bar.close > bar.open ? "#16a34a" : "#dc2626")`. Assertions:
   `plot-field colorValue` at a known `(0, bar)`, a minted `plot-hash`
   (all-null value series), `diagnostic-code-absent unsupported-plot-kind`
   + `malformed-emission`. Mint both via harness.
8. **conformance `scenarios/index.ts`** — import + re-export + add to
   `ALL_SCENARIOS` (after `PLOT_KIND_BG_COLOR_GATED_SCENARIO`, :546).
   **conformance `src/index.ts`** — re-export the new constant (alpha order).
9. **conformance `runConformanceSuite.test.ts`** — add the scenario to the
   PHASE_5 plot-kind group so the end-to-end pass runs it.
10. **pine-converter `plotFamily.ts` `emitBackground`** — emit
    `bgcolor(<color>)` / `barcolor(<color>)`; thread bgcolor `transp` (named
    arg) into `{ transp }` opts and `title` into `{ title }` for both
    (Pine named args; minimal + faithful). No-color ⇒ `null` unchanged.
11. **pine-converter `plot-family.test.ts`** — update expected output to the
    sugar form + add a per-bar-conditional fixture asserting the conditional
    rides through.
12. **pine-converter fixture triple** — `33-bgcolor-dynamic.pine` +
    `.expected.chart.ts` + `.expected.diagnostics.json`. Round-trips (not in
    KNOWN_NON_COMPILING). Golden harness pins the SOURCE.
13. **pine-converter `CLAUDE.md`** — `emitBackground` emit-shape note.
    **`docs/spec/pine-migration.md` §8** — sugar carries real per-bar color.
14. **Regenerate** `CONFORMANCE.md` + `conformance-report.json` via
    `pnpm conformance:report`.
15. **Extend the changeset** prose (canvas2d private — no bump line).

## Files table

| File | Action |
|------|--------|
| examples/canvas2d-adapter/src/render/bgColor.ts | Modify |
| examples/canvas2d-adapter/src/render/bgColor.test.ts | Modify |
| examples/canvas2d-adapter/src/createCanvas2dAdapter.ts | Modify |
| examples/canvas2d-adapter/src/createCanvas2dAdapter.test.ts | Modify (bar-color colorValue) |
| packages/adapter-kit/src/types.ts | Modify (present-tense precedence) |
| packages/adapter-kit/CLAUDE.md | Modify |
| docs/spec/emissions.md | Modify (colorValue row) |
| packages/conformance/src/runConformanceSuite.ts | Modify (colorValue field) |
| packages/conformance/src/scenarios/plotKindBgColorDynamic.scenario.ts | Create |
| packages/conformance/src/scenarios/index.ts | Modify (register) |
| packages/conformance/src/index.ts | Modify (re-export) |
| packages/conformance/src/runConformanceSuite.test.ts | Modify (group) |
| packages/pine-converter/src/transform/plotFamily.ts | Modify (emitBackground) |
| packages/pine-converter/src/transform/plot-family.test.ts | Modify |
| packages/pine-converter/fixtures/33-bgcolor-dynamic.{pine,expected.chart.ts,expected.diagnostics.json} | Create |
| packages/pine-converter/CLAUDE.md | Modify |
| docs/spec/pine-migration.md | Modify (§8) |
| examples/canvas2d-adapter/CONFORMANCE.md | Regenerate |
| examples/canvas2d-adapter/conformance-report.json | Regenerate |
| .changeset/bgcolor-barcolor.md | Modify (prose) |

## Gates to keep green

- `pnpm -F chartlang-example-canvas2d-adapter test`
- `pnpm -F @invinite-org/chartlang-conformance test`
- `pnpm -F @invinite-org/chartlang-pine-converter test`
- `pnpm conformance` (new scenario green; four static hashes UNCHANGED)
- scoped typecheck per touched package; `npx biome lint` on touched files
- `pnpm converter:docs:check` (no new diagnostic code, but run to confirm)

## Acceptance criteria

- canvas2d (+ contract binding others) prefer `colorValue`; null skips;
  omitted ⇒ static.
- `plot-kind-bg-color-dynamic` pins per-bar color via `plot-field colorValue`
  (a plot-FIELD assertion) + a numeric hash; the four static hashes untouched.
- converter emits `bgcolor(...)`/`barcolor(...)` sugar with real per-bar color;
  fixture 33 round-trips.
- CLAUDE.md + docs updated; changeset extended.
