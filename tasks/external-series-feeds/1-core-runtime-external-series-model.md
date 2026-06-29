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
- `resolveInputs` accepts object-shaped overrides for this descriptor but does
  not create a live `Series<number>`.
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

## Requirements

### Runtime feed type

Add a small public/runtime type for external feed values, for example:

```ts
export type ExternalSeriesFeed = Readonly<{
    values: ReadonlyArray<number>;
}>;

export type ExternalSeriesFeedMap = Readonly<Record<string, ExternalSeriesFeed>>;
```

The exact exported location can be adjusted to fit the package boundaries, but
the type must be available to host packages and adapter-kit without importing
private runtime internals.

### Descriptor resolution

Update `packages/runtime/src/inputs/resolveInputs.ts` so the
`"external-series"` branch resolves to a `Series<number>` view, not the raw
override object.

Key behavior:

- Match feeds by descriptor input name.
- A missing feed still resolves to a valid series object whose values are `NaN`.
- The result must be stable enough that scripts can store the input value once
  and read it on later bars.
- Invalid override shapes do not crash the whole script run; they are treated as
  missing feeds and can emit a diagnostic/log if the runtime already has a
  pattern for that.

### Feed storage

Add runtime state for external series feeds next to the stream state used by
primary OHLCV series.

Use the existing series-view/ring-buffer machinery where possible:

- Do not create a parallel `Series` proxy implementation.
- Preserve normal series indexing semantics.
- Ensure feed replacement can truncate/extend to the current history length
  without corrupting the primary bar stream.

### Script runner API

Add a direct runner method for whole-map feed replacement. The method name used
by downstream tasks is:

```ts
runner.setExternalSeries(feeds);
```

If the final public API needs a slightly different signature, keep a clearly
named equivalent and update all downstream docs. It must be possible to replace
the feed map without recompiling the script.

### Tests

Add focused runtime tests for:

- `input.externalSeries` resolves to a series and supports `[0]`, `[1]`, and
  `.current`.
- Missing feed yields `NaN`.
- Short feed yields `NaN` beyond provided values.
- Live `setExternalSeries` replacement affects subsequent computes without
  remounting.
- Existing `input.source` behavior remains OHLC-only and unchanged.

## Files

- `packages/core/src/input/inputDescriptor.ts`
- `packages/core/src/input/input.ts`
- `packages/runtime/src/inputs/resolveInputs.ts`
- `packages/runtime/src/inputs/resolveInputs.test.ts`
- `packages/runtime/src/createScriptRunner.ts`
- `packages/runtime/src/seriesView.ts`
- `packages/runtime/src/streamState.ts`
- Any runtime type export barrel needed by host packages.

## Acceptance Criteria

- External series descriptors resolve to numeric series values during compute.
- Direct runtime users can call `setExternalSeries` or the final equivalent API.
- Missing/invalid feed data produces `NaN`, not thrown compute errors.
- Runtime tests cover history indexing and live replacement.
- No behavior change to `input.source`.
