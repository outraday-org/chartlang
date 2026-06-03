# Phase 7 — `1.0` Standardisation

> **Plan reference:** PLAN.md §19 Phase 7, with cross-cuts into §15
> (consumer-repo adapters), §3.3 (versioning), §17.3 (spec docs).
> **Prerequisite:** Phases 1–6 shipped, conformance suite green.
> **Version target:** `1.0`.

## Goal

Freeze `apiVersion: 1` and ship chartlang as a real standard.
External adoption signal: at least one third-party-style adapter
(Lightweight Charts) lands and passes the full conformance suite.

## Deliverables

### Freeze `apiVersion: 1`

- Audit the public surface against §3.3 versioning rules.
- Lock the `STATEFUL_PRIMITIVES` registry.
- Compiler accepts only `apiVersion: 1` for this major; future
  versions go behind a new flag.
- Changeset hygiene: any breaking change post-freeze requires a new
  major.

### Spec site at `chartlang.dev/spec`

- Expand PLAN.md into the published spec per §17.3.
- Versioned: `1.0` snapshot frozen at release.
- Hosted via VitePress (already wired in Phase 0).
- Cross-references every primitive's doc page (auto-generated from
  JSDoc per §17.2).

### Lightweight Charts adapter

- Lives in its own consumer repo (per §15 — no chart-specific
  adapter ships in the OSS monorepo).
- Imports `@invinite-org/chartlang-adapter-kit` and the published
  hosts.
- Passes the full `@invinite-org/chartlang-conformance` suite.
- Serves as the public proof that chartlang is portable beyond
  invinite.

### Public conformance reports

- `pnpm conformance --report` writes a structured report per §17.5.
- Reports published alongside the spec site for every supported
  adapter.

### Migration guide (final)

- Pine → chartlang guide drafted in Phase 6 polished and published
  under `chartlang.dev/spec/pine-migration`.
- Covers the patterns from the top ~50 Pine scripts.

### Release plumbing

- Changesets release workflow polished — single-button publish to
  npm for every `@invinite-org/chartlang-*` package.
- Announce in `README.md`, GitHub release, and a `CHANGELOG.md`
  generated from changeset entries.

## Done criteria

- `apiVersion: 1` locked; any source-incompatible change requires
  a new major version line.
- Spec site live at `chartlang.dev/spec` with the `1.0` snapshot
  frozen.
- Lightweight Charts adapter conforms to 100% of the suite.
- Public conformance report rendered for the canvas2d reference
  adapter and the Lightweight Charts adapter.
- Pine → chartlang migration guide published and reviewed against
  the top ~50 Pine scripts.
- `pnpm publish:release` works end-to-end via changesets.

## Notes for `/write-tasks`

- This phase is mostly polish + governance, not new primitives. If
  a new primitive surfaces here, push it to `1.x` to keep the
  freeze clean.
- Lightweight Charts adapter is a separate repo by §15 design —
  don't pull it into the monorepo. Tasks here cover the *interface*
  the OSS repo must expose; the adapter implementation tasks belong
  in that repo's own tracker.
- Pre-1.0 deprecations: anything marked deprecated in 0.x must be
  removed before the freeze, not carried as a back-compat shim.
