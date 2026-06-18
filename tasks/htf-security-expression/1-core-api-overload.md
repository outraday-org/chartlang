# Core: `request.security` expression overload + types

> **Status: TODO**

## Goal

Add the second (expression/callback) overload of `request.security` to
the core public surface — the TypeScript signatures, the runtime
sentinel stub, the `statefulPrimitives` registry entry, and the JSDoc —
so scripts can type-check the new form and downstream packages have a
contract to compile/run against. No behavior yet; this task is the
contract.

## Prerequisites

None.

## Current Behavior

`packages/core/src/request/request.ts`:

```ts
export type RequestSecurityOpts = Readonly<{ readonly interval: string }>;

export const request = Object.freeze({
    security(_opts: RequestSecurityOpts): SecurityBar {
        return sentinel("request.security");
    },
    lowerTf(_opts: RequestLowerTfOpts): Series<ReadonlyArray<Bar>> {
        return sentinel("request.lowerTf");
    },
});
export type RequestNamespace = typeof request;
```

`SecurityBar` is the 12-field OHLCV-series struct.
`packages/core/src/types.ts` exposes `request: RequestNamespace` on
`ComputeContext`. `packages/core/src/statefulPrimitives.ts` registers
`request.security` with `slot: true`.

## Desired Behavior

`request.security` is **overloaded**:

```ts
// 1. data-only (unchanged)
security(opts: RequestSecurityOpts): SecurityBar;
// 2. expression form (new)
security(opts: RequestSecurityOpts, expr: SecurityExpr): Series<number>;
```

The expression form returns a `Series<number>` aligned no-lookahead to
the main timeline. The callback type:

```ts
export type SecurityExpr = (bar: SecurityBar) => Series<number> | number;
```

A `Series<number> | number` return lets authors write either
`(bar) => ta.ema(bar.close, 20)` (series) or `(bar) => bar.close.current * 2`
(scalar); the runtime samples the value once per HTF bar.

## Requirements

### 1. `SecurityExpr` type + overloaded signature

In `packages/core/src/request/request.ts`:

1. Export `SecurityExpr`:
   ```ts
   /**
    * A higher-timeframe expression callback for {@link RequestNamespace.security}.
    * Receives the HTF {@link SecurityBar} (OHLCV series on the secondary
    * stream's own clock) and returns the value to evaluate per HTF bar.
    * The body may reference only the `bar` parameter, the ambient `ta` /
    * `math` namespaces, `inputs`, and literal constants — capturing any
    * other outer binding is a compile error
    * (`request-security-expr-captures-local`).
    */
   export type SecurityExpr = (bar: SecurityBar) => Series<number> | number;
   ```
2. Convert `security` to an overloaded function. Because the namespace is
   a frozen object literal, declare the overloads on the **type** and
   keep one implementation:
   ```ts
   function security(opts: RequestSecurityOpts): SecurityBar;
   function security(opts: RequestSecurityOpts, expr: SecurityExpr): Series<number>;
   function security(_opts: RequestSecurityOpts, _expr?: SecurityExpr): SecurityBar | Series<number> {
       return sentinel("request.security");
   }
   export const request = Object.freeze({ security, lowerTf });
   ```
   Keep `RequestNamespace = typeof request` so `ComputeContext.request`
   continues to surface both overloads automatically. Verify the
   resulting `RequestNamespace["security"]` is callable in both arities
   (add a `// @ts-expect-error`-free compile assertion in the test).

### 2. `statefulPrimitives` registry

`packages/core/src/statefulPrimitives.ts` already lists `request.security`
with `slot: true`. Confirm no change is needed for the second arity (the
slot-id is still injected as the first argument regardless of the second
arg). Add an inline comment noting the expression overload also routes
through this same entry. If the registry encodes an arg count / arg
shape anywhere, widen it to allow the optional 2nd arg.

### 3. JSDoc (primitive template — feeds `skills:generate`)

The `security` method must carry the full primitive JSDoc block so
`pnpm skills:generate` captures the new form. Include both forms in
`@example`, `@since` (next minor), and the stability marker matching the
sibling `request.*` entries:

```ts
/**
 * Read a secondary candle stream at a script-author-fixed interval.
 *
 * Two forms:
 * - **Data**: `request.security({ interval })` → a {@link SecurityBar}
 *   (OHLCV series aligned no-lookahead to the main timeline).
 * - **Expression**: `request.security({ interval }, (bar) => …)` →
 *   `Series<number>`. The callback runs **on the higher-timeframe
 *   clock** (once per HTF bar), so `ta.*` inside it accumulate over HTF
 *   bars; the result is aligned no-lookahead down to the main timeline.
 *
 * @example
 *     // weekly EMA(20) — computed over weekly bars, drawn on the chart
 *     const trend = request.security({ interval: "1W" }, (bar) => ta.ema(bar.close, 20));
 *     plot(trend, { title: "Weekly EMA(20)" });
 * @example
 *     // data form — aligned weekly close
 *     const weekly = request.security({ interval: "1W" });
 *     plot(weekly.close, { title: "Weekly close" });
 * @since 0.<next>
 * @stable
 */
```

### 4. Tests (co-located)

`packages/core/src/request/request.test.ts` (extend):

- **Sentinel**: both arities throw the `sentinel("request.security")`
  message when called outside a script step (the data form already does;
  add the expression arity).
- **Type-level**: a `tsd`-style or in-file compile assertion that
  `request.security({ interval: "1W" })` is `SecurityBar` and
  `request.security({ interval: "1W" }, (b) => ta.ema(b.close, 20))` is
  `Series<number>`. Use the existing core type-assertion pattern (look
  for `expectType` / `satisfies` usage already in the package).
- **`SecurityExpr` accepts both** a `Series<number>`-returning and a
  `number`-returning callback (compile assertion).

100% coverage on the changed file (the impl branch is a single
`sentinel` return — ensure the test calls it).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/request/request.ts` | Modify | `SecurityExpr` type, overloaded `security`, JSDoc |
| `packages/core/src/request/request.test.ts` | Modify | Sentinel + type assertions for the new overload |
| `packages/core/src/statefulPrimitives.ts` | Modify (likely comment-only) | Confirm/annotate expression arity routes through the slot entry |
| `packages/core/src/index.ts` | Modify | Re-export `SecurityExpr` if the package re-exports request types |
| `packages/core/CLAUDE.md` | Modify | Document the two-form `request.security` surface |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (core coverage 100%)
- `pnpm docs:check` (JSDoc on the new export)
- `pnpm readme:check` (if core README lists the request surface)

## Changeset

`.changeset/request-security-expression-form.md` — **minor** bump for
`@invinite-org/chartlang-core` (additive overload). One changeset file
for the whole feature is fine; create it here and let later tasks append
the other affected packages to its frontmatter.

## Acceptance Criteria

- [ ] `request.security` overloaded: data form → `SecurityBar`,
      expression form → `Series<number>`.
- [ ] `SecurityExpr` exported and re-exported from the package barrel.
- [ ] `statefulPrimitives` confirmed to cover the 2-arg arity.
- [ ] JSDoc primitive block present with both `@example`s, `@since`,
      stability marker.
- [ ] Sentinel + type-level tests pass; core coverage 100%.
- [ ] `packages/core/CLAUDE.md` documents the two-form surface.
- [ ] Changeset created (minor, core).
