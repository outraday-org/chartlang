# Examples — Full Primitive Coverage

## 1. Overview

Today the project ships ~27 worked example scripts (25 wired into the
demo). They drive the live demo (`apps/site` → `?script=<id>#demo`) and
the auto-generated docs Examples section (`docs/examples/*.md`).
Meanwhile the **reference** docs under `docs/primitives/**` are already
auto-generated from JSDoc and cover *every* primitive — **200 pages**
(96 `ta.*`, 63 `draw.*`, 13 `input.*`, 10 `state.*`, `plot`/`hline`,
`request.security`/`lowerTf`, `alert`, 6 `define.*` overrides,
`barstate`/`syminfo`/`timeframe`, and the namespaces added since this
plan was written — `math`, `str`, `session`, `time`, each a single
page).

This feature closes the gap on the *worked-example* side: ship **one
runnable example per primitive**, wired into both example homes
(`examples/scripts/*.chart.ts` for e2e compilation + the live demo /
docs catalogue), surfaced in a **new categorized demo dialog** (left
sidebar of categories, replacing the flat `<select>`), and protected by
a **coverage gate** that fails CI if any primitive doc page lacks an
example.

The pre-existing **multi-primitive** showcase demos are **preserved**
under a dedicated `complex` category. Demos that showcase a *single*
headline primitive are instead folded in as that primitive's
per-primitive default (family category, not `complex`); a `complex`
entry that turns out to be a single-primitive duplicate of a default is
removed, not kept twice (Task 1 §6a). Finally, the catalogue is
published as a small data package
(`@invinite-org/chartlang-examples`) and the downstream **invinite**
repo's chartlang template dialog is regenerated from it — adopting the
**same categories** — with cross-repo CI so an invinite template-refresh
PR opens automatically whenever chartlang publishes new examples.

See `examples/CLAUDE.md`, `apps/CLAUDE.md` (demo + compiler
invariants), `docs/CLAUDE.md`, and `scripts/CLAUDE.md` for the
conventions these tasks must preserve.

## 2. Current State

- **Example sources** — `examples/scripts/*.chart.ts` (27 files), each
  compiled end-to-end by `packages/cli/src/e2e.test.ts`
  (`EXAMPLE_SCRIPTS`, a hand-maintained list). 14 of these were added
  since this plan was written (the `math.*`/`str.*`/`state.array`/
  `state.map`/`draw.fillBetween` demos — see Task 1 §6).
- **Demo catalogue** — `apps/site/src/components/demo/scripts.ts`
  exports `DEMO_SCRIPTS: DemoScript[]` (`{ id, label, description,
  source }`) — **25 entries**, with `source` **inlined as a string**
  (hand-duplicated from `examples/scripts/`). This is the single source
  of truth for the live demo dropdown AND for docs Examples.
- **Docs Examples** — `scripts/gen-examples-docs.ts`
  (`pnpm examples:generate` / `--check` = `examples:gate`) renders
  `docs/examples/index.md` + one page per `DEMO_SCRIPTS` entry.
- **Docs nav** — `docs/.vitepress/config.ts` imports `DEMO_SCRIPTS` to
  build the Examples sidebar (flat list).
- **Reference docs** — `pnpm chartlang docs` (genDocs + extractDrawing
  Pages + genPhase4Docs) emits `docs/primitives/**`. Gated by
  `pnpm docs:gate` (byte-diff). Already 100% primitive coverage.
- **Demo UI** — `apps/site/src/components/demo/DemoBody.tsx` renders a
  flat `<select>` over `DEMO_SCRIPTS`; `?script=<id>` deep-links.
  MTF scripts get synthetic secondary streams via
  `ChartPane.tsx` + `secondaryStreams.ts`.

## 3. Target State

- **`examples/catalogue.ts`** — a new pure metadata registry exporting
  `EXAMPLE_CATALOGUE: ExampleMeta[]`, where
  `ExampleMeta = { id, label, description, category, primitives:
  string[] }`. `id` matches the `examples/scripts/<id>.chart.ts`
  basename. `category` is a fixed `ExampleCategory` union. `primitives`
  lists the canonical primitive ids the example demonstrates.
- **One `.chart.ts` per primitive** — ~200 files under
  `examples/scripts/`, each a valid `defineIndicator` default export
  that compiles clean and runs without throwing on the demo's daily
  candles.
- **Generated `scripts.ts`** — `DEMO_SCRIPTS` is now **code-generated**
  by `scripts/gen-demo-scripts.ts` (folded into `pnpm examples:generate`)
  by reading each `.chart.ts` source + its `catalogue.ts` meta. The
  `DemoScript` type gains a `category` field. Removes ~200× manual
  source duplication; the two homes stay in sync by construction.
- **`EXAMPLE_SCRIPTS`** in `e2e.test.ts` is **derived from**
  `EXAMPLE_CATALOGUE` (no third hand-maintained list).
- **Coverage gate** — `scripts/examples-coverage.ts`
  (`pnpm examples:coverage`) enumerates the canonical primitive id set
  directly from the generated `docs/primitives/**/*.md` page tree, then
  asserts each id appears in ≥1 `EXAMPLE_CATALOGUE` entry's `primitives`
  array. A committed `examples/coverage-allowlist.json` lists
  not-yet-covered ids; each population task shrinks it; the final task
  asserts it is empty and deletes it. CI stays green throughout.
- **Categorized demo dialog** — `DemoBody.tsx` replaces the `<select>`
  with a "Browse examples" button opening a modal: a left sidebar of
  categories, a right pane listing the examples in the selected
  category (label + description). VitePress Examples sidebar is grouped
  by the same categories.

## 4. Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **Canonical registry = the generated `docs/primitives/**` page set** | Every primitive already has exactly one auto-generated doc page; deriving the coverage target from that tree means the gate self-updates when a new primitive lands — no separate hardcoded primitive list to drift. |
| **`scripts.ts` becomes generated, not hand-authored** | ~200 inlined source strings cannot be hand-maintained without drift. A generator reading the canonical `.chart.ts` + `catalogue.ts` keeps both example homes byte-identical by construction; the existing `examples:gate` byte-diff already enforces this shape. |
| **`primitives: string[]` lives in `catalogue.ts`, not parsed from source** | Static AST extraction of "which primitives does this script use" is brittle (aliases, re-exports, indirect calls). An explicit author-declared list is simple, reviewable, and the gate cross-checks it against the doc-page set. |
| **One example per primitive (not grouped)** | Per the feature decision: maximal per-primitive docs value; each primitive's example deep-links from its reference page. The categorized dialog keeps the ~200-entry catalogue navigable. |
| **Shrinking allowlist, not a deferred gate** | Landing the gate in task 1 with a full allowlist keeps CI green while ~20 population tasks land incrementally; each task removes the ids it covers, making progress measurable and preventing a big-bang red gate. |
| **No new golden/conformance scenario per example** | The primitives already exist and already carry their §22.10 golden + conformance coverage in `packages/runtime`. These examples are *usage demos*; the contract is "compiles e2e + runs clean", enforced by `e2e.test.ts`. New goldens would duplicate existing runtime coverage. |
| **Demo dialog over enriched `<select>`** | A ~200-entry flat select is unusable; the user requested a categorized dialog with a left category sidebar. |
| **Examples must run with input *defaults*** | The demo has no input-override UI, so any `input.*` example resolves to its default value. Examples are authored to render meaningfully at defaults. |
| **`complex` holds only *multi-primitive* composites; single-primitive demos are folded as defaults** | The pre-existing **multi-primitive** showcase demos (composition, MTF, state, pane-routing) are valuable as-is and live in `complex`. But a demo that exists to showcase **one** headline primitive **is** that primitive's per-primitive default — it takes the primitive's family category (never `complex`), and the family task skips a duplicate. A `complex` entry that turns out to be a single-primitive duplicate of an existing default is **removed**, not preserved (Task 1 §6a fold rule). Composites that are now fully covered by single-primitive defaults credit **no** `primitives` (the default owns the coverage) but stay as showcases. |
| **Publish the catalogue as `@invinite-org/chartlang-examples`** | invinite already consumes the `@invinite-org/chartlang-*` npm family; a versioned data package is the cleanest, pinnable transport for its template dialog (chosen over raw-JSON fetch / submodule). |
| **invinite adopts chartlang's `ExampleCategory` taxonomy** | The user wants "same categories" across both products; one canonical taxonomy (incl. `complex`) replaces invinite's local 7-value `TemplateCategory`. The sync maps 1:1. |
| **Cross-repo auto-update via `repository_dispatch` + PR bot** | chartlang push-to-main/release dispatches to invinite, which bumps the dep, re-syncs, and opens a PR — keeping the template dialog current without manual work (schedule + Renovate fallback if no cross-repo token). |

## 5. Dependency Graph

```
Task 1 (catalogue model + generators + coverage-gate harness, allowlist seeded full)
  |
  v
Task 2 (categorized demo dialog + VitePress category grouping)
  |
  +--> Tasks 3-10  (TA families: one example per ta.* primitive)
  +--> Tasks 11-18 (draw families: one example per draw.* kind)
  +--> Tasks 19-21 (core: input / state+plot+alert / define+bar+ctx+request)
  +--> Task 21b     (core: language idioms — own `language` category +
            |        `examples:idioms` gate; manifest-keyed, not allowlist)
            |   each task: add .chart.ts + catalogue entries, shrink allowlist,
            |   regen scripts.ts + docs/examples
            v
Task 22 (flip coverage gate to enforcing: allowlist empty + deleted,
         final docs/skills regen, README counts, changeset)
  |
  v
Task 23 (chartlang: publish @invinite-org/chartlang-examples package
         + main-push dispatch workflow to invinite)
  |
  v
Task 24 (invinite repo: templates-sync generator, adopt chartlang
         taxonomy, regenerate template catalogue.ts)
  |
  v
Task 25 (invinite repo: auto-update CI — dispatch/scheduled re-sync PR)
```

Tasks 23–25 are the **distribution** phase: 23 lives in chartlang, 24
and 25 live in the `../invinite/` repo and depend on the published
package.

Tasks 3–21 and 21b are independent of each other (each touches disjoint
`.chart.ts` files + disjoint `catalogue.ts` entries + disjoint allowlist
keys) and all depend only on Tasks 1 & 2. They are numbered for a
clean sequential run; the merge points are `catalogue.ts`,
`coverage-allowlist.json`, and the regenerated `scripts.ts` /
`docs/examples` (re-run the generators after each task). Task 21b is the
one exception that also lands additive taxonomy/gate deltas on the Task-1
artifacts (the `language` category + the `examples:idioms` gate); those
edits are additive and do not collide with the per-primitive ids the
other W1 tasks own.

## 5b. Execution Plan & Parallelization (waves)

The numbering is a safe total order, but the true dependency graph is
wide. Tasks can run in these waves to compress wall-clock time:

| Wave | Tasks | Concurrency | Notes |
|------|-------|-------------|-------|
| **W0** | 1 | — | Must complete first: catalogue barrel, fragment dir, generators, gate, taxonomy (incl. `complex`). |
| **W1** | **2, 3, 4, …, 21, 21b** | up to **20 parallel** | Task 2 (demo dialog) only needs the `category` field; Tasks 3–21 + 21b each own a disjoint `examples/scripts/*.chart.ts` set + a disjoint `examples/catalogue/<slug>.ts` fragment. None depend on each other. Task 21b additionally lands additive taxonomy/gate deltas (the `language` category + `examples:idioms` gate); sequence those before the W2 integration step. |
| **W2** | 22 | — | Integration + enforce: needs all of 3–21 + 21b landed (allowlist drained, idiom manifest seeded) and Task 2's grouped sidebar for `docs:build`. |
| **W3** | 23 | — | Publish `@invinite-org/chartlang-examples` (chartlang). |
| **W4** | 24 | — | invinite sync (needs published package). |
| **W5** | 25 | — | invinite auto-update CI. |

**What makes W1 safe to parallelize — and the two shared files it must
not race on:**

- *Disjoint by construction:* each W1 task writes its own `.chart.ts`
  files and its own catalogue fragment. No two tasks touch the same
  source file. The barrel `examples/catalogue.ts` is written once in W0
  and only *spreads* fragments — W1 tasks don't edit it.
- *Shared file #1 — `examples/coverage-allowlist.json`:* every W1 task
  removes its ids. Running concurrently in one tree, these edits race.
- *Shared file #2 — the generated outputs* (`scripts.ts`,
  `docs/examples/**`, `examples/catalogue.json`, and the Task-23
  package data module): these are **derived**, never hand-merged.

**Mechanics for running W1 in parallel (recommended):**

1. Run each W1 task in its **own git worktree** (the executor's
   `isolation: worktree`), producing only its `.chart.ts` files + its
   `examples/catalogue/<slug>.ts` fragment. In worktrees, W1 tasks
   **skip** the per-task allowlist edit and the `examples:generate` /
   `examples:coverage` steps.
2. **Integrate once per wave** (a short integration step, or the head of
   Task 22): merge all fragments, then run a single
   `pnpm examples:generate` (re-derives every generated output from the
   merged catalogue) and recompute `coverage-allowlist.json` to exactly
   the still-uncovered set. Then `pnpm examples:gate` +
   `pnpm examples:coverage` + e2e validate the integrated result.

**Sequential fallback (no worktrees):** run 3–21 in numeric order; each
task performs its own allowlist shrink + `examples:generate` +
`examples:coverage` (as written in the task bodies), keeping the gate
green at every step. This is slower but needs no integration step. The
per-task instructions are written for this mode; the worktree mode just
defers those three commands to the wave boundary.

## 6. Task Summary Table

| # | Title | Package / Area | Deps | Examples | Est. Complexity |
|---|-------|----------------|------|----------|-----------------|
| 1 | [Catalogue model, generators & coverage gate](./1-catalogue-and-coverage-gate.md) | examples, scripts, apps/site, cli | None | (migrate all on-disk: 11 demo + 6 extra e2e) | High |
| 2 | [Categorized demo dialog & docs grouping](./2-demo-category-dialog.md) | apps/site, docs | 1 | — | Medium |
| 3 | [TA — moving averages & overlays](./3-ta-moving-averages.md) | examples | 1,2 | 13 | Medium |
| 4 | [TA — momentum oscillators I](./4-ta-momentum-i.md) | examples | 1,2 | 10 | Medium |
| 5 | [TA — momentum oscillators II](./5-ta-momentum-ii.md) | examples | 1,2 | 17 | Medium |
| 6 | [TA — trend, directional & stops](./6-ta-trend-directional.md) | examples | 1,2 | 11 | Medium |
| 7 | [TA — bands, channels & volatility](./7-ta-bands-volatility.md) | examples | 1,2 | 12 | Medium |
| 8 | [TA — volume & flow](./8-ta-volume.md) | examples | 1,2 | 14 | Medium |
| 9 | [TA — volume profiles](./9-ta-volume-profiles.md) | examples | 1,2 | 4 | Medium |
| 10 | [TA — pivots, fractals & series utilities](./10-ta-pivots-utilities.md) | examples | 1,2 | 15 | Medium |
| 11 | [Draw — lines & rays](./11-draw-lines.md) | examples | 1,2 | 10 (+1 conditional `fillBetween`) | Medium |
| 12 | [Draw — shapes & freehand](./12-draw-shapes.md) | examples | 1,2 | 12 | Medium |
| 13 | [Draw — markers, text & tables](./13-draw-markers.md) | examples | 1,2 | 7 | Medium |
| 14 | [Draw — channels, regression & cycles](./14-draw-channels.md) | examples | 1,2 | 8 | Medium |
| 15 | [Draw — Fibonacci family](./15-draw-fibonacci.md) | examples | 1,2 | 10 | Medium |
| 16 | [Draw — Gann](./16-draw-gann.md) | examples | 1,2 | 4 | Medium |
| 17 | [Draw — Elliott waves](./17-draw-elliott.md) | examples | 1,2 | 5 | Medium |
| 18 | [Draw — harmonic & chart patterns](./18-draw-patterns.md) | examples | 1,2 | 6 | Medium |
| 19 | [Core — inputs](./19-core-inputs.md) | examples | 1,2 | 12 | Medium |
| 20 | [Core — state, plot, hline & alert](./20-core-state-plot-alert.md) | examples | 1,2 | 11 | Medium |
| 21 | [Core — define, bar, context & request](./21-core-define-bar-request.md) | examples | 1,2 | 11 | Medium |
| 21b | [Core — language idioms ("how", not "what")](./21b-language-idioms.md) | examples, scripts | 1,2 | 15 | Medium |
| 22 | [Enforce coverage gate & finalize](./22-enforce-and-finalize.md) | examples, scripts, docs | 1-21, 21b | — | Low |
| 23 | [Publish examples package & cross-repo trigger](./23-publish-examples-package.md) | packages/examples, .github | 22 | — | Medium |
| 24 | [invinite — templates sync & unified taxonomy](./24-invinite-templates-sync.md) | **invinite repo** | 23 | — | Medium |
| 25 | [invinite — auto-update CI](./25-invinite-auto-update-ci.md) | **invinite repo** | 24 | — | Low |

> Per-task example counts for Tasks 3–21 were sized against the original
> ~200-page surface; the surface is now **200 pages** (the `math`/`str`/
> `session`/`time` namespaces + `state.array`/`state.series`/
> `draw.fillBetween` landed since — several already have on-disk default
> examples, see Task 1 §6b). The authoritative target is the generated
> `docs/primitives/**` page set the Task-1 gate enumerates. If a count
> drifts, the gate — not this table — is the source of truth, and the
> relevant family task absorbs the delta; the new `math` and `str`
> categories carry their namespace defaults. **Task 21b is additive on
> top of that surface:** its 15
> examples cover *language idioms* (no primitive page), keyed to the
> separate `examples/idiom-manifest.json` + `examples:idioms` gate, so
> they do not count toward the per-primitive target.

## 7. Code Reuse

| Existing | Path | Reuse for |
|----------|------|-----------|
| `DEMO_SCRIPTS` / `DemoScript` | `apps/site/src/components/demo/scripts.ts` | Generated target; extend type with `category`. |
| `gen-examples-docs.ts` (`AUTO_HEADER`, byte-diff `--check`) | `scripts/gen-examples-docs.ts` | Pattern + gate convention for the new generator & coverage gate. |
| `docs-gate.ts` / `generate-skills-reference.ts` | `scripts/` | Gate skeleton (regenerate-in-memory + byte-diff + structured error). |
| `EXAMPLE_SCRIPTS` e2e loop | `packages/cli/src/e2e.test.ts` | Derive from `EXAMPLE_CATALOGUE`. |
| Example script template | `examples/scripts/sma-offset.chart.ts` etc. | Authoring template (MIT header, top-level import + destructured params per `examples/CLAUDE.md`). |
| `bar.point(offset, …)` anchoring | `examples/scripts/pivot-high-ray.chart.ts`, `forecast-line.chart.ts` | `draw.*` anchor construction. |
| MTF secondary streams | `apps/site/src/components/demo/secondaryStreams.ts`, `ChartPane.tsx`, `createMultiStreamCandlePump` | `request.security` / `request.lowerTf` examples. |
| VitePress Examples sidebar builder | `docs/.vitepress/config.ts` | Category grouping. |
| invinite template dialog + `merge-source` | `../invinite/src/components/trading-chart/chartlang-editor/templates/` | Regenerate `catalogue.ts` from the package; reuse `merge-source.ts` copy/append/replace + the dialog UI. |
| invinite `@invinite-org/chartlang-*` deps + CI | `../invinite/package.json`, `.github/` | Add the examples dep; reuse the existing pnpm/PR-bot workflow shape. |
| chartlang scaffold (§22.4) | `scripts/scaffold.ts` (`PACKAGE_DIRS`) | Scaffold `packages/examples` (never hand-write the template files). |

## 8. Provenance

No `../invinite/` ports. Examples are authored against the existing
primitive surface; where an example mirrors a known indicator usage it
is original demo code, not a transcription.

## 9. Deferred / Follow-Up Work

- **Input-override UI in the demo** so `input.*` examples can be driven
  interactively (currently default-valued only).
- **Per-primitive "Try it live" deep-links from reference pages** —
  injecting the `?script=<id>#demo` link into each `docs/primitives/**`
  page (the doc pages are auto-generated; this needs a genDocs change).
- **Visual/screenshot goldens** for `draw.*` examples (out of scope;
  these tasks guarantee compile + runtime-clean only).
- **Parallelizing `e2e.test.ts`** if the ~200-script compile loop
  becomes the long pole in CI (flagged in Task 1).

## 10. Cross-Feature Reconciliation (in-flight task folders)

Three other task folders touch the same example/demo surface this
feature owns. None of them is *included* here — they each **build** a
primitive or behavior, whereas these tasks only author usage demos for
primitives that **already exist**. But they collide at two seams, and one
of them moves the coverage gate. **Recommended global order: land all
three feature folders first, then run this feature** — they were written
against the current *hand-inlined* `apps/site/src/components/demo/scripts.ts`
world, and this feature's Task 1 migration absorbs them cleanly.

| Folder | Adds a primitive? | Moves the coverage gate? | What this feature must do |
|--------|-------------------|--------------------------|---------------------------|
| `tasks/htf-security-expression/` | No — a new *overload* of existing `request.security` | No new doc page | Task 1 migration sweeps the existing `htf-trend-filter` demo into `complex` (composite, credits nothing). `request.security` is covered by the single-primitive default `symbol-ratio` (Task 1 §6b); Task 21 records it as covered. Nothing extra. |
| `tasks/bidirectional-plot-offset/` | No — behavior change to the existing `offset` option | No | Task 1 migration sweeps the existing `sma-offset` demo into its category; `ta.sma` already covered. Nothing extra. |
| `tasks/draw-fill-between/` | **Yes — `draw.fillBetween`, a new `DrawingKind`** | **Yes** | A new `docs/primitives/draw/fill-between.md` page lands ⇒ the Task-1 coverage gate (which enumerates ids from the `docs/primitives/**` tree) **auto-requires** an example for `fill-between`. **Task 11 (draw-lines) now owns this conditionally** (see its "Conditional — `draw.fillBetween`" note): if `fill-between.md` exists, Task 11 folds in the `fill-between-band` script that `draw-fill-between` Task 5 authors (category `draw-lines`, `primitives: ["draw.fillBetween"]`) rather than authoring a second one; if it does not exist, the id is not a gate target and Task 11 skips it. |

**Two shared-file traps regardless of order:**

1. **Generated `scripts.ts`.** After this feature's Task 1, `scripts.ts`
   is **code-generated** from `examples/catalogue.ts` + the `.chart.ts`
   sources. Any of the three feature tasks that hand-edits an inlined
   `HTF_TREND_FILTER` / `SMA_OFFSET` / `FILL_BETWEEN_BAND` constant will
   have that edit **silently overwritten** by `pnpm examples:generate`.
   If a feature folder lands *after* this one, it must edit the
   `.chart.ts` + the catalogue fragment and regenerate — not the
   constant. (Notes added to those task files.)
2. **`examples/coverage-allowlist.json` + the `.chart.ts` set** are this
   feature's territory; the feature folders only touch their own existing
   example file (`htf-trend-filter` / `sma-offset`) or, for
   `draw-fill-between`, add one new script that this feature must catalogue.
