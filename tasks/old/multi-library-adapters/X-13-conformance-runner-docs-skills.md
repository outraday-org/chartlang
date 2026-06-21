# Conformance runner (multi-adapter) + skills + docs index

> **Status: TODO**

## Goal

Wire the four new adapters into the cross-cutting surfaces: make
`scripts/run-conformance.ts` run **all five** adapters, update the
`skills/chartlang-setup` integrator skill (adapter contract + the new
geometry layer + the new adapters), add the `docs/adapters/` index/nav,
and list the adapters in the root `README.md`.

## Prerequisites

- Tasks 4, 6, 8, 10, 12 (all five adapters complete and conformance-green
  individually).

## Current Behavior

- `scripts/run-conformance.ts` hardcodes the single canvas2d default
  export: `runConformanceSuite(adapterMod.default)`.
- `skills/chartlang-setup/` mirrors the compile/host/adapter contract but
  knows only the canvas2d adapter and no geometry layer.
- `docs/adapters/` has `contract.md`, `capabilities.md`,
  `writing-an-adapter.md`, `plot-overrides.md`, `conformance.md`, and a
  single per-library page `reference/lightweight-charts.md` (the
  first-adapter *getting-started* guide lives at
  `docs/getting-started/write-your-first-adapter.md`). No adapters overview
  index page exists.
- Root `README.md` references the canvas2d playground only.

## Desired Behavior

The conformance runner iterates a registry of all five adapter default
exports; the integrator skill documents the geometry layer + four new
adapters; docs and the root README present all five adapters.

## Requirements

### 1. Multi-adapter conformance runner — `scripts/run-conformance.ts`

Replace the single-adapter import with a registry that tries each adapter's
`src` then `dist` (mirroring the existing `tryImport` fallback):

```ts
const ADAPTERS = [
    { name: "canvas2d", dir: "examples/canvas2d-adapter" },
    { name: "lightweight-charts", dir: "examples/lightweight-charts-adapter" },
    { name: "uplot", dir: "examples/uplot-adapter" },
    { name: "echarts", dir: "examples/echarts-adapter" },
    { name: "konva", dir: "examples/konva-adapter" },
];

let anyFailed = false;
for (const a of ADAPTERS) {
    const mod = (await tryImport(join(ROOT, a.dir, "src/index.ts")))
              ?? (await tryImport(join(ROOT, a.dir, "dist/index.js")));
    if (!mod) { console.error(`skip ${a.name}: not built`); continue; }
    const report = await conformanceMod.runConformanceSuite(mod.default);
    console.log(`${a.name}: ${report.passed} passed, ${report.failed} failed`);
    if (report.failed > 0) anyFailed = true;
}
process.exit(anyFailed ? 1 : 0);
```

Preserve the script's existing logging/exit-code contract. Update
`scripts/CLAUDE.md` if it documents the runner's single-adapter assumption.

### 2. Integrator skill — `skills/chartlang-setup/`

Per the repo-root rule ("when you change anything a skill describes, update
that skill in the same PR"), update the integrator skill's adapter-contract
reference to add:

- The **geometry layer**: `decomposeDrawing`, the `DrawPrimitive` IR,
  `paintPrimitive`/`RenderCtx`/`MockCanvasContext` from
  `@invinite-org/chartlang-adapter-kit` + `/canvas`, and the recommended
  authoring pattern ("decompose once, map primitives to your library").
- The **four new example adapters** as reference implementations, noting
  which are ctx-based (canvas2d, lightweight-charts, uplot — reuse
  `paintPrimitive`) vs scene/option mappers (konva → nodes, echarts →
  graphic) — i.e. the two integration strategies.
- `skills/chartlang-setup/references/adapter.md` is **hand-written** (it
  carries no generated header) — hand-edit it directly. `pnpm skills:generate`
  only regenerates `skills/chartlang-coding/references/primitives.md` (which
  carries the `<!-- AUTO-GENERATED -->` header); that file is a
  language-surface artefact and is **not** affected here — leave it
  untouched, and `pnpm skills:gate` (which only byte-diffs the generated
  `primitives.md`) stays green without regeneration.

### 3. Docs index — `docs/adapters/`

- Add an adapters overview/index page (`docs/adapters/index.md`) linking
  the five per-library pages under `docs/adapters/reference/`:
  `canvas2d`, `lightweight-charts`, `uplot`, `echarts`, `konva` (the
  lightweight-charts page was rewritten in Task 6; uplot/echarts/konva
  created in Tasks 8/10/12; add a `reference/canvas2d.md` here for the
  reference adapter if one does not yet exist).
- Add the four new pages to the existing **"Reference"** sub-group of the
  `/adapters/` sidebar in `docs/.vitepress/config.ts` (it already lists
  `{ text: "Lightweight Charts", link: "/adapters/reference/lightweight-charts" }`
  — append uplot/echarts/konva/canvas2d entries with
  `/adapters/reference/<id>` links).
- Update `docs/getting-started/write-your-first-adapter.md` to mention the
  geometry layer + point at the five examples as starting points.
- Run `pnpm docs:check` (and `docs:build` if the gate requires it).

### 4. Root README — `README.md`

Add the five adapters to the adapter list/table (keep the root README ≤ 300
lines). Mention the shared geometry layer in one line.

### Edge cases

- The runner must not fail hard when an adapter is not yet built — log and
  continue (CI builds all before conformance, but local runs may not).
- Keep the exit-code contract: non-zero iff any adapter reports failures.
- Do not introduce a public-package API change here (scripts/docs/skills
  only) — no changeset unless `scripts/CLAUDE.md`-tracked behaviour counts.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `scripts/run-conformance.ts` | Modify | iterate all five adapter default exports |
| `scripts/CLAUDE.md` | Modify (if applicable) | note multi-adapter runner |
| `skills/chartlang-setup/**` | Modify | geometry layer + four new adapters |
| `docs/adapters/index.md` | Create | five-adapter overview index |
| `docs/adapters/reference/canvas2d.md` | Create (if absent) | reference-adapter page |
| `docs/.vitepress/config.ts` | Modify | add reference entries for uplot/echarts/konva/canvas2d |
| `docs/getting-started/write-your-first-adapter.md` | Modify | geometry-layer authoring pattern |
| `README.md` | Modify | list all five adapters |

## Gates

- `pnpm typecheck` / `pnpm lint`
- `pnpm conformance` (all five adapters green via the new runner)
- `pnpm docs:check` / `pnpm docs:build`
- `pnpm readme:check` (root ≤ 300 lines)
- `pnpm skills:gate` (if the setup skill is generated)

## Changeset

No public-package change → no changeset (the adapter-kit minor was landed
in Tasks 1–3). If `scripts/`/`skills:gate` policy requires one, add a
docs-only patch changeset.

## Acceptance Criteria

- `pnpm conformance` runs and reports all five adapters; exits non-zero
  only on a real failure.
- `skills/chartlang-setup` documents the geometry layer + the four new
  adapters and the two integration strategies; `skills:gate` green.
- `docs/adapters/` indexes all five with working nav; `docs:check`/`docs:build`
  green.
- Root README lists the five adapters and stays ≤ 300 lines.
- All gates green.
