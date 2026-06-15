---
name: validate-tasks
description: Double-check and validate a chartlang task folder for gaps, issues, and improvements. Directly fixes all problems found in the task files.
metadata:
  internal: true
---

Read `references/command.md` and follow that workflow in Codex.

Adapt the referenced Claude command for Codex:
- Treat the command file as workflow guidance, not as skill metadata.
- Ignore Claude-only frontmatter such as `model` or `tools`.
- Replace Claude-specific slash-command or subagent steps with the closest direct Codex workflow.
