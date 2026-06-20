# Plot & Drawing Z-Order (Layering Control)

## Overview

Give chartlang authors deterministic, portable control over **which
visual mark renders on top of which** — a "z-index" for `plot()` and
`draw.*()`. The work lands in three tiers:

- **Tier 1 — make today's implicit ordering normative.** chartlang
  already orders marks by emission queue (`plots` before `drawings`)
  and by script-declaration order within a queue, but only the
  reference adapter honors this and only incidentally. Promote it to a
  **spec-level guarantee** every conformant adapter must follow, and
  teach it in the author skill.
- **Tier 2 — pin the group stack in the adapter contract.** Document
  the fixed render bands (background → plots → drawings → alerts) as a
  normative part of the adapter contract so a future adapter can't
  silently paint drawings under plots. Add the testable slice to
  conformance.
- **Tier 3 — add an explicit numeric `z` field.** An optional,
  presentation-only `z?: number` on `PlotOpts` and the `draw.*`
  option types, threaded to `PlotEmission.z` / `DrawingEmission.z`
  exactly the way `xShift` was threaded for plot offset (commit
  `ca19e20`). The adapter computes one **global render order**: sort
  every mark by `(z ?? 0, groupBand, declarationOrder)`. Everything at
  the default `z=0` is byte-identical to today; a drawing at `z=-1`
  renders **below** `z=0` plots; a plot at `z=10` renders **above**
  drawings. This is the lever that finally lets an author put a drawing
  beneath a plot — which the fixed group stack alone forbids.

The feature goes slightly **beyond** Pine Script, which exposes no
numeric per-element z-index (only a fixed group order, declaration
order within a group, and the opt-in `explicit_plot_zorder` flag that
makes plot declaration order authoritative). Because chartlang already
breaks ties by declaration order, Pine's `explicit_plot_zorder=true`
is effectively chartlang's default — so the Pine converter reclassifies
that flag from an "unmapped" warning to a recognized no-op.

Relevant repo contracts: root `CLAUDE.md` (skill + per-folder
`CLAUDE.md` update rules), `docs/spec/semantics.md` §"Emission
Ordering", CONTRIBUTING §16.3 (test layers) and §22.10 (primitive
landing set — partially applicable; `z` is an option, not a new
primitive).

## Current State

- **Ordering is implicit.** `docs/spec/semantics.md:333` ("Emission
  Ordering") fixes the **queue** order in `RunnerEmissions`: `plots`,
  `drawings`, `alerts`, `alertConditions`, `logs`, `diagnostics`.
  Within a queue, items appear in script-declaration order;
  last-write-wins dedup applies per `(slotId, bar)` / `(handleId, bar)`.
- **No z field anywhere.** `PlotEmission`
  (`packages/adapter-kit/src/types.ts:491`) and `DrawingEmission`
  (`packages/adapter-kit/src/types.ts:647`) carry `pane`, `visible?`,
  and the presentation-only `xShift?` — but no `z` / `layer` / `order`.
  `PlotOpts` (`packages/core/src/plot/plot.ts:232`) and the `draw.*`
  option types carry no `z`.
- **The reference adapter hard-codes paint order.**
  `examples/canvas2d-adapter/src/createCanvas2dAdapter.ts` `renderFrame`
  (≈555–610) paints axis → background overlays → candles → bar overlays
  → plot series → glyphs → hlines → drawings → alerts. Drawings always
  land on top of plots; nothing can cross that boundary.
- **`xShift` is the precedent to mirror.** Author sets `offset` on a
  `ta.*` opts bag → runtime tags the series view
  (`packages/runtime/src/seriesView.ts:79`) → `plotImpl`
  (`packages/runtime/src/emit/plot.ts:88`) writes `PlotEmission.xShift`,
  **omitting it when `0`** for byte-identity → `validateEmission`
  type-checks it → the adapter resolves it in `render/coords.ts`
  (`projectShiftedX`) → docs in `docs/spec/emissions.md` +
  `docs/language/series-and-indexing.md` → conformance scenario
  `packages/conformance/src/scenarios/plotOffsetXshift.scenario.ts` →
  skills auto-doc via `pnpm skills:generate`.
- **Pine converter** drops `explicit_plot_zorder` today: it is in the
  `UNMAPPED_ARGS` set in
  `packages/pine-converter/src/transform/declarationArgs.ts` (≈line 92)
  and raises an `indicator-arg-not-mapped` warning.

## Target State

- **Spec:** `docs/spec/semantics.md` states a **normative** render-order
  contract — adapters MUST honor declaration order within a group and
  the fixed group bands — and documents the global `z` sort key.
  `docs/spec/emissions.md` gains the `z?` row on `PlotEmission` and
  `DrawingEmission`.
- **Contract:** `PlotOpts.z?: number` and `<draw>.z?: number` on every
  `draw.*` option type. `PlotEmission.z?` and `DrawingEmission.z?` on
  the wire, validated as finite numbers (NaN/±Infinity rejected) by
  `validateEmission`. Omitted/`0` ⇒ byte-identical to a pre-feature
  emission.
- **Runtime:** `plotImpl` and the drawing-emit path read `opts.z`, write
  it conditionally (`...(z === 0 ? {} : { z })`).
- **Reference adapter:** one global render pass that sorts all marks by
  `(z ?? 0, groupBand, declarationSeq)` (stable) and paints in that
  order; background/axis stay below, alert badges stay on top.
- **Conformance:** a `z-order` scenario pins `z` on a plot and a drawing
  emission, and pins omitted-when-`0` byte-identity.
- **Pine converter:** `explicit_plot_zorder` recognized as a no-op (no
  warning); fixture updated.
- **Surface:** a dedicated example script (`examples/scripts/` +
  `DEMO_SCRIPTS` → auto-generated `docs/examples/<id>.md`), the author
  skill (`SKILL.md` prose for the `z` option — the generated
  `references/primitives.md` carries no option-field JSDoc, so `z` is
  taught in prose only — + `translating-from-pine.md`).

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **`z` lives on `PlotOpts` / draw options, not on the `ta.*` series** | Unlike `xShift` (a property of the computed/displayed series), z-order is a property of the *render call*. Placing it on the call options matches Pine's model and keeps `ta.*` opts clean. |
| **Global sort key, not within-group only** | The motivating gap is "put a drawing beneath a plot," which a fixed, uncrossable group stack cannot express. A global key with group as the tiebreak solves it while preserving today's behavior at `z=0`. |
| **Default `z=0`, omitted on the wire** | Mirrors `xShift`: a no-z emission is byte-identical to the pre-feature baseline, so all existing goldens/conformance hashes are untouched. |
| **Finite number (fractional allowed), not integer** | A sort key benefits from insertion between layers (`z=1.5`) without renumbering. `validateEmission` rejects only NaN/±Infinity. |
| **No indicator-level opt-in flag** | Pine needs `explicit_plot_zorder` because its default ignores plot declaration order; chartlang already orders by declaration, so `z` can always be active with zero backward-compat risk. |
| **Sort tiebreak = `(z, groupBand, declarationSeq)`** | `groupBand` keeps the sane default (plots under drawings) when z ties; `declarationSeq` keeps last-declared-on-top within a band. No arbitrary per-element band numbers leak into the wire — only the adapter knows the bands. |
| **Pine `explicit_plot_zorder` → recognized no-op** | chartlang's declaration-order-within-group already equals Pine's `explicit_plot_zorder=true`, so the flag is satisfied by default; downgrade from warning to silent recognition. |
| **No compiler changes** | `z` is a pass-through option on `plot()`/`draw.*`; slot injection and forbidden-construct analysis are unaffected. |

## Dependency Graph

```
Task 1 (Tier 1+2 spec + adapter contract + skills note — docs only)
  |
  v
Task 2 (core: z on PlotOpts + draw option types)
  |
  +---------------------------+
  v                           v
Task 3 (adapter-kit:          (Task 2 also feeds Task 4)
  z on emissions +
  validateEmission)
  |
  v
Task 4 (runtime: thread z -> plot + drawing emissions)   [needs 2 + 3]
  |
  +-------------------+-------------------+
  v                   v                   v
Task 5 (reference     Task 6 (conformance Task 7 (pine converter:
  adapter: global       z-order scenario)   explicit_plot_zorder
  z-sort paint order)   [needs 4]           no-op) [needs 1]
  [needs 3, 4]
  |
  v
Task 8 (docs + dedicated example + demo + skills regen) [needs 2-5]
```

## Task Summary

| # | Title | Package | Dependencies | Est. Complexity |
|---|-------|---------|--------------|-----------------|
| 1 | [Tier 1+2 ordering spec & adapter contract](./1-spec-ordering-contract.md) | docs, skills | None | Medium |
| 2 | [Core `z` option on plot & draw](./2-core-z-option.md) | core | 1 | Low |
| 3 | [Emit `z` field + validation](./3-adapter-kit-z-emission.md) | adapter-kit | 2 | Medium |
| 4 | [Runtime threads `z` to emissions](./4-runtime-z-thread.md) | runtime | 2, 3 | Medium |
| 5 | [Reference adapter global z-sort](./5-canvas2d-z-sort.md) | canvas2d-adapter | 3, 4 | High |
| 6 | [Conformance z-order scenario](./6-conformance-z-scenario.md) | conformance | 4 | Low |
| 7 | [Pine converter `explicit_plot_zorder`](./7-pine-explicit-zorder.md) | pine-converter | 1 | Low |
| 8 | [Docs, dedicated example, demo & skills](./8-docs-example-demo-skills.md) | docs, apps/site, examples, skills | 2, 3, 4, 5 | High |

## Code Reuse

| Existing | Path | Reuse for |
|----------|------|-----------|
| `xShift` thread-through | `packages/runtime/src/emit/plot.ts:88`, `…/types.ts:491` | Exact template for `z` (omit-when-default, conditional spread). |
| `validateEmission` | `packages/adapter-kit/src/validation/validateEmission.ts` | Extend with finite-number `z` checks (sibling to the `xShift` integer check). |
| `plotOffsetXshift.scenario.ts` | `packages/conformance/src/scenarios/plotOffsetXshift.scenario.ts` | Template for the `z-order` scenario (`plot-field` assertions, `index.ts` wiring). |
| Adapter render order | `examples/canvas2d-adapter/src/createCanvas2dAdapter.ts` `renderFrame` | Refactor into a single sorted pass; reuse existing per-kind renderers. |
| `DemoScript` + examples gen | `apps/site/src/components/demo/scripts.ts`, `scripts/gen-examples-docs.ts` | Add the dedicated z-layering example; `pnpm examples:generate`. |
| Skills generator | `scripts/generate-skills-reference.ts` | Reads `draw.*` JSDoc from `packages/runtime/src/emit/draw` — signature/anchors/since only, **not** option fields. `z` does **not** surface here; taught via `SKILL.md` prose (Task 8). |
| Pine `UNMAPPED_ARGS` | `packages/pine-converter/src/transform/declarationArgs.ts` (≈92) | Reclassify `explicit_plot_zorder`. |

## Provenance

No `../invinite/` ports. Tier 3's `z` field is a chartlang extension with
no 1:1 Pine source construct; the Pine converter never *emits* `z`, it
only stops warning on `explicit_plot_zorder`.

## Deferred / Follow-Up Work

- **Other adapters** (lightweight-charts reference doc, third-party):
  only the canvas2d reference adapter implements the global sort here;
  the contract (Task 1) binds the rest, ported as they appear.
- **Per-pane z** is out of scope — `z` orders within the resolved pane;
  cross-pane stacking is governed by pane layout, not `z`.
- **`z` on alert badges / tables** — alerts stay pinned on top; not
  sortable by `z` in v1.
- **Animated/transition z** — not modeled; `z` is a static per-bar
  presentation value.
