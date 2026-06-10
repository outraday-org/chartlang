# Conformance `--report`: CONFORMANCE.md + JSON sidecar + drift gate

> **Status: Complete**

## Goal

Ship public conformance reports per PLAN §17.5: extend
`runConformanceSuite` with per-scenario results, add a pure markdown
renderer, teach `scripts/run-conformance.ts` a `--report` flag that
writes `CONFORMANCE.md` + `conformance-report.json` at the adapter
package root, check both files in for the canvas2d reference adapter,
and gate drift in CI with a `--check` mode (byte-compare, mirroring
the `docs:gate` pattern).

## Prerequisites

- Task 6 — the spec pages this report links to exist.

## Current Behavior

- `ConformanceReport`
  (`packages/conformance/src/runConformanceSuite.ts:182`) is
  `{ passed: number; failed: number; failures: ConformanceFailure[] }`
  — aggregate only. Per-scenario pass/fail is not retained.
- `scripts/run-conformance.ts` imports the suite + the canvas2d
  adapter, prints `conformance: N scenarios passed, M failures.` and
  exits. No argument parsing.
- No `CONFORMANCE.md` exists anywhere in the repo.

## Desired Behavior

- `ConformanceReport` gains a `scenarios` array (additive — existing
  fields untouched):

  ```ts
  export type ScenarioResult = {
      readonly id: string;
      readonly title: string;
      readonly status: "pass" | "fail";
      readonly failures: ReadonlyArray<ConformanceFailure>;
  };
  // ConformanceReport gains:
  //   readonly scenarios: ReadonlyArray<ScenarioResult>;
  ```

- A pure renderer ships from the conformance package:

  ```ts
  export function renderConformanceMarkdown(
      report: ConformanceReport,
      meta: { adapterName: string; generatedBy: string },
  ): string;
  ```

  Output shape (per §17.5):
  - Title + adapter name + suite version (`generatedBy`, e.g.
    `@invinite-org/chartlang-conformance@1.0.0`). **No timestamp** —
    the file must be byte-reproducible for the drift gate.
  - Summary line: `N passed / M failed / T total`.
  - Table: `| scenario id | title | status |`, sorted by id.
  - For each failed scenario, a fenced diff-snippet block from its
    `ConformanceFailure` messages.

- A sibling `renderConformanceJson(report, meta): string` emits the
  stable JSON sidecar: `{ adapterName, generatedBy, passed, failed,
  scenarios: [...] }`, 4-space-indented, sorted keys, trailing
  newline — byte-reproducible.

- `scripts/run-conformance.ts` parses argv (`node:util parseArgs`):
  - no flags — current behaviour, unchanged output.
  - `--report` — additionally writes
    `examples/canvas2d-adapter/CONFORMANCE.md` and
    `examples/canvas2d-adapter/conformance-report.json`.
  - `--report --check` — renders to memory and byte-compares against
    the committed files; exit 1 on drift with a "run
    `pnpm conformance --report` and commit" hint (mirrors
    `scripts/docs-gate.ts` drift messages).

- Root `package.json` gains
  `"conformance:report": "pnpm tsx scripts/run-conformance.ts --report"`;
  CI runs `pnpm tsx scripts/run-conformance.ts --report --check`
  after the existing `pnpm conformance` step.

- Both canvas2d report files are committed and green.

## Requirements

### 1. `ScenarioResult` + report widening

In `packages/conformance/src/runConformanceSuite.ts`: collect
per-scenario outcomes where the runner already iterates scenarios.
`failures` (flat array) keeps its existing aggregation; each
`ScenarioResult.failures` holds only that scenario's entries. Freeze
the new arrays like the rest of the report. JSDoc: `@since 1.0`,
`@stable`, `@example`.

### 2. Renderers — new module `packages/conformance/src/report/renderReport.ts`

Pure functions, no I/O, no clock. Export both renderers from the
package barrel (`packages/conformance/src/index.ts`). The markdown
renderer escapes `|` in titles; the JSON renderer uses a stable
key-order serialiser (explicit object literal construction is
sufficient — do not pull a dependency).

Unit tests co-located (`renderReport.test.ts`):
- empty report (0 scenarios) renders valid markdown + JSON;
- all-pass report has no diff-snippet section;
- failing scenario renders its fenced snippet;
- pipe-escaping in titles;
- JSON output round-trips `JSON.parse` and key order is stable across
  two calls (string equality).
- property test (fast-check, pinned seed): for arbitrary scenario
  results, markdown table row count == scenario count + header rows;
  JSON parse-roundtrip equality.

### 3. `scripts/run-conformance.ts` extension

Keep the existing no-runner fallback (`noRunner()`) intact — `--report`
with no runner exits 0 with the same message and writes nothing.
File writes use `node:fs/promises`. The `--check` compare reads the
committed files; a missing committed file is drift.

Script-level tests live in the existing scripts test setup
(`pnpm test:scripts`, `scripts/vitest.config.ts`) — cover arg
parsing and the drift-compare branches with an injected fake runner
module if the existing script tests have that seam; otherwise cover
the pure helpers by extracting them into the script file's exported
functions (the scripts config runs `*.test.ts` siblings).

### 4. Canvas2d report

Run `pnpm conformance:report`, commit
`examples/canvas2d-adapter/CONFORMANCE.md` +
`conformance-report.json`. Add both to the adapter's
`files` allowlist? **No** — the example package is `private: true`
and unpublished; the files just live in the repo per §17.5.

### 5. CI wiring

In `.github/workflows/ci.yml`, after `pnpm conformance`:

```yaml
            - run: pnpm tsx scripts/run-conformance.ts --report --check
```

### 6. Docs

- `docs/adapters/conformance.md` (13-line stub): add a short section
  "Publishing your conformance report" — the `--report` flow, what
  the two files contain, where adapter authors check them in (their
  own repo root, per §15.2). Keep the page lean; the full tutorial
  lands in Task 8.
- New exports get `@since 1.0` + `@stable` JSDoc; auto-generated
  primitive pages are unaffected (conformance isn't in the gen-docs
  source set) but `pnpm docs:check` runs over the package — comply.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/conformance/src/runConformanceSuite.ts` | Modify | `ScenarioResult` + `scenarios` field. |
| `packages/conformance/src/report/renderReport.ts` | Create | Pure markdown + JSON renderers. |
| `packages/conformance/src/report/renderReport.test.ts` | Create | Unit + property tests. |
| `packages/conformance/src/index.ts` | Modify | Barrel re-exports. |
| `scripts/run-conformance.ts` | Modify | `--report` / `--check` argv handling + writes. |
| `scripts/run-conformance.test.ts` | Create | Arg parsing + drift-compare coverage (scripts vitest config). |
| `examples/canvas2d-adapter/CONFORMANCE.md` | Create (generated) | Public report, checked in. |
| `examples/canvas2d-adapter/conformance-report.json` | Create (generated) | Machine-readable sidecar. |
| Root `package.json` | Modify | `conformance:report` script. |
| `.github/workflows/ci.yml` | Modify | Drift-gate step. |
| `docs/adapters/conformance.md` | Modify | Publishing section. |
| `.changeset/phase7-conformance-reports.md` | Create | Minor on conformance. |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (100% coverage on `packages/conformance/src/report/`
  and touched runner lines)
- `pnpm test:scripts`
- `pnpm conformance`
- `pnpm tsx scripts/run-conformance.ts --report --check` (new gate —
  must pass against the committed files)
- `pnpm docs:check`, `pnpm docs:build`, `pnpm readme:check`

## Changeset

`.changeset/phase7-conformance-reports.md`:

```md
---
"@invinite-org/chartlang-conformance": minor
---

Public conformance reports per PLAN §17.5: `ConformanceReport` gains
per-scenario results, and new pure renderers
(`renderConformanceMarkdown`, `renderConformanceJson`) emit the
`CONFORMANCE.md` + `conformance-report.json` pair that
`pnpm conformance --report` writes at an adapter's package root.
```

## Acceptance Criteria

- [ ] `ConformanceReport.scenarios` lands additively; existing report
      consumers compile unchanged.
- [ ] Renderers are pure, byte-reproducible (no timestamps), and
      covered by unit + property tests at 100%.
- [ ] `pnpm conformance:report` writes both canvas2d files; both are
      committed.
- [ ] `--report --check` drift gate is green in CI and fails on a
      locally-induced drift (experiment recorded in PR description).
- [ ] `docs/adapters/conformance.md` documents the publishing flow.
- [ ] All gates green; changeset committed.
