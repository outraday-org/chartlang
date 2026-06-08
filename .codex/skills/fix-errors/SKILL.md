---
name: fix-errors
description: Fix Biome and TypeScript errors/warnings — from pasted output or by running pnpm lint + pnpm typecheck.
---

Read `references/command.md` and follow that workflow in Codex.

Adapt the referenced Claude command for Codex:
- Treat the command file as workflow guidance, not as skill metadata.
- Ignore Claude-only frontmatter such as `model` or `tools`.
- Replace Claude-specific slash-command or subagent steps with the closest direct Codex workflow.
