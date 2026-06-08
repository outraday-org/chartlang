# Task 8 — host-quickjs: sandbox-escape suite + bench

> **Status: TODO**

## Goal

Land the defence-in-depth sandbox-escape suite that pins
`host-quickjs` as the production server-side host for **untrusted**
user scripts. Every escape vector the QuickJS membrane is supposed
to close gets an explicit test: `Function` constructor reach, `eval`,
dynamic `import()`, `globalThis` access, host-object capture via
`structuredClone`, infinite-loop denial-of-service, OOM exhaustion,
cross-realm leaks. Pair with a hardened bench against `host-worker`
so the §8.3 "≤ 100× slower for alert-class workloads" claim has a
measured anchor.

## Prerequisites

- Task 7: `createQuickJsHost` implemented with membrane.

## Current Behavior

- Task 7 covered cross-host parity + memory/CPU cap smoke tests.
- No explicit sandbox-escape suite.
- Bench measures roundTrip but not the full per-bar-compute path.

## Desired Behavior

- `packages/host-quickjs/src/sandbox.test.ts` covers ten escape
  vectors, each with a focused test asserting the attempt either
  fails with a known error message or produces no escape side
  effect.
- The suite runs in CI on every PR; a regression that lets any
  vector pass is a release-blocker.
- `packages/host-quickjs/src/perBarCompute.bench.ts` measures the
  full `push(close) → drain()` round trip for a 1,000-bar input
  on a representative script. Pair file lands the `THRESHOLD_MS`
  gate.

## Requirements

### 1. `packages/host-quickjs/src/sandbox.test.ts`

Each escape attempt is a separate `it("blocks <vector>", …)`:

#### 1.1 `Function` constructor

- Script: `defineIndicator({ compute() { const F = (0, eval)("Function"); F("return 1")(); } })`.
- Expectation: the `eval` call throws inside QuickJS; the membrane
  catches it; `drain()` returns a `fatal` diagnostic with code
  `runtime-error` referencing the throw site.

#### 1.2 `eval`

- Script: `defineIndicator({ compute() { eval("1"); } })`.
- Expectation: same — QuickJS deletes `eval` from the global; the
  call throws `ReferenceError`.

#### 1.3 Dynamic `import()`

- Script: `defineIndicator({ compute() { import("./malicious"); } })`.
- Expectation: the QuickJS module loader rejects unknown specifiers;
  the host membrane does **not** wire a module resolver; throw
  propagates as `fatal`.

#### 1.4 `globalThis` access

- Script: `defineIndicator({ compute() { (globalThis as any).leaked = 1; } })`.
- Expectation: assignment succeeds inside QuickJS but does **not**
  leak across the membrane. After the script completes, the host's
  `globalThis.leaked` is undefined. Pin via a second assertion in
  the test.

#### 1.5 Host-object capture via `structuredClone`

- Script: the script's `compute` reads `ctx.bar` (a host-provided
  view) and tries to return it as an `alert` meta value carrying a
  non-JsonValue (e.g. a `Function`).
- Expectation: `validateEmission` rejects the non-JsonValue meta
  field; the emission becomes a `malformed-emission` diagnostic;
  no host reference leaks.

#### 1.6 Infinite-loop DoS

- Script: `defineIndicator({ compute() { while(true) {} } })`.
- Expectation: `setInterruptHandler` fires after `maxStepMs`; the
  bar's compute is aborted; `step-overshoot` surfaces via
  `onHostError`; the next `drain()` returns the bar's partial
  emissions (typically empty, since the loop runs first).

#### 1.7 OOM exhaustion

- Script: allocates a 100 MB `Array(50_000_000).fill(0)`.
- Expectation: QuickJS hits `maxHeapBytes = 64 MB`; the allocation
  throws; `onHostError` receives `quickjs-oom`; subsequent bars
  fail gracefully (the context is disposed and re-created on
  next `load()`).

#### 1.8 Realm leak via `Reflect`

- Script attempts `Reflect.getPrototypeOf(Reflect)`.
- Expectation: succeeds inside QuickJS but the returned object is a
  QuickJS-internal prototype, not a host one. Assert by attempting
  to call a host-only method on it; expect `undefined`.

#### 1.9 Symbol.iterator hijack

- Script: `defineIndicator({ compute({ bar }) { Object.defineProperty(Object.prototype, Symbol.iterator, { get() { throw new Error("hijacked") } }); plot(bar.close); } })`.
- Expectation: the membrane's emission serialisation tolerates the
  hijack — it uses internal JSON serialisation paths that don't
  trip object prototype iteration. The emission still serialises
  correctly. (This is a parity claim about the runtime's
  emission pipeline; pin it.)

#### 1.10 Proxy revoke after emit

- Script: builds a `Proxy` around the emission meta payload, then
  revokes it before `drain()`.
- Expectation: emission serialisation happens at `pushPlot` /
  `pushAlert` time (per runtime CLAUDE.md), not at `drain` time —
  so the revoked Proxy can't affect drain output. Pin with a test
  that asserts the emission shape is intact.

### 2. `packages/host-quickjs/src/perBarCompute.bench.ts` (+ pair)

#### `perBarCompute.bench.ts`

- Vitest `bench()` running 1,000 `push(closeEvent) + drain()`
  iterations for a script computing `ta.ema(close, 20) + ta.rsi(close, 14)`.
- Single context per bench run (not per iteration) — measures
  per-bar overhead, not setup.

#### `perBarCompute.bench.test.ts`

- `THRESHOLD_MS`: target ≤ `host-worker` baseline × 50 (measured
  during the bench setup phase, then used as the gate). Document
  the rationale: PLAN §8.3 budgets 10–100×; 50× is the middle of
  the range and a stable CI gate.

### 3. CI considerations

- The sandbox suite runs `pnpm -F @invinite-org/chartlang-host-quickjs test sandbox`
  as a discrete script step in CI (existing `pnpm test` already
  picks it up; this just calls it out explicitly in the PR check
  matrix).
- The bench step `pnpm -F @invinite-org/chartlang-host-quickjs bench:ci`
  runs in the existing bench step.

### 4. JSDoc + CLAUDE.md

- Extend `packages/host-quickjs/CLAUDE.md` (created in Task 7) with
  the sandbox vectors covered. Future regressions are easier to
  diagnose when the matrix is documented inline.

### 5. README

- Add a one-line stability claim to
  `packages/host-quickjs/README.md`:
  > Sandbox-escape suite covers `Function` / `eval` / dynamic
  > `import` / `globalThis` / OOM / DoS / realm-leak / Symbol-
  > iterator hijack / Proxy revoke.

  Stay ≤ 100 lines.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/host-quickjs/src/sandbox.test.ts` | Create | 10 sandbox-escape tests |
| `packages/host-quickjs/src/perBarCompute.bench.ts` | Create | Bench (vitest bench mode) |
| `packages/host-quickjs/src/perBarCompute.bench.test.ts` | Create | `THRESHOLD_MS` gate |
| `packages/host-quickjs/CLAUDE.md` | Modify | List sandbox vectors covered |
| `packages/host-quickjs/README.md` | Modify | One-line sandbox claim |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm -F @invinite-org/chartlang-host-quickjs test --coverage` (100%)
- `pnpm docs:check`
- `pnpm readme:check`
- `pnpm bench:ci`

## Changeset

`.changeset/phase5-host-quickjs-sandbox-bench.md` — `patch` bump for
`@invinite-org/chartlang-host-quickjs` (no public surface change,
only test + doc additions). Body cites PLAN §8.3 + §8.4.

## Acceptance Criteria

- [ ] All 10 sandbox-escape tests pass; each pins a documented
      blocking mechanism.
- [ ] `perBarCompute` bench under the documented threshold.
- [ ] CLAUDE.md lists every vector covered.
- [ ] README's stability claim is accurate.
- [ ] 100% coverage maintained; gates green.
- [ ] Changeset committed.
