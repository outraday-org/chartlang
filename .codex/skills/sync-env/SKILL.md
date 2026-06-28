---
name: sync-env
description: Reconcile every local .env with its .env.example — add new vars, remove deleted ones, preserve your values. Useful after pulling a branch that changed env vars.
metadata:
  internal: true
---

Read `references/command.md` and follow that workflow in Codex.

Adapt the referenced Claude command for Codex:
- Treat the command file as workflow guidance, not as skill metadata.
- Ignore Claude-only frontmatter such as `model` or `tools`.
- Replace Claude-specific slash-command or subagent steps with the closest direct Codex workflow.
