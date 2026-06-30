# Core and runtime external series model

> **Status: TODO**

## Goal

Turn `input.externalSeries(...)` from a manifest-only descriptor into a
runtime-resolved numeric `Series<number>` that scripts can read during
`compute`.

## Prerequisites

None. This is the first upstream task.

## Current Behavior

- `input.externalSeries({ name, schema, title? })` emits a descriptor with
  `kind: "external-series"`.
- `packages/core/src/input/inputDescriptor.ts` defines `Schema<T>` as an opaque
  marker whose JSDoc still says runtime validation is future work.
- `packages/runtime/src/inputs/resolveInputs.ts` accepts object-shaped overrides
  for this descriptor but does not create a live `Series<number>`.
- If a script uses the resolved value as a series, the runtime has no aligned
  feed backing it.

## Desired Behavior

- The resolved input value for an external-series descriptor is an indexable
  numeric series.
- At each primary bar index, `.current` and `[0]` read the current feed value;
  `[1]` reads the previous feed value.
- Missing values, short arrays, non-finite values, and not-yet-warmed bars
  produce `NaN`.
- Existing descriptor and manifest shapes remain backward-compatible.
- `input.source` remains OHLC/derived-source-only.

## Requirements

### Public feed types

Add public feed types in `packages/core/src/input/inputDescriptor.ts` and
re-export them through `packages/core/src/input/index.ts` and
`packages/core/src/index.ts`:

```ts
export type ExternalSeriesFeed = Readonly<{
    values: ReadonlyArray<number>;
}>;

export type ExternalSeriesFeedMap = Readonly<Record<string, ExternalSeriesFeed>>;
```

Requirements:

- `ExternalSeriesFeed` and `ExternalSeriesFeedMap` carry complete JSDoc with
  `@example`, `@since`, and a stability marker.
- The `Schema<T>` JSDoc stops saying runtime validation is future work. It
  remains an opaque v1 schema marker, but numeric external feeds are runtime
  supported after this task.
- Adapter-kit and host packages can import or re-export these types without
  importing private runtime internals.

### Descriptor resolution

Update `packages/runtime/src/inputs/resolveInputs.ts` so the
`"external-series"` branch resolves to a `Series<number>` view, not the raw
override object.

Key behavior:

- Match feeds by descriptor input name.
- A missing feed still resolves to a valid series object whose values are `NaN`.
- The result is stable enough that scripts can store the input value once and
  read it on later bars.
- Invalid override shapes do not crash the whole script run. Treat them as
  missing feeds and use the existing once-per-mount `input-coercion-failed`
  diagnostic pattern.
- Unknown feed keys are ignored.

### Feed storage

Add runtime state for external series feeds next to the stream state used by
primary OHLCV series.

Use the existing series-view/ring-buffer machinery where possible:

- Do not create a parallel `Series` proxy implementation.
- Preserve normal series indexing semantics.
- Ensure feed replacement can truncate/extend to the current history length
  without corrupting the primary bar stream.
- Keep `input.source` strictly OHLC/derived-source-only; do not widen
  `SOURCE_FIELDS`.

### Script runner API

Add load-time feed arguments to `CreateScriptRunnerArgs`:

- `externalSeriesFeeds?: ExternalSeriesFeedMap`
- `resolveExternalSeries?: (scriptId: string) => ExternalSeriesFeedMap`

Add a direct runner method for whole-map feed replacement:

```ts
runner.setExternalSeries(feeds);
```

The live method replaces the whole feed map without recompiling the script. It
must not merge partial keys.

### JSDoc and package guidance

- Update `packages/runtime/CLAUDE.md` if the new feed state adds a non-obvious
  runtime lifecycle invariant.
- Public exports in core/runtime must include `@example`, `@since`, and a
  stability marker so `pnpm docs:check` and `pnpm hover:check` pass.

### Tests

Add focused tests for:

- Core unit/type coverage for the new feed types and updated schema wording.
- `input.externalSeries` resolves to a series and supports `[0]`, `[1]`, and
  `.current`.
- Missing feed yields `NaN`.
- Short feed yields `NaN` beyond provided values.
- Non-finite feed values (`NaN`, `Infinity`, `-Infinity`) read as `NaN` at the
  affected bar without poisoning later bars.
- Live `setExternalSeries` replacement affects subsequent computes without
  remounting.
- Existing `input.source` behavior remains OHLC-only and unchanged.
- Runtime coverage includes the branch paths this task adds; add property,
  golden, or bench coverage where the changed runtime package gate requires it.

## Files to Create/Modify

- `packages/core/src/input/inputDescriptor.ts`
- `packages/core/src/input/inputDescriptor.types.test.ts`
- `packages/core/src/input/index.ts`
- `packages/core/src/index.ts`
- `packages/core/src/input/input.ts`
- `packages/core/src/input/input.test.ts`
- `packages/core/src/input/input.types.test.ts`
- `packages/runtime/src/inputs/resolveInputs.ts`
- `packages/runtime/src/inputs/resolveInputs.test.ts`
- `packages/runtime/src/createScriptRunner.ts`
- `packages/runtime/src/createScriptRunner.test.ts`
- `packages/runtime/src/seriesView.ts`
- `packages/runtime/src/streamState.ts`
- `packages/runtime/src/index.ts`, if the final public runner/feed type surface
  needs a runtime barrel export
- `packages/runtime/CLAUDE.md`, if a new lifecycle invariant is introduced
- `.changeset/*.md`

## Gates

- `pnpm -F @invinite-org/chartlang-core test`
- `pnpm -F @invinite-org/chartlang-runtime test`
- `pnpm typecheck`
- `pnpm docs:check`
- `pnpm hover:check`

## Changeset

Add minor changesets for:

- `@invinite-org/chartlang-core`
- `@invinite-org/chartlang-runtime`

## Acceptance Criteria

- External series descriptors resolve to numeric series values during compute.
- Direct runtime users can provide load-time feeds and call `setExternalSeries`.
- Missing/invalid feed data produces `NaN`, not thrown compute errors.
- Runtime tests cover history indexing and live replacement.
- No behavior change to `input.source`.
- Public feed types are documented and exported from stable package barrels.
- Required changesets are present.
