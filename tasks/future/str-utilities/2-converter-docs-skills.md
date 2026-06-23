# Task 2 — Pine `str.*` converter mapping + conformance + docs/skills/example

> **Status: TODO**

## Goal

Map Pine Script's `str.*` calls onto the chartlang `str` namespace in the
pine-converter, add one conformance scenario exercising formatted text in a
`draw.table`, and publish the author-facing surface (docs reference page,
author-skill reference entry, one runnable example).

## Prerequisites

- Task 1 (core `str` namespace + ambient shim) complete.

## Current Behavior

- The Pine converter (`packages/pine-converter/src/transform/`) maps several
  call families but has no `str.*` mapping — a Pine `str.tostring(...)` today
  has no chartlang target.
- The author skill references live in
  `skills/chartlang-coding/references/` (`primitives.md` is auto-generated for
  `ta`/`draw`; `translating-from-pine.md` is hand-maintained).
- Docs reference pages live under `docs/` (`docs/language/`, `docs/primitives/`).

## Desired Behavior

| Pine | chartlang |
|------|-----------|
| `str.tostring(x)` / `str.tostring(x, "#.##")` | `str.tostring(x, "#.##")` |
| `str.format("{0} {1}", a, b)` | `str.format("{0} {1}", a, b)` |
| `str.length(s)` | `str.length(s)` |
| `str.contains(s, t)` | `str.contains(s, t)` |
| `str.replace_all(s, t, r)` | `str.replaceAll(s, t, r)` |
| `str.split(s, sep)` | `str.split(s, sep)` |
| `str.upper(s)` / `str.lower(s)` | `str.upper(s)` / `str.lower(s)` |
| `str.tostring(x, format.mintick)` | **unsupported** → emit a `// TODO` comment + converter diagnostic (deferred per README) |

## Requirements

### 1. Converter mapping (`packages/pine-converter/src/transform/`)

- Add a `str.*` member-call transform following the existing family
  transforms' structure (locate the file that maps namespaced calls — e.g.
  the `ta.*` / `math.*` family transform — and add a `str` case, or a new
  `strFamily.ts` if families are file-per-namespace; match the established
  layout).
- Identity-map the names in the table above; convert Pine's snake_case
  (`replace_all`) to chartlang camelCase (`replaceAll`).
- For `str.tostring(x, format.mintick)` and any unmapped `str.*` member, emit
  a converter diagnostic (reuse the existing `unsupported-*` diagnostic code
  family in `packages/pine-converter/src/diagnostics/codes.ts`) and pass the
  call through with a `// TODO:` annotation rather than failing the whole
  conversion.
- Co-locate converter unit tests (golden in → chartlang out) next to the
  transform, covering each mapped name + the unsupported path.

### 2. Conformance scenario (`packages/conformance/src/scenarios/`)

- Add `strFormattedTable.scenario.ts` mirroring the existing
  `plotKind*`/table scenario shape: a tiny script that builds a `draw.table`
  whose cell text comes from `str.format` / `str.tostring`, asserting the
  emitted `DrawingEmission` text payload is byte-stable across **all** adapters.
  `pnpm conformance` replays every registered scenario through every adapter
  (canvas2d, echarts, konva, lightweight-charts, uplot), so a registered
  scenario *is* the all-adapter proof.
- Register it in the scenario index the conformance runner enumerates.

### 3. Docs (`docs/`)

- Add a `str` reference page under the language/namespaces section (mirror the
  `color` reference page layout). One row per method: signature, description,
  example output. Document the `"#.##"` vs `"0.0000"` mask semantics and the
  no-locale guarantee.
- Add the page to the docs sidebar/nav config.
- Keep within the README ≤ 100-line / page conventions.

### 4. Author skill (`skills/chartlang-coding/`)

- Add a `str.*` section to `references/translating-from-pine.md` (the Pine →
  chartlang mapping table above).
- If `SKILL.md` enumerates available namespaces, add `str` to the inventory.
- `str.*` is **not** in the auto-generated `primitives.md` (that generator is
  `ta`/`draw` only) — do not run `pnpm skills:generate` expecting it there;
  document `str` by hand alongside `color`.

### 5. Example + live-demo wiring (`examples/scripts/` + `apps/site`)

Follow the established example pipeline (see `examples/CLAUDE.md`,
`apps/CLAUDE.md`, `tasks/examples-full-coverage/`):

1. **Source** — add `examples/scripts/str-formatted-hud.chart.ts`: a compact
   indicator rendering a `draw.table` HUD with `str.format`/`str.tostring`-built
   rows (`O/H/L/C` to `"#.##"`).
2. **e2e compile** — append the file to `EXAMPLE_SCRIPTS` in
   `packages/cli/src/e2e.test.ts:13` so it compiles end-to-end in CI.
3. **Live demo + docs Examples** — add a `DEMO_SCRIPTS` entry in
   `apps/site/src/components/demo/scripts.ts` (`{ id, label, description,
   source }`, `source` **inlined as a string** per that file's convention). If
   the categorized demo dialog (`tasks/examples-full-coverage`) has landed,
   place it in the language/utilities category.
4. **Generate + gate** — run `pnpm examples:generate` to render
   `docs/examples/*` + the Examples nav; keep `pnpm examples:gate` green.

> These namespace utilities are not `ta.*`/`draw.*`, so the per-primitive
> example **coverage gate** in `tasks/examples-full-coverage` does not require
> them — but they must still appear in `DEMO_SCRIPTS` so the live demo + docs
> Examples list them.

### 6. Adapters — no new capability, verified across all (`examples/*-adapter/`)

`str.*` is pure compute: its outputs are plain `string`s consumed by the
already-shipped `draw.text` / `draw.table` / `draw.marker` / `alert` holes. It
emits **no new wire primitive** and needs **no adapter code change** — given
`tasks/adapter-feature-parity/` is implemented, every adapter (canvas2d,
echarts, konva, lightweight-charts, uplot) already renders the resulting text
payloads. Coverage is by **verification, not re-implementation**:

- The conformance scenario (§2) is the all-adapter proof — `pnpm conformance`
  replays it through every adapter and asserts byte-stable text payloads. Do
  not add per-adapter code.
- State this explicitly in the changeset/PR so a reviewer does not expect
  adapter diffs.

### 7. react-starter — compile-path verification (`apps/react-starter/`)

The react-starter seam (`src/lib/chart/activeAdapter.ts`,
`src/lib/chart/seamVariants.ts`) is library-agnostic: new language features flow
through the compiler automatically, so **no seam change** is required. Verify
the namespace is accepted end-to-end through the starter:

- Add a minimal case to `apps/react-starter/tests/compile.spec.ts` that POSTs a
  source using `str.format`/`str.tostring` in a `draw.table` to `/api/compile`
  and asserts a clean compile.
- `apps/react-starter/tests/adapter-matrix.spec.ts` already proves all five
  seam variants build — no change needed; reference it as the
  all-adapter-bundles guarantee.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/pine-converter/src/transform/strFamily.ts` (or existing family file) | Create/Modify | Map `str.*` Pine calls. |
| `packages/pine-converter/src/transform/strFamily.test.ts` | Create | Converter unit tests. |
| `packages/conformance/src/scenarios/strFormattedTable.scenario.ts` | Create | Formatted-table conformance. |
| `packages/conformance/src/scenarios/index.ts` (or registry) | Modify | Register scenario. |
| `docs/language/str.md` (path per nav) | Create | Reference page. |
| `docs/.vitepress/config.*` | Modify | Sidebar entry. |
| `skills/chartlang-coding/references/translating-from-pine.md` | Modify | Pine mapping table. |
| `examples/scripts/str-formatted-hud.chart.ts` | Create | Runnable example. |
| `packages/cli/src/e2e.test.ts` | Modify | Add example to `EXAMPLE_SCRIPTS`. |
| `apps/site/src/components/demo/scripts.ts` | Modify | `DEMO_SCRIPTS` entry (live demo + docs Examples). |
| `apps/react-starter/tests/compile.spec.ts` | Modify | Compile-path case for `str.*` (proves the starter accepts the namespace). |
| `.changeset/str-converter.md` | Create | patch (pine-converter, conformance). |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (coverage 100% on pine-converter + conformance)
- `pnpm conformance` (the scenario runs through every adapter)
- `pnpm docs:check`
- `pnpm readme:check`
- `pnpm examples:gate` (after `pnpm examples:generate`)
- `pnpm skills:gate` (if skill references change)
- `pnpm -F chartlang-react-starter e2e` (Playwright compile + adapter-matrix specs)

## Changeset

`.changeset/str-converter.md` — **patch** (pine-converter, conformance).

## Acceptance Criteria

- Every Pine `str.*` name in the table converts; unsupported `mintick` form
  emits a diagnostic + `// TODO`, never a hard failure.
- Conformance scenario passes across **all** adapters (canvas2d, echarts,
  konva, lightweight-charts, uplot) via `pnpm conformance`; text payload is
  byte-stable.
- Docs page renders and is in the nav; skill mapping table updated.
- Example compiles in e2e (`EXAMPLE_SCRIPTS`) and appears in the live demo
  (`DEMO_SCRIPTS`); `examples:gate` green.
- No adapter code change required (documented in the changeset); react-starter
  compile-path case green and the adapter-matrix spec proves all five seam
  variants bundle.
- Coverage + docs + readme + conformance + skills + react-starter gates green;
  changeset committed.
