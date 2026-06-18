---
title: "apiVersion contract"
since: "1.0"
status: "stable"
---

# apiVersion contract

`apiVersion` is the integer that selects the chartlang script language
contract. It is independent of npm package semver and is the compatibility key
that lets scripts, compilers, runtimes, hosts, and adapters agree on one
portable language.

## The `apiVersion` Integer

Every chartlang script MUST declare `apiVersion: 1` in the object literal
passed to `defineIndicator`, `defineDrawing`, `defineAlert`, or
`defineAlertCondition`.

This compiler implements exactly one frozen language version: `1`. It MUST
reject every other literal with `api-version-mismatch`. The required
wrong-literal message wording is:

```txt
`apiVersion: 2` is not supported — this compiler implements the frozen `apiVersion: 1` contract. Future language versions require a compiler that declares support for them.
```

It MUST also reject a missing `apiVersion` field with the same diagnostic
code. The required missing-field wording is:

```txt
defineIndicator/defineDrawing/defineAlert/defineAlertCondition requires `apiVersion: 1` — the frozen language version this compiler implements.
```

The numeric value is deliberately small and literal. A future language version
uses `apiVersion: 2`, not a string such as `"1.1"` and not the npm package
version.

## What `apiVersion: 1` Freezes

`apiVersion: 1` freezes four compatibility surfaces.

### Script-Visible Core API

Every export visible to scripts from `@invinite-org/chartlang-core` and
`@invinite-org/chartlang-core/time` is part of the v1 contract. This includes
the `define*` constructors, type aliases, primitive namespaces, time helpers,
input builders, state slots, request primitives, drawing helpers, plotting
helpers, alert helpers, runtime logging helpers, and view objects exposed to
`compute`.

Within `1.x`, implementations MAY add new optional fields or new exports that
do not change existing semantics. Removing an export, renaming an export,
changing a parameter meaning, changing return semantics, or changing which
calls allocate state requires `apiVersion: 2`.

### `STATEFUL_PRIMITIVES`

The v1 stateful primitive registry is name-set-locked for the entries that
ship in a given `1.x` release: a conforming compiler MUST use that release's
call-name set when deciding which primitive calls receive callsite ids and
which primitive calls are forbidden inside loops.

Within `1.x`, implementations MAY **add** new stateful primitive entries. A new
call name is purely additive — it introduces new callsites only and changes
neither the behavior nor the runtime state identity of any script written for
an earlier `1.x`. This mirrors the additive policy for `DiagnosticCode` and the
emission `PlotKind` / drawing kinds below: a runtime that does not recognise a
newer entry simply never sees it emitted by an older script.

Removing or renaming an existing registry entry is a language change and
requires `apiVersion: 2`. Changing an entry from slot-allocating to
non-slot-allocating, or the reverse, also changes runtime state identity and
requires `apiVersion: 2`.

### Manifest Schema

The script manifest schema is frozen at v1. Required fields, field names,
discriminators, and meanings MUST remain stable for every v1 script. Within
`1.x`, implementations MAY add optional manifest fields that older runtimes
can ignore.

Removing a manifest field, renaming a field, changing a discriminator, making
an optional field required, or changing the meaning of existing manifest data
requires `apiVersion: 2`.

#### Indicator composition (`1.x` additive)

The indicator-composition feature lands entirely as additive optional
fields within `apiVersion: 1.x`: `dependencies`, `outputs`, `exportName`,
`siblings`, and `isDrawn` on `ScriptManifest`. Single-script files emit
byte-identical manifests because every new field stays absent on the
back-compat path. Older runtimes that ignore the new fields keep
loading `1.x` manifests without behaviour change. See
[Script manifest § Indicator Dependencies](./manifest.md#indicator-dependencies).

### Emission Wire Schemas

Runtime emission shapes are frozen at v1. Existing plot, drawing, alert, log,
and diagnostic wire fields keep their names and meanings for the full v1
line.

Within `1.x`, implementations MAY add optional fields and MAY add new
`PlotKind` values or drawing kinds that adapters can ignore when unsupported.
Adapters MUST treat unsupported additive kinds as capability fallbacks, not as
schema corruption. Renames, removals, required-field additions, and semantic
changes require `apiVersion: 2`.

`DiagnosticCode` is additive across `1.x`. The indicator-composition
feature extends the set with six new codes — `dep-error`, `dep-cycle`,
`dep-unknown-output`, `dep-invalid-input-override`, `dep-dynamic`, and
`dep-output-not-titled` — bringing the total to 32. Adapters that don't
recognise an additive code MUST log + ignore it, never treat it as
schema corruption. The `STATEFUL_PRIMITIVES` set is unchanged by indicator
composition; the new `.output(...)` / `.withInputs(...)` accessors are
compiler-rewritten sentinels on `CompiledScriptObject`, not runtime
primitives.

## Compiler Support Window

The chartlang compatibility model allows a compiler to support a sliding
window of language versions `N..N+2`. That window is a maximum support policy,
not a requirement that every compiler implement future versions early.

This compiler supports exactly `{1}`. It MUST reject `apiVersion: 0`,
`apiVersion: 2`, omitted values, string values, and computed values.

## Adapter and Host Declaration

Adapters and hosts MUST declare which script `apiVersion` values they support.
A runtime MUST reject a script, manifest, adapter, or host combination whose
declared versions do not overlap. The rejection MUST be a clear load-time
error, not a silent no-op and not a delayed rendering artifact.

A v1 adapter MAY ignore additive optional fields or unsupported additive
emission kinds according to its capability declaration. It MUST NOT claim
support for `apiVersion: 1` while changing the meaning of frozen v1 fields.

## Package Semver vs `apiVersion`

Package semver and script `apiVersion` are orthogonal axes.

Package semver governs the TypeScript API of each npm package: for example
compiler options, runtime host helpers, adapter-kit utilities, and package
entry points. Script `apiVersion` governs the language accepted from
`.chart.ts` files and the compatibility surfaces listed above.

A `2.0.0` npm package release does not imply `apiVersion: 2`. A package may
need a semver major for package-level TypeScript changes while still compiling
and running only `apiVersion: 1` scripts. Conversely, `apiVersion: 2` is a
language change and must be called out explicitly even if packages also change
semver.

## Freeze Snapshot

The `v1.0.0` git tag is the canonical frozen snapshot of the v1 spec. After
that tag, edits under `docs/spec/` are clarifications unless they explicitly
declare a semantic change.

Any semantic change to the v1 grammar, manifest, emission schemas, runtime
semantics, script-visible core API, or stateful primitive registry requires an
`apiVersion` bump. Such a change MUST be called out in a changeset and MUST
land as a new language version, beginning with `apiVersion: 2`.

Clarifications MAY improve wording, examples, cross-links, or ambiguity in
the published pages, but they MUST NOT redefine accepted source, diagnostics,
runtime behavior, manifest shape, or wire shape for existing v1 scripts.

## Conformance Checklist

- Every script declares numeric-literal `apiVersion: 1` in its default
  `define*` object.
- The compiler supports exactly `{1}` unless it explicitly declares support
  for another language version.
- The compiler rejects every unsupported, missing, string, or computed
  `apiVersion` value with `api-version-mismatch` and the frozen wording above.
- The script-visible core API and `/time` subpath remain source-compatible for
  v1 scripts.
- The 174-entry `STATEFUL_PRIMITIVES` name set and slot behavior stay locked
  for v1.
- Manifest fields and emission wire schemas remain backward-compatible, with
  only additive optional changes allowed in `1.x`.
- Adapters and hosts declare supported `apiVersion` values and reject
  mismatches at load time with a clear error.
- Package semver changes are not treated as language-version changes unless
  the release explicitly bumps `apiVersion`.
- The `v1.0.0` tag is treated as the canonical frozen snapshot; semantic spec
  changes require a new `apiVersion` and a changeset.
