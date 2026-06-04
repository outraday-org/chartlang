# Task 30 — Phase 2 closeout: registry verification + `0.2` version bump + changeset

> **Status: TODO**

## Goal

Verify the full Phase-2 surface lands at the expected
cardinalities, bump every published package to `0.2.0`, write the
phase-closing changeset, and confirm every gate is green against
the §9.2 indicator catalogue. This is the final task in the
phase — no new code, just verification + version bumps.

## Prerequisites

- Tasks 1-29 complete.

## Current Behavior

End-of-Phase-2 state from Tasks 1-29:

- `TA_REGISTRY` cardinality = 90 (9 Phase-1 + 6 cross-functional +
  ~75 §9.2 ports).
- `STATEFUL_PRIMITIVES` has the matching 90 entries plus `plot`,
  `hline`, `alert` (Phase 1 surfaces).
- `PlotKind` carries 9 values; canvas2d adapter declares all 9.
- `lib/` carries the chained-MA family + stats helpers.
- Universal `opts.offset` honoured everywhere.
- `gen-docs.ts` writes `docs/primitives/ta/<id>.md` per primitive.

But package versions still read `0.1.x`.

## Desired Behavior

After this task:

- Every published `@invinite-org/chartlang-*` package's
  `package.json#version` reads `0.2.0`.
- `apiVersion: 1` script header unchanged (Phase 2 is purely
  additive at runtime).
- `STATEFUL_PRIMITIVES` cardinality assertion in
  `packages/core/src/statefulPrimitives.test.ts` pinned at the
  final count (93 — 90 `ta.*` + `plot` + `hline` + `alert`).
- `TA_REGISTRY` cardinality assertion in
  `packages/runtime/src/ta/registry.test.ts` pinned at 90.
- `pnpm conformance` runs through all ~90 scenarios green.
- Single phase-closing changeset summarising the surface delta.
- `CHANGELOG.md` per package updated by `pnpm changeset version`.

## Requirements

### 1. Registry verification test

Add `packages/conformance/src/scenarios/phase2Coverage.test.ts`:

```ts
import { TA_REGISTRY } from "@invinite-org/chartlang-runtime";
import { STATEFUL_PRIMITIVES } from "@invinite-org/chartlang-core";
import { PHASE_2_INDICATORS } from "./phase2Inventory"; // hand-written list

describe("Phase 2 surface", () => {
    test("every PLAN §9.2 indicator has a ta.* primitive", () => {
        for (const id of PHASE_2_INDICATORS) {
            expect(TA_REGISTRY).toHaveProperty(id);
        }
    });
    test("TA_REGISTRY cardinality", () => {
        expect(Object.keys(TA_REGISTRY).length).toBe(90);
    });
    test("STATEFUL_PRIMITIVES cardinality", () => {
        // Task 5 widened the entry shape to
        // `{ name: string; slot: boolean }` but kept the container
        // a `ReadonlySet`, so `.size` still works.
        expect(STATEFUL_PRIMITIVES.size).toBe(93);
    });
    test("ta.nz is the only slot:false entry", () => {
        const stateless = [...STATEFUL_PRIMITIVES].filter((e) => e.slot === false);
        expect(stateless.map((e) => e.name)).toEqual(["ta.nz"]);
    });
});
```

`packages/conformance/src/scenarios/phase2Inventory.ts` is a
hand-written list of every §9.2 primitive that ships in Phase 2,
sourced from the README's task table. Maintained as the source of
truth for phase verification — a divergence (a missing primitive,
an extra one) fails the test.

`phase2Inventory.ts` is a `ReadonlyArray<string>` of names. The
deferred primitives (`correlationCoeff`, 4 volume-profile, 7
trade-narrative externals) are explicitly listed under a
`PHASE_5_DEFERRED` constant in the same file for clarity.

### 2. Conformance run

Run `pnpm conformance` against the canvas2d adapter. Expected:

- ~85 scenarios pass (3 from Phase 1 + 1 plot-kind coverage
  scenario from Task 1 + 6 cross-functional from Task 5 + ~75
  port-batch scenarios from Tasks 6–28). The §9.4 helper tasks
  (3 and 4) do **not** add conformance scenarios — they're
  internal helpers; their consumer primitives carry the
  scenario coverage.
- Zero failures.
- Zero dropped emissions other than the documented
  `unsupported-plot-kind` cases — Phase 2 explicitly does NOT
  drop anything (`CANVAS2D_CAPABILITIES.plots` covers every Phase-
  2 kind).
- Every scenario uses Task 1's `Scenario.inlineSource` field
  (Phase-1 scenarios continue to use `scriptPath`).

### 3. Version bumps

Apply via `pnpm changeset version` after running
`pnpm changeset add` with the closeout changeset (see §4). Verify
the bumps land:

| Package | New version |
|---|---|
| `@invinite-org/chartlang-core` | `0.2.0` |
| `@invinite-org/chartlang-compiler` | `0.2.0` |
| `@invinite-org/chartlang-runtime` | `0.2.0` |
| `@invinite-org/chartlang-host-worker` | `0.2.0` (additive — picks up runtime + adapter-kit updates) |
| `@invinite-org/chartlang-host-quickjs` | `0.1.0` (no change — Phase-5 territory) |
| `@invinite-org/chartlang-adapter-kit` | `0.2.0` |
| `@invinite-org/chartlang-language-service` | `0.1.0` (no change — Phase 4) |
| `@invinite-org/chartlang-editor` | `0.1.0` (no change — Phase 4) |
| `@invinite-org/chartlang-cli` | `0.2.0` (new `docs` subcommand) |
| `@invinite-org/chartlang-conformance` | `0.2.0` |

### 4. Closeout changeset

`.changeset/phase-2-closeout.md`:

```md
---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-adapter-kit": minor
"@invinite-org/chartlang-conformance": minor
"@invinite-org/chartlang-cli": minor
"@invinite-org/chartlang-compiler": minor
"@invinite-org/chartlang-host-worker": minor
---

Phase 2 — `0.2` full indicator parity.

- 81 new `ta.*` primitives (6 cross-functional + 75 §9.2 ports);
  `TA_REGISTRY` cardinality 9 → 90; `STATEFUL_PRIMITIVES`
  cardinality 12 → 93.
- 5 new chained-MA helpers + 5 new stats/volatility helpers in
  `packages/runtime/src/ta/lib/`.
- 6 new `PlotKind`s (histogram, bars, area, filled-band, label,
  marker) + canvas2d renderers + `validateEmission` arms.
- `Bar` extended with `hl2` / `hlc3` / `ohlc4` / `hlcc4` derived
  source fields — runtime already pre-computes on `BarView`.
- `Scenario` extended with `inlineSource?: string` so Phase-2
  scenarios stay self-contained without bloating
  `examples/scripts/`.
- `STATEFUL_PRIMITIVES` shape widened from `ReadonlySet<string>`
  to `ReadonlySet<{ name: string; slot: boolean }>` to support
  `ta.nz` (the only stateless `ta.*`).
- Universal `opts.offset` honoured on every `ta.*` primitive
  (Phase-1 backfill in Task 29).
- `chartlang docs` subcommand generates
  `docs/primitives/ta/<id>.md` per primitive.
- 100% coverage maintained across every published package.
- `apiVersion: 1` script header unchanged; Phase 2 is additive
  at runtime.
```

### 5. Coverage re-run

`pnpm test` runs the merged coverage report. Confirm 100% across
every published package on every metric (lines, statements,
branches, functions). Any breach is a fail — the closeout cannot
land if coverage slipped.

### 6. Bench summary

`pnpm bench:ci` runs the full Phase-2 bench matrix. Confirm
every primitive's `THRESHOLD_MS` is within the captured median ×
3 ceiling. The README captures the post-Phase-2 perf snapshot in
a new appendix "§Phase-2 perf baseline" — single table of
primitive → bench median (ms / 10 000 bars) for the Apple-silicon
reference machine.

### 7. README + docs gates

- `pnpm readme:check` — every package README ≤ 100 lines; root
  README ≤ 300 lines.
- `pnpm docs:gate` — every primitive has a generated page; no
  drift.
- `docs/primitives/ta/index.md` reflects the 90-entry surface.

### 8. PR description

Final PR body summarises the cardinality before/after, the
deferred surface (correlationCoeff + volume profiles + externals),
and links the closeout changeset.

## Files to Create / Modify

| File | Action | Purpose |
|---|---|---|
| `packages/conformance/src/scenarios/phase2Inventory.ts` | Create | Hand-written §9.2 inventory + deferred set. |
| `packages/conformance/src/scenarios/phase2Coverage.test.ts` | Create | Cardinality + presence assertions. |
| `.changeset/phase-2-closeout.md` | Create | Closeout changeset. |
| `packages/<every>/package.json` | Modify | `0.2.0` bumps via `pnpm changeset version`. |
| `packages/<every>/CHANGELOG.md` | Generate | `pnpm changeset version` writes per-package changelog. |
| `docs/primitives/ta/index.md` | Modify | Add Phase-2 entries (hand-written index). |
| `README.md` (root) | Modify | Update "Indicator parity" section to reflect Phase 2 complete + add bench appendix. |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (100% coverage everywhere)
- `pnpm bench:ci`
- `pnpm docs:check`
- `pnpm docs:gate`
- `pnpm readme:check`
- `pnpm conformance` (every scenario green)

## Changeset

The phase-closing changeset itself (`.changeset/phase-2-
closeout.md`) IS the deliverable. No additional changesets in this
task.

## Acceptance Criteria

- `phase2Coverage.test.ts` passes — `TA_REGISTRY` cardinality 90,
  `STATEFUL_PRIMITIVES` cardinality 93, every §9.2-listed
  primitive is registered.
- Every published package's `package.json` reads `0.2.0` (except
  `host-quickjs`, `language-service`, `editor` which stay at
  `0.1.0`).
- Generated per-package `CHANGELOG.md` updated by changeset.
- `pnpm conformance` green against the canvas2d adapter.
- All gates green; 100% coverage report.
- Root README's "Indicator parity" section updated.
- Phase-2 perf baseline appendix added to README.
- PR ready to merge.
