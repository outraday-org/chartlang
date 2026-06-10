# Pre-freeze deprecation removal + stability promotion sweep

> **Status: TODO**

## Goal

Clean the public surface before the `apiVersion: 1` freeze: delete the
single remaining `@deprecated` export (`PHASE_1_SCENARIOS`), run a
workspace-wide audit confirming no other deprecated surface survives,
and promote every shipping `@experimental` export to `@stable`. After
this task the surface is exactly what `1.0` promises — nothing
deprecated, nothing provisional.

## Prerequisites

- Phase 6 closeout complete (packages at `0.6.x`, `phase6-*`
  changesets consumed). This task lands first in Phase 7.

## Current Behavior

- `packages/conformance/src/scenarios/index.ts` (~line 705) exports
  `PHASE_1_SCENARIOS`, a `@deprecated since 0.2.1` alias of
  `ALL_SCENARIOS`, kept "for one release" — that release has long
  shipped.
- ~40+ source files still carry `@experimental` on shipping surfaces.
  Confirmed locations (non-exhaustive — the task runs its own grep):
  - `packages/core/src/`: `types.ts`, `plot/plot.ts`,
    `define/defineDrawing.ts`, `define/defineAlertCondition.ts`,
    `define/overrides.ts`, `input/inputDescriptor.ts`,
    `color/colorHelpers.ts`, `color/index.ts`, `runtime/runtime.ts`,
    `state/snapshot.ts`, all of `draw/`, `ta/ta.ts`.
  - `packages/runtime/src/`: `runtimeContext.ts`,
    `persistentStateStore.ts` + `.validate.ts`, `state/`, `request/`,
    `emit/` (including the full `emit/draw/` tree).
  - `packages/adapter-kit/src/`: `base/`, `capabilities/`, `mocks/`,
    `defineAdapter.ts`, `validation/`, `types.ts`.
  - `packages/compiler/src/analysis/extractAlertConditions.ts`.
  - `packages/conformance/src/`: `runConformanceSuite.ts` (every
    exported type), `scenarios/*.scenario.ts`,
    `fixtures/generateGoldenBars.ts`.
  - `packages/cli/src/commands/`: `docs.ts`, `genDocs.ts`,
    `extractDrawingPages.ts`, `genPhase4Docs.ts`.
  - `packages/host-worker/src/`: `workerBoot.ts`, `filterEmissions.ts`,
    `idbStateStore.ts`, `createWorkerHost.ts`, `createWorkerBoot.ts`,
    `defaultWorkerFactory.ts`, `types.ts`, `limits.ts`, `protocol.ts`.
  - `packages/host-quickjs/src/`: `moduleSourceToScript.ts`,
    `protocol.ts`, `createQuickJsHost.ts`, `types.ts`, `limits.ts`.
  - `packages/language-service/src/_lib/`: `collectCompletions.ts`,
    `resolveFqnAtOffset.ts`, `isInsideIntervalLiteral.ts`,
    `mapDiagnostic.ts`.
  - `packages/editor/src/extensions/`: `peekPanel.ts`.
- `scripts/docs-check.ts` requires one of `@stable` / `@experimental`
  on `src/ta/` + `src/draw/` exports; it does not forbid
  `@experimental` anywhere.

## Desired Behavior

- `PHASE_1_SCENARIOS` is deleted. No import site exists (verify by
  grep before deleting; the symbol was kept only for external
  consumers, which the 1.0 major covers).
- `grep -rn "@deprecated" packages/*/src examples/*/src` returns zero
  exported-symbol hits (CHANGELOG.md / coverage artefacts excluded).
- Every `@experimental` marker on an exported symbol in
  `packages/*/src` and `examples/canvas2d-adapter/src` is replaced
  with `@stable`.
- Regenerated artefacts are committed: `docs/primitives/` pages
  (`pnpm chartlang docs`), hover registry
  (`pnpm gen-hover-registry`).

## Requirements

### 1. Delete `PHASE_1_SCENARIOS`

In `packages/conformance/src/scenarios/index.ts` remove the constant
and its JSDoc block entirely (no `// removed` comment, no re-export
shim). Then:

```bash
grep -rn "PHASE_1_SCENARIOS" packages examples scripts docs
```

must return zero hits (update any test that referenced the alias to
use `ALL_SCENARIOS`).

### 2. Workspace deprecation audit

```bash
grep -rn "@deprecated" packages/*/src examples/canvas2d-adapter/src scripts
```

Expected result after step 1: **zero hits**. If the audit surfaces
another deprecated export, remove it the same way (delete symbol +
migrate internal callers). Record the audit result in the PR
description.

### 3. Stability promotion sweep

Mechanical replacement across every exported symbol's JSDoc:

```bash
grep -rln "@experimental" packages/*/src examples/canvas2d-adapter/src
```

For each file, replace ` * @experimental` with ` * @stable`. Rules:

- Only JSDoc *tag lines* change — prose mentioning the word
  "experimental" in a description is left alone unless it now
  contradicts the marker (fix the prose where it does, e.g. "kept
  experimental until Phase 5" sentences).
- Inline `@since X.Y` tags stay untouched — `@since` records when the
  symbol landed, not its stability.
- Do **not** add markers to symbols that have none — `docs-check`
  only requires the marker on `ta.*` / `draw.*` namespaces; adding
  markers elsewhere is a separate (non-)goal.

### 4. Regenerate generated artefacts

The `docs/primitives/{ta,draw}/*.md` pages and the Phase-4 doc entries
embed the stability marker. After the sweep:

```bash
pnpm chartlang docs
pnpm gen-hover-registry
pnpm docs:gate     # byte-compare must pass
pnpm hover:check   # registry must be in sync
```

Commit every regenerated page in this task's PR (same-PR rule as
§22.10).

### 5. Conformance scenario titles / JSDoc

`packages/conformance/src/scenarios/*.scenario.ts` files carry
`@experimental` on their exported scenario constants — they are part
of the published conformance package surface and get promoted like
everything else.

### 6. Tests

No behavioural change — the existing suites must stay green
unmodified except for:

- Any test asserting on `PHASE_1_SCENARIOS` (migrate to
  `ALL_SCENARIOS`).
- Any snapshot/golden embedding the literal `@experimental` (e.g.
  doc-generation tests in `packages/cli/src/commands/genDocs.test.ts`,
  `extractDrawingPages.test.ts`, `genPhase4Docs.test.ts` fixtures) —
  update the fixtures to `@stable`.

Coverage stays at 100% on every touched package (deleting
`PHASE_1_SCENARIOS` removes covered lines — fine; no uncovered
branches may appear).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/conformance/src/scenarios/index.ts` | Modify | Delete `PHASE_1_SCENARIOS`. |
| `packages/conformance/src/**` (tests referencing the alias) | Modify | Migrate to `ALL_SCENARIOS`. |
| `packages/{core,runtime,compiler,adapter-kit,conformance,cli,host-worker,host-quickjs,language-service,editor}/src/**` | Modify | `@experimental` → `@stable` on exported symbols. |
| `examples/canvas2d-adapter/src/**` | Modify | Same sweep. |
| `packages/cli/src/commands/*.test.ts` fixtures | Modify | Update embedded marker literals. |
| `docs/primitives/**` | Modify (regenerated) | Pages reflect `@stable`. |
| Hover registry output (per `scripts/gen-hover-registry.ts`) | Modify (regenerated) | Registry reflects `@stable`. |
| `.changeset/phase7-pre-freeze-sweep.md` | Create | Major on conformance (removed export), patch on every package whose JSDoc changed. |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (coverage 100% on touched packages)
- `pnpm docs:check`
- `pnpm docs:gate`
- `pnpm hover:check`
- `pnpm readme:check`
- `pnpm conformance`

## Changeset

`.changeset/phase7-pre-freeze-sweep.md`:

```md
---
"@invinite-org/chartlang-conformance": major
"@invinite-org/chartlang-core": patch
"@invinite-org/chartlang-runtime": patch
"@invinite-org/chartlang-compiler": patch
"@invinite-org/chartlang-adapter-kit": patch
"@invinite-org/chartlang-cli": patch
"@invinite-org/chartlang-host-worker": patch
"@invinite-org/chartlang-host-quickjs": patch
"@invinite-org/chartlang-language-service": patch
"@invinite-org/chartlang-editor": patch
---

Pre-1.0 surface cleanup: remove the deprecated `PHASE_1_SCENARIOS`
alias (use `ALL_SCENARIOS`) and promote every shipping export from
`@experimental` to `@stable` ahead of the `apiVersion: 1` freeze.
```

(The conformance major folds into the phase-wide `1.0.0` bump at
closeout — changesets takes the highest pending bump. Patch lines are
included for **every** publishable package that carries an
`@experimental` marker in its `src/`: `host-worker`, `host-quickjs`,
`language-service`, and `editor` all do — confirmed by
`grep -rln "@experimental" packages/{host-worker,host-quickjs,language-service,editor}/src`.)

## Acceptance Criteria

- [ ] `PHASE_1_SCENARIOS` deleted; `grep` for the name returns zero
      hits workspace-wide.
- [ ] `grep -rn "@deprecated" packages/*/src examples/canvas2d-adapter/src`
      returns zero hits.
- [ ] `grep -rn "@experimental" packages/*/src examples/canvas2d-adapter/src`
      returns zero hits.
- [ ] `docs/primitives/` pages + hover registry regenerated and
      committed; `pnpm docs:gate` + `pnpm hover:check` green.
- [ ] All gates green; 100% coverage on touched packages.
- [ ] Changeset committed.
