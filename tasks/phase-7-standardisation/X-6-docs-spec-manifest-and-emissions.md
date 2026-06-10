# Spec: `manifest.md` + `emissions.md`

> **Status: Complete**

## Goal

Expand the two contract-facing spec stubs: `docs/spec/manifest.md`
(the `ScriptManifest` JSON sidecar schema) and
`docs/spec/emissions.md` (the wire schemas for every Plot / Drawing /
Alert / AlertCondition / Log payload crossing the adapter boundary).
Together with Tasks 4–5 this completes the canonical `apiVersion: 1`
spec — an adapter author must be able to implement the contract from
these pages alone.

## Prerequisites

- Task 5 (`semantics.md`) — emissions cross-link the emission-ordering
  and capability-fallback sections.

## Current Behavior

Both files are 12-line Phase-0 stubs. The real schemas live in
`packages/core/src/types.ts` (`ScriptManifest`),
`packages/compiler/src/manifest.ts` (`buildManifest` — the recursive
freeze + exact field set), and
`packages/adapter-kit/src/types.ts` (`PlotEmission`,
`DrawingEmission`, `AlertEmission`, `AlertConditionEmission`,
`LogEmission`, `RuntimeDiagnostic`, `DiagnosticCode`, `Capabilities`)
plus `packages/adapter-kit/src/validation/validateEmission.ts`.

## Desired Behavior

Two complete, self-contained spec documents whose field tables are
verified 1:1 against the shipped types.

## Requirements

### 1. `docs/spec/manifest.md` — required sections

1. **Purpose.** The manifest is the JSON sidecar the compiler emits
   alongside the compiled bundle; hosts render inputs and gate
   capabilities from it **without executing user code**.
2. **Schema.** One table row per `ScriptManifest` field, derived from
   `buildManifest` (`packages/compiler/src/manifest.ts:31`):
   `apiVersion` (literal 1), `kind`
   (`indicator | drawing | alert | alertCondition`), `name`,
   `inputs` (descriptor record — sub-table of the input-descriptor
   shape per kind, including `uiHint` semantics), `capabilities`
   (`CapabilityId[]`), `requestedIntervals`,
   `userPickableInterval`, `seriesCapacities`, `maxLookback`, and
   the optional fields: `maxBarsBack`, `format`
   (`price | volume | percent | compact`), `precision`, `scale`
   (`price | left | right | new`), `requiresIntervals`, `shortName`,
   `alertConditions` (id / title / description / defaultMessage).
3. **Construction guarantees.** Recursively frozen; arrays copied;
   deterministic for identical source (callsite-id stability).
4. **JSON-compatibility.** The manifest round-trips through
   `JSON.stringify` / `structuredClone` unchanged — no functions, no
   class instances, no bigints, no NaN in any field.
5. **Versioning hook.** Additive optional fields are `1.x`-legal;
   removing or re-typing a field requires `apiVersion: 2` (link
   `versioning.md`).

### 2. `docs/spec/emissions.md` — required sections

1. **Wire-safety invariant.** Every emission is JSON-friendly and
   `structuredClone`-safe; the same bytes cross a Worker
   `postMessage` or a QuickJS membrane unchanged. State the
   `validateEmission` rules: no bigints, no NaN (where the schema
   forbids it), no class instances, no functions.
2. **Per-emission schemas.** One section per emission type with a
   field table verified against `packages/adapter-kit/src/types.ts`:
   - `PlotEmission` — including the full `PlotKind` union (pinned
     set; enumerate every member) and the `pane` semantics
     (`"overlay" | "new" | <literal id>`).
   - `DrawingEmission` — the `DrawingKind` union (all 62 members
     enumerated, grouped as in `docs/primitives/draw/`), world-point
     anchor semantics, handle id + sub-id structure, style payload.
   - `AlertEmission` — message, severity, meta record constraints.
   - `AlertConditionEmission` — condition id linkage to the
     manifest's `alertConditions`.
   - `LogEmission` — level union, message, meta.
   - `RuntimeDiagnostic` — the full `DiagnosticCode` union, one row
     per code with when-it-fires prose.
3. **Ordering + delivery.** Reference (not duplicate)
   `semantics.md`'s emission-ordering section; specify here only
   what the *adapter* may assume about batching and per-bar grouping.
4. **Capability gating.** For each emission family, which
   `Capabilities` key gates it and what the silent no-op +
   `unsupported-*` diagnostic looks like on the wire.
5. **Conformance hooks.** How `runConformanceSuite` exercises these
   schemas (capability honesty, wire-schema compliance, determinism
   — the §15.3 trio), linking the conformance docs page.

### 3. Verification discipline

Every union the spec enumerates (`PlotKind`, `DrawingKind`,
`DiagnosticCode`, `Capabilities` keys, manifest field set) MUST be
mechanically diffed against the shipped types at writing time —
copy the union from `types.ts`, sort, compare. Membership mismatches
between spec table and type union are a task failure. Record the
diff method in the PR description.

### 4. Style rules

Same as Tasks 4–5: normative voice, self-contained (the *schemas* are
restated in the doc, not linked to source), front-matter
(`since: "1.0"`, `status: "stable"`), closing **Conformance
checklist** per document.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `docs/spec/manifest.md` | Rewrite | Canonical `ScriptManifest` schema. |
| `docs/spec/emissions.md` | Rewrite | Canonical emission wire schemas. |
| `docs/adapters/contract.md` | Modify | One-line pointer to `emissions.md` (stub stays otherwise). |

## Gates

- `pnpm docs:build`
- `pnpm docs:check`
- `pnpm readme:check`
- `pnpm lint`

## Changeset

None — docs-only.

## Acceptance Criteria

- [ ] `manifest.md` field table matches `buildManifest`'s output
      field-for-field (mechanical diff recorded in the PR).
- [ ] `emissions.md` enumerates every member of `PlotKind`,
      `DrawingKind`, and `DiagnosticCode` with zero membership drift
      from `packages/adapter-kit/src/types.ts`.
- [ ] Wire-safety invariant + capability gating documented per
      emission family.
- [ ] Both documents self-contained with conformance checklists.
- [ ] `pnpm docs:build` green.
