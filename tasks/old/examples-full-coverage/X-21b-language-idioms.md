# Core — Language Idioms ("how", not "what")

> **Status: TODO**

## Goal

Ship one runnable, **single-concept** example per language *idiom* — the
"how you express X" surface documented under `docs/language/**` and the
example-bearing parts of `docs/spec/**` — and protect it with an
**idiom coverage gate** that is orthogonal to the per-primitive
`examples:coverage` gate.

Today every example in this folder is keyed to a **primitive** page
(`docs/primitives/**`). The narrative idioms — series indexing,
bidirectional plot offset, bounded-loop windows, `bar.point` anchoring,
indicator composition, pane routing, the four `define*` script kinds,
version pinning — are demonstrated only **incidentally** inside `complex`
composites, credited to a primitive, never surfaced *as the idiom*. A
user reading the catalogue learns *what exists*, not *how to write it*.
This task closes that gap with a dedicated `language` category and a
gate that enumerates the idiom set from a small committed manifest.

## Why this is a new task, not a row in 19–21

Tasks 19–21 ("Core") are still **primitive-existence** buckets
(`input.*`, `state.*`, `plot`/`hline`/`alert`, `define.*`,
`barstate`/`syminfo`/`timeframe`, `request.*`). Their coverage target is
the `docs/primitives/**` page tree (Task 1 §4). Idioms have **no
primitive page** — `series[n]`, `{ offset }`, a bounded `for` window, a
multi-export file, `pane:` routing, `defineDrawing`/`defineAlert`/
`defineAlertCondition` are language constructs, not catalogue primitives.
So the existing gate structurally cannot require them; this task adds a
parallel gate keyed to `docs/language/**`.

## Prerequisites

Tasks 1 (catalogue + generators + gate harness) and 2 (demo dialog).
This task **extends** Task 1's taxonomy + gate harness (see "Task-1 / 22
deltas" below); land those edits as part of this task.

## Authoring playbook

Per the base rules in [Task 3](./3-ta-moving-averages.md) (MIT header,
top-level imports **and** destructured `compute` params, compiles clean +
runs without throwing on the demo's daily candles, one explanatory
comment). Two idiom-specific rules:

- **Single concept, minimal noise.** Each example isolates exactly one
  idiom. It MAY also exist inside a `complex` composite — author a
  **new, focused** script anyway (the same way Task 20 ships a dedicated
  `plot` demo even though composites plot). The composite stays in
  `complex`; this is the canonical *idiom* reference.
- **Comment names the idiom and the doc page.** The one-line comment
  must say which idiom it demonstrates and point at the
  `docs/language/<page>.md` (or `docs/spec/<page>.md`) section, so the
  example and the narrative doc stay paired.

Per id: add an `ExampleMeta` entry `{ id, label, description,
category: "language", idioms: ["<idiom-id>"] }` to this task's own
fragment `examples/catalogue/language-idioms.ts`. **Note** the extra
`idioms` field — see the Task-1 delta below; it is the idiom-gate analog
of `primitives` and is what `examples:idioms` cross-checks.

## Idioms

Idiom ids are namespaced `lang.*` (kept distinct from `ta.*`/`draw.*`
primitive ids). The "Today" column records the incidental composite that
touches it — which this task does **not** re-categorize.

| Idiom id | Doc source | Example concept | Today (incidental) |
|----------|-----------|-----------------|--------------------|
| `lang.seriesIndex` | language/series-and-indexing | `series[n]` / `.current` / `.length`: plot `ema.current − ema[1]`. | — |
| `lang.barSeriesIndex` | language/series-and-indexing | Direct `bar.close[1]` indexing + the raw-number coercion caveat (`+bar.close`). | manual-sma |
| `lang.offset` | language/series-and-indexing | **Bidirectional** plot offset: `ta.sma(_, 20, { offset: ±5 })`, value unshifted. | sma-offset |
| `lang.warmupGap` | language/series-and-indexing | Warmup `NaN` → plot gap (not zero) for `ta.ema(_, 50)`. | — |
| `lang.boundedLoop` | language/series-and-indexing | Rolling window via a bounded `for (i<N) series[i]` — buffer sized like the unrolled form. | manual-sma |
| `lang.barPoint` | language/series-and-indexing | `bar.point(offset, price)` drawing anchors (past + future). | anchored-line, forecast-line, pivot-high-ray |
| `lang.depOutput` | language/indicator-composition | Consume another indicator via `<dep>.output("title")`. | trend-composition |
| `lang.withInputs` | language/indicator-composition | `<dep>.withInputs({ length })` override without forking. | trend-confirmation |
| `lang.multiExport` | language/indicator-composition | One file, `export default` + `export const` sibling + private `const` dep. | trend-composition |
| `lang.crossFileImport` | language/indicator-composition | `import base from "./base-trend.chart"` cross-file dep. | base-trend + trend-confirmation |
| `lang.paneRouting` | spec/emissions, spec/semantics | `plot(_, { pane: "rsi" })` subpane routing (folds to overlay w/ `unsupported-pane` — documented). | explicit-pane-routing |
| `lang.versionPinning` | language/version-pinning | `apiVersion: 1` literal pin + why it is frozen. | — |
| `lang.defineDrawing` | language/overview, spec/grammar | `defineDrawing` script kind (drawing-first). | anchored-line |
| `lang.defineAlert` | language/overview, spec/grammar | `defineAlert` headless alert-only script. | — |
| `lang.defineAlertCondition` | language/overview, spec/grammar | `defineAlertCondition` user-wireable named condition. | — |

> `lang.fillBetween` is **not** here: `draw.fillBetween` is a real
> primitive page (`docs/primitives/draw/fill-between.md`) already owned
> by Task 11's `fill-between-band`. Idioms cover the *non-primitive*
> language surface only.
>
> Forbidden constructs (`docs/language/forbidden-constructs.md`) are a
> **negative** surface — there is no positive runnable example, so they
> are deliberately excluded from the idiom set (a comment in the manifest
> records why, so the gate's "every language page is represented" check
> allow-lists that page).

## Task-1 / Task-22 deltas (land in this task)

This task is self-contained but touches three Task-1 artifacts. Keep the
edits minimal and additive:

1. **Taxonomy** — add `"language"` to the `ExampleCategory` union,
   `CATEGORY_LABELS` (`"Core · Language Idioms"`), and `CATEGORY_ORDER`
   (place after `define-bar-context`) in `examples/catalogue.ts`.
2. **`ExampleMeta`** — add an optional `idioms?: ReadonlyArray<string>`
   field. Primitive examples omit it; idiom examples set it (and may set
   `primitives: []`). `examples/catalogue.test.ts` asserts every
   `language`-category entry has a non-empty `idioms` array and no other
   category sets `idioms`.
3. **`scripts/examples-idioms.ts` (new) → `pnpm examples:idioms`** — the
   idiom gate, mirroring `examples-coverage.ts`:
   - **Target set** = the ids in a committed manifest
     `examples/idiom-manifest.json` (`{ id, page }[]`), NOT a doc-tree
     walk (language pages are narrative, not 1:1 with idioms). The
     manifest is the canonical idiom list; this task seeds it with the
     rows above.
   - **Covered set** = union of all `idioms` across `EXAMPLE_CATALOGUE`.
   - **Fail** on `MISSING` (manifest id with no example),
     `UNKNOWN` (catalogue `idioms` id absent from the manifest), and
     `UNREPRESENTED_PAGE` (a `docs/language/*.md` page whose section
     appears in no manifest `page`, unless allow-listed — see the
     forbidden-constructs note). Structured stderr + `exitCode = 1`,
     same shape as `docs-gate.ts`. Co-locate
     `scripts/examples-idioms.test.ts` at 100%.
   - Add `"examples:idioms": "pnpm tsx scripts/examples-idioms.ts"` to
     the root `package.json` and into the same CI gate chain as
     `examples:coverage`.
4. **Task 22 is unaffected.** The idiom gate has its **own** manifest and
   no allowlist, so Task 22's "primitive allowlist empty + deleted"
   assertion does not interact with it. Add one line to Task 22's gate
   list: also run `pnpm examples:idioms`. (Record this in
   `22-enforce-and-finalize.md` when this task lands.)

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `examples/scripts/<id>.chart.ts` (×15) | Create | One focused script per idiom. |
| `examples/catalogue/language-idioms.ts` | Create (own) | The `language`-category fragment (entries carry `idioms`). |
| `examples/catalogue.ts` | Modify | Add `"language"` to union + labels + order; spread the new fragment. |
| `examples/catalogue.test.ts` | Modify | `language`-category invariants for the `idioms` field. |
| `examples/idiom-manifest.json` | Create | Canonical idiom target set + page map (+ forbidden-constructs allow-list note). |
| `scripts/examples-idioms.ts` | Create | Idiom coverage gate. |
| `scripts/examples-idioms.test.ts` | Create | Gate unit tests (100%). |
| `package.json` | Modify | Add `examples:idioms`; wire into the gate chain. |
| `apps/site/src/components/demo/scripts.ts` | Regenerate | `examples:generate` (now also carries `language` entries). |
| `docs/examples/<id>.md` (×15) | Regenerate | `examples:generate`. |
| `examples/CLAUDE.md` | Modify | Document the idiom manifest + `examples:idioms` lifecycle. |

## Gates

`pnpm typecheck`, `pnpm lint`, `pnpm test` (e2e compiles every new
script; 100% on the new gate helper), `pnpm examples:gate`,
`pnpm examples:coverage` (unchanged — green), `pnpm examples:idioms`
(green: every manifest id has an example).

## Changeset

`.changeset/examples-language-idioms.md` — **patch** (examples + docs +
tooling; `DemoScript`/`ExampleMeta` gained an optional `idioms` field —
note it). The published `@invinite-org/chartlang-examples` package
(Task 23) now also carries the `language` category + `idioms` field;
flag for Task 24's invinite taxonomy sync.

## Acceptance Criteria

- One compiling, runtime-clean, **single-concept** example per idiom id
  in `examples/idiom-manifest.json`, each filed under the `language`
  category with a non-empty `idioms` array.
- `examples/catalogue.ts` carries the `language` taxonomy; the demo
  dialog + docs sidebar show a "Core · Language Idioms" group (Task 2's
  grouping picks it up from `CATEGORY_ORDER` for free).
- `pnpm examples:idioms` passes; a unit test confirms it **fails** when a
  manifest id has no covering example.
- `examples:generate` regenerated `scripts.ts` + `docs/examples`;
  `examples:gate` + `examples:coverage` + e2e green; `examples/CLAUDE.md`
  updated; changeset committed.

## Wave placement

Runs in **W1** alongside Tasks 2–21 (it owns a disjoint `.chart.ts` set
+ its own `language-idioms.ts` fragment + its own manifest/gate — no
collision). Its only shared edits are the additive Task-1 taxonomy/gate
deltas above; sequence those before the W2 integration step so Task 22's
`docs:build` + final gate run see the `language` category. Add the row to
the README §6 task table and §5b wave table when this lands.
