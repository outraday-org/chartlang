# Host protocol and adapter API

> **Status: TODO**

## Goal

Expose the runtime external-series feed model through adapter-kit, worker host,
and QuickJS host with host parity.

## Prerequisites

- Task 1 in this folder is complete.

## Current Behavior

- Adapter-kit accepts `resolveInputs` and `resolvePlotOverrides`, but no
  external series feed callback.
- Worker host protocol has load/candle/drain/dispose/setPlotOverrides messages,
  but no feed message.
- QuickJS host mirrors plot override behavior but has no feed route.

## Desired Behavior

- Adapters can provide load-time external series feeds for a script.
- Hosts can update those feeds live through a whole-map replacement API.
- Worker and QuickJS hosts expose the same public method name and semantics as
  the direct runtime.

## Requirements

### Adapter-kit contract

Extend the adapter contract with a feed callback. Use the existing docs hint as
the baseline name unless implementation review finds a better fit:

```ts
readonly feedExternalSeries?: (
    scriptId: string
) => ExternalSeriesFeedMap;
```

Rules:

- The callback is optional.
- Returned keys are external-series input names from the manifest.
- Unknown feed keys are ignored by the runtime.
- Missing expected keys resolve to `NaN` feeds.
- The callback is load-time only; live updates use the host method.
- Import or re-export `ExternalSeriesFeed` / `ExternalSeriesFeedMap` from the
  public core surface added by Task 1. Do not introduce a second feed shape in
  adapter-kit.

Update adapter-kit exported types and docs in lockstep.

### Worker protocol

Extend `packages/host-worker/src/protocol.ts` with:

- Load frame field for initial external series feeds.
- Host-to-worker message for live feed replacement, named `setExternalSeries`.
- Worker implementation that calls the runtime runner method from Task 1.

The live message replaces the full feed map. It must not merge partial keys.

### QuickJS host

Add the same load-time and live replacement behavior to the QuickJS host.

Requirements:

- Same public host method as worker host.
- Same whole-map replacement semantics.
- Same missing/invalid feed fallback behavior.
- No dependency on browser-only APIs.
- Update `packages/host-quickjs/src/dispatcherCore.ts`,
  `packages/host-quickjs/src/dispatcher.ts`, and the generated dispatcher
  source via `pnpm -F @invinite-org/chartlang-host-quickjs build:dispatcher`.

### Public host types

Update all relevant host option/result types:

- `CreateWorkerHostOpts`
- `CreateQuickJsHostOpts`
- `resolveExternalSeries?: (scriptId: string) => ExternalSeriesFeedMap` on both
  host constructor option types
- Shared `ScriptHost` interface in `packages/host-worker/src/types.ts`
- `ScriptRunnerHandle` in `packages/host-worker/src/types.ts`
- Protocol frame unions in both host packages
- Docs and exported type tests

### Tests

Add host-level tests for:

- Initial feed delivery during load.
- Live feed replacement after load.
- Whole-map replacement clearing a previously supplied feed.
- Worker and QuickJS parity for the same scenario.
- Worker protocol/boot error behavior when `setExternalSeries` is called before
  `load`.
- QuickJS JSON-membrane sandbox coverage proving getter/function-shaped values
  are dropped and cannot cross as live host references.
- Type tests for the new constructor options and `ScriptHost.setExternalSeries`
  method.

## Files to Create/Modify

- `packages/adapter-kit/src/types.ts`
- `packages/adapter-kit/src/types.types.test.ts`
- `packages/host-worker/src/protocol.ts`
- `packages/host-worker/src/types.ts`
- `packages/host-worker/src/createWorkerHost.ts`
- `packages/host-worker/src/createWorkerHost.test.ts`
- `packages/host-worker/src/createWorkerHost.types.test.ts`
- `packages/host-worker/src/createWorkerBoot.ts`
- `packages/host-worker/src/createWorkerBoot.test.ts`
- `packages/host-quickjs/src/protocol.ts`
- `packages/host-quickjs/src/types.ts`
- `packages/host-quickjs/src/createQuickJsHost.ts`
- `packages/host-quickjs/src/createQuickJsHost.test.ts`
- `packages/host-quickjs/src/dispatcherCore.ts`
- `packages/host-quickjs/src/dispatcherCore.test.ts`
- `packages/host-quickjs/src/dispatcher.ts`
- `packages/host-quickjs/src/dispatcherSource.generated.ts`
- `packages/host-quickjs/dist/dispatcher.js`
- `packages/host-quickjs/src/sandbox.test.ts`
- `packages/host-quickjs/src/integration.test.ts`
- `docs/adapters/contract.md`
- `docs/hosts/worker.md`
- `docs/hosts/quickjs.md`
- `docs/hosts/writing-a-host.md`
- `.changeset/*.md`

## Gates

- `pnpm -F @invinite-org/chartlang-adapter-kit test`
- `pnpm -F @invinite-org/chartlang-host-worker test`
- `pnpm -F @invinite-org/chartlang-host-quickjs test`
- `pnpm -F @invinite-org/chartlang-host-quickjs build:dispatcher`
- `pnpm typecheck`
- `pnpm docs:check`
- `pnpm docs:snippets`

## Changeset

Add minor changesets for:

- `@invinite-org/chartlang-adapter-kit`
- `@invinite-org/chartlang-host-worker`
- `@invinite-org/chartlang-host-quickjs`

## Acceptance Criteria

- Adapter-kit exposes a typed external-series feed callback.
- Worker host exposes live external feed replacement.
- QuickJS host exposes live external feed replacement.
- Initial and live feed behavior match direct runtime semantics.
- Whole-map replacement clears omitted keys.
- Worker and QuickJS host parity is covered in
  `packages/host-quickjs/src/integration.test.ts`.
- Host docs describe the new method and whole-map replacement rule.
- Required changesets are present.
