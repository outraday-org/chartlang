# Docs: Pine → chartlang migration guide

> **Status: TODO**

## Goal

Ship `docs/spec/pine-migration.md` — a curated migration guide
covering the six categories of Pine scripts (indicators, drawings,
alerts, inputs, state, multi-timeframe), a Pine→chartlang feature
matrix flagging unsupported areas, and a 5-script audit checklist
proving the guide covers real Pine code. PR-gated through
`pnpm docs:check`.

## Prerequisites

- Task 5 completed — the `request.lowerTf` surface this guide
  documents must be implemented before the guide can show working
  examples.

## Current Behavior

`docs/spec/` ships `emissions.md`, `grammar.md`, `manifest.md`,
`semantics.md`, `versioning.md`. No migration guide. External Pine
authors have no curated on-ramp; they must read the entire spec to
find equivalents.

## Desired Behavior

`docs/spec/pine-migration.md` ships with these sections (in order):

1. **Introduction** — who this guide is for, what's covered, what
   isn't.
2. **High-level mental model** — Pine's per-bar execution vs
   chartlang's `compute(ctx)`, how `series` maps to `Series<T>`, the
   role of the manifest.
3. **Worked examples — one per category** (six total):
   - Indicators (EMA crossover)
   - Drawings (`box.new` → `draw.box`, `label.new` → `draw.label`)
   - Alerts (`alertcondition` + `alert` → `defineAlertCondition` +
     `alert`)
   - Inputs (`input.int` / `input.string` / `input.source` → typed
     `input.*`)
   - State (`var` → `state.int` / `state.float` / `state.string`)
   - Multi-timeframe (`request.security` → `request.security`;
     introduction of `request.lowerTf` for bucketed LTF data)
4. **Feature matrix** — every Pine v6 primitive grouped by category,
   with a chartlang equivalent or an explicit "not supported" reason.
5. **Audit checklist** — 5 real Pine scripts (curated, cited by name)
   and the chartlang script that replaces each. Each entry links to a
   `tasks/phase-6-tier3-ltf/audit/<n>-<slug>.md` line-by-line port
   trace.

The guide is registered in `scripts/docs-check.ts`'s explicit doc
list (alongside the existing `docs/spec/*.md` files) so `pnpm docs:check`
validates its frontmatter + internal links.

## Requirements

### 1. Top-level structure

`docs/spec/pine-migration.md`:

```md
---
title: "Pine → chartlang migration guide"
since: "0.6"
status: "stable"
---

# Pine → chartlang migration guide

> **Audience:** Pine v6 authors porting indicators, drawings, alerts,
> and multi-timeframe scripts to chartlang.
>
> **Scope:** Every Pine v6 surface that has a chartlang equivalent.
> Out-of-scope surfaces are flagged with a "not supported, see
> roadmap" note (see § Feature matrix).

## High-level mental model

[~150-200 words]

## Worked examples

### 1. Indicators — EMA crossover

[Pine source block + chartlang source block + commentary]

### 2. Drawings — labeled box on the last 50 bars

[Same pattern]

### 3. Alerts — RSI cross + `defineAlertCondition`

[Same pattern]

### 4. Inputs — int / string / source

[Same pattern]

### 5. State — `var` running total

[Same pattern]

### 6. Multi-timeframe — `request.security` HTF and `request.lowerTf`
   LTF

[Same pattern; cover both directions in one section]

## Feature matrix

| Pine v6 surface | chartlang equivalent | Notes |
|-----------------|----------------------|-------|
| [80-120 rows] | | |

## Audit checklist

5 real Pine scripts, each linked to a curated port trace.
```

### 2. Worked-example contract

Every worked example follows the same structure:

```md
### N. <Category> — <Script summary>

**Pine v6 source:**

\`\`\`pine
//@version=6
indicator("EMA Crossover", overlay=true)
fastLen = input.int(9)
slowLen = input.int(21)
fast = ta.ema(close, fastLen)
slow = ta.ema(close, slowLen)
plot(fast, color=color.green)
plot(slow, color=color.red)
\`\`\`

**chartlang equivalent:**

\`\`\`ts
import { defineIndicator, input, plot, ta } from "@invinite-org/chartlang-core";

export default defineIndicator({
  id: "ema-crossover",
  version: "1.0.0",
  inputs: {
    fastLen: input.int({ default: 9, min: 1 }),
    slowLen: input.int({ default: 21, min: 1 }),
  },
  compute(ctx) {
    const fast = ta.ema(ctx.close, ctx.inputs.fastLen);
    const slow = ta.ema(ctx.close, ctx.inputs.slowLen);
    plot(fast, { color: "#22c55e" });
    plot(slow, { color: "#ef4444" });
  },
});
\`\`\`

**Differences worth knowing:**

- chartlang inputs are declared in the manifest, not in `compute`.
  This lets the editor render the input UI without running the
  script.
- chartlang `plot()` takes an options object instead of positional
  args.
- Colors are CSS strings, not `color.<name>` constants. Use
  `color.fromGradient`, `color.withAlpha`, `color.rgb`, `color.hsl`
  for dynamic colors (added in `0.5`).
```

Use the established surface from §22.10 / Phase 5 docs — link out to
the auto-generated `docs/primitives/...` pages for deeper API detail.

### 3. Feature matrix

The matrix is **the** load-bearing reference for migrating authors.
Cover, at minimum:

- **Indicators** — all `ta.*` (RSI, EMA, SMA, MACD, ATR, Bollinger,
  Stoch RSI, VWAP, Aroon, ADX, CCI, MFI, Williams %R, Ichimoku, SAR,
  Supertrend, etc. — the Phase-2 + Phase-5 inventory plus the four
  volume-profile primitives).
- **Plots** — `plot`, `plotshape`, `plotchar`, `plotarrow`,
  `plotcandle`, `plotbar`, `bgcolor`, `barcolor`, `hline`, `fill`.
- **Drawings** — every Phase-3 `DrawingKind` plus `draw.table`
  (Phase 5).
- **Alerts** — `alert`, `alertcondition`, `defineAlertCondition`.
- **Inputs** — `input.int`, `input.float`, `input.bool`,
  `input.string`, `input.source`, `input.timeframe`, `input.color`,
  `input.enum`.
- **State** — `var`, `varip`, `nz`, `na`.
- **Multi-timeframe** — `request.security`, `request.lowerTf`,
  `request.security_lower_tf` (chartlang merges this into
  `request.lowerTf`).
- **Session / calendar** — `time`, `dayofweek`, `weekofyear`,
  `session.ismarket`, `session.isfirstbar`, `session.islastbar`.
  Map to `nyDayKey`, `weekday`, `weekKey`, `session.isOpen`
  (Phase 6).
- **Color / style** — `color.new`, `color.rgb`, `color.from_gradient`,
  `color.r`, `color.g`, `color.b`, `color.a`.
- **Runtime** — `runtime.log.*`, `runtime.error`.
- **Strategy** — `strategy.entry` / `strategy.close` /
  `strategy.exit` → **not supported** (beyond 1.0; link to PLAN §15
  follow-up).
- **Library / module system** — Pine `library` declarations →
  **partially supported** (chartlang has ES modules; document the
  conventions).
- **Webhook / notification** — Pine `alert` with webhook payload →
  **not supported** in the OSS repo (consumer adapters wire their
  own).

Each row carries a one-line note. Where a chartlang equivalent
exists, link to the auto-generated docs page.

### 4. Audit checklist

Five real Pine scripts (curated, attributed):

| # | Pine script (source) | chartlang port | Notes |
|---|----------------------|----------------|-------|
| 1 | Linked or named PD-style RSI strategy | `tasks/phase-6-tier3-ltf/audit/1-rsi-strategy.md` | Pure indicator |
| 2 | A SMA-cross alert script | `audit/2-sma-cross-alert.md` | Exercises `defineAlertCondition` |
| 3 | A multi-timeframe trend filter | `audit/3-mtf-trend-filter.md` | Exercises `request.security` + `request.lowerTf` |
| 4 | A volume-profile-derived support / resistance script | `audit/4-vp-sr.md` | Exercises the Phase-5 VP primitives |
| 5 | A session-aware VWAP variant | `audit/5-session-vwap.md` | Exercises the Phase-6 session helpers |

The audit folder is created under `tasks/phase-6-tier3-ltf/audit/`
with a short README + 5 entries. Each entry contains:

- The **original Pine source** (or a link if licensing prohibits
  inlining).
- The **chartlang port**.
- A **line-by-line trace** mapping Pine identifiers / calls /
  semantics to their chartlang equivalents.
- A **gap callout** flagging anything that doesn't port cleanly (and
  what the user should do instead).

The audit folder is **work-product**, not deliverable docs — it
exists to prove the migration guide covers real-world scripts and
isn't ornamental.

### 5. Wire into docs:check

`scripts/docs-check.ts` (or `scripts/gen-docs.ts`) maintains an
explicit list of curated doc pages. Append `docs/spec/pine-migration.md`
to this list:

```ts
const CURATED_DOCS = [
  "docs/spec/emissions.md",
  "docs/spec/grammar.md",
  "docs/spec/manifest.md",
  "docs/spec/semantics.md",
  "docs/spec/versioning.md",
  "docs/spec/pine-migration.md", // Phase 6
] as const;
```

Verification step: every internal markdown link in the guide
resolves (existing `docs:check` logic already validates internal
links across the curated list — verify it includes
`docs/primitives/**` since the migration guide links into those).

### 6. Cross-link from other docs

- `docs/spec/grammar.md` — one paragraph at the top with a link to
  the migration guide.
- Top-level `README.md` — one bullet under "Getting started" linking
  to the guide. Keep root README ≤ 300 lines.

### 7. Style + tone

- ~1,500–2,500 words total (matches the other `docs/spec/*` pages).
- Code blocks compile (every `chartlang` block is type-checked by
  `pnpm docs:check`).
- No marketing language — this is reference docs.
- Use `> Note:` callouts for gotchas; use `> Warning:` callouts for
  semantic differences that bite (e.g. Pine's `na` vs chartlang's
  `NaN`).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `docs/spec/pine-migration.md` | Create | The migration guide. |
| `tasks/phase-6-tier3-ltf/audit/README.md` | Create | Audit folder index. |
| `tasks/phase-6-tier3-ltf/audit/1-rsi-strategy.md` | Create | Audit entry 1. |
| `tasks/phase-6-tier3-ltf/audit/2-sma-cross-alert.md` | Create | Audit entry 2. |
| `tasks/phase-6-tier3-ltf/audit/3-mtf-trend-filter.md` | Create | Audit entry 3. |
| `tasks/phase-6-tier3-ltf/audit/4-vp-sr.md` | Create | Audit entry 4. |
| `tasks/phase-6-tier3-ltf/audit/5-session-vwap.md` | Create | Audit entry 5. |
| `scripts/docs-check.ts` | Modify | Append `pine-migration.md` to curated list. |
| `docs/spec/grammar.md` | Modify | One-paragraph cross-link. |
| `README.md` (root) | Modify | One bullet linking to the guide. |

## Gates

- `pnpm docs:check` — frontmatter valid, every internal link
  resolves, every chartlang code block compiles.
- `pnpm readme:check` — root README ≤ 300 lines after the addition.
- `pnpm typecheck` — the chartlang code blocks in the guide are
  extracted and compiled (the existing docs:check pipeline does
  this; verify the migration guide blocks are included).

## Changeset

**None.** Docs-only changes do not take a changeset in this
workspace — there is no `@invinite-org/chartlang-docs` published
package, and `.changeset/` in prior phases (1–5) does not contain
docs-only entries. The migration guide ships as a plain commit; the
narrative line lands in the Task-7 closeout changeset under the
existing per-package bumps.

## Acceptance Criteria

- [ ] `docs/spec/pine-migration.md` ships with the six worked
      examples, the feature matrix, and the audit checklist.
- [ ] Every chartlang code block in the guide compiles (validated by
      `pnpm docs:check`).
- [ ] Every internal markdown link resolves.
- [ ] The five audit entries exist under
      `tasks/phase-6-tier3-ltf/audit/` with line-by-line traces.
- [ ] `scripts/docs-check.ts` includes `pine-migration.md` in the
      curated list.
- [ ] `docs/spec/grammar.md` and root `README.md` cross-link to the
      guide.
- [ ] Feature matrix covers at least the surfaces listed in
      Requirements §3.
- [ ] Out-of-scope surfaces (strategy primitives, webhook delivery,
      etc.) are explicitly flagged with a "not supported, see
      roadmap" reason.
- [ ] `pnpm docs:check`, `pnpm readme:check`, `pnpm typecheck` all
      green.
- [ ] No changeset (docs-only convention).
