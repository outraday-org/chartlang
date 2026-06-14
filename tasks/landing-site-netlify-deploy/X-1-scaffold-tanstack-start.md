# Task 1 — Scaffold `apps/site/` with TanStack Start + shadcn (Base UI preset)

> **Status: TODO**

## Goal

Stand up a new `apps/site/` workspace package that runs a
**TanStack Start** dev server with **shadcn** components composed on
**Base UI** primitives, wired into pnpm workspaces so
`pnpm --filter chartlang-site dev` (and `build`, `typecheck`) work
from the repo root. The output of this task is a hello-world route —
no marketing copy, no demo wiring, no brand styling. Tasks 2–4
populate it.

## Prerequisites

None. This is the first task in the folder.

## Current Behavior

`apps/` does not exist. `pnpm-workspace.yaml` lists `packages/*`,
`examples/canvas2d-adapter`, `examples/react-demo` — no `apps/*`
entry. There is no TanStack Start, Tailwind v4, shadcn, or Base UI
in the lockfile.

## Desired Behavior

After this task:

- `apps/site/` exists with a TanStack Start project scaffolded by
  the **exact** invocation the user requested:
  `pnpm dlx shadcn@latest init --preset b0 --base base --template start`.
- The project is a workspace package named `chartlang-site`,
  `"private": true`, `"version": "0.0.0"`. It does **not** publish.
- `pnpm install` at the repo root resolves the new package's deps.
- `pnpm --filter chartlang-site dev` starts the Vite-driven dev
  server on `http://localhost:5173` and serves a hello-world route.
- `pnpm --filter chartlang-site build` produces a Netlify-compatible
  build (the shadcn scaffold targets Netlify by default when
  `--template start` is used; verify and pin if needed).
- `pnpm --filter chartlang-site typecheck` runs `tsc --noEmit`.
- The new package does **not** contribute to the workspace coverage
  gate (it has no published source — it's an app).

## Requirements

### 1. Workspace wiring (do this first, before running the scaffold)

Edit `pnpm-workspace.yaml`:

```yaml
packages:
    - "packages/*"
    - "apps/*"            # NEW
    - "examples/canvas2d-adapter"
    - "examples/react-demo"
```

`examples/react-demo` stays in the workspace until Task 7 removes
it — the two demo apps coexist for the duration of Tasks 1–6.

### 2. Scaffold

From repo root, create the directory and run the exact command the
user requested:

```bash
mkdir -p apps && cd apps
pnpm dlx shadcn@latest init --preset b0 --base base --template start
# When prompted for the project name, answer: site
# When prompted for any other option, accept the recommended default
# unless it conflicts with a constraint below.
cd ..
```

If the shadcn CLI insists on creating the directory itself instead of
populating an existing one, run it from `apps/` directly so the new
project lands at `apps/site/`.

**Constraints the scaffold output must satisfy:**

- Package name: `chartlang-site`. Edit `apps/site/package.json` if
  the scaffold defaults to something else (e.g. `site`).
- `"private": true`, `"version": "0.0.0"`, `"license": "MIT"`,
  `"engines": { "node": ">=20" }` — match the conventions in
  `examples/react-demo/package.json`.
- All shadcn dependencies installed under `apps/site/node_modules/`
  resolve via the workspace's `pnpm-lock.yaml`. Do **not** commit a
  separate lockfile.
- Tailwind v4 (the b0 preset's default) is configured. Confirm by
  looking for `@import "tailwindcss"` in the generated globals.css.
- The TanStack Start router is in file-based mode under `app/routes/`.

### 3. License header on every TS/TSX file

The repo's `biome.json` does not enforce a header, but every existing
`.ts`/`.tsx` file under `packages/`, `examples/`, and `scripts/` opens
with:

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
```

Add this two-line header to every file the scaffold generates that
you intend to commit. Scaffold-generated files you do **not** modify
(e.g. shadcn's `components/ui/*.tsx` until Task 2 customises them)
also get the header — the convention applies repo-wide.

### 4. Root `package.json` scripts

Add four passthrough scripts to the repo root `package.json` so the
new app participates in the normal workflow:

```json
{
    "scripts": {
        "site:dev": "pnpm --filter chartlang-site dev",
        "site:build": "pnpm --filter chartlang-site build",
        "site:typecheck": "pnpm --filter chartlang-site typecheck",
        "site:lint": "pnpm --filter chartlang-site lint"
    }
}
```

The existing `pnpm -r typecheck` and `pnpm -r build` already cover
the new app once it's in the workspace; the passthrough scripts make
the dev workflow ergonomic.

### 5. Hello-world route

The scaffold ships a default route. Replace its body with the shape
below. **Treat the imports as illustrative** — the actual import path
for `createFileRoute` is whatever the scaffold emits (current TanStack
Start ships it from `@tanstack/react-router`; the snippet uses
`@tanstack/start/router` as a placeholder). See README → "TanStack
Start / shadcn snippet caveat".

```tsx
// apps/site/app/routes/index.tsx
import { createFileRoute } from "@tanstack/start/router"; // see caveat

export const Route = createFileRoute("/")({
    component: HomeRoute,
});

function HomeRoute() {
    return (
        <main>
            <h1>chartlang</h1>
            <p>Landing site scaffold — Task 1 of landing-site-netlify-deploy.</p>
        </main>
    );
}
```

No styling. No brand. Task 2 paints the room.

### 6. README (≤ 100 lines, §17.1 shape)

Write `apps/site/README.md` per the same shape as
`examples/react-demo/README.md`. Required sections:

1. Title (`# chartlang-site`)
2. Stability label (`> **Stability: experimental.**`)
3. One-paragraph purpose
4. Public surface — N/A (`"private": true`); say so
5. Local dev — `pnpm site:dev`
6. Build — `pnpm site:build`
7. Deploy — TBD (Task 6 fills this in)
8. License — MIT

Cap at 100 lines so `pnpm readme:check` stays green.

### 7. tsconfig integration

`apps/site/tsconfig.json` must extend `../../tsconfig.base.json` so
the project picks up the workspace's `strict`, `noUncheckedIndexedAccess`,
and module-resolution settings. The shadcn scaffold ships its own
tsconfig — merge it on top of the base:

```jsonc
{
    "extends": "../../tsconfig.base.json",
    "compilerOptions": {
        "jsx": "react-jsx",
        "module": "ESNext",
        "moduleResolution": "Bundler",
        "lib": ["ES2022", "DOM", "DOM.Iterable"],
        "paths": {
            "~/*": ["./app/*"]
        }
    },
    "include": ["app/**/*.ts", "app/**/*.tsx", "app.config.ts"]
}
```

The site is a browser app — `"DOM"` lib is **required** here, in
contrast to the compiler's lib pin (which forbids DOM globals on
purpose). Document the contrast in a one-line comment on the lib
array.

### 8. Lint config

Biome is the repo-wide linter (`pnpm lint` at root runs `biome lint .`).
If the shadcn scaffold ships an `.eslintrc` or `biome.json` override,
**delete it** — the root `biome.json` covers everything. Add an
`apps/site/biome.json` only if the scaffold's output clashes with
repo-wide rules (e.g. unused-import handling for shadcn's
auto-generated re-exports).

If clashes arise, prefer narrowing the scaffold output to repo
conventions (`pnpm format --write apps/site/` after the scaffold)
over local rule exceptions.

### 9. Vitest non-participation

`apps/site/` does **not** run vitest. The site has no published
source — its functional tests are e2e tests under Playwright,
written in Task 4. Do **not** create a `vitest.config.ts` in
`apps/site/`. The root `vitest.config.ts` uses an `exclude` block
(no explicit `include`) and currently excludes
`examples/react-demo/**`, build outputs, and scratch harnesses.
Verify that `apps/site/` source files do not get discovered by
vitest's default test-file globs (no `*.test.ts` / `*.test.tsx` /
`*.spec.ts` files should live under `apps/site/`). If a Playwright
spec under `apps/site/tests/` ever ends in `.test.ts`, add
`"apps/**"` to the root vitest `exclude`.

### 10. Coverage gate non-participation

Per the same logic, `apps/site/` is **outside** the 100% coverage
gate. The §16.5 coverage merge runs `scripts/coverage-merge.ts` which
walks `packages/*` — confirm by reading that script. If the script
expands to a glob that would catch `apps/*`, narrow it back.

### 11. README cap on root README still respected

After this task, root `README.md` is **unchanged**. Task 7 updates
it to point at `chartlang.invinite.com`. Until then, `pnpm readme:check`
keeps the existing 300-line cap.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `pnpm-workspace.yaml` | Modify | Add `apps/*` glob. |
| `package.json` (root) | Modify | Add `site:dev`, `site:build`, `site:typecheck`, `site:lint` passthrough scripts. |
| `apps/site/` (whole tree) | Create | TanStack Start + shadcn (Base UI b0) scaffold output. |
| `apps/site/package.json` | Create (via scaffold, then edit) | Name = `chartlang-site`, private, version `0.0.0`, license MIT, engines node ≥ 20. |
| `apps/site/tsconfig.json` | Create (via scaffold, then edit) | Extends `../../tsconfig.base.json`; lib includes DOM. |
| `apps/site/app/routes/index.tsx` | Create | Hello-world `<h1>chartlang</h1>` placeholder. |
| `apps/site/README.md` | Create | §17.1 shape, ≤ 100 lines. |
| `scripts/coverage-merge.ts` | Verify (do not modify unless needed) | Confirm `apps/*` is excluded from the coverage roll-up. |
| Root `vitest.config.ts` | Verify (modify only if needed) | Confirm `apps/*` not in `include`; add to `exclude` if it appears. |

## Gates

- `pnpm install` — clean, no peer-dep warnings the lockfile can't resolve.
- `pnpm typecheck` — green workspace-wide, including `chartlang-site`.
- `pnpm lint` — green; if shadcn's autogen produces noisy diagnostics,
  `pnpm format --write apps/site/` first, then re-run.
- `pnpm build` — green workspace-wide; `chartlang-site build`
  produces a Netlify-compatible artifact under
  `apps/site/.netlify/` or `apps/site/dist/` (the exact path is
  Task 6's concern; Task 1 just needs the build to succeed).
- `pnpm test` — green; coverage gate not affected by the new app.
- `pnpm readme:check` — green; new `apps/site/README.md` ≤ 100 lines.
- `pnpm docs:check`, `pnpm docs:gate`, `pnpm conformance` — green;
  unaffected by this task.

## Changeset

None. No published package changes. `apps/site/` is private.

## Acceptance Criteria

- [ ] `pnpm-workspace.yaml` lists `apps/*`.
- [ ] `apps/site/package.json` is named `chartlang-site`,
      `"private": true`, version `0.0.0`, MIT.
- [ ] `apps/site/tsconfig.json` extends `../../tsconfig.base.json`.
- [ ] `pnpm --filter chartlang-site dev` opens
      `http://localhost:5173` and shows the hello-world heading.
- [ ] `pnpm --filter chartlang-site build` exits 0.
- [ ] `pnpm --filter chartlang-site typecheck` exits 0.
- [ ] `pnpm typecheck` (workspace) exits 0.
- [ ] `pnpm test` exits 0 with the existing coverage thresholds
      untouched.
- [ ] `pnpm lint` exits 0.
- [ ] `pnpm readme:check` exits 0; `apps/site/README.md` is ≤ 100
      lines.
- [ ] Every committed `.ts`/`.tsx` file under `apps/site/` starts
      with the two-line MIT header.
- [ ] No new entries in `scripts/coverage-merge.ts`'s walk pick up
      `apps/site/`.
- [ ] Lockfile changes (one new pnpm-lock entry) are committed.
- [ ] PR description names this task by number and links to the
      task folder README.
