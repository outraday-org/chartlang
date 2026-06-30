# Conformance, docs, generated references, and publish

> **Status: TODO**

## Goal

Prove external-series feeds across the runtime and host surfaces, update public
documentation, regenerate derived references, and prepare packages for
downstream Invinite integration.

## Prerequisites

- Task 1 in this folder is complete.
- Task 2 in this folder is complete.

## Current Behavior

- Docs mention `input.externalSeries` but describe it as an adapter-supplied
  concept without a complete runtime/host contract.
- Language-service hover text still includes "phase" language for unsupported
  runtime validation.
- Conformance has no scenario that reads external feed history.
- No published chartlang package version contains the feed API Invinite needs.

## Desired Behavior

- Conformance includes at least one script that declares an external series
  input, reads history, and observes a live feed replacement.
- Docs clearly distinguish `input.source` from `input.externalSeries`.
- Generated hover/reference artifacts describe the supported feed API.
- Changed packages have changesets; publishing happens after merge through the
  repo release flow.

## Requirements

### Conformance scenario

Add a scenario that:

- Declares an external series input, for example `other =
  input.externalSeries(...)`.
- Plots `other.current`, `other[1]`, or a simple `ta.*` result from the feed.
- Runs with an initial feed map.
- Applies a live `setExternalSeries` event mid-stream.
- Asserts both initial history reads and post-update values.

Run it through the existing runtime-only conformance harness. Do not add
host-worker or host-quickjs dependencies to `@invinite-org/chartlang-conformance`;
cross-host parity belongs in `packages/host-quickjs/src/integration.test.ts`
and is covered by Task 2.

### Documentation

Update docs so the supported model is explicit:

- `docs/language/inputs.md`
- JSDoc source for `input.externalSeries`, `Schema`, `ExternalSeriesFeed`,
  `ExternalSeriesFeedMap`, and `input.source`, then run `pnpm docs:generate` to
  update `docs/primitives/input/externalSeries.md` and
  `docs/primitives/input/source.md`
- `docs/adapters/contract.md`
- `docs/hosts/worker.md`
- `docs/hosts/quickjs.md`
- `docs/hosts/writing-a-host.md`
- Any migration, examples, or FAQ pages that still imply external series is
  future-only, including `docs/spec/pine-migration.md`, `docs/reference/faq.md`,
  and generated examples if the catalogue changes

Required wording:

- `input.source` selects built-in OHLC/derived bar fields only.
- `input.externalSeries` is for host-supplied numeric series such as another
  indicator output, another script output, fundamentals, or app data.
- The host is responsible for alignment to the primary chart stream.
- Missing values are `NaN`.

### Generated references

Regenerate any generated artifacts affected by public API or docs changes:

- Primitive docs (`pnpm docs:generate` / `pnpm docs:gate`).
- Language-service hover registry (`pnpm gen-hover-registry` /
  `pnpm hover:check`).
- Examples/docs generated from scripts, if examples change.
- Skills/reference bundles (`pnpm skills:generate` / `pnpm skills:gate`), if
  public primitive guidance changes.

Do not hand-edit generated files when a generator owns them.

### Changesets and publish

Add changesets for every changed package that downstream apps import. At
minimum, review these packages:

- `@invinite-org/chartlang-core`
- `@invinite-org/chartlang-runtime`
- `@invinite-org/chartlang-adapter-kit`
- `@invinite-org/chartlang-host-worker`
- `@invinite-org/chartlang-host-quickjs`
- `@invinite-org/chartlang-conformance`
- `@invinite-org/chartlang-language-service`
- `@invinite-org/chartlang-editor`, if editor surfaces or generated references
  changed

Publishing is a post-merge release action, not part of the implementation PR.
After merge, run the repo release flow (`pnpm release` /
`pnpm publish:release` as appropriate) and record the published versions in the
downstream Invinite tasklist execution notes before starting its package upgrade
task.

## Files to Create/Modify

- `packages/conformance/src/runConformanceSuite.ts`
- `packages/conformance/src/scenarios/*`
- `packages/conformance/src/scenarios/index.ts`
- `docs/language/inputs.md`
- `docs/primitives/input/externalSeries.md`
- `docs/primitives/input/source.md`
- `docs/adapters/contract.md`
- `docs/hosts/worker.md`
- `docs/hosts/quickjs.md`
- `docs/hosts/writing-a-host.md`
- `docs/spec/pine-migration.md`
- `docs/reference/faq.md`
- `packages/core/src/input/input.ts`
- `packages/core/src/input/inputDescriptor.ts`
- `packages/language-service/src/hoverRegistry.generated.ts`
- `skills/chartlang-coding/references/primitives.md`, if regenerated
- `.changeset/*`

## Gates

- `pnpm -F @invinite-org/chartlang-conformance test`
- `pnpm conformance`
- `pnpm conformance:check`
- `pnpm docs:generate`
- `pnpm docs:check`
- `pnpm docs:gate`
- `pnpm docs:snippets`
- `pnpm hover:check`
- `pnpm skills:gate`
- `pnpm readme:check`

## Changeset

Verify the changesets from Tasks 1 and 2 still cover every package with
`packages/*/src/` changes. Add or update changesets for:

- `@invinite-org/chartlang-conformance`
- `@invinite-org/chartlang-language-service`, if the generated hover registry
  changes
- `@invinite-org/chartlang-editor`, only if editor-visible surfaces change

## Acceptance Criteria

- Conformance proves external-series feed history and live replacement.
- Docs no longer describe the feature as future-only.
- Generated references are in sync with the new API.
- All changed packages have changesets.
- Post-merge release steps are documented, and published npm versions are
  recorded before downstream Invinite package upgrades begin.
