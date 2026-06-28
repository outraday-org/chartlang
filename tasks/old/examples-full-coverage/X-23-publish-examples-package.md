# Publish Examples Package & Cross-Repo Trigger (chartlang)

> **Status: TODO**

## Goal

Make the example catalogue consumable by downstream repos (invinite):
publish a tiny data package `@invinite-org/chartlang-examples` that
exports the full `EXAMPLE_CATALOGUE` (meta + inlined source + category),
and add a chartlang `main`-push automation that notifies invinite to
re-sync its template dialog.

## Prerequisites

Task 22 (every primitive covered; catalogue + `examples/catalogue.json`
final and gated).

## Current Behavior

`examples/catalogue.ts` + `examples/catalogue.json` exist (Tasks 1, 22)
but are repo-internal. invinite cannot import them — `examples/` is not
a published package, and invinite already depends only on the
`@invinite-org/chartlang-*` npm packages.

## Desired Behavior

- A published `@invinite-org/chartlang-examples` package exports a typed
  `EXAMPLE_CATALOGUE` (the same `ExampleMeta` shape + `source`) and the
  `ExampleCategory` / `CATEGORY_LABELS` / `CATEGORY_ORDER` taxonomy.
- Pushing to chartlang `main` (after a release) dispatches an event to
  invinite so its sync (Task 24/25) runs against the new version.

## Requirements

### 1. Scaffold the package

- Append `"packages/examples"` to `PACKAGE_DIRS` in `scripts/scaffold.ts`
  and run `pnpm scaffold` (idempotent §22.4 generator — do **not**
  hand-write the six template files).
- Package name `@invinite-org/chartlang-examples`, **public** (not
  `"private": true` — it is published). Coverage/README/JSDoc/changeset
  gates apply (it is now part of `coverage-merge` / `readme-check`
  walks — confirm those scripts pick it up, or add it explicitly).

### 2. Generated data module

- Extend the Task-1 generator (`scripts/gen-demo-scripts.ts`, run by
  `pnpm examples:generate`) to also emit
  `packages/examples/src/catalogue.generated.ts`:
  - re-exports `ExampleCategory` / `CATEGORY_LABELS` / `CATEGORY_ORDER`
    (import from `examples/catalogue`),
  - exports `EXAMPLE_CATALOGUE: ReadonlyArray<ExampleMetaWithSource>`
    where `ExampleMetaWithSource = ExampleMeta & { source: string }`
    (source inlined from each `.chart.ts`, identical to the
    `examples/catalogue.json` payload).
- `packages/examples/src/index.ts` re-exports the generated module +
  the types. JSDoc (`@since`, `@example`, stability) on each export.
- `pnpm examples:gate` byte-checks `catalogue.generated.ts` alongside
  `scripts.ts` + `examples/catalogue.json`.
- Unit test asserts `EXAMPLE_CATALOGUE` is non-empty, ids unique, every
  `source` parses as a `defineIndicator` default export, and the count
  equals `examples/catalogue.json`.

### 3. Release wiring

- Confirm the changesets release flow publishes the new public package
  (it is picked up automatically once non-private). Add the package to
  any explicit publish allow-list if one exists.
- `.changeset/examples-package.md` — **minor** for
  `@invinite-org/chartlang-examples` (new package, initial public
  surface).

### 4. Cross-repo dispatch (chartlang → invinite)

- Add a `.github/workflows/notify-invinite.yml` that, on push to `main`
  affecting `packages/examples/**` or `examples/**` (or on release),
  sends a `repository_dispatch` (event type `chartlang-examples-updated`)
  to the invinite repo via a `gh api` call using a stored
  `INVINITE_DISPATCH_TOKEN` secret (PAT/fine-grained token with
  `contents:write` + `actions:write` on invinite). Include the published
  version in the `client_payload`.
- Document the secret + the receiver side (Task 25) in
  `.github/CLAUDE.md`. If the org prefers not to store a cross-repo
  token, note the fallback: invinite consumes the package via a
  scheduled dependency bump (Renovate/Dependabot) instead — Task 25
  covers both receiver shapes.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `scripts/scaffold.ts` | Modify | Append `packages/examples` to `PACKAGE_DIRS`. |
| `packages/examples/**` | Create (scaffold) | New published data package. |
| `packages/examples/src/catalogue.generated.ts` | Create (generated) | Catalogue + inlined sources. |
| `packages/examples/src/index.ts` | Modify | Public re-exports + JSDoc. |
| `scripts/gen-demo-scripts.ts` | Modify | Emit the package data module. |
| `.github/workflows/notify-invinite.yml` | Create | Dispatch on main/release. |
| `.github/CLAUDE.md` | Modify | Document dispatch + secret. |
| `.changeset/examples-package.md` | Create | Minor (new package). |

## Gates

- `pnpm typecheck`, `pnpm lint`, `pnpm test` (100% on the new package)
- `pnpm examples:gate` (generated data byte-clean)
- `pnpm docs:check` (JSDoc on new exports), `pnpm readme:check`
- CI `ci.yml` green with the new package in the workspace

## Changeset

`.changeset/examples-package.md` — **minor** (`@invinite-org/chartlang-examples`).

## Acceptance Criteria

- `@invinite-org/chartlang-examples` builds, is public, exports
  `EXAMPLE_CATALOGUE` (with sources) + the taxonomy; 100% coverage +
  JSDoc gates green.
- Generator emits the package data module; `examples:gate` byte-clean.
- `notify-invinite.yml` dispatches on main/release; secret + receiver
  documented; changeset committed.
