# Skills

chartlang ships two [Anthropic-format Agent Skills](https://www.skills.sh) that
teach an external LLM how to work with chartlang. Unlike the in-repo `CLAUDE.md`
files (which orient an agent working *inside* this repository), a skill installs
into your own agent — Claude Code, Claude.ai, Cursor, the Anthropic SDK — and
travels with you, not the repo. Point your assistant at the right skill and it
already knows the contract, the primitive surface, and the forbidden constructs.

## The two skills

The two skills serve two different people:

- **[chartlang-setup](./chartlang-setup)** — for the **developer integrating
  chartlang into their project**. Install it into the AI assistant you build
  with so it knows how to compile scripts, host the bundle in a sandbox, and
  render emissions through a chart adapter.
- **[chartlang-coding](./chartlang-coding)** — for the **LLM attached to an end
  user's coding editor** that helps them write `.chart.ts` indicator, drawing,
  and alert scripts in the chartlang language. This skill is only useful once an
  AI assistant is wired into the editor where scripts get authored.

In short: `chartlang-setup` is for *you, wiring chartlang into a product*;
`chartlang-coding` is for *your users' assistant, writing chartlang scripts*.

## Install

The fastest path is the [skills.sh](https://www.skills.sh) CLI, which discovers
the `skills/` directory in the repo and links each skill into your agent's skill
folder:

```bash
# install every chartlang skill
npx skills add outraday-org/chartlang

# or a single skill
npx skills add outraday-org/chartlang/tree/main/skills/chartlang-coding
```

### Manual install

Each skill is a self-contained directory — a `SKILL.md` with `name` +
`description` frontmatter and a `references/` folder. Copy the skill's directory
into one of:

- `.claude/skills/<name>/` for Claude Code.
- `.cursor/rules/<name>/` for Cursor.
- Your project's `CLAUDE.md` (paste the relevant references inline).
- [claude.ai](https://claude.ai) — upload the directory as a Skill.

## Maintenance

The skills mirror chartlang's language and integration contract, so a change to
either is a change to the skill. The generated primitive reference inside
`chartlang-coding` is re-emitted by `pnpm skills:generate`, and `pnpm
skills:gate` fails CI on drift — so what an assistant reads always matches the
shipped surface.
