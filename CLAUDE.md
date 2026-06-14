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
  The generated `skills/chartlang-coding/references/primitives.md` is
  re-emitted by `pnpm skills:generate`; the `skills:gate` will fail CI
  if you forget.

## Index

- `packages/*/CLAUDE.md` — per-package invariants (compiler, runtime,
  hosts, cli, conformance, core).
- `docs/CLAUDE.md`, `examples/CLAUDE.md`, `scripts/CLAUDE.md`,
  `.github/CLAUDE.md` — folder-scoped conventions.
- `skills/chartlang-coding/` — end-user "write chartlang scripts" skill.
- `skills/chartlang-setup/` — developer "integrate chartlang" skill.
