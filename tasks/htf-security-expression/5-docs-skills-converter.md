# Docs + skills + Pine converter + changeset + CLAUDE.md sweep

> **Status: TODO**

## Goal

Finish the feature's documentation and tooling surface so nothing is
left describing the old behavior: the multi-timeframe language doc, a
dedicated example/guide page, the auto-generated docs, the **skills**
folder (both skills + regenerated references), the Pine converter (which
currently lowers Pine's expression form incorrectly), the changeset, and
a final sweep of every per-folder `CLAUDE.md` whose invariants changed.

## Prerequisites

Task 4 (example/demo/conformance landed; behavior final).

## Current Behavior

- `docs/language/multi-timeframe.md` documents only the data-only
  `request.security({ interval })` → `SecurityBar` form, with the
  `ta.ema(weekly.close, 10)` example (the misleading one).
- `docs/examples/htf-trend-filter.md` is auto-generated from
  `DEMO_SCRIPTS` via `pnpm examples:generate`.
- `docs/converter/diagnostics.md` is auto-generated and lists the
  converter's `request-security-*` diagnostics.
- `skills/chartlang-coding/SKILL.md` §7 lists `request.security({ interval })`
  and `request.lowerTf({ interval })` as supported (data-only) primitives;
  it does **not** mention the expression form, and
  `references/forbidden.md` does not forbid `request.security` in any
  arity. `skills/chartlang-coding/references/primitives.md` is regenerated
  by `pnpm skills:generate` (gated by `skills:gate`).
  `skills/chartlang-setup/` mirrors the compile/host/adapter contract.
- `packages/pine-converter/src/transform/requestSecurity.ts` lowers
  `request.security(syminfo.tickerid, "D", ta.ema(close, 9))` to the
  **wrong** main-timeframe form
  `request.security({ interval: "1d" }).ta.ema(bar.close, 9)`.
  Tested in `src/transform/request-security.test.ts`.

## Desired Behavior

- The language doc documents **both** forms, explains the clock
  distinction (why the data form's `ta.*` counts main bars and the
  expression form counts HTF bars), and the restricted-scope rule.
- The spec docs document the new manifest field and the runtime
  semantics, so integrators can discover the contract without reading
  implementation tasks.
- A dedicated docs page demonstrates the weekly-trend example.
- Skills document the new chartlang callback form and the capture rule
  (added to the supported `request.*` surface in §7). Generated
  references regenerated.
- The Pine converter lowers the expression form to the correct chartlang
  callback form.

## Requirements

### 1. Language doc — `docs/language/multi-timeframe.md`

Add an "Expression form" section after the data-form section:
- Signature `request.security({ interval }, (bar) => …) → Series<number>`.
- **The clock explanation** (this is the conceptual heart): the data
  form returns a series aligned to the *main* timeline, so `ta.*` applied
  to it count their window in *main* bars; the expression form runs
  `ta.*` on the *HTF* clock (one step per HTF bar) then aligns down. Show
  the side-by-side: `ta.ema(weekly.close, 20)` (≈ daily EMA) vs
  `request.security({ interval: "1W" }, (b) => ta.ema(b.close, 20))`
  (true 20-week EMA).
- The restricted-scope rule: callback may reference only the `bar`
  param, `ta`, `inputs`, safe `Math.*` globals, and literals; capturing
  an outer local → `request-security-expr-captures-local`.
  (chartlang has no `math` namespace — don't document one, and keep
  `Math.random` forbidden.)
- No-lookahead alignment (held until the next HTF close), same-symbol
  only, `multiTimeframe` capability gate → NaN fallback.
- Ensure the page is in `docs/.vitepress/config.ts` sidebar (it already
  is for multi-timeframe; just confirm).

### 2. Dedicated example/guide page

The Examples section is generated from `DEMO_SCRIPTS` via
`pnpm examples:generate` (Task 4 updated the HTF demo entry). Run it and
commit the regenerated `docs/examples/htf-trend-filter.md`. If a second
demo entry was added in Task 4 (e.g. "Weekly vs Daily EMA"), its
`docs/examples/<id>.md` is generated too — confirm both render and are
in the Examples nav (`docs/.vitepress/config.ts` builds the nav from
`DEMO_SCRIPTS`, so this is automatic — just verify the gate).

If the team wants a hand-written conceptual guide beyond the generated
example, add `docs/language/` prose in the multi-timeframe page rather
than a separate generated file (avoid a second source of truth).

### 3. Spec docs

- `docs/spec/manifest.md`: add `securityExpressions` to the manifest
  field table as an optional array of `{ slotId, interval, paramName }`
  descriptors. Explain that it is emitted only for expression-form
  `request.security` callsites and omitted otherwise.
- `docs/spec/semantics.md`: update the Higher-Timeframe
  `request.security` section to distinguish data-form alignment from
  expression-form HTF-clock evaluation, including no-lookahead alignment,
  same-symbol-only scope, and `multiTimeframe` NaN fallback.

### 4. Skills — `chartlang-coding`

- `skills/chartlang-coding/SKILL.md`: in §7 (where
  `request.security({ interval })` is already listed as supported),
  **add** the expression form as a supported pattern — document the
  chartlang callback form, the restricted-scope rule, and a
  correct/incorrect example (`(bar) => ta.ema(bar.close, 20)` ✅ vs
  `(bar) => ta.ema(bar.close, k)` ❌ capture). There is nothing to
  "un-forbid" — the form was never in `references/forbidden.md`. Do
  **not** add an expression form for `request.lowerTf` (out of scope —
  it stays data-only).
- Regenerate `skills/chartlang-coding/references/primitives.md` via
  `pnpm skills:generate` (it picks up the Task-1 JSDoc on
  `request.security`). Commit the regenerated file.
- `skills/chartlang-setup/`: if it documents the manifest shape or the
  compile/host contract, add the `securityExpressions` manifest field
  and the runtime's lazy callback-capture/fold-stream note. Keep it in
  sync with the runtime/host contract.
- Run `pnpm skills:gate` — must pass.

### 5. Pine converter — `requestSecurity.ts`

Update the lowering so a non-OHLCV third argument becomes the chartlang
callback form:
- `request.security(syminfo.tickerid, "D", ta.ema(close, 9))` →
  `request.security({ interval: "1d" }, (bar) => ta.ema(bar.close, 9))`.
- The converter must rewrite series references inside the Pine source
  expression to the HTF `bar` param: bare `close`/`open`/`high`/`low`/
  `hl2`/etc. → `bar.close` etc. (reuse the converter's existing source
  field mapper — the same one that today produces `bar.close`).
- OHLCV-only third args (`request.security(sym, "D", close)`) keep
  lowering to the **data** form `request.security({ interval: "1d" }).close`
  (no behavioral change — a bare field doesn't need the callback).
- If the Pine expression captures something the chartlang capture-rule
  forbids, emit a converter diagnostic guiding the user (reuse or extend
  `request-security-not-mapped`); document it in `docs/converter/`.
- Update `src/transform/request-security.test.ts`: the
  `ta.ema(close, 9)` case now expects the callback form. This inline test
  is the authoritative converter coverage — there are **no `*security*`
  fixtures** under `packages/pine-converter/fixtures/` today. If a
  broader end-to-end fixture happens to exercise `request.security(sym,
  tf, ta.*)`, regenerate its `.expected.chart.ts` /
  `.expected.diagnostics.json`; otherwise no fixture work is needed.

### 6. Converter docs

Two different mechanisms — do not conflate them:

- `docs/converter/diagnostics.md` is **auto-generated** (header marker
  `AUTO-GENERATED by pnpm converter:docs:generate`, emitted by
  `scripts/gen-converter-docs.ts`). Regenerate it.
- `docs/converter/supported.md` and `docs/converter/rejects.md` are
  **hand-written** (no auto-gen marker). They must be **hand-edited**:
  - `supported.md` has a hand-authored **"## Multi-timeframe"** section
    (~line 148) that today only describes the OHLCV-third-arg lowering
    `request.security(syminfo.tickerid, "<timeframe>", <ohlcv>)`. Extend
    it to document that a `ta.*`/expression third argument now lowers to
    the chartlang **callback form**
    `request.security({ interval }, (bar) => …)`, while a bare OHLCV
    third arg keeps lowering to the data form.
  - `rejects.md` has a `request-security-not-mapped` row (~line 87) whose
    "Fix" suggestion implies the expression third arg is unsupported.
    Update it so an in-subset `ta.*` expression is no longer described as
    a reject; keep the genuinely-unsupported shapes (cross-symbol,
    non-literal timeframe, `lookahead`) listed.

Run the converter docs gate (`pnpm converter:docs:generate` /
`pnpm docs:check`) and confirm green.

### 7. Final CLAUDE.md sweep

Confirm every per-folder `CLAUDE.md` touched across Tasks 1-4 is updated,
plus:
- `docs/CLAUDE.md` — if it enumerates language pages.
- `skills/` — if there's a skills CLAUDE/README describing coverage.
- `packages/pine-converter/CLAUDE.md` — the new lowering + any diagnostic.
- Root `CLAUDE.md` — only if a cross-folder rule changed (likely not).

### 8. Changeset finalisation

Ensure `.changeset/request-security-expression-form.md` lists every
bumped package with the right semver:
- `@invinite-org/chartlang-core` — minor
- `@invinite-org/chartlang-compiler` — minor
- `@invinite-org/chartlang-runtime` — minor
- `@invinite-org/chartlang-host-worker` — minor
- `@invinite-org/chartlang-host-quickjs` — minor
- `@invinite-org/chartlang-conformance` — patch (new scenarios)
- `@invinite-org/chartlang-pine-converter` — minor (new lowering)
Write a clear summary describing the new expression form and the
clock semantics.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `docs/language/multi-timeframe.md` | Modify | Expression form + clock explanation + capture rule |
| `docs/spec/manifest.md` | Modify | Optional `securityExpressions` sidecar field |
| `docs/spec/semantics.md` | Modify | HTF expression-form runtime semantics |
| `docs/examples/htf-trend-filter.md` (+ any new id) | Regenerate | `pnpm examples:generate` |
| `docs/converter/diagnostics.md` | Regenerate (auto-gen) | Converter diagnostics table |
| `docs/converter/supported.md` | Modify (hand-written) | Extend "## Multi-timeframe" with the callback-form lowering |
| `docs/converter/rejects.md` | Modify (hand-written) | Update `request-security-not-mapped` row — `ta.*` expr no longer a reject |
| `skills/chartlang-coding/SKILL.md` | Modify | Add expression form to §7 supported surface; document callback + capture rule |
| `skills/chartlang-coding/references/primitives.md` | Regenerate | `pnpm skills:generate` |
| `skills/chartlang-setup/*` | Modify (if applicable) | Manifest + runtime/host contract sync |
| `packages/pine-converter/src/transform/requestSecurity.ts` | Modify | Correct expression lowering |
| `packages/pine-converter/src/transform/request-security.test.ts` | Modify | Expect callback form |
| `packages/pine-converter/fixtures/*` | Regenerate (only if an existing fixture exercises the 3-arg form; no `*security*` fixtures exist today) | Expected outputs |
| `packages/pine-converter/CLAUDE.md` | Modify | New lowering note |
| `.changeset/request-security-expression-form.md` | Modify | Final package list + summary |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (pine-converter coverage 100%)
- `pnpm docs:check`
- `pnpm examples:generate` + `pnpm examples:gate`
- `pnpm skills:generate` + `pnpm skills:gate`
- `pnpm changeset status` (changeset present)

## Acceptance Criteria

- [ ] `multi-timeframe.md` documents both forms + the clock distinction
      + the capture rule.
- [ ] `docs/spec/manifest.md` documents `securityExpressions`, and
      `docs/spec/semantics.md` documents HTF-clock expression evaluation.
- [ ] Generated example page(s) regenerated and in the Examples nav.
- [ ] Skills §7 documents the expression form (callback + capture rule);
      primitives reference regenerated; `skills:gate` green.
- [ ] Pine converter lowers `request.security(sym, tf, ta.*)` to the
      callback form; tests + fixtures updated; OHLCV-only stays data form.
- [ ] Converter docs: `diagnostics.md` regenerated; `supported.md`
      "## Multi-timeframe" + `rejects.md` `request-security-not-mapped`
      hand-edited for the callback-form lowering.
- [ ] All affected `CLAUDE.md` files updated.
- [ ] Changeset finalised with every bumped package + summary.
