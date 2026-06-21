# Scaffold `apps/react-starter` — TanStack Start + shadcn (Base UI default)

> **Status: TODO**

## Goal

Create `apps/react-starter/` as a private TanStack Start application
using the **shadcn Base UI _default_ theme** (neutral palette, NOT the
chartlang `brand/` tokens, NOT the site's `b0` preset). Land the app
shell: routing, root layout, a placeholder workspace route, the shadcn
primitives the later tasks need, and the workspace wiring so
`pnpm --filter chartlang-react-starter dev` serves a neutral two-pane
shell. No chartlang compile/chart/db wiring yet — those land in Tasks
2–6.

## Prerequisites

None. (Reads `apps/site/` as a structural reference only.)

## Current Behavior

`apps/` contains only `apps/site/` (`chartlang-site`), scaffolded with
`pnpm dlx shadcn@latest init --preset b0 --base base --template start`
and themed with the chartlang brand. There is no neutral starter app.

## Desired Behavior

A second app, `chartlang-react-starter`, exists under
`apps/react-starter/`. It boots a TanStack Start dev server showing a
neutral shadcn shell with a left/right two-pane layout placeholder
("Editor" / "Chart" stubs). It is wired into the pnpm workspace and
excluded from the same gates as `apps/site` (coverage/readme/changeset/
Biome/vitest-workspace).

## Requirements

### 1. Scaffold via the shadcn Start template — default base, no brand

From the repo root, scaffold into `apps/react-starter/`:

```
pnpm dlx shadcn@latest init --base base --template start
```

- `--base base` selects the **Base UI** registry (same registry the site
  uses); it is NOT a color. The site command is
  `init --preset b0 --base base --template start` (`apps/CLAUDE.md`) —
  keep `--base base`, **drop `--preset b0`** (that is the chartlang brand
  preset). The starter must use the stock shadcn Base UI default.
- Pick the **neutral** base color (or `zinc` — stock shadcn default) as
  the init base-color choice (a separate prompt/flag from `--base`),
  Tailwind v4, CSS variables on.
- The generated `src/styles.css` (or `app.css`) keeps the **default**
  shadcn `:root` / `.dark` token block. **Do not** `@import
  "../../../brand/brand.css"` — that is the site's wiring and is
  forbidden here (the user re-themes the starter themselves).
- Rename / set `package.json` `"name": "chartlang-react-starter"`,
  `"private": true`, `"version": "0.0.0"`, `"type": "module"`,
  `"license": "MIT"`, `engines.node >= 22`.

### 2. shadcn primitives needed downstream

Add the Base UI primitives the workspace UI (Tasks 5–6) will use, so
later tasks don't re-run `shadcn add`:

```
pnpm dlx shadcn@latest add button input select dialog command \
  resizable sonner card scroll-area separator badge tooltip
```

These land under `src/components/ui/` with the default theme. (`command`
+ `dialog` back the symbol picker; `resizable` backs the two-pane split;
`sonner` backs the alert/toast feed; `select` backs any later library
indicator.)

### 3. Root layout + routing (neutral shell)

- `src/routes/__root.tsx` — a neutral shell: app title "chartlang
  starter", a thin top bar, `<Outlet />`, the `<Toaster />` from sonner.
  **No** `brand/` logo import, **no** `og:image`, **no** favicon wiring
  from `brand/` (the one documented relaxation of the `brand/` SSOT
  contract — note it in `apps/react-starter/README.md`). A plain text or
  default favicon is fine.
- `src/routes/index.tsx` — the workspace route. For this task, render a
  `resizable` two-pane split with a left "Editor" placeholder card and a
  right "Chart" placeholder card. Tasks 5–6 replace the placeholders.
- Keep the TanStack Router generated `routeTree.gen.ts` as-is
  (`@ts-nocheck`, auto-generated — same exception as the site).

### 4. Build config baseline (full invariants land in Task 2)

- `vite.config.ts` — start from the template's
  `tanstackStart()` + `@netlify/vite-plugin-tanstack-start` is **not**
  needed (the starter is run locally, not deployed to Netlify); use the
  plain TanStack Start + React + Tailwind plugin set. Node SSR server is
  the default dev/preview target. Task 2 adds the compiler-coexistence
  plugins.
- `tsconfig.json` — extend the workspace base; `lib` includes
  `DOM`/`DOM.Iterable` (apps are browser apps — `apps/CLAUDE.md`).

### 5. Workspace + gate wiring

- The app is picked up by the root `pnpm-workspace.yaml` `apps/*` glob
  (verified present — `pnpm-workspace.yaml` already lists `- "apps/*"`, so
  no edit is needed; just confirm the new app resolves after `pnpm install`).
- Confirm the root `biome.json` ignore covers `apps/**` (it does per
  `apps/CLAUDE.md`) — `apps/react-starter` inherits it. Same for the
  root `vitest.config.ts` `apps/**` exclude.
- Add `apps/react-starter/` to `apps/CLAUDE.md`'s Layout section as a
  second bullet (private starter, default shadcn theme, cloned by
  `create-chartlang`). Note the brand-relaxation exception there.
- `apps/react-starter/README.md` — ≤100 lines, §17.1 shape: what it is,
  `pnpm dev`, the `.env` it will need (Task 4), the "this is a starter —
  re-theme freely" note.

### 6. MIT headers

Every committed `.ts`/`.tsx` carries the repo MIT header (same rule as
`apps/site`), except `routeTree.gen.ts` (auto-generated, `@ts-nocheck`).

### Edge cases

- **Brand bleed:** grep the scaffolded tree for `brand`, `b0`, and the
  chartlang token names; assert none leak in. The shell must be visually
  stock shadcn.
- **Port clash:** the site dev server uses `--port 3000`; give the
  starter a different default (e.g. `--port 3100`) so both can run.
- **No `.changeset`** added by this task (apps are changeset-exempt).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `apps/react-starter/**` (scaffold output) | Create | TanStack Start + shadcn base-ui default app |
| `apps/react-starter/package.json` | Modify | name/private/engines |
| `apps/react-starter/src/routes/__root.tsx` | Modify | neutral shell, no brand |
| `apps/react-starter/src/routes/index.tsx` | Create | two-pane placeholder workspace |
| `apps/react-starter/README.md` | Create | ≤100-line app README |
| `apps/CLAUDE.md` | Modify | document the second app + brand relaxation |
| `pnpm-workspace.yaml` | No change (verify only) | already lists `apps/*` |

## Gates

- `pnpm typecheck` (workspace incl. new app)
- `pnpm lint` (Biome ignores `apps/**` — must stay ignored)
- App builds: `pnpm --filter chartlang-react-starter build`
- No coverage/readme/changeset gate applies (apps-exempt).

## Changeset

None — `apps/*` is changeset-exempt (`apps/CLAUDE.md`).

## Acceptance Criteria

- `pnpm --filter chartlang-react-starter dev` serves a neutral shadcn
  two-pane shell on port 3100.
- The tree contains **no** `brand/` import, no `b0` preset, no chartlang
  brand tokens (grep-clean).
- Default shadcn primitives present under `src/components/ui/`.
- `apps/CLAUDE.md` documents the app and the brand relaxation.
- MIT headers on all committed source; `routeTree.gen.ts` excepted.
- `pnpm typecheck` green workspace-wide.
</content>
