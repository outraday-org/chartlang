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
- **`brand/` is the single source of truth for the brand palette AND
  the logo.** `brand/brand.css` holds the tokens; the logo ships as
  `brand/chartlang_logo.{svg,ico}` plus `chartlang_logo_{48,256,1024}.png`.
  Both `apps/site/` (`src/styles.css`) and the VitePress docs theme
  (`docs/.vitepress/theme/style.css`) `@import` the CSS by the relative
  path `../../../brand/brand.css`. The logo is consumed without
  duplicate files: `apps/site/` imports the brand icons through Vite
  (`?url`) in `src/routes/__root.tsx` (favicons + `og:image`) and
  `src/components/brand/Logo.tsx` (nav mark), and `pnpm brand:sync`
  (`scripts/sync-brand-assets.ts`, run by `docs:dev`/`docs:build`)
  copies the svg + ico into the git-ignored `docs/public/logo.{svg,ico}`
  that VitePress's `themeConfig.logo` + favicon need. Edit the palette
  or swap the logo **here**, never by forking into a consumer — the two
  sites must stay visually one product. `brand/` is a plain shared-assets
  folder, not a workspace package (no `package.json`). See
  `brand/README.md`.

## Index

- `packages/*/CLAUDE.md` — per-package invariants (compiler, runtime,
  hosts, cli, conformance, core).
- `docs/CLAUDE.md`, `examples/CLAUDE.md`, `scripts/CLAUDE.md`,
  `.github/CLAUDE.md`, `apps/CLAUDE.md` — folder-scoped conventions.
- `skills/chartlang-coding/` — end-user "write chartlang scripts" skill.
- `skills/chartlang-setup/` — developer "integrate chartlang" skill.
- `brand/` — shared brand assets (`brand.css` tokens + `logo.svg` /
  `logo.png`) consumed by `apps/site/` and the docs theme. See
  `brand/README.md`.
