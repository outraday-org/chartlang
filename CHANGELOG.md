# chartlang changelog

chartlang releases are cut with Changesets. Each published package keeps
its generated `CHANGELOG.md` beside the package, while this root file is
the release index for project-wide milestones and announcement notes.

## Package changelogs

- [`@invinite-org/chartlang-core`](./packages/core/CHANGELOG.md)
- [`@invinite-org/chartlang-compiler`](./packages/compiler/CHANGELOG.md)
- [`@invinite-org/chartlang-runtime`](./packages/runtime/CHANGELOG.md)
- [`@invinite-org/chartlang-adapter-kit`](./packages/adapter-kit/CHANGELOG.md)
- [`@invinite-org/chartlang-host-worker`](./packages/host-worker/CHANGELOG.md)
- [`@invinite-org/chartlang-host-quickjs`](./packages/host-quickjs/CHANGELOG.md)
- [`@invinite-org/chartlang-language-service`](./packages/language-service/CHANGELOG.md)
- [`@invinite-org/chartlang-editor`](./packages/editor/CHANGELOG.md)
- [`@invinite-org/chartlang-cli`](./packages/cli/CHANGELOG.md)
- [`@invinite-org/chartlang-conformance`](./packages/conformance/CHANGELOG.md)

GitHub releases carry the project announcement, links to the package
changelogs, and the conformance report snapshot for each release.

## 1.0.0 — Standardisation

Released 2026-06-10.

chartlang `1.0.0` is the `apiVersion: 1` standardisation release. It
freezes the script language contract, publishes the canonical spec, ships
public conformance reporting, and proves the adapter-author path from
scaffold to report.

- `apiVersion: 1` is frozen: the compiler accepts only version `1`, the
  172-entry `STATEFUL_PRIMITIVES` registry is name-set locked, every shipping
  export is stable, and pre-1.0 deprecated surface has been removed.
- The canonical spec lives in [`docs/spec/`](./docs/spec/) and the
  `v1.0.0` git tag is the frozen snapshot once the closeout is merged and
  tagged.
- The canvas2d reference adapter publishes
  [`CONFORMANCE.md`](./examples/canvas2d-adapter/CONFORMANCE.md) and
  [`conformance-report.json`](./examples/canvas2d-adapter/conformance-report.json),
  drift-checked by CI.
- `chartlang scaffold-adapter` now emits a runnable conformance test and
  report script, backed by the adapter tutorial and Lightweight Charts
  walkthrough.
- The Pine migration guide now includes a pattern-coverage matrix audited
  against roughly 50 common Pine scripts.

External release steps after this closeout merges: wait for the CI
Changesets publish with npm provenance, push the repo-level `v1.0.0` tag if
the action did not create it, and attach/link the coverage report in the
GitHub Release notes.
