# chartlang-coding

The authoring skill — for the **LLM attached to an end user's coding editor**
that helps them write chartlang scripts. Install it into the assistant wired
into the editor (Claude Code, Claude.ai, Cursor) where `.chart.ts` indicator,
drawing, and alert scripts get authored. It teaches the assistant the rules a
chartlang script must follow so it stops guessing and writes code the compiler
accepts on the first try.

This is the skill end users want; it is only useful once an AI assistant is
attached to the editor. If you are the developer *embedding* chartlang into a
product rather than writing scripts, you want
[chartlang-setup](./chartlang-setup) instead.

## What it teaches

- The **import + destructure contract**: top-level imports come only from
  `@invinite-org/chartlang-core`, and `compute({ bar, ta, plot, ... })`
  destructures the per-bar context. Both must hold together.
- The **four script kinds**: `defineIndicator`, `defineDrawing`, `defineAlert`,
  and `defineAlertCondition`.
- **Inputs**, series and indexing, and indicator composition.
- The **forbidden constructs** the compiler rejects, with idiomatic
  replacements (see also [Forbidden constructs](../language/forbidden-constructs)).
- The full **`ta.*` / `draw.*` primitive surface** (see also
  [TA primitives](../primitives/ta/)).

## What's inside

- `SKILL.md` — the contract on one screen, the script kinds, composition, and
  common mistakes.
- `references/primitives.md` — the full `ta.*` / `draw.*` signature table,
  auto-generated from JSDoc (`@formula`, `@warmup`, `@since`, stability markers).
- `references/forbidden.md` — rejected constructs and their replacements.
- `references/examples.md` — complete, compileable worked scripts.

## Install

```bash
npx skills add outraday-org/chartlang/tree/main/skills/chartlang-coding
```

See [Skills](./) for manual-install targets and the maintenance contract.
