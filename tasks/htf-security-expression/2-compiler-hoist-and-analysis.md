# Compiler: hoist HTF callback + capture diagnostic + lookback + manifest

> **Status: TODO**

## Goal

Teach the compiler to recognise the expression form
`request.security(opts, (bar) => …)`, **hoist** the callback into a
registerable per-callsite security-expression unit recorded in the
manifest, reject outer-local capture with a new diagnostic, and ensure
`extractMaxLookback` includes lookback inside the callback so the
secondary stream is sized correctly. The compiler output of this task is
what the runtime (Task 3) consumes.

## Prerequisites

Task 1 (core overload + `SecurityExpr` type).

## Current Behavior

- `extractRequestedIntervals.ts` reads `opts.interval` (string literal or
  `inputs.<enum>`) into `manifest.requestedIntervals`; non-literal →
  `request-security-interval-not-literal`. It ignores any second arg.
- `callsiteIdInjection.ts` injects a slot-id string as the **first** arg
  of every stateful call (`request.security` included) and visits nested
  calls uniformly — so `ta.*` inside an arrow callback already receives
  slot ids. The injected security-call shape is
  `request.security("<slotId>", opts)`.
- `extractMaxLookback.ts` walks series reads (`close[N]`) + `ta.*` calls
  to size the ring buffer. **Verify** whether it descends into nested
  arrow functions (it should, via the AST walk) — confirm with a test.
- `manifest.ts` freezes `requestedIntervals`. `program.ts` holds the
  ambient core shim (must match Task 1's overload). `diagnostics.ts`
  owns the diagnostic-code union.

## Desired Behavior

For each `request.security(slotId, opts, expr)` callsite where `expr` is
an arrow/function expression:

1. The interval is extracted exactly as today (still must be literal).
2. The callback is **validated**: its body may reference only the `bar`
   parameter, `ta`/`math` (resolved via core), `inputs`, and literals.
   Any other free identifier → `request-security-expr-captures-local`.
3. The callsite is recorded as a **security-expression unit** in the
   manifest: `{ slotId, interval, paramName }` (the compiled callback
   itself stays inline in the emitted module; the manifest entry tells
   the runtime "this slotId runs an expression on this interval").
4. `extractMaxLookback` counts lookback inside the callback so the
   secondary stream for `interval` is sized ≥ the callback's needs.

## Requirements

### 1. Detect the expression arity in `extractRequestedIntervals`

After resolving a `request.security` call and its `opts.interval`, check
for a **second argument** that is `ts.isArrowFunction(arg)` or
`ts.isFunctionExpression(arg)`. When present, this callsite is an
expression unit. Keep emitting the interval into `requestedIntervals`
(union/sort/dedupe unchanged). Extract:
- `slotId` — the already-injected first-arg string literal (read it from
  the call; if the injection pass runs after this analysis, read the
  pre-injection callsite id the same way `injectCallsiteIds` mints it —
  reuse that helper rather than re-deriving the format).
- `interval` — the literal.
- `paramName` — the callback's single parameter identifier text.

> **Ordering note:** `extractRequestedIntervals` runs in the
> analysis phase (`api.ts` `transformAndAnalyse`). Slot-id injection runs
> earlier in that pipeline (api.ts lines ~212-217), so the slot-id literal
> is present by analysis time. Confirm against `api.ts` and assert it in a
> test; if not, thread the minted id through instead of re-reading.

### 2. New capture-check pass

Add `packages/compiler/src/analysis/validateSecurityExpr.ts`:

```ts
/**
 * Validate that a request.security expression callback references only
 * its bar parameter, the ambient ta/math namespaces, inputs, and
 * literal constants. Any other free identifier is a captured outer
 * binding and is rejected with `request-security-expr-captures-local`.
 */
export function validateSecurityExpr(
    callback: ts.ArrowFunction | ts.FunctionExpression,
    checker: ts.TypeChecker,
    diagnostics: CompileDiagnostic[],
    sourcePath: string,
): void;
```

Algorithm:
- Collect the callback's bound names (the `bar` param + any locals
  declared *inside* the body — `const`/`let` are allowed as long as
  their initialisers also obey the rule).
- Walk the body for `ts.Identifier` references in expression position.
  For each free identifier (not a bound name, not a property name):
  - **Allow** if `resolveCoreSymbolName(checker, id)` resolves to `ta`,
    `math`, `inputs`, or `bar`-derived access. Reuse
    `resolveCallee.ts:resolveCoreSymbolName` — do not fork symbol
    resolution.
  - **Allow** `inputs.<x>` member access (the destructured `inputs`
    param resolves through `ComputeContext`).
  - Otherwise push `request-security-expr-captures-local` with the
    identifier's range and a message naming the captured symbol and
    suggesting it be inlined as a literal or read from `inputs`.
- Function/arrow expressions nested deeper inside the callback are out
  of subset — reject them too (keeps v1 flat).

Wire `validateSecurityExpr` into `api.ts` `transformAndAnalyse`,
called once per detected expression callsite, alongside the interval
extraction.

### 3. New diagnostic code

`packages/compiler/src/diagnostics.ts`: add
`"request-security-expr-captures-local"` to the diagnostic-code union
(error severity). Follow the existing code's shape (message builder,
severity, any docs-table registration). If diagnostic codes are
enumerated for the converter docs table, add the entry there too.

### 4. Manifest wiring

`packages/compiler/src/manifest.ts` (+ the manifest type in core or
compiler — locate `ScriptManifest`): add a field

```ts
readonly securityExpressions: ReadonlyArray<Readonly<{
    readonly slotId: string;
    readonly interval: string;
    readonly paramName: string;
}>>;
```

Default `[]` for scripts without the expression form (keeps every
existing manifest byte-identical except the new empty array — confirm
the host sidecar + snapshot consumers tolerate the added field; if any
freeze/validate path enumerates manifest keys, update it). Populate from
the callsites found in step 1, sorted by `slotId` for determinism.

> The compiled callback stays **inline** in the emitted module — the
> runtime closes over the live `ta`/`bar`. The manifest entry is only the
> registry telling the runtime which slotId is an HTF expression and on
> which interval. Do **not** try to serialise the callback body.

### 5. `extractMaxLookback` covers the callback

Confirm (and test) that `extractMaxLookback.ts` descends into the arrow
callback so a `ta.ema(bar.close, 200)` or `bar.close[50]` inside it
contributes to `maxLookback`. If it currently narrows scope and skips
nested functions, widen it to include `request.security` expression
callbacks specifically (do not blanket-include arbitrary nested
functions — those are rejected in step 2 anyway). The secondary stream
is created with the whole-file `maxLookback`-derived capacity in Task 3,
so covering the callback here guarantees the HTF stream is large enough.

### 6. `program.ts` ambient shim

Update the ambient core type shim in `program.ts` to match Task 1's
overloaded `security` (both arities) and the `SecurityExpr` type, so the
in-memory `ts.Program` type-checks author scripts using the new form.

### 7. Tests (co-located)

`packages/compiler/src/analysis/validateSecurityExpr.test.ts` (new):
- accepts `(bar) => ta.ema(bar.close, 20)`,
  `(bar) => ta.rsi(bar.hlc3, inputs.len)`, `(bar) => bar.close.current`.
- rejects `(bar) => ta.ema(bar.close, k)` (captures `k`),
  `(bar) => ta.ema(otherSeries, 20)` (captures `otherSeries`), and a
  nested arrow.

`packages/compiler/src/analysis/extractRequestedIntervals.test.ts`
(extend): the expression form still emits the interval; populates
`securityExpressions` with the right `slotId`/`interval`/`paramName`;
non-literal interval still errors.

`packages/compiler/src/analysis/extractMaxLookback.test.ts` (extend):
lookback inside the callback is counted.

Add an end-to-end compile assertion (in the compiler's API test or
`packages/cli/src/e2e.test.ts` if that's where script-shaped fixtures
live) that a full `defineIndicator` using the expression form compiles
clean with a populated `securityExpressions` manifest entry.

100% coverage on every changed compiler file.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/compiler/src/analysis/extractRequestedIntervals.ts` | Modify | Detect expr arity, emit `securityExpressions` entries |
| `packages/compiler/src/analysis/validateSecurityExpr.ts` | Create | Capture-check pass |
| `packages/compiler/src/analysis/validateSecurityExpr.test.ts` | Create | Accept/reject cases |
| `packages/compiler/src/analysis/extractMaxLookback.ts` | Modify | Count callback lookback |
| `packages/compiler/src/diagnostics.ts` | Modify | New diagnostic code |
| `packages/compiler/src/manifest.ts` | Modify | `securityExpressions` field |
| `packages/compiler/src/api.ts` | Modify | Wire validateSecurityExpr into the pipeline |
| `packages/compiler/src/program.ts` | Modify | Ambient shim for the overload |
| `packages/compiler/CLAUDE.md` | Modify | Document hoist + capture diagnostic + manifest field |
| `packages/core/src/types.ts` (or manifest type home) | Modify | `ScriptManifest.securityExpressions` type |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (compiler coverage 100%)
- `pnpm docs:check`

## Changeset

Append `@invinite-org/chartlang-compiler` (**minor**) to the feature
changeset created in Task 1.

## Acceptance Criteria

- [ ] Expression-form callsites detected; interval still extracted +
      literal-checked.
- [ ] `securityExpressions` populated in the manifest (sorted, `[]`
      default), type added to `ScriptManifest`.
- [ ] `request-security-expr-captures-local` rejects outer-local
      capture and nested functions; accepts `bar`/`ta`/`math`/`inputs`/
      literals.
- [ ] `extractMaxLookback` counts callback lookback (tested).
- [ ] `program.ts` shim matches the Task-1 overload.
- [ ] All changed compiler files at 100% coverage; `CLAUDE.md` updated.
- [ ] Changeset frontmatter updated.
