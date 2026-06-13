# Compiler `apiVersion: 1` freeze + `STATEFUL_PRIMITIVES` lock

> **Status: Complete**

## Goal

Turn the existing structural `apiVersion: 1` check into the formal
freeze: release-grade diagnostics, an exact name-set lock on
`STATEFUL_PRIMITIVES`, and freeze-contract JSDoc on every surface that
the lock governs. After this task, any source-incompatible change to
the script-visible surface requires `apiVersion: 2` by construction.

## Prerequisites

- Task 1 (surface cleanup) — the freeze locks a *clean* surface.

## Current Behavior

- `packages/compiler/src/analysis/structuralChecks.ts:269–303`
  already rejects any `apiVersion` literal other than `1` and any
  missing `apiVersion` field, emitting `"api-version-mismatch"`
  (`packages/compiler/src/diagnostics.ts:18`). But:
  - The wrong-literal message (line ~283) reads `"Only apiVersion: 1
    is supported in Phase 1."` — phase-scoped wording that's wrong
    post-1.0.
  - The missing-field message (line ~303) reads
    `"defineIndicator/defineDrawing/defineAlert/defineAlertCondition
    requires apiVersion: 1."` — not phase-scoped, but generic enough
    that it doesn't communicate the freeze contract; Task 2 upgrades
    it to release-grade wording for parity with the wrong-literal
    case.
- `packages/core/src/statefulPrimitives.test.ts:204` pins
  `STATEFUL_PRIMITIVES.size` to **172** — a size pin only. Two
  same-size mutations (rename one primitive, add one + remove one)
  pass undetected.
- `STATEFUL_PRIMITIVES` JSDoc
  (`packages/core/src/statefulPrimitives.ts:223`) describes the
  registry but not the freeze contract.
- `CompileOptions.apiVersion: 1`
  (`packages/compiler/src/api.ts:214`) is typed as the literal `1` —
  already correct; JSDoc calls it "a forward-compat marker".

## Desired Behavior

- The `api-version-mismatch` diagnostics carry 1.0 wording:
  - Wrong literal: `` `apiVersion: ${found}` is not supported — this
    compiler implements the frozen `apiVersion: 1` contract. Future
    language versions require a compiler that declares support for
    them.``
  - Missing field: ``defineIndicator/defineDrawing/defineAlert/
    defineAlertCondition requires `apiVersion: 1` — the frozen
    language version this compiler implements.``
- `STATEFUL_PRIMITIVES` is locked by an **exact sorted name-list
  test** in `statefulPrimitives.test.ts`: the test embeds the full
  172-name array and asserts deep equality against
  `[...STATEFUL_PRIMITIVES].map(e => e.name).sort()`. Any rename,
  addition, or removal fails with a diff naming the exact entries.
- `STATEFUL_PRIMITIVES` + `STATEFUL_PRIMITIVES_BY_NAME` JSDoc gains a
  freeze paragraph: "Locked at `apiVersion: 1` (172 entries). Adding,
  removing, or renaming an entry is a language change and requires
  `apiVersion: 2` — see `docs/spec/versioning.md`."
- The compiler's `CompileOptions.apiVersion` JSDoc drops the
  "forward-compat marker" phrasing in favour of the freeze contract.

## Requirements

### 1. Diagnostic wording in `structuralChecks.ts`

Update both message strings (lines ~283 and ~303). The diagnostic
*code* (`"api-version-mismatch"`) and severity are unchanged — no
`CompileDiagnosticCode` union change, no adapter-kit change.

Update the corresponding assertions in
`packages/compiler/src/analysis/structuralChecks.test.ts` (the tests
asserting on message substrings) and any compile-level test in
`packages/compiler/src/compile.test.ts` that matches the old wording.

### 2. Name-set lock in `statefulPrimitives.test.ts`

Add to the existing suite (keep the size pin at line 204 — it's a
fast-failing first signal):

```ts
it("locks the apiVersion-1 registry to the exact 172-entry name set", () => {
    const names = [...STATEFUL_PRIMITIVES].map((e) => e.name).sort();
    expect(names).toEqual(FROZEN_API_V1_NAMES);
});
```

`FROZEN_API_V1_NAMES` is a sorted, hand-committed
`ReadonlyArray<string>` literal in the test file (generate it once via
a scratch script, then paste — it is deliberately *not* derived from
the registry at test time, that's the whole point). Include a comment
above the array:

```ts
// apiVersion: 1 freeze (Phase 7). Do NOT edit this list to make a
// failing test pass — a diff here is a language change and requires
// apiVersion: 2. See docs/spec/versioning.md.
```

### 3. Freeze JSDoc on the registry

In `packages/core/src/statefulPrimitives.ts`, extend the JSDoc of
`STATEFUL_PRIMITIVES` and `STATEFUL_PRIMITIVES_BY_NAME` with the
freeze paragraph from Desired Behavior. Keep existing `@since` /
`@example` tags; markers are `@stable` after Task 1.

### 4. `CompileOptions` JSDoc

In `packages/compiler/src/api.ts` (~line 200), reword the
`apiVersion` option documentation: it is the *frozen* language
version the compiler implements; passing it is an explicit
acknowledgement of the contract, and the type stays the literal `1`
so a future `apiVersion: 2` compiler is a type-level break.

### 5. §3.3 public-surface audit

A review (not code) step recorded in the PR description:

- Walk `packages/core/src/index.ts` exports and confirm every
  script-visible namespace (`ta`, `plot`, `draw`, `alert`, `input`,
  `state`, `runtime`, `color`, `request`, `time` subpath, `define*`)
  is intentional for 1.0 — anything that shouldn't be promised gets
  removed *in this task* (expected: nothing; Task 1 already swept).
- Confirm `packages/adapter-kit/src/types.ts` pinned sets
  (`DiagnosticCode`, `PlotKind`, `DrawingKind` unions, `Capabilities`
  keys) carry "additive only across `apiVersion: 1.x`" wording where
  they don't already (line 595 has it for one set — extend the same
  sentence to the others that lack it).

### 6. Tests

- `structuralChecks.test.ts`: new cases asserting the exact new
  message strings for (a) `apiVersion: 2` literal, (b) missing
  `apiVersion`.
- `statefulPrimitives.test.ts`: the name-set lock test (step 2).
- All existing tests green; 100% coverage maintained on core +
  compiler.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/compiler/src/analysis/structuralChecks.ts` | Modify | 1.0 diagnostic wording. |
| `packages/compiler/src/analysis/structuralChecks.test.ts` | Modify | Assert new wording; add `apiVersion: 2` + missing-field cases. |
| `packages/compiler/src/compile.test.ts` | Modify (if it matches old wording) | Keep message assertions in sync. |
| `packages/compiler/src/api.ts` | Modify | Freeze-contract JSDoc on `CompileOptions.apiVersion`. |
| `packages/core/src/statefulPrimitives.ts` | Modify | Freeze paragraph in registry JSDoc. |
| `packages/core/src/statefulPrimitives.test.ts` | Modify | Exact name-set lock test + frozen list literal. |
| `packages/adapter-kit/src/types.ts` | Modify | Extend "additive only across apiVersion: 1.x" wording to all pinned sets. |
| `.changeset/phase7-api-version-freeze.md` | Create | Patch on compiler + core + adapter-kit (wording/tests only; behaviour unchanged). |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (coverage 100% on core, compiler, adapter-kit)
- `pnpm docs:check` (JSDoc edits keep `@example` / `@since` intact)
- `pnpm docs:gate`
- `pnpm conformance`

## Changeset

`.changeset/phase7-api-version-freeze.md`:

```md
---
"@invinite-org/chartlang-compiler": patch
"@invinite-org/chartlang-core": patch
"@invinite-org/chartlang-adapter-kit": patch
---

Freeze `apiVersion: 1`: release-grade compiler diagnostics for
version mismatches, an exact name-set lock on the 172-entry
`STATEFUL_PRIMITIVES` registry, and freeze-contract documentation on
every pinned surface. No behavioural change — the structural check
already enforced `apiVersion: 1`.
```

## Acceptance Criteria

- [ ] Compiler rejects `apiVersion: 2` (and missing `apiVersion`)
      with the new 1.0 wording; tests assert the exact strings.
- [ ] `STATEFUL_PRIMITIVES` locked by an exact sorted name-list test
      with the do-not-edit freeze comment.
- [ ] Registry + `CompileOptions` JSDoc carry the freeze contract and
      reference `docs/spec/versioning.md`.
- [ ] Adapter-kit pinned sets all carry the additive-only wording.
- [ ] §3.3 audit recorded in the PR description; surface unchanged.
- [ ] All gates green; 100% coverage maintained.
- [ ] Changeset committed.
