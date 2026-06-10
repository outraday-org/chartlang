# Version pinning

`apiVersion` is the integer that selects the chartlang language
contract. Every script declares it as a numeric literal:

```ts
import { defineIndicator } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "stable",
    apiVersion: 1,
    overlay: true,
    compute() {},
});
```

The current compiler ships exactly one frozen language version: `1`.
That version is forever — a script written today still compiles, loads,
and emits the same numbers tomorrow, on any conforming chartlang
implementation that declares support for `apiVersion: 1`.

## Why a separate integer from npm semver

Package semver and script `apiVersion` are orthogonal axes.

| Axis | Governs | Example |
| --- | --- | --- |
| npm package semver | TypeScript API of an `@invinite-org/chartlang-*` package | `@invinite-org/chartlang-host-worker@2.0.0` may drop a deprecated helper. |
| script `apiVersion` | The language grammar, manifest schema, emission wire shapes, and the script-visible core API. | `apiVersion: 2` would be a new language version with its own compiler. |

A `2.0.0` package release does not imply `apiVersion: 2`. A package may
need a semver major for package-level TypeScript changes while still
compiling and running only `apiVersion: 1` scripts. The full policy is
in [apiVersion contract](../spec/versioning.md).

## What `apiVersion: 1` freezes

The
[apiVersion contract](../spec/versioning.md#what-apiversion-1-freezes)
is the canonical list. In short:

- **Script-visible core API.** Every export from
  `@invinite-org/chartlang-core` and its `/time` subpath.
- **The 172-entry stateful-primitive registry.** Which call names
  allocate runtime state slots and which are stateless is locked.
  Renaming `ta.ema` to `ta.exponentialMa` would be `apiVersion: 2`.
- **The script manifest schema.** Required fields, names, and
  discriminators stay stable.
- **The emission wire shapes.** Plot, drawing, alert, alert-condition,
  log, and diagnostic payload field names and meanings stay stable.

Within `1.x`, implementations may add optional fields and additive plot
or drawing kinds that older runtimes and adapters can safely ignore.
Removing a field, renaming a field, changing a discriminator, or
changing the meaning of existing data requires `apiVersion: 2`.

## How the compiler enforces it

```ts
import { defineIndicator } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "rejected",
    // @ts-expect-error — apiVersion must be 1
    apiVersion: 2,
    overlay: true,
    compute() {},
});
```

The compiler refuses any value but the literal numeric `1`. The
diagnostic is `api-version-mismatch`. A missing `apiVersion` field is
the same diagnostic. The wording is part of the spec — see
[apiVersion contract § the apiVersion integer](../spec/versioning.md#the-apiversion-integer).

## How the runtime and adapters honour it

- The runtime loads a script through the
  [host interface](../hosts/worker.md). It checks the manifest's
  `apiVersion` against its own supported set; a mismatch is a clear
  load-time error, not a silent no-op.
- Adapters declare the `apiVersion` values they accept. A v1 adapter
  may ignore additive optional fields or unsupported additive emission
  kinds via its capability declaration. It must not claim support for
  `apiVersion: 1` while changing the meaning of frozen v1 fields.

## The freeze snapshot

The `v1.0.0` git tag is the canonical frozen snapshot of the v1 spec.
After that tag, edits under `docs/spec/` are clarifications unless they
explicitly declare a semantic change. Any semantic change to the v1
grammar, manifest, emission schemas, runtime semantics, script-visible
core API, or stateful primitive registry requires an `apiVersion` bump.

## Cross-links

- The normative policy: [apiVersion contract](../spec/versioning.md).
- The diagnostic table: [grammar § forbidden constructs](../spec/grammar.md#forbidden-constructs).
- The stateful registry rules: [grammar § callsite identity](../spec/grammar.md#callsite-identity).
