# skills/

Portable [Anthropic-format Agent Skills](https://www.skills.sh) that
teach an external LLM how to work with chartlang. Unlike the per-folder
`CLAUDE.md` files (which orient an AI agent working *inside* this repo),
the skills here install into any agent — Claude.ai, Claude Code, Cursor,
the Anthropic SDK — and travel with the user, not the repo.

## The skills

- **[`chartlang-coding/`](./chartlang-coding/)** — for an end user
  wiring AI into their editor to help write `.chart.ts` indicator,
  drawing, and alert scripts. Teaches the `defineIndicator`/`compute`
  contract, the import + destructure rule, inputs, forbidden
  constructs, and the `ta.*`/`draw.*` primitive surface.
- **[`chartlang-setup/`](./chartlang-setup/)** — for a developer
  integrating chartlang into a product. Covers the three integration
  paths: embed in your chart, write a chart adapter, run server-side
  alerts, with reference snippets pointing at the in-repo examples.

## Install

The fastest path is the [skills.sh](https://www.skills.sh) CLI, which
discovers the `skills/` directory in this repo and symlinks each skill
into your agent's skill folder (`.claude/skills/`, `.cursor/rules/`,
etc.):

```bash
# install every skill in this repo
npx skills add outraday-org/chartlang

# or a single skill
npx skills add outraday-org/chartlang/tree/main/skills/chartlang-coding
```

### Manual install

Each skill is a self-contained directory: a `SKILL.md` with `name` +
`description` YAML frontmatter and a `references/` folder. To install by
hand, copy the skill's directory into one of:

- `.claude/skills/<name>/` for Claude Code.
- `.cursor/rules/<name>/` for Cursor.
- Your project's `CLAUDE.md` (paste the relevant references inline).
- [claude.ai](https://claude.ai) — upload the directory as a Skill.

## Maintenance

These skills mirror the language and integration contract, so a change
to either is a change to the skill. See the repo-root
[`CLAUDE.md`](../CLAUDE.md) for the rule. The generated primitive
reference (`chartlang-coding/references/primitives.md`) is re-emitted
by `pnpm skills:generate`; `pnpm skills:gate` fails CI on drift.
