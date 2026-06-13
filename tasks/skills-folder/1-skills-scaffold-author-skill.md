# Task 1 — Root `CLAUDE.md` + `skills/` scaffold + `chartlang-author` skill

> **Status: TODO**

## Goal

Create the repo-root `CLAUDE.md` (the maintenance contract), the
top-level `skills/` directory with its `README.md`, and the
**`chartlang-author`** Agent Skill — an Anthropic-format skill that
teaches an end-user LLM how to write chartlang `.chart.ts` scripts.
The skill ships its narrative `SKILL.md` plus three hand-written
reference pages; `references/primitives.md` lands as a committed
**placeholder** that Task 2 replaces with generated content.

## Prerequisites

None. First task in the folder.

## Current Behavior

- No repo-root `CLAUDE.md` exists (16 per-folder ones do).
- No `skills/` directory exists.
- An external LLM helping a user write `.chart.ts` files has no
  portable knowledge pack — it must be hand-fed the docs.

## Desired Behavior

After this task:

- `CLAUDE.md` exists at the repo root with the maintenance contract +
  a one-line index of where folder `CLAUDE.md` files and skills live.
- `skills/README.md` explains what `skills/` is and how to install via
  `npx skills add outraday-org/chartlang` or manual copy.
- `skills/chartlang-author/SKILL.md` is a complete, self-consistent
  authoring guide.
- `skills/chartlang-author/references/{primitives.md,examples.md,forbidden.md}`
  exist. `examples.md` + `forbidden.md` are final; `primitives.md` is
  a placeholder with the generator's auto-header so Task 2's gate has a
  target.
- Root `README.md` gains a short "AI skills" subsection linking
  `skills/`.

## Requirements

### 1. Root `CLAUDE.md` — terse maintenance contract

Create `/CLAUDE.md`. Keep it under ~40 lines. Exact structure:

```markdown
# CLAUDE.md (repo root)

Maintenance contract for AI agents working in this repo. Per-folder
`CLAUDE.md` files carry the deep orientation; this file carries only
the rules that span folders.

## Rules

- **When you change behavior in a folder, update that folder's
  `CLAUDE.md`.** The per-folder file is the agent-facing source of
  truth for that package's invariants. A behavior change that
  invalidates a documented invariant must update the `CLAUDE.md` in
  the same PR.
- **When you change anything a skill in `skills/` describes, update
  that skill in the same PR.** The author skill mirrors the language
  surface (`defineIndicator`, `compute`, `ta.*`/`draw.*`, forbidden
  constructs); the integrator skill mirrors the compile/host/adapter
  contract. If you change those, the skill is now wrong — fix it.
  The generated `skills/chartlang-author/references/primitives.md` is
  re-emitted by `pnpm skills:generate`; the `skills:gate` will fail CI
  if you forget.

## Index

- `packages/*/CLAUDE.md` — per-package invariants (compiler, runtime,
  hosts, cli, conformance, core).
- `docs/CLAUDE.md`, `examples/CLAUDE.md`, `scripts/CLAUDE.md`,
  `.github/CLAUDE.md` — folder-scoped conventions.
- `skills/chartlang-author/` — end-user "write chartlang scripts" skill.
- `skills/chartlang-integrator/` — developer "integrate chartlang" skill.
```

> Note: the `skills:generate` / `skills:gate` scripts referenced above
> land in Task 2. It is fine for this root file to reference them now —
> they exist by the end of the folder, and the rule reads correctly
> regardless of ordering.

### 2. `skills/README.md`

Create `skills/README.md` (≤ 60 lines). Cover:

- What `skills/` is: portable Anthropic-format Agent Skills for
  external LLMs (not the in-repo `CLAUDE.md` agent orientation).
- The two skills and one-line purpose each.
- Install via skills.sh:

  ```bash
  # installs every skill in this repo into your agent (.claude/skills, etc.)
  npx skills add outraday-org/chartlang

  # or a single skill
  npx skills add outraday-org/chartlang/tree/main/skills/chartlang-author
  ```

- Manual install: copy `skills/<name>/SKILL.md` (and its `references/`)
  into `.cursor/rules/`, your project `CLAUDE.md`, or upload to
  Claude.ai.
- A one-line maintenance note: "These skills mirror the language and
  integration contract — see the repo-root `CLAUDE.md` rule."

### 3. `skills/chartlang-author/SKILL.md`

The bulk of this task. Hand-written. **Frontmatter** (skills.sh
requires `name` + `description`; make the description "pushy" for
trigger accuracy per skill-authoring guidance):

```yaml
---
name: chartlang-author
description: >-
  Write chartlang `.chart.ts` indicator, drawing, and alert scripts.
  Use this skill whenever the user is editing a `.chart.ts` file, asks
  to write or fix a chartlang indicator, mentions `defineIndicator`,
  `ta.*`, `plot`, `draw.*`, `alert`, or `input.*`, or wires AI into an
  editor to author chartlang scripts. Covers the import+destructure
  contract, the four script kinds, forbidden constructs, inputs, and
  the full `ta.*`/`draw.*` primitive surface.
---
```

**Body** — condense from `docs/language/overview.md`,
`docs/language/forbidden-constructs.md`, `docs/language/inputs.md`, and
`docs/getting-started/write-your-first-script.md`. Do **not** paste
those verbatim; write a tight LLM-facing guide and link back to the
canonical docs. Required sections:

1. **The contract in one screen** — a minimal `defineIndicator` script;
   the two load-bearing rules stated explicitly:
   - Top-level imports come from `@invinite-org/chartlang-core` **only**
     and feed the compiler's capability extractor.
   - `compute({ bar, ta, plot, … })` destructures the per-bar context;
     the destructured callables are the real slot-aware impls. Top-level
     `ta`/`plot`/`alert` identifiers are compile-time holes that throw
     if called outside the runtime. **Both forms must appear together.**
2. **The four script kinds** — table: `defineIndicator` /
   `defineDrawing` / `defineAlert` / `defineAlertCondition`, what each
   emits. `apiVersion: 1` is a numeric literal.
3. **Series & indexing** — `ta.*` return series; `.current` reads the
   latest value; warmup windows return NaN/seed until filled. Link
   `docs/language/series-and-indexing.md`.
4. **Inputs** — the twelve `input.*` shapes, how defaults flow, and the
   `.withInputs(...)` override path. Link `docs/language/inputs.md`.
5. **Indicator composition** — bind a producer to a `const`, read its
   outputs via `<binding>.output("title")`; export = drawn,
   non-exported `const` = data-only dep. Link
   `docs/language/indicator-composition.md`.
6. **Forbidden constructs (hard rules)** — no `Date`, `Math.random`,
   `fetch`, `setTimeout`/`setInterval`, `Promise`, `eval`,
   `new Function`, `require`, dynamic `import`. Diagnostic:
   `hostile-global`. No escape hatch in `apiVersion: 1`. Time comes
   from `bar.time`. Point at `references/forbidden.md` for the full
   category list.
7. **Primitive surface** — one paragraph: "the complete `ta.*` /
   `draw.*` reference with signatures, `@formula`, and `@warmup` is in
   `references/primitives.md` (generated from source — authoritative)."
   Do **not** inline the primitive table in SKILL.md.
8. **Worked examples** — point at `references/examples.md`.
9. **Common mistakes** — short bulleted list: importing `ta` top-level
   but not destructuring it (or vice versa); calling a primitive
   outside `compute`; using wall-clock/entropy; forgetting `.current`
   on a crossover series; an untitled `plot()` in a producer disabling
   the default-output path.

Keep SKILL.md focused and skimmable — target ~150–220 lines. Detail
that belongs in a reference goes in `references/`, not the main body.

### 4. `skills/chartlang-author/references/forbidden.md`

Hand-written. Condense `docs/language/forbidden-constructs.md` into an
LLM-facing rule list grouped by category (determinism, sandbox I/O,
non-replayable control flow), each with the offending construct, the
`hostile-global` (or relevant) diagnostic code, and the
chartlang-idiomatic replacement (e.g. `Date.now()` → `bar.time`). Open
the file with the same auto-header sentinel **only if** it is generated
— it is **not**, so no header. Link back to
`docs/spec/grammar.md#forbidden-constructs` as the normative source.

### 5. `skills/chartlang-author/references/examples.md`

Hand-written. 3–4 complete, compileable worked examples drawn from
`examples/scripts/`:

- EMA cross with alert (`examples/scripts/ema-cross.chart.ts`).
- Bollinger bands (`examples/scripts/bollinger-bands.chart.ts`).
- RSI divergence alert (`examples/scripts/rsi-divergence-alert.chart.ts`).
- Indicator composition (`examples/scripts/trend-confirmation.chart.ts`
  + `base-trend.chart.ts`).

For each: the full source, then 2–3 sentences on what contract detail
it demonstrates. These are real files — copy their current content; do
not invent variants.

### 6. `skills/chartlang-author/references/primitives.md` (PLACEHOLDER)

Create a committed placeholder so the skill is self-consistent before
Task 2's generator runs. First line MUST be the auto-generated-header
sentinel Task 2 will emit (so the gate compares cleanly). Use:

```markdown
<!-- AUTO-GENERATED by pnpm skills:generate — do not edit by hand -->

# chartlang primitive reference

> Placeholder. Regenerated from source JSDoc by `pnpm skills:generate`
> (lands in Task 2 of the skills-folder task set). Until then this file
> is intentionally minimal.
```

Task 2 overwrites this entire file. Do not invest in its content here.

### 7. Root `README.md` — "AI skills" subsection

Add a short subsection (after "Try it" or near "What's in the box",
your judgment) linking the skills:

```markdown
## AI skills

Two installable [Agent Skills](https://www.skills.sh) teach an LLM to
work with chartlang — one for **writing** scripts, one for
**integrating** the stack:

​```bash
npx skills add outraday-org/chartlang
​```

See [`skills/`](./skills/) for both skills and manual-install steps.
```

Keep the root README ≤ 300 lines (it is currently well under). Verify
`pnpm readme:check` still passes — the gate validates structure, and a
new `##` section is allowed.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `CLAUDE.md` | Create | Repo-root maintenance contract + index. |
| `skills/README.md` | Create | What `skills/` is + install steps. |
| `skills/chartlang-author/SKILL.md` | Create | End-user authoring guide. |
| `skills/chartlang-author/references/forbidden.md` | Create | Forbidden-construct rule list. |
| `skills/chartlang-author/references/examples.md` | Create | Worked compileable examples. |
| `skills/chartlang-author/references/primitives.md` | Create | Placeholder (Task 2 generates). |
| `README.md` | Modify | Add "AI skills" subsection. |

## Gates

- `pnpm readme:check` — root README still passes after the new section.
- `pnpm docs:check`, `pnpm docs:gate`, `pnpm typecheck`, `pnpm test` —
  **unaffected** (no package `src/` touched, `skills/` is markdown).
  Confirm none regress.
- No new gate added in this task (the `skills:gate` lands in Task 2).

## Changeset

None. `skills/`, root `CLAUDE.md`, and the README edit are repo
tooling/docs — no published-package version change. The changeset gate
is package-scoped.

## Acceptance Criteria

- Root `CLAUDE.md` states both maintenance rules (folder `CLAUDE.md`
  on behavior change; skills on contract change) and the index.
- `skills/chartlang-author/SKILL.md` has valid `name` + `description`
  frontmatter and covers all nine body sections; ~150–220 lines.
- `references/forbidden.md` and `references/examples.md` are complete
  and accurate against current `docs/` + `examples/scripts/`.
- `references/primitives.md` placeholder's first line is the exact
  auto-header sentinel Task 2 emits.
- Root README links `skills/`; `pnpm readme:check` green.
- No regression in `pnpm typecheck` / `pnpm test` / `pnpm docs:gate`.
- No changeset committed.
