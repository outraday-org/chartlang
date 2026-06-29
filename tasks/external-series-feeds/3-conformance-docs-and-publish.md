# Conformance, docs, generated references, and publish

> **Status: TODO**

## Goal

Prove external-series feeds across host surfaces, update public documentation,
regenerate derived references, and publish packages for downstream Invinite
integration.

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
- Changed packages have changesets and are published.

## Requirements

### Conformance scenario

Add a scenario that:

- Declares an external series input, for example `other = input.externalSeries`.
- Plots `other.current`, `other[1]`, or a simple `ta.*` result from the feed.
- Runs with an initial feed map.
- Applies a live `setExternalSeries` event mid-stream.
- Asserts both initial history reads and post-update values.

Run it through the same direct/worker/QuickJS harness paths used for other
runtime parity scenarios.

### Documentation

Update docs so the supported model is explicit:

- `docs/language/inputs.md`
- `docs/primitives/input/externalSeries.md`
- `docs/primitives/input/source.md`
- `docs/adapters/contract.md`
- `docs/hosts/worker.md`
- `docs/hosts/writing-a-host.md`
- Any migration or FAQ pages that still imply external series is future-only.

Required wording:

- `input.source` selects built-in OHLC/derived bar fields only.
- `input.externalSeries` is for host-supplied numeric series such as another
  indicator output, another script output, fundamentals, or app data.
- The host is responsible for alignment to the primary chart stream.
- Missing values are `NaN`.

### Generated references

Regenerate any generated artifacts affected by public API or docs changes:

- Language-service hover registry.
- Examples/docs generated from scripts, if examples change.
- Skills/reference bundles, if this repo has a generator for them.

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

Publish the package set after the PR merges. Record the published versions in
the downstream Invinite tasklist execution notes before starting its package
upgrade task.

## Files

- `packages/conformance/src/runConformanceSuite.ts`
- `packages/conformance/src/scenarios/*`
- `docs/language/inputs.md`
- `docs/primitives/input/externalSeries.md`
- `docs/primitives/input/source.md`
- `docs/adapters/contract.md`
- `docs/hosts/worker.md`
- `docs/hosts/writing-a-host.md`
- `packages/language-service/src/hoverRegistry.generated.ts`
- `.changeset/*`

## Acceptance Criteria

- Conformance proves external-series feed history and live replacement.
- Docs no longer describe the feature as future-only.
- Generated references are in sync with the new API.
- All changed packages have changesets.
- Published npm versions are available for Invinite to consume.
