# invinite — Templates Sync Generator & Unified Taxonomy

> **Status: TODO**

## Goal

Make invinite's chartlang template dialog auto-generated from the
published `@invinite-org/chartlang-examples` package: replace the
hand-authored `catalogue.ts` with a generated one, adopt chartlang's
`ExampleCategory` taxonomy (incl. `complex`) as invinite's
`TemplateCategory`, and add a `pnpm chartlang:templates:sync` script +
gate. **This task is in the `../invinite/` repo**, not chartlang.

## Prerequisites

Task 23 (`@invinite-org/chartlang-examples` published with
`EXAMPLE_CATALOGUE` + taxonomy exports).

> Before starting, read `../invinite/CLAUDE.md` and
> `src/components/trading-chart/chartlang-editor/CLAUDE.md` for that
> repo's conventions (prettier/eslint, 4-space indent, test layout,
> gate patterns). Match them — the rules below are chartlang-side
> intent, not a license to diverge from invinite's house style.

## Current Behavior

`src/components/trading-chart/chartlang-editor/templates/`:
- `types.ts` — `ChartlangTemplate` (`{ id, name, description, category,
  tags, source }`) + a 7-value `TemplateCategory`
  (`utilities|trend|momentum|oscillators|volatility|volume|mixed`) +
  `TEMPLATE_CATEGORY_ORDER`.
- `catalogue.ts` — hand-authored `CHARTLANG_TEMPLATES` with sources
  built via a local `buildIndicator` helper.
- `merge-source.ts` (+ test) — copy/append/replace insertion logic.
- `ChartlangTemplatesDialog.tsx`, `ChartlangTemplatePreview.tsx` — UI.

invinite already depends on several `@invinite-org/chartlang-*` packages
(see `package.json`).

## Desired Behavior

- `catalogue.ts` is **generated** from `EXAMPLE_CATALOGUE`; never
  hand-edited.
- `TemplateCategory` **is** chartlang's `ExampleCategory` (one canonical
  taxonomy across both products), incl. `complex`.
- `pnpm chartlang:templates:sync` regenerates the catalogue;
  `pnpm chartlang:templates:gate` (`--check`) byte-diffs it in CI.

## Requirements

### 1. Dependency

- Add `"@invinite-org/chartlang-examples": "^<published>"` to
  invinite `package.json` (range consistent with the other
  `@invinite-org/chartlang-*` deps). `pnpm install`.

### 2. Adopt the taxonomy (`types.ts`)

- Replace the local `TemplateCategory` union + `TEMPLATE_CATEGORY_ORDER`
  with re-exports of `ExampleCategory`, `CATEGORY_ORDER`, and
  `CATEGORY_LABELS` from `@invinite-org/chartlang-examples` (alias to
  the existing `TemplateCategory` / `TEMPLATE_CATEGORY_ORDER` names so
  downstream imports keep working, or update the importers).
- Keep `ChartlangTemplate` shape; `category` now typed as
  `ExampleCategory`.

### 3. Sync generator

- Add `scripts/sync-chartlang-templates.ts` (invinite) + package.json
  scripts `chartlang:templates:sync` and `chartlang:templates:gate`
  (`--check`), mirroring chartlang's `examples:generate` gate idiom
  (regenerate-in-memory + byte-diff + structured error + exit 1).
- It maps each `EXAMPLE_CATALOGUE` entry → `ChartlangTemplate`:
  - `id` ← entry `id`; `name` ← entry `label`; `description` ← entry
    `description` (truncate/validate ≤80 chars per the `types.ts`
    contract, or relax that contract — decide and document);
    `category` ← entry `category`; `source` ← entry `source`;
    `tags` ← derived from the entry `primitives` (split on `.`) + label
    tokens, lower-cased, deduped.
- Emit `templates/catalogue.ts` with an `AUTO-GENERATED` header,
  preserving category order via `CATEGORY_ORDER`. The old
  `buildIndicator` helper is removed (sources now come verbatim from
  the package).

### 4. Dialog + consumers

- Update `ChartlangTemplatesDialog.tsx` / `ChartlangTemplatePreview.tsx`
  to render the (now larger, ~191 + complex) catalogue grouped by the
  new categories using `CATEGORY_LABELS`; ensure search over `tags` +
  `name` still works and the list is scrollable/sectioned.
- `merge-source.ts` is unaffected (operates on `source` strings) —
  confirm its tests still pass against generated entries; add a smoke
  test that every generated template's `source` is a valid
  copy/append/replace input.

### 5. Tests

- `sync-chartlang-templates.test.ts`: generator output matches the
  committed `catalogue.ts` (gate), category coverage, tag derivation,
  id uniqueness.
- Keep invinite's existing coverage expectations green.

## Files to Create / Modify (in `../invinite/`)

| File | Action | Purpose |
|------|--------|---------|
| `package.json` | Modify | Add dep + `chartlang:templates:{sync,gate}` scripts. |
| `scripts/sync-chartlang-templates.ts` | Create | Generator. |
| `.../chartlang-editor/templates/types.ts` | Modify | Adopt chartlang taxonomy. |
| `.../chartlang-editor/templates/catalogue.ts` | Regenerate | Generated from the package. |
| `.../chartlang-editor/ChartlangTemplatesDialog.tsx` | Modify | Group by new categories. |
| `.../chartlang-editor/ChartlangTemplatePreview.tsx` | Modify (as needed) | Category labels. |
| `scripts/sync-chartlang-templates.test.ts` | Create | Generator + mapping tests. |
| invinite `CLAUDE.md`(s) | Modify | Document the generated catalogue + gate. |

## Gates (invinite repo)

- invinite `typecheck`, `lint`, `test` green
- `pnpm chartlang:templates:gate` byte-clean
- invinite CI workflow green with the new dep + scripts

## Changeset

invinite's own release process (per its repo conventions) — add a
changeset/entry if invinite uses one; otherwise none.

## Acceptance Criteria

- invinite's template dialog is generated from
  `@invinite-org/chartlang-examples`; categories match chartlang's
  taxonomy (incl. `complex`).
- `chartlang:templates:sync` regenerates `catalogue.ts`;
  `chartlang:templates:gate` is byte-clean; merge copy/append/replace
  still works; invinite tests + CI green.
