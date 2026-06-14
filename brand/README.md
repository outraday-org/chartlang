# brand/

`brand.css` is the **single source of truth** for the chartlang brand
palette (indigo + slate + emerald) and the `--background` / `--foreground`
/ `--primary` / `--accent` semantic tokens, in `:root` (light) and `.dark`
(dark) form. It is pure CSS custom properties — no Tailwind, framework, or
`@import` directives — so any surface can consume it directly.

Two sites import this same file so they stay visually one product:

- `apps/site/` — via `apps/site/src/styles.css`
  (`@import "../../../brand/brand.css";`).
- `docs/.vitepress/theme/` — via `style.css`
  (`@import "../../../brand/brand.css";`), which remaps VitePress's
  `--vp-*` variables onto these tokens.

**Edit the palette here, never in either consumer.** Forking the tokens
into one site silently drifts the two apart.

## Logo

The brand mark ships as one source set — **switch the logo by replacing
these files** (keep the names), there are no other copies to keep in
sync:

| File | Used as |
|---|---|
| `chartlang_logo.svg` | Primary favicon + nav logo (both sites) |
| `chartlang_logo.ico` | Legacy favicon fallback (both sites) |
| `chartlang_logo_48.png` | Small PNG favicon |
| `chartlang_logo_256.png` | PNG favicon |
| `chartlang_logo_1024.png` | `apple-touch-icon` (home-screen / install) |
| `chartlang_og.png` | `og:image` social card (1200×630, 1.91:1) |

- `apps/site/` imports them through Vite (`?url`) in
  `src/routes/__root.tsx` (favicons + `og:image`) and
  `src/components/brand/Logo.tsx` (nav mark). Small assets inline as
  data URIs; larger ones emit as hashed files. No copy lives in
  `apps/site/public/`.
- `docs/` needs the mark served at its site root for VitePress's
  `themeConfig.logo` + favicon `<link>`s. `pnpm brand:sync`
  (`scripts/sync-brand-assets.ts`, run automatically by `docs:dev` and
  `docs:build`) copies `chartlang_logo.svg` → `docs/public/logo.svg` and
  `chartlang_logo.ico` → `docs/public/logo.ico`, both **git-ignored** —
  never commit or hand-edit those copies.

`apps/site/src/components/brand/Logo.tsx` renders `chartlang_logo.svg`
(same file as the favicon) next to the wordmark, so the nav logo and the
tab icon are always identical.

This is a plain shared-assets directory — **not** a workspace package
(no `package.json`). Both sites' build graphs reference it by relative
path.

The palette and its rationale are described in
`tasks/landing-site-netlify-deploy/2-brand-system-and-layout.md`.
