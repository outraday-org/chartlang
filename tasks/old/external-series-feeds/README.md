# External series feeds

> **Status: TODO**

## Overview

Make `input.externalSeries(...)` a real runtime feature instead of only a
manifest descriptor. Hosts should be able to supply per-script numeric series
feeds, update them as bars stream, and expose the same behavior through the
direct runtime, worker host, QuickJS host, adapter-kit contract, runtime
conformance harness, docs, and generated language-service references.

This is the upstream prerequisite for Invinite's same-chart series picker. The
Invinite work depends on these packages being published after this tasklist
lands.

## Current State

- `packages/core/src/input/inputDescriptor.ts` defines
  `ExternalSeriesDescriptor<T>` and an opaque `Schema<T>`, but the schema
  comment says runtime validation is deferred.
- `packages/runtime/src/inputs/resolveInputs.ts` accepts an object override for
  descriptors with `kind: "external-series"`, but it does not create or update
  an indexable `Series<number>` feed.
- `packages/adapter-kit/src/types.ts` exposes `resolveInputs`, but the adapter
  feed hook is still documented as future work.
- `packages/host-worker/src/protocol.ts`, `packages/host-quickjs/`, and the
  host docs only route `inputOverrides` and `plotOverrides`; there is no
  `setExternalSeries` or equivalent live feed message.
- Conformance already covers `resolveInputs` and live `setPlotOverrides`, but
  has no runtime scenario proving `input.externalSeries` history or live feed
  replacement. Cross-host parity belongs in the host packages, not conformance.

## Target State

- A script can declare an external series input and read it as a normal
  `Series<number>` inside `compute`, including `[n]`, `.current`, and `ta.*`
  source arguments.
- Hosts can set a complete external-series feed at load time and replace it
  live without recompiling the script.
- Missing, invalid, short, or warm-up feed values resolve to `NaN` instead of
  throwing during compute.
- Direct runtime, worker host, and QuickJS host have the same public API and
  behavior, with conformance kept runtime-only and cross-host parity tested in
  the host packages.
- Docs and language-service hover text describe the feature as supported.
- Packages are versioned and published so downstream apps can update from npm.

## Architecture Decisions

| Decision | Rationale |
| --- | --- |
| Keep `input.source` OHLC-only | `input.source` is the built-in OHLC/derived bar selector. External same-chart indicators and script outputs use `input.externalSeries` so Pine-style source semantics stay stable. |
| Public host API is `setExternalSeries(feeds)` for live replacement, with `scriptId` only on load-time resolver callbacks | Mirrors `setPlotOverrides`: simple to reason about, deterministic, and avoids partial merge ambiguity. The tasklist uses `setExternalSeries` as the required live-update marker. |
| Feed values are numeric arrays aligned to the primary bar stream | The first supported use case is same-chart indicator/script output. Alignment stays host-owned; runtime only consumes the feed for the current bar index. |
| Fallback is `NaN`, not stale carry-forward | Avoids silently inventing values when a source has not warmed up, was deleted, or is shorter than the chart history. Scripts can handle gaps with existing numeric checks. |
| Host parity is required before publish | Invinite uses the worker host; server-side or alert surfaces may use other hosts later. Shipping only one host would create divergent behavior. Conformance stays runtime-only; host parity is asserted in host integration tests. |

## Dependency Graph

```
Task 1 (core + runtime feed model)
  |
  v
Task 2 (adapter-kit + worker/quickjs host API)
  |
  v
Task 3 (conformance, docs, generated references, publish)
```

## Task Summary Table

| # | Title | Packages | Dependencies | Complexity |
| --- | --- | --- | --- | --- |
| 1 | [Core and runtime external series model](./1-core-runtime-external-series-model.md) | core, runtime | None | High |
| 2 | [Host protocol and adapter API](./2-host-protocol-and-adapter-api.md) | adapter-kit, host-worker, host-quickjs | 1 | High |
| 3 | [Conformance, docs, generated references, and publish](./3-conformance-docs-and-publish.md) | conformance, docs, language-service, repo release | 1, 2 | Medium |

## Code Reuse

| Existing | Path | Use |
| --- | --- | --- |
| `ExternalSeriesDescriptor` | `packages/core/src/input/inputDescriptor.ts` | Keep the public descriptor shape; extend comments/types only as needed. |
| `resolveInputs` | `packages/runtime/src/inputs/resolveInputs.ts` | Continue resolving scalar/enum/source overrides; add external feed resolution beside the existing descriptor switch. |
| `Series` views | `packages/runtime/src/seriesView.ts`, `packages/runtime/src/streamState.ts` | Reuse the existing ring-buffer/proxy model instead of inventing a second series abstraction. |
| Host plot override flow | `packages/host-worker/src/protocol.ts`, `packages/host-quickjs/`, `packages/runtime/src/createScriptRunner.ts` | Mirror the load-time + live-update shape for external series. |
| Conformance event loop | `packages/conformance/src/runConformanceSuite.ts`, `packages/conformance/src/scenarios/` | Add runtime external-series feed inputs/events next to input override and plot override support. Do not import or drive host packages from conformance. |
| Host parity tests | `packages/host-quickjs/src/integration.test.ts` | Add worker-vs-QuickJS parity coverage for external-series load-time and live replacement behavior. |
| Generated docs/references scripts | `pnpm docs:generate`, `pnpm hover:check`, `pnpm skills:generate` | Use repo generators for primitive pages, language-service hovers, and skills where applicable. Do not hand-edit generated primitive pages or generated registries. |

## Release Gate

Task 3 adds changesets for the changed packages. After the PR merges, publish
the changed `@invinite-org/chartlang-*` packages through the repo release flow
(`pnpm release` / `pnpm publish:release` as appropriate). The downstream
Invinite tasklist must not start package upgrades until published versions are
available on npm.

## Deferred / Follow-Up Work

- Rich external schemas beyond numeric series.
- Multi-symbol or cross-timeframe external feeds. This tasklist is for
  same-primary-stream numeric series.
- Server-side alert evaluation for app-specific source bindings. Downstream apps
  should explicitly gate unsupported external-series alert use until they can
  provide equivalent feeds.
