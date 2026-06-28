---
description: Reconcile every local .env with its .env.example — add new vars, remove deleted ones, preserve your values. Useful after pulling a branch that changed env vars.
---

# Sync .env from .env.example

## Purpose

After pulling a branch where the `.env.example` files changed, a teammate's
real `.env` files drift out of sync — they may be missing newly added vars or
still carry vars that were removed. This command reconciles every real `.env`
in this pnpm workspace against its sibling `.env.example` — the repo root plus
every `apps/*`, `packages/*`, `examples/*`, and `local-starters/*` folder that
ships an example:

- **adds** keys that were added to the example (as the example's placeholder),
- **removes** keys that were deleted from the example,
- **preserves** every value you already set, including whether you keep a key
  active or commented out,
- adopts the example's comments / section layout / ordering.

It never overwrites a value you set and never prints secret values. The
deterministic logic lives in `scripts/sync-env-from-examples.mjs` (run via
`pnpm sync:env`) so it behaves identically no matter which agent invokes it.

## Task

1. **Preview first.** Run:

   ```
   pnpm sync:env --dry-run
   ```

   Show the user the per-file summary (which keys would be added/removed, and
   which files only need comment/ordering normalization).

2. If nothing would change, tell the user everything is already in sync and stop.

3. **Apply.** Run:

   ```
   pnpm sync:env
   ```

4. Report the result. The script prints a per-file **Next steps** section that
   classifies vars into:
   - `🔑 set a real value` — any **active** key whose value is still a
     placeholder or empty (API keys, secrets, tokens, encryption keys,
     `DATABASE_URL`, `NPM_TOKEN`, etc.). This is audited on **every** run
     against the reconciled `.env`, so a file that is structurally in sync but
     left half-configured (e.g. a required `NPM_TOKEN` still on its
     `npm_xxxx…` placeholder) is still flagged with a `⚠ … still unset` line;
   - `add (default)` — config defaults that work as-is, no change needed;
   - `💤 optional` — commented vars the user enables + sets only if they use
     that provider.
   Relay that Next-steps list to the user verbatim so they know exactly which
   files need which secrets.

5. Do **not** commit `.env` files (they are gitignored and contain secrets). Do
   not echo secret values in your output.

## Notes

- The `.env.example` files are the source of truth for *which* keys exist; the
  real `.env` files own the *values*.
- A key the user keeps commented out stays commented (its disabled state is
  preserved) even if the example has it active, and vice-versa.
- Direct CLI use (no agent needed): `pnpm sync:env` or
  `pnpm sync:env --dry-run`.
- CI use: `node scripts/sync-env-from-examples.mjs --check` exits non-zero if
  any `.env` is out of sync **or** still holds unset placeholder values.
