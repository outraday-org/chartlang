# Phase 7 — `1.0` Standardisation

> **Plan reference:** PLAN.md §19 Phase 7, with cross-cuts into §15
> (consumer-repo adapters), §3.3 (versioning), §17.1–§17.6 (docs +
> spec + conformance reports), §18 (build / publish / release).
> **Prerequisite:** Phases 1–6 shipped **including the Phase 6
> closeout** (`tasks/phase-6-tier3-ltf/7-phase-closeout.md`) — every
> package at `0.6.x`, all phase6-* changesets consumed, conformance
> green.
> **Version target:** `1.0.0` on every published package.

## Goal

Freeze `apiVersion: 1` and ship chartlang as a real standard. The
public surface becomes a contract: every shipping export is `@stable`,
every pre-1.0 deprecation is removed, the canonical language spec is
published at `chartlang.dev/spec`, public conformance reports render
for the reference adapter, the adapter-author path (scaffold → implement
→ conform → publish report) is proven end-to-end as the Lightweight
Charts portability story, and a single-button changesets release
publishes every `@invinite-org/chartlang-*` package to npm.

## Current State

- Every package sits at `0.5.0` / `0.6.0-pending` — Phase 6 source has
  landed (`core/src/time/`, `core/src/interval/`, `request.lowerTf`,
  `docs/spec/pine-migration.md`) and the five `phase6-*` changesets
  wait in `.changeset/` for the Phase 6 closeout to consume them.
- The compiler already structurally enforces `apiVersion: 1`
  (`packages/compiler/src/analysis/structuralChecks.ts:269–303`,
  diagnostic code `"api-version-mismatch"` in
  `packages/compiler/src/diagnostics.ts:18`) — but the error message
  still says "Only apiVersion: 1 is supported in Phase 1." and no
  spec document defines the freeze contract.
- `STATEFUL_PRIMITIVES` is pinned at **172** entries by
  `packages/core/src/statefulPrimitives.test.ts:204` (size-only pin —
  no name-set lock).
- Exactly **one** `@deprecated` export exists: `PHASE_1_SCENARIOS` in
  `packages/conformance/src/scenarios/index.ts` (alias of
  `ALL_SCENARIOS`, kept "for one release" since `0.2.1`).
- ~40+ source files across core / runtime / compiler / adapter-kit /
  conformance / cli still carry `@experimental` markers on shipping
  surfaces (every Phase 4–6 addition).
- The five spec docs (`docs/spec/grammar.md`, `semantics.md`,
  `manifest.md`, `emissions.md`, `versioning.md`) are Phase-0 stubs of
  12–15 lines each. `docs/spec/pine-migration.md` is the only real
  spec page (200 lines, 6 worked examples, audited against 5 scripts).
- `pnpm docs:build` runs `vitepress build docs` but **no
  `docs/.vitepress/` config exists** and the CI workflow does not run
  `docs:build`.
- `runConformanceSuite` returns `ConformanceReport = { passed, failed,
  failures }` (`packages/conformance/src/runConformanceSuite.ts:182`)
  — aggregate counts only, no per-scenario results, no markdown / JSON
  report emission. `scripts/run-conformance.ts` prints a one-line
  summary. No `CONFORMANCE.md` exists anywhere in the repo.
- `chartlang scaffold-adapter` writes six starter files
  (`packages/cli/src/adapterTemplate/templates.ts`, 230 lines) but the
  template only *mentions* the conformance suite in comments — the
  scaffolded package has no wired conformance test.
- `docs/adapters/writing-an-adapter.md` is a 12-line stub. No
  Lightweight Charts walkthrough exists.
- The CI release job in `.github/workflows/ci.yml` is intentionally
  commented out (manual §22.11 releases). Root `package.json` has
  `"release": "pnpm build && changeset publish"` but no
  `publish:release` script and no root `CHANGELOG.md`.

## Target State

- **Pre-freeze hygiene:** `PHASE_1_SCENARIOS` deleted; a sweep
  confirms zero remaining `@deprecated` exports; every shipping
  export promoted `@experimental` → `@stable`; regenerated
  `docs/primitives/` pages + hover registry committed.
- **Freeze:** compiler accepts **only** `apiVersion: 1` with
  release-grade messaging; `STATEFUL_PRIMITIVES` locked by an exact
  name-set test (not just cardinality); the freeze contract documented
  on the registry's JSDoc — additions require `apiVersion: 2`.
- **Spec site:** `docs/.vitepress/config.ts` wired with nav + sidebar
  mirroring §17.1; `pnpm docs:build` green and in CI; the five spec
  stubs expanded into the canonical, self-contained language spec
  (grammar, versioning, semantics, manifest, emissions). The `v1.0.0`
  git tag is the frozen spec snapshot — no directory duplication.
- **Public conformance reports:** `pnpm conformance --report` writes
  `CONFORMANCE.md` (scenario id × pass/fail table, diff snippets on
  fail per §17.5) **and** `conformance-report.json` at the adapter
  package root. The canvas2d report is checked in and drift-gated in
  CI (mirrors the `docs:gate` byte-compare pattern).
- **Adapter-author proof (Lightweight Charts story):** the scaffold
  template wires a runnable conformance test + report script;
  `docs/adapters/writing-an-adapter.md` is the full §17.4 tutorial;
  `docs/adapters/reference/lightweight-charts.md` walks the LWC port
  end-to-end (consumer-repo, per §15 — no LWC package in this repo).
- **Pine migration guide final:** a pattern-coverage matrix audited
  against the top ~50 public Pine scripts; gaps get new worked
  examples or explicit "not supported, see roadmap" entries; the
  guide is in the spec sidebar.
- **Release plumbing:** CI release job live (changesets/action@v1 +
  NPM_TOKEN + provenance); `pnpm publish:release` alias; root
  `CHANGELOG.md`; README announce section.
- **Closeout:** every package at `1.0.0` via a major changeset;
  `v1.0.0` tag = spec snapshot; GitHub release with coverage report.

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **Hard freeze: compiler accepts only `apiVersion: 1`** | Matches PLAN §3.3 with N locked to 1. Any other literal is a hard `api-version-mismatch` error. Future majors gate behind a new compiler flag — no speculative `apiVersion: 2` branch ships now. (User-confirmed.) |
| **Promote every shipping export to `@stable` at the freeze** | 1.0 means the surface IS the contract. A symbol not ready for that promise must be removed before the freeze, not shipped `@experimental`. (User-confirmed.) |
| **Remove `PHASE_1_SCENARIOS` + full deprecation sweep** | Phase README rule: pre-1.0 deprecations are removed, not carried as shims. The 1.0 major bump covers the break. (User-confirmed.) |
| **Git tag `v1.0.0` IS the frozen spec snapshot — single-version VitePress** | No `docs/spec/1.0/` copy, no version-switcher infrastructure for a single release. Versioned URLs can come later via tag-built deploys. (User-confirmed.) |
| **LWC adapter = contract proof, not a package** | Per §15 no chart-specific adapter ships in the OSS monorepo. The OSS deliverable is the proven *path*: hardened scaffolder + full adapter-author tutorial + LWC porting walkthrough. The adapter implementation lives in its consumer repo. (User-confirmed.) |
| **`--report` emits Markdown + JSON sidecar** | `CONFORMANCE.md` per §17.5 for humans; `conformance-report.json` for the spec site and CI tooling. Both at the adapter package root, both checked in, drift-gated like `docs:gate`. (User-confirmed.) |
| **CI-driven npm publish via changesets/action** | Single-button release per the phase done-criteria. Re-enables provenance; requires `NPM_TOKEN`. Manual §22.11 path stays documented as fallback. (User-confirmed.) |
| **Pine guide: pattern audit vs ~50 scripts, not 50 ports** | The deliverable is the coverage *matrix* — distinct idioms from the top ~50 scripts each mapped to a documented equivalent or an explicit gap entry. Worked examples are added only for uncovered idioms. (User-confirmed.) |
| **Spec content split into three sequential tasks (grammar+versioning / semantics / manifest+emissions)** | Each stub-pair expansion is a focused ~250-line spec. One mega "write the spec" task would sprawl past 700 lines and drift. Compiler-facing, runtime-facing, and contract-facing docs are natural seams. |
| **VitePress wiring lands before spec content** | `docs:build` fails on dead links — wiring it first means every content task validates against the real build instead of discovering link rot at closeout. |
| **`ConformanceReport` gains per-scenario results additively** | The report table needs id × pass/fail rows; the existing `{ passed, failed, failures }` shape stays untouched, a `scenarios` array is appended. Additive minor — safe even relative to the freeze (apiVersion governs the script language, not package semver). |
| **Hygiene sweep (Task 1) lands before the freeze audit (Task 2)** | The freeze audit verifies a *clean* surface. Auditing first and sweeping second would invalidate the audit. |

## Dependency Graph

```
1 pre-freeze-deprecation-and-stability-sweep
  |
  v
2 compiler-api-version-freeze-and-registry-lock
  |
  v
3 docs-vitepress-spec-site-wiring
  |
  v
4 docs-spec-grammar-and-versioning
  |
  v
5 docs-spec-semantics
  |
  v
6 docs-spec-manifest-and-emissions
  |
  v
7 conformance-public-reports
  |
  v
8 cli-adapter-author-proof
  |
  v
9 docs-pine-migration-pattern-audit
  |
  v
10 release-plumbing-ci-publish
  |
  v
11 phase-closeout
```

Execution is strictly sequential. Each task's prerequisites are
satisfied by all lower-numbered tasks.

## Task Summary Table

| # | Title | Package(s) | Dependencies | Est. Complexity |
|---|-------|------------|--------------|-----------------|
| 1 | [Pre-freeze deprecation removal + stability promotion sweep](./1-pre-freeze-deprecation-and-stability-sweep.md) | all | None | Medium |
| 2 | [Compiler `apiVersion: 1` freeze + `STATEFUL_PRIMITIVES` lock](./2-compiler-api-version-freeze-and-registry-lock.md) | compiler, core | 1 | Medium |
| 3 | [VitePress spec-site wiring + CI `docs:build` gate](./3-docs-vitepress-spec-site-wiring.md) | docs, CI | 2 | Medium |
| 4 | [Spec: `grammar.md` + `versioning.md`](./4-docs-spec-grammar-and-versioning.md) | docs | 3 | High |
| 5 | [Spec: `semantics.md`](./5-docs-spec-semantics.md) | docs | 4 | High |
| 6 | [Spec: `manifest.md` + `emissions.md`](./6-docs-spec-manifest-and-emissions.md) | docs | 5 | High |
| 7 | [Conformance `--report`: CONFORMANCE.md + JSON sidecar + drift gate](./7-conformance-public-reports.md) | conformance, scripts, canvas2d, CI | 6 | High |
| 8 | [Adapter-author proof: scaffold hardening + tutorial + LWC walkthrough](./8-cli-adapter-author-proof.md) | cli, docs | 7 | Medium |
| 9 | [Pine migration guide: pattern audit vs top ~50 scripts](./9-docs-pine-migration-pattern-audit.md) | docs | 8 | Medium |
| 10 | [Release plumbing: CI publish + CHANGELOG + announce](./10-release-plumbing-ci-publish.md) | CI, root | 9 | Medium |
| 11 | [Phase closeout — 1.0.0 major, tag, release](./11-phase-closeout.md) | all | 10 | Medium |

## Code Reuse

| Existing artefact | Reuse for |
|-------------------|-----------|
| `packages/compiler/src/analysis/structuralChecks.ts:269–303` apiVersion enforcement | Task 2 updates the message wording + tests; the enforcement mechanism is already correct. No new pass. |
| `packages/compiler/src/diagnostics.ts` `"api-version-mismatch"` code | Task 2 reuses the existing code — no new `CompileDiagnosticCode` entry. |
| `packages/core/src/statefulPrimitives.test.ts:204` size pin | Task 2 extends the existing test file with an exact name-set lock. Same file, same vitest suite. |
| `packages/conformance/src/runConformanceSuite.ts` `ConformanceReport` + `ConformanceFailure` | Task 7 widens additively with per-scenario results; the render function consumes the same types. |
| `scripts/run-conformance.ts` runner wrapper | Task 7 adds `--report` / `--check` arg parsing to the existing script — no new script file. |
| `scripts/docs-gate.ts` byte-compare drift pattern | Task 7's report drift gate mirrors the tmp-dir + byte-compare structure. |
| `scripts/docs-check.ts` JSDoc linter | Task 1 relies on it to verify the `@stable` sweep left no marker gaps; no changes to the script itself. |
| `scripts/gen-hover-registry.ts` + `pnpm hover:check` | Task 1 regenerates the hover registry after the marker sweep. |
| `packages/cli/src/commands/genDocs.ts` / `extractDrawingPages.ts` / `genPhase4Docs.ts` | Task 1 regenerates every `docs/primitives/` page after the JSDoc sweep via `pnpm chartlang docs`. |
| `packages/cli/src/adapterTemplate/templates.ts` six-file template | Task 8 extends the template constants in place — no parallel template module. |
| `packages/cli/src/commands/scaffoldAdapter.ts` + tests | Task 8 extends the existing command + its test file. |
| `docs/spec/pine-migration.md` (200 lines, Phase 6) | Task 9 extends this file — the worked-example structure and front-matter stay. |
| `.github/workflows/ci.yml` commented release block | Task 10 uncomments and finishes it — the block is already drafted. |
| Root `package.json` `"release"` script | Task 10 adds the `publish:release` alias on top; changesets config (`.changeset/config.json`) is already correct (`access: public`). |
| PLAN.md §3.3 / §4 / §5 / §6 / §7 / §17.3 | Tasks 4–6 expand these sections into the spec — the content source is the plan itself, not new design work. |
| `docs/index.md` + existing stub pages | Task 3's sidebar links every existing page; stubs outside `docs/spec/` keep their stub content (deferred below). |

## Provenance

Phase 7 carries **no ports from `../invinite/`**. Every task is
governance, documentation, or release tooling over the existing
surface. No provenance headers are introduced.

## Deferred / Follow-Up Work

The following are intentionally **NOT** in Phase 7 scope:

- **Expanding the non-spec doc stubs** (`docs/language/*`,
  `docs/hosts/*`, `docs/getting-started/*`) — the 1.0 contract is the
  spec (`docs/spec/`); tutorial content lands incrementally in `1.x`.
  Task 3 links the stubs so the site builds; their content is follow-up.
- **The Lightweight Charts adapter implementation** — lives in its own
  consumer repo per §15. This repo ships the proven path (Task 8);
  the adapter's own tracker owns its implementation tasks.
- **Versioned spec URLs / VitePress version switcher** — the `v1.0.0`
  tag is the snapshot; multi-version doc builds land when `2.0` work
  starts.
- **`apiVersion: 2` compiler branch** — no speculative code. The new
  flag lands with the first apiVersion-2 feature.
- **Strategy primitives, library scripts, marketplace metadata,
  persistent collections, `barstate.security(handle)`** — "Beyond
  1.0" per PLAN §19.
- **Tick-/range-based intervals, cross-symbol `request.security`,
  session-aware indicators** — deferred from Phase 6, still deferred.
- **Conformance reports for third-party adapters** — adapter authors
  generate + publish their own `CONFORMANCE.md` (Task 7 ships the
  tooling; §15.2 keeps publication decentralised).

## Done criteria

Phase 7 closes when:

- [x] Zero `@deprecated` exports remain; every shipping export is
      `@stable`; `pnpm docs:check` + `pnpm docs:gate` +
      `pnpm hover:check` green.
- [x] Compiler accepts only `apiVersion: 1` with release wording;
      `STATEFUL_PRIMITIVES` locked by exact name-set test.
- [x] `pnpm docs:build` green locally and in CI; the five spec docs
      are self-contained (no "see the source code" references).
- [x] `pnpm conformance --report` writes `CONFORMANCE.md` +
      `conformance-report.json` for the canvas2d adapter; both are
      checked in and drift-gated in CI.
- [x] `chartlang scaffold-adapter` output contains a runnable
      conformance test + report script; the adapter-author tutorial
      and LWC walkthrough are published.
- [x] Pine migration guide carries the pattern-coverage matrix audited
      against the top ~50 Pine scripts — every idiom has a documented
      equivalent or an explicit roadmap note.
- [ ] `pnpm publish:release` works end-to-end via changesets; the CI
      release job is live.
- [ ] Every published package is at `1.0.0`; `v1.0.0` tag pushed;
      GitHub release carries the coverage report and announce notes.
