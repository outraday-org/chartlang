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
) => Readonly<Record<string, ExternalSeriesFeed>>;
```

Rules:

- The callback is optional.
- Returned keys are external-series input names from the manifest.
- Unknown feed keys are ignored by the runtime.
- Missing expected keys resolve to `NaN` feeds.
- The callback is load-time only; live updates use the host method.

Update adapter-kit exported types and docs in lockstep.

### Worker protocol

Extend `packages/host-worker/src/protocol.ts` with:

- Load frame field for initial external series feeds.
- Host-to-worker message for live feed replacement, named
  `setExternalSeries` or the final equivalent.
- Worker implementation that calls the runtime runner method from Task 1.

The live message replaces the full feed map. It must not merge partial keys.

### QuickJS host

Add the same load-time and live replacement behavior to the QuickJS host.

Requirements:

- Same public host method as worker host.
- Same whole-map replacement semantics.
- Same missing/invalid feed fallback behavior.
- No dependency on browser-only APIs.

### Public host types

Update all relevant host option/result types:

- `CreateWorkerHostOpts`
- QuickJS host options
- Shared host interfaces in docs or exported types
- Any conformance adapter shape

### Tests

Add host-level tests for:

- Initial feed delivery during load.
- Live feed replacement after load.
- Whole-map replacement clearing a previously supplied feed.
- Worker and QuickJS parity for the same scenario.

## Files

- `packages/adapter-kit/src/types.ts`
- `packages/host-worker/src/protocol.ts`
- `packages/host-worker/src/*`
- `packages/host-quickjs/src/*`
- `packages/conformance/src/runConformanceSuite.ts`
- `docs/adapters/contract.md`
- `docs/hosts/worker.md`
- `docs/hosts/writing-a-host.md`

## Acceptance Criteria

- Adapter-kit exposes a typed external-series feed callback.
- Worker host exposes live external feed replacement.
- QuickJS host exposes live external feed replacement.
- Initial and live feed behavior match direct runtime semantics.
- Host docs describe the new method and whole-map replacement rule.
