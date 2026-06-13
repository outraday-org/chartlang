---
title: "Indicator composition"
since: "0.7"
status: "stable"
---

# Indicator Composition

One chartlang indicator can read another indicator's plot output as a
typed `Series<number>`. The producer ships its compiled bundle exactly
once; the consumer binds the producer to a local `const`, optionally
overrides its inputs, and reads a named output inside its own
`compute`. The host mounts whichever indicators the module exports
(default and named) as drawn; everything that's only held by a private
`const` becomes a data feed.

This is additive within `apiVersion: 1.x`. The 172-entry
[`STATEFUL_PRIMITIVES`](../spec/versioning.md#stateful_primitives)
registry is unchanged; the new `.output(...)` and `.withInputs(...)`
accessors are compiler-rewritten sentinels on
[`CompiledScriptObject`](../spec/manifest.md#indicator-dependencies),
not runtime primitives.

## A worked example

```ts
import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

// Private dep — local `const`, not exported. Never rendered.
const fastTrend = defineIndicator({
    name: "Fast Trend",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        plot(ta.ema(bar.close, 20), { title: "line" });
    },
});

// Drawn sibling — `export const` makes the host mount + render it
// under the `export:slowTrend/...` slot-id prefix.
export const slowTrend = defineIndicator({
    name: "Slow Trend",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        plot(ta.ema(bar.close, 100), { title: "line" });
    },
});

// Drawn primary — default export, the file's primary indicator.
export default defineIndicator({
    name: "Trend Confirmation",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        const fast = fastTrend.output("line");
        const slow = slowTrend.output("line");
        if (ta.crossover(fast, slow).current) {
            plot(bar.close, { title: "Confirmed cross" });
        }
    },
});
```

The host loads one ESM artefact per `.chart.ts` file. Three indicators
were declared; two of them (`slowTrend` and the default) render. The
private `fastTrend` runs every bar but its plots are dropped before
they reach the adapter.

## Producer vs consumer

A **producer** is any `CompiledScriptObject` bound to a local
identifier. The producer's `plot(value, { title })` calls define the
outputs other scripts can consume.

A **consumer** is any indicator whose `compute` reads a producer's
output via `<binding>.output("title")`. The consumer's `compute` runs
**after** every producer it depends on each bar.

The same indicator can be both at once: a named export that also calls
`.output(...)` on another binding renders normally **and** acts as a
data feed for downstream consumers.

## `.withInputs({...})` overrides

`.withInputs({ key: value })` lets a consumer override one or more of
the producer's `input.*` defaults without forking the source. The
override map's keys must exist in the producer's `inputs` schema and
each value must coerce to the input's declared type — the compiler
emits the `dep-invalid-input-override` diagnostic when either rule is
violated.

```ts no-gate
const fastTrend = baseTrend.withInputs({ length: 20 });
// `length` must be declared on baseTrend's inputs:
//     inputs: { length: input.int(50, { min: 2, max: 250 }) }
```

Chained `withInputs` calls fold in declaration order — the last write
wins. The compiler statically validates the chain; the runtime never
sees `.withInputs(...)` invocations.

Host-side input panel changes are applied by remounting or reloading
the script with a fresh override record. An active runner's resolved
input bag is frozen for deterministic replay, including dependency
sub-runners.

## `.output("title")` reads

`<binding>.output("title")` returns a `Series<number>` view over the
producer's titled `plot` calls. The compiler rewrites every call site
into a synthesised `__chartlang_depOutput(slotId, localId, title)`
runtime call before bundling, so the rewritten code never invokes the
sentinel — calling `.output(...)` outside a compiler-handled bundle
throws.

If the producer's `plot(...)` call has no `title`, the compiler emits
`dep-output-not-titled` and rejects the build. Title every `plot` the
producer emits when consumers reference it by name; untitled producers
that no consumer reads are still fine.

If a consumer asks for a title the producer never declares, the
compiler emits `dep-unknown-output`.

## Multi-export files

A single `.chart.ts` MAY declare any number of `defineIndicator(...)`
results. The export form determines what the host renders:

| Form | Render? | Slot-id prefix |
| --- | --- | --- |
| `export default defineIndicator(...)` | Yes — primary script | (none) |
| `export const foo = defineIndicator(...)` | Yes — sibling | `export:foo/` |
| `const foo = defineIndicator(...)` | No — private dep | (dropped; diagnostics carry `dep:foo/`) |

The compiled sidecar is a single `ScriptManifest` when only one drawn
indicator exists in the file and a `ReadonlyArray<ScriptManifest>` when
two or more do — the host runs `Array.isArray(manifest)` to branch.

Sibling exports are emitted in declaration order under their
`export:<exportName>/` prefix. Diagnostics from any source forward to
the adapter; only renderable emissions (plots / drawings / alerts /
logs) from private deps are dropped.

## Cross-file imports

The compiler resolves `import baseTrend from "./base-trend.chart"`
recursively, inlining the producer's compiled module into the
consumer's bundle. Shared producers reached via multiple paths inline
exactly once (deduplicated by content hash).

This release only resolves **same-package** sibling files. Cross-
package imports (`import x from "@some/other-pkg/x.chart"`) are out of
scope.

## Cycle detection

A binding cycle — `A → B → A`, or any longer chain — fails compile with
the `dep-cycle` diagnostic at every binding in the cycle.

## Dep error handling

If a dep's `compute` throws (or calls `runtime.error(...)`), the
runtime:

1. Emits a `dep-error` diagnostic carrying the inner message.
2. Drops the **primary** script's renderable emissions for that bar.
3. Keeps **sibling** export emissions for that bar — siblings are
   independent renders, not data deps of the primary.
4. Resumes normal execution on the next bar.

A buggy dep cannot smuggle wrong values into a consumer because the
consumer's bar is invalidated atomically.

## State and persistence

Each dep / sibling owns its own state-slot section in the runner
snapshot. Slot ids are prefixed `dep:<localId>/` for private deps and
`export:<exportName>/` for siblings; the primary keeps its existing
`<sourcePath>:<line>:<col>#<callIndex>` format. Warm-start replays
restore every section deterministically. See
[Execution semantics § Dependency execution order](../spec/semantics.md#dependency-execution-order).

## What's not supported in this release

- **Dynamic dep resolution.** Host-supplied registries of compiled
  scripts resolved at mount time stay out of scope; the inline-bundle
  model is the only path.
- **Cross-package imports.** `import x from "@some/other-pkg/x.chart"`
  is rejected at compile.
- **Opt-in emission forwarding for private deps.** A dep that's not
  exported never renders. To render a sibling alongside a primary,
  add an `export const` binding.
- **Dep alerts forwarded with rate-limit ledger merge.** Alerts only
  flow when the dep is also a drawn export.

## Related

- [Script manifest § Indicator dependencies](../spec/manifest.md#indicator-dependencies)
- [Execution semantics § Dependency execution order](../spec/semantics.md#dependency-execution-order)
- [apiVersion contract](../spec/versioning.md)
- [Glossary § Dependency, Private dep, Drawn indicator, Output](../reference/glossary.md#dependency)
