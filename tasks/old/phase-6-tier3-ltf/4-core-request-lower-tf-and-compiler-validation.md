# Core: `request.lowerTf` surface + compiler `validateLowerTfIntervals` pass

> **Status: TODO**

## Goal

Ship the public `request.lowerTf({ interval })` declaration in
`@invinite-org/chartlang-core`, register the
`"lower-tf-not-lower"` diagnostic code, and add the
`validateLowerTfIntervals` compiler analysis pass that walks every
`request.lowerTf` callsite and emits the diagnostic at compile time
when the requested interval is **not strictly lower** than the
script's declared main interval. Runtime wiring lands in Task 5.

## Prerequisites

- Task 1 completed (`IntervalDescriptor.intervalSeconds?` +
  `intervalToSeconds` available — the validation pass uses it).
- Task 3 completed (LTF bucketing kernel available — needed by
  Task 5, not this task, but landing the pipeline in order).

## Current Behavior

`packages/core/src/request/request.ts` exports `request.security`
only. The `request` namespace shape is:

```ts
export const request = Object.freeze({
  security: requestSecurityImpl,
});
```

No `request.lowerTf`. Compiler `extractRequestedIntervals.ts` collects
literal `request.security({ interval })` calls into
`manifest.requestedIntervals`; it does **not** validate ordering
between intervals.

`packages/compiler/src/diagnostics.ts` `CompileDiagnosticCode` union
covers the Phase-5 compile-time set. No `"lower-tf-not-lower"`.
(Compile-time codes live in the compiler's
`CompileDiagnosticCode` union — distinct from the runtime
`DiagnosticCode` union in `packages/adapter-kit/src/types.ts` which
catalogues adapter-capability mismatches.)

## Desired Behavior

`@invinite-org/chartlang-core` exports `request.lowerTf`:

```ts
export type RequestLowerTfOpts = { readonly interval: string };

declare const request: {
  readonly security: (opts: RequestSecurityOpts) => SecurityBar;
  readonly lowerTf: (opts: RequestLowerTfOpts) => Series<ReadonlyArray<Bar>>;
};
```

The runtime stub throws outside a `ComputeContext` (same pattern as
`request.security`). The compiler's `extractRequestedIntervals` pass
collects `request.lowerTf` intervals **in addition to**
`request.security` intervals into `manifest.requestedIntervals`. The
new `validateLowerTfIntervals` pass validates each `request.lowerTf`
callsite against the main interval and emits `"lower-tf-not-lower"`
on violation.

`"lower-tf-not-lower"` joins the `CompileDiagnosticCode` union in
`packages/compiler/src/diagnostics.ts` (not the adapter-kit
runtime `DiagnosticCode` union) with this contract:

- **Severity:** `error`
- **Emit site:** compile-time.
- **Message:** `request.lowerTf({ interval: "<requested>" }) must be
  strictly lower than the main interval "<main>" (requested
  <requestedSec>s ≥ main <mainSec>s)`.

## Requirements

### 1. Add `RequestLowerTfOpts` + `request.lowerTf` to core

In `packages/core/src/request/request.ts`:

```ts
import type { Bar, Series } from "../types.js";

export type RequestLowerTfOpts = {
  /**
   * Canonical interval value of the lower-timeframe stream
   * ("30s", "15s", "1m", etc.). Must be strictly lower than the
   * script's main interval — the compiler emits
   * `"lower-tf-not-lower"` otherwise.
   *
   * @since 0.6
   * @stable
   */
  readonly interval: string;
};

const LOWER_TF_STUB: (opts: RequestLowerTfOpts) => Series<ReadonlyArray<Bar>> = () => {
  throw new Error(
    "request.lowerTf may only be called inside a runtime ComputeContext",
  );
};

export const request = Object.freeze({
  security: requestSecurityImpl,
  lowerTf: LOWER_TF_STUB,
}) satisfies {
  readonly security: (opts: RequestSecurityOpts) => SecurityBar;
  readonly lowerTf: (opts: RequestLowerTfOpts) => Series<ReadonlyArray<Bar>>;
};
```

Export `RequestLowerTfOpts` from the package barrel
(`packages/core/src/index.ts`).

### 2. Append `request.lowerTf` to `CORE_AMBIENT_SHIM`

In `packages/compiler/src/program.ts`, the existing `declare module
"@invinite-org/chartlang-core"` block adds:

```ts
export type RequestLowerTfOpts = { readonly interval: string };
export const request: {
  readonly security: (opts: RequestSecurityOpts) => SecurityBar;
  readonly lowerTf: (opts: RequestLowerTfOpts) => Series<ReadonlyArray<Bar>>;
};
```

Mirror the Phase-5 `request.security` declaration style.

### 3. Append `"lower-tf-not-lower"` to `CompileDiagnosticCode`

In `packages/compiler/src/diagnostics.ts` (single-file diagnostics
module — there is no `packages/compiler/src/diagnostics/` subdir):

```ts
export type CompileDiagnosticCode =
  | ...existing codes...
  | "lower-tf-not-lower";
```

Append at the end of the union to preserve the Phase-1 contract
("new codes are added at the end" — see the JSDoc on the existing
union). The adapter-kit `DiagnosticCode` union is **not** modified —
it catalogues runtime adapter-capability mismatches, not compile-time
errors.

### 4. New compiler pass `validateLowerTfIntervals.ts`

Location: `packages/compiler/src/analysis/validateLowerTfIntervals.ts`.

Surface:

```ts
import type ts from "typescript";
import type { IntervalDescriptor } from "@invinite-org/chartlang-core";
import { intervalToSeconds } from "@invinite-org/chartlang-core";
import { createDiagnostic, type CompileDiagnostic } from "../diagnostics.js";

/**
 * Walks every `request.lowerTf({ interval: <literal> })` callsite and
 * verifies the literal is strictly lower (in seconds) than the
 * script's declared main interval. Emits
 * `"lower-tf-not-lower"` on violation.
 *
 * Non-literal `interval` values are out of scope — they are caught by
 * the existing `request-security-interval-not-literal` pass (the
 * same pass applies to both `request.security` and
 * `request.lowerTf`).
 *
 * The script's main interval is not pinned by the manifest
 * (`ScriptManifest.userPickableInterval` is a boolean flag — `true`
 * when the user may pick the main interval at runtime, not a pinned
 * value). The pass therefore validates against the **smallest**
 * interval the adapter declares in `Capabilities.intervals`: if the
 * requested lower-tf literal is not strictly lower than the smallest
 * declared main, the diagnostic fires. This guarantees no false
 * positives when the user is allowed to pick the main interval and
 * still catches every "lower-tf-not-lower" combination at compile
 * time.
 */
export function validateLowerTfIntervals(
  sourceFile: ts.SourceFile,
  filePath: string,
  declaredIntervals: ReadonlyArray<IntervalDescriptor>,
): ReadonlyArray<CompileDiagnostic>;
```

The body:

1. Walk the AST for `CallExpression` nodes whose callee resolves to
   `request.lowerTf` (mirror the resolution logic in
   `extractRequestedIntervals.ts`).
2. For each callsite, extract the literal `interval` value. If
   non-literal, skip — the existing literal-check pass handles it.
3. Resolve the main interval as the **smallest** entry in
   `declaredIntervals` (sorted by `intervalToSeconds`). This is the
   tightest valid main the script can run against; any LTF literal
   `>=` this value is invalid regardless of which main the user
   picks at runtime.
4. Compute `requestedSec = intervalToSeconds({ value: lit, label: lit, group: "" })`.
5. Compute `mainSec = intervalToSeconds(main)`.
6. If `requestedSec >= mainSec`, emit:

```ts
createDiagnostic({
  severity: "error",
  code: "lower-tf-not-lower",
  message: `request.lowerTf({ interval: "${lit}" }) must be strictly lower than the main interval "${main.value}" (requested ${requestedSec}s ≥ main ${mainSec}s)`,
  file: filePath,
  node: literalNode,
  sourceFile,
});
```

### 5. Wire the pass into the compile pipeline

`packages/compiler/src/api.ts` — the `compile()` function (around the
existing `extractRequestedIntervals` invocation, line ~136 in Phase 5)
runs the analysis passes in sequence and concatenates their
diagnostics. Insert a call to `validateLowerTfIntervals` after
`extractRequestedIntervals` (so the requested-intervals set is
populated and any non-literal arguments have already produced
`request-security-interval-not-literal` diagnostics) and before the
bundler stage. The pass needs `declaredIntervals` — pass through the
adapter's `Capabilities.intervals` as the `declaredIntervals`
argument (the compiler already receives the manifest's
`requestedIntervals` from `extractRequestedIntervals`; the
adapter-capability set is supplied by the host via the compile
options bag).

### 6. Extend `extractRequestedIntervals` to collect `request.lowerTf`

The Phase-5 pass collects `request.security` intervals only. Extend
it to also match `request.lowerTf({ interval: <lit> })` and add the
literal to `manifest.requestedIntervals`. The collected set is a flat
list of every interval the script asks for — secondary stream
registration in Task 5 reads from it without needing to distinguish
LTF from HTF.

Keep the existing `request-security-interval-not-literal` diagnostic
applying to both call shapes (rename the diagnostic code? **No** — the
code stays as-is to preserve the Phase-5 wire contract; the message is
generalised). Update the diagnostic message to:

```
request.{security|lowerTf}({ interval }) must be a string literal or input.enum value
```

Pick the brace-substituted variant based on the callee name.

### 7. Tests — pass-side

`packages/compiler/src/analysis/validateLowerTfIntervals.test.ts`:

- Declared intervals `["1h"]`, LTF = `"5m"` → no diagnostic.
- Declared intervals `["1m"]`, LTF = `"5m"` → diagnostic with
  expected message and source range pointing to the literal.
- Declared intervals `["5m"]`, LTF = `"5m"` → diagnostic (must be
  strictly lower).
- Declared intervals `["5m"]`, LTF = `"30s"` → no diagnostic.
- LTF interval non-literal → no diagnostic from this pass (the
  literal-check pass handles it).
- No `request.lowerTf` calls in the script → no diagnostic.
- Declared intervals `["1m", "5m", "1h"]`, LTF = `"30s"` → no
  diagnostic (lower than the smallest declared `"1m"`).
- Declared intervals `["1m", "5m", "1h"]`, LTF = `"5m"` → diagnostic
  (not strictly lower than the smallest declared `"1m"`).
- Hour-suffix case parity (`"1h"` and `"1H"` resolve identically via
  `intervalToSeconds`) — exercise both cases.

### 8. Tests — extractor extension

`packages/compiler/src/analysis/extractRequestedIntervals.test.ts`
adds:

- Script with `request.security({ interval: "1D" })` +
  `request.lowerTf({ interval: "30s" })` → both collected into
  `manifest.requestedIntervals`.
- Script with `request.lowerTf({ interval: dynamic })` →
  `request-security-interval-not-literal` diagnostic emitted with the
  generalised message.

### 9. Tests — core surface

`packages/core/src/request/request.test.ts` already exercises
`request.security`. Add cases for `request.lowerTf`:

- `request.lowerTf({ interval: "1m" })` outside a `ComputeContext`
  throws the expected error message.
- `Object.isFrozen(request)` remains `true`.

### 10. JSDoc + docs gate

`request.lowerTf` carries `@since 0.6`, `@stable`, and a compiling
`@example` (calling it inside an indicator that's gated by a
`Capabilities.multiTimeframe` flag). `pnpm docs:check` auto-generates
`docs/primitives/request/lowerTf.md`.

### 11. README + CLAUDE.md

`packages/core/README.md` — add `request.lowerTf` to the surface
table. ≤ 100 lines.
`packages/compiler/README.md` — add `validateLowerTfIntervals` to the
analysis-pass list. ≤ 100 lines.
`packages/compiler/src/analysis/CLAUDE.md` — paragraph on the LTF
ordering check + pointer to PLAN §4.5.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/request/request.ts` | Modify | Add `RequestLowerTfOpts`, `request.lowerTf` stub. |
| `packages/core/src/request/request.test.ts` | Modify | New cases for `request.lowerTf`. |
| `packages/core/src/index.ts` | Modify | Re-export `RequestLowerTfOpts`. |
| `packages/compiler/src/program.ts` | Modify | Append `request.lowerTf` to `CORE_AMBIENT_SHIM`. |
| `packages/compiler/src/diagnostics.ts` | Modify | Add `"lower-tf-not-lower"` to `CompileDiagnosticCode`. |
| `packages/compiler/src/analysis/validateLowerTfIntervals.ts` | Create | New analysis pass. |
| `packages/compiler/src/analysis/validateLowerTfIntervals.test.ts` | Create | Unit cases for the pass. |
| `packages/compiler/src/analysis/extractRequestedIntervals.ts` | Modify | Also collect `request.lowerTf` intervals; generalise literal-check message. |
| `packages/compiler/src/analysis/extractRequestedIntervals.test.ts` | Modify | New cases. |
| `packages/compiler/src/api.ts` | Modify | Invoke the new pass after `extractRequestedIntervals` in `compile()`. |
| `packages/compiler/src/analysis/CLAUDE.md` | Create (if missing) | Paragraph on LTF ordering. |
| `packages/core/README.md` | Modify | Surface table update. |
| `packages/compiler/README.md` | Modify | Analysis-pass list update. |
| `.changeset/phase6-request-lower-tf-surface.md` | Create | Minor bumps on `chartlang-core` and `chartlang-compiler` (adapter-kit untouched — `lower-tf-not-lower` is a compile-time code). |

## Gates

- `pnpm typecheck`.
- `pnpm lint`.
- `pnpm test` — 100% coverage on touched files.
- `pnpm docs:check`.
- `pnpm readme:check`.

## Changeset

`.changeset/phase6-request-lower-tf-surface.md`:

```md
---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-compiler": minor
---

Add `request.lowerTf({ interval })` surface returning
`Series<ReadonlyArray<Bar>>` of contained lower-timeframe bars.
Compile-time `lower-tf-not-lower` diagnostic (added to
`CompileDiagnosticCode`) enforces that the lower-timeframe
interval is strictly smaller than the main interval (per PLAN
§4.5). Runtime wiring lands in the next release.
```

## Acceptance Criteria

- [ ] `request.lowerTf` declared in core with frozen `request`
      namespace shape preserved.
- [ ] `Object.isFrozen(request)` remains `true`.
- [ ] `RequestLowerTfOpts` exported from the package barrel.
- [ ] `CORE_AMBIENT_SHIM` declares `request.lowerTf`; scripts compile
      against it.
- [ ] `"lower-tf-not-lower"` added to `CompileDiagnosticCode` in
      `packages/compiler/src/diagnostics.ts` (appended at the end
      per the Phase-1 "new codes added at the end" contract).
- [ ] `validateLowerTfIntervals` pass ships with full JSDoc; tests
      cover the 7 cases listed.
- [ ] `extractRequestedIntervals` extended to collect both
      `request.security` and `request.lowerTf` intervals; generalised
      literal-check message.
- [ ] Compile pipeline invokes the new pass after the manifest is
      partially built.
- [ ] 100% coverage on touched compiler files.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm docs:check`,
      `pnpm readme:check` all green.
- [ ] Auto-generated `docs/primitives/request/lowerTf.md` exists.
- [ ] Changeset committed.
