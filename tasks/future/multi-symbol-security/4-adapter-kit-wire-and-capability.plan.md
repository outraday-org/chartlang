# Task 4 plan — adapter-kit: `streamKey` composite + `multiSymbol` capability

## Context

Widen the host wire + capability surface for multi-symbol `request.security`.
Task 1 is done: `feedKey(symbol, interval)` lives in
`packages/core/src/request/feedKey.ts` and is re-exported from core's barrel
(`packages/core/src/index.ts:221`); `manifest.requestedFeeds` /
`RequestedFeed` exist; `apiVersion` stays 1. Core is already built (`dist/`
carries `feedKey`), so adapter-kit typecheck will resolve the import.

This task is wire types + capability + docs only. No runtime logic. The
`multi-symbol-not-supported` NaN diagnostic is Task 5.

## Pre-existing work

- `CandleEvent.streamKey?: string` already exists on all three variants
  (`types.ts:43/54/65`) — only the JSDoc widens; the type is unchanged.
- `Capabilities.multiTimeframe` (`types.ts:304`) is the exact shape to mirror
  for `multiSymbol`.
- `capabilities.multiTimeframe(enabled)` builder (`capabilities.ts:157`) is the
  shape to mirror for a `multiSymbol(enabled)` builder.
- Three capability bags appear in test files + four JSDoc `@example`s
  (`defineAdapter.ts` x2, `bufferingAdapter.ts`, `passThroughAdapter.ts`,
  `types.ts` `Capabilities` example) — all need `multiSymbol: false` added so
  the bag stays a complete `Capabilities`.

## Issues found

- **Validation (`validation/`) has NOTHING to wire.** `validateEmission` /
  `decodeDrawing` validate plot/drawing emissions only; they never touch
  `Capabilities` or `CandleEvent.streamKey`. Task requirement #5 is a no-op
  here — recorded, not skipped.
- `defineAdapter.test.ts`, `bufferingAdapter.test.ts`,
  `passThroughAdapter.test.ts` build a literal `Capabilities` — adding a
  required `multiSymbol` makes those objects fail typecheck unless updated.
  Must update them.
- `@since` for `multiSymbol` is **1.2** (matches `feedKey`'s `@since 1.2`, the
  multi-symbol feature's version), per the task file's drafted JSDoc.
- `streamKey` JSDoc keeps `@since 0.5` (the field is not new; its meaning
  widens) — matches the task file's drafted block.

## Steps

1. `types.ts`: re-doc the three `streamKey` JSDoc blocks → composite feed key,
   cross-referencing `feedKey`. Keep `@since 0.5`, type `string`.
2. `types.ts`: add `readonly multiSymbol: boolean` to `Capabilities` with the
   drafted JSDoc (`@since 1.2 @stable @example`). Add `multiSymbol: false` to
   the `Capabilities` `@example` bag.
3. `capabilities/capabilities.ts`: add a `multiSymbol(enabled)` builder
   mirroring `multiTimeframe`.
4. `base/bufferingAdapter.ts`, `base/passThroughAdapter.ts`,
   `defineAdapter.ts`: add `multiSymbol: false` to every `@example` capability
   bag.
5. `mocks/mockCandleSource.ts`: add an optional `symbol?` to
   `MockCandleSourceOpts`; when set, tag every emitted event's `streamKey`
   via `feedKey(symbol, interval)`. Omitted ⇒ no `streamKey` (byte-identical
   to today's main-stream output).
6. `index.ts`: re-export `feedKey` from core (identity, not a fork).
7. Tests:
   - `types.types.test.ts`: composite `streamKey` accepts `"AMEX:SPY@1D"`;
     `Capabilities` requires `multiSymbol` (missing-key is a type error).
   - `capabilities.test.ts` + `capabilities.types.test.ts`: `multiSymbol`
     builder unit + type test.
   - `mockCandleSource.test.ts`: emits `feedKey`-tagged `streamKey` for a
     different symbol; omitted symbol ⇒ no `streamKey`.
   - `index.test.ts`: `feedKey` is re-exported and is core's identity.
   - Update the three test-file capability bags with `multiSymbol: false`.
8. `adapter-kit/CLAUDE.md`: document the composite-`streamKey == feedKey`
   contract + the `multiSymbol` capability invariant.

## Files

| File | Action | Purpose |
|------|--------|---------|
| `packages/adapter-kit/src/types.ts` | Modify | Re-doc `streamKey`; add `Capabilities.multiSymbol`; update example. |
| `packages/adapter-kit/src/capabilities/capabilities.ts` | Modify | `multiSymbol(enabled)` builder. |
| `packages/adapter-kit/src/base/bufferingAdapter.ts` | Modify | `multiSymbol: false` in `@example`. |
| `packages/adapter-kit/src/base/passThroughAdapter.ts` | Modify | `multiSymbol: false` in `@example`. |
| `packages/adapter-kit/src/defineAdapter.ts` | Modify | `multiSymbol: false` in `@example`s. |
| `packages/adapter-kit/src/mocks/mockCandleSource.ts` | Modify | `symbol?` opt → `feedKey`-tagged `streamKey`. |
| `packages/adapter-kit/src/index.ts` | Modify | Re-export `feedKey` from core. |
| `packages/adapter-kit/src/types.types.test.ts` | Modify | Composite streamKey + required `multiSymbol`. |
| `packages/adapter-kit/src/capabilities/capabilities.test.ts` | Modify | `multiSymbol` unit. |
| `packages/adapter-kit/src/capabilities/capabilities.types.test.ts` | Modify | `multiSymbol` type. |
| `packages/adapter-kit/src/mocks/mockCandleSource.test.ts` | Modify | `feedKey`-tagged emit. |
| `packages/adapter-kit/src/index.test.ts` | Modify | `feedKey` re-export. |
| `packages/adapter-kit/src/defineAdapter.test.ts` | Modify | bag + `multiSymbol`. |
| `packages/adapter-kit/src/base/bufferingAdapter.test.ts` | Modify | bag + `multiSymbol`. |
| `packages/adapter-kit/src/base/passThroughAdapter.test.ts` | Modify | bag + `multiSymbol`. |
| `packages/adapter-kit/CLAUDE.md` | Modify | streamKey==feedKey + `multiSymbol` invariant. |

## Gates to keep green

- `pnpm typecheck`, `pnpm lint`
- `pnpm -F @invinite-org/chartlang-adapter-kit test` (100% coverage)
- `pnpm docs:check`

## Changeset

Extend existing `.changeset/multi-symbol-security.md` (already lists
adapter-kit minor). No new file. Already covers this task's surface.

## Acceptance criteria

- `CandleEvent.streamKey` documented as the composite `feedKey`; type
  unchanged; omission still = main stream.
- `Capabilities.multiSymbol: boolean` added + defaulted `false` in every bag;
  independent of `multiTimeframe`; `multiSymbol(enabled)` builder added.
- `mockCandleSource` builds secondary `streamKey` through `feedKey`;
  `feedKey` re-exported from the kit (identity from core).
- Single-symbol-MTF adapters unchanged with `multiSymbol: false`.
- adapter-kit tests/docs:check green; CLAUDE.md updated.
</content>
</invoke>
