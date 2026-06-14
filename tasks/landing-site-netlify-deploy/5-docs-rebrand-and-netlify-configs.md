# Task 5 — Re-theme VitePress docs + Netlify configs

> **Status: TODO**

## Goal

Bring `docs/.vitepress/` under the same brand identity as
`apps/site/` (indigo + slate + emerald, Inter + JetBrains Mono,
shared logo + header treatment), reset the docs base path to `/`
since the new host serves the docs at a custom-domain root, and
commit the two Netlify build configs that Task 6 wires into CI. The
end-state is a docs site that looks like a sibling of the marketing
page, ready to deploy from `netlify/docs.toml`.

## Prerequisites

- Task 2 complete — brand tokens in `apps/site/app/styles/brand.css`.
- Task 4 complete — Netlify preset confirmed working for the site
  (proves the function path before docs migration).

(The README dependency graph and task-summary table reflect this:
Task 5 depends on **{2, 4}**, not just 2.)

## Current Behavior

- VitePress runs the default theme (gray neutrals, brand-neutral
  blue links, system fonts).
- `docs/.vitepress/config.ts` sets `base: process.env.DOCS_BASE ?? "/"`,
  with `DOCS_BASE=/chartlang/` set by `.github/workflows/docs.yml`
  for GitHub Pages.
- The nav is text-only — no logo.
- Deploy path: GitHub Actions runs `pnpm docs:build`, uploads
  `docs/.vitepress/dist`, and `actions/deploy-pages@v4` publishes
  to GitHub Pages.
- No `netlify/` directory exists.

## Desired Behavior

After this task:

- `docs/.vitepress/theme/` holds a custom theme that **extends** the
  VitePress default theme (does not replace) and overrides palette,
  fonts, header logo, and selected nav styling.
- The palette tokens in the custom theme are a 1:1 mirror of
  `apps/site/app/styles/brand.css`. Both files import a single
  shared source of truth — see Requirement 4.
- The base path is `/` always — env-var override removed (the
  custom-domain deploy never needs a sub-path; local `pnpm docs:dev`
  also serves at `/`).
- The chartlang logo (mark variant from Task 2) renders in the docs
  nav alongside the existing nav links.
- The Shiki code-block theme used by VitePress matches the marketing
  site's `CodeBlock` theme (`github-dark-dimmed` or equivalent) so
  snippets visually match across sites.
- `netlify/site.toml` and `netlify/docs.toml` exist with build
  configs ready for Task 6 to register against two Netlify Sites.

## Requirements

### 1. Extract the brand tokens into a shared file

To keep the two sites visually identical, the palette lives once and
is imported twice. Move `apps/site/app/styles/brand.css` to a
repo-root location both sites can reach via a relative path:

| Old location | New location |
|---|---|
| `apps/site/app/styles/brand.css` | `brand/brand.css` |

Update `apps/site/app/styles/globals.css` to import the new path:

```css
@import "tailwindcss";
@import "../../../../brand/brand.css";   /* shared source of truth */
@import "@fontsource-variable/inter/wght.css";
@import "@fontsource-variable/jetbrains-mono/wght.css";
```

Add a `brand/README.md` (≤ 30 lines) explaining:

- These tokens are the single source of truth for both
  `apps/site/` and `docs/.vitepress/theme/`.
- Edit here; never duplicate.
- The palette is described in
  `tasks/landing-site-netlify-deploy/2-brand-system-and-layout.md`.

The `brand/` folder is **not** a workspace package — it carries no
`package.json`. It is a plain assets directory both sites' build
graphs import from. Add `brand/` to `pnpm format`'s include glob by
verifying the root `biome.json` already covers it (it does, biome
runs on `.`).

### 2. Custom VitePress theme

Create `docs/.vitepress/theme/index.ts`:

```ts
// docs/.vitepress/theme/index.ts
import DefaultTheme from "vitepress/theme";
import type { Theme } from "vitepress";
import BrandLogoMark from "./components/BrandLogoMark.vue";
import "./style.css";

const theme: Theme = {
    extends: DefaultTheme,
    enhanceApp({ app }) {
        app.component("BrandLogoMark", BrandLogoMark);
    },
};

export default theme;
```

Create `docs/.vitepress/theme/style.css`:

```css
/* docs/.vitepress/theme/style.css
 *
 * Aligns VitePress with apps/site/. Imports the shared brand.css and
 * remaps VitePress's CSS variables onto our palette so the default
 * theme's components (Nav, Sidebar, Content, Search) pick up the
 * indigo + slate + emerald look without per-component overrides.
 */

@import "../../../brand/brand.css";
@import "@fontsource-variable/inter/wght.css";
@import "@fontsource-variable/jetbrains-mono/wght.css";

:root {
    --vp-c-bg: var(--background);
    --vp-c-bg-soft: var(--muted);
    --vp-c-bg-alt: var(--brand-slate-100);
    --vp-c-text-1: var(--foreground);
    --vp-c-text-2: var(--muted-foreground);
    --vp-c-text-3: var(--muted-foreground);
    --vp-c-divider: var(--border);

    --vp-c-brand-1: var(--brand-indigo-500);
    --vp-c-brand-2: var(--brand-indigo-300);
    --vp-c-brand-3: var(--brand-indigo-700);
    --vp-c-brand-soft: var(--brand-indigo-100);

    --vp-c-tip-1: var(--brand-emerald-500);
    --vp-c-tip-soft: var(--brand-emerald-300);

    --vp-font-family-base: "Inter Variable", ui-sans-serif, system-ui, sans-serif;
    --vp-font-family-mono: "JetBrains Mono Variable", ui-monospace, monospace;
}

.dark {
    --vp-c-bg: var(--brand-slate-950);
    --vp-c-bg-soft: var(--brand-slate-900);
    --vp-c-bg-alt: var(--brand-slate-900);
    --vp-c-text-1: var(--brand-slate-50);
    --vp-c-text-2: var(--brand-slate-300);
    --vp-c-text-3: var(--brand-slate-500);
    --vp-c-divider: var(--brand-slate-700);

    --vp-c-brand-1: var(--brand-indigo-300);
    --vp-c-brand-2: var(--brand-indigo-500);
    --vp-c-brand-3: var(--brand-indigo-700);
    --vp-c-brand-soft: var(--brand-indigo-900);
}
```

Add the `@fontsource-variable/*` packages to the **root**
`devDependencies` so VitePress can resolve them at build time:

```json
{
    "devDependencies": {
        "@fontsource-variable/inter": "^5.0.0",
        "@fontsource-variable/jetbrains-mono": "^5.0.0"
    }
}
```

(They are already installed under `apps/site/` per Task 2 — adding
them at the root makes the imports above resolve without crossing
the `apps/site/node_modules/` boundary.)

### 3. Brand logo mark in the docs nav

VitePress lets a theme inject components via slots. Add a logo to
the nav-title slot.

Create `docs/.vitepress/theme/components/BrandLogoMark.vue`:

```vue
<!-- docs/.vitepress/theme/components/BrandLogoMark.vue -->
<template>
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
        <!-- Same shapes as apps/site/app/components/brand/Logo.tsx variant="mark".
             Hand-copy the SVG geometry; do NOT import the TSX file from Vue. -->
    </svg>
</template>
```

Wire it into the nav by adding to `docs/.vitepress/config.ts`:

```ts
themeConfig: {
    logo: { src: "/logo.svg", alt: "chartlang" },
    siteTitle: "chartlang",
    // …existing nav + sidebar…
}
```

Place `docs/public/logo.svg` and `docs/public/favicon.svg` — copy
from `apps/site/public/`. The two files **must be byte-identical** so
the favicon cache survives a user jumping between the sites.

### 4. Reset the docs base path

In `docs/.vitepress/config.ts`:

```ts
// Before:
// base: process.env.DOCS_BASE ?? "/",

// After:
base: "/",
```

Document the change in the inline comment: the docs deploy to
`docs.chartlang.invinite.com` at the root; the `DOCS_BASE` env var
is no longer set by any CI workflow.

### 5. Tell VitePress to use the custom theme

VitePress auto-discovers `docs/.vitepress/theme/index.ts` — no
config change required. Verify by running `pnpm docs:build` and
checking the output bundle for the indigo color value.

### 6. Shared Shiki theme

The default VitePress Shiki theme is "github-dark"; the marketing
site (Task 3) uses "github-dark-dimmed". Align the docs to match by
setting in `docs/.vitepress/config.ts`:

```ts
markdown: {
    // existing config(md) hook…
    theme: "github-dark-dimmed",
}
```

Re-run `pnpm docs:build` and visually confirm a sample page's code
block matches the marketing site's `CodeBlock` rendering.

### 7. `netlify/site.toml`

Create `netlify/site.toml`:

```toml
# netlify/site.toml — build config for chartlang.invinite.com.
# Registered in Netlify as the base config for Site "chartlang-site".

[build]
    base = "."
    command = "pnpm install --frozen-lockfile && pnpm --filter chartlang-site build"
    publish = "apps/site/.netlify/dist"

[build.environment]
    NODE_VERSION = "20"
    PNPM_VERSION = "9.12.0"

[functions]
    # esbuild ships native binaries — exclude from bundling so the
    # Lambda runtime loads it from node_modules/.
    external_node_modules = ["esbuild"]

[[redirects]]
    from = "/api/*"
    to = "/.netlify/functions/:splat"
    status = 200

# Headers — security baseline. No CSP yet (the editor uses inline
# scripts via CodeMirror); revisit when a CSP audit is on the
# roadmap.
[[headers]]
    for = "/*"
    [headers.values]
        X-Content-Type-Options = "nosniff"
        Referrer-Policy = "strict-origin-when-cross-origin"
        Permissions-Policy = "geolocation=(), camera=(), microphone=()"
```

**Verify** the `publish` path against the actual output of
`pnpm --filter chartlang-site build` (TanStack Start's Netlify
preset writes to a specific directory — confirm with one local build
before committing).

### 8. `netlify/docs.toml`

Create `netlify/docs.toml`:

```toml
# netlify/docs.toml — build config for docs.chartlang.invinite.com.
# Registered in Netlify as the base config for Site "chartlang-docs".

[build]
    base = "."
    command = "pnpm install --frozen-lockfile && pnpm docs:build"
    publish = "docs/.vitepress/dist"

[build.environment]
    NODE_VERSION = "20"
    PNPM_VERSION = "9.12.0"

# VitePress generates per-route HTML. No `/api/*` routes on this
# site — pure static.

[[headers]]
    for = "/*"
    [headers.values]
        X-Content-Type-Options = "nosniff"
        Referrer-Policy = "strict-origin-when-cross-origin"

# Cache assets aggressively; HTML is short-cache.
[[headers]]
    for = "/assets/*"
    [headers.values]
        Cache-Control = "public, max-age=31536000, immutable"
```

### 9. Keep `.github/workflows/docs.yml` intact for now

Do **not** delete or disable the GitHub Pages workflow in this task.
Task 6 owns the deletion + CI rewire. Until Task 6 lands, the docs
keep deploying to GitHub Pages and Netlify Sites are pre-staged.

### 10. README touch-up

Append to `docs/CLAUDE.md` (if present) or update the existing
docs build comment in `docs/.vitepress/config.ts`:

```ts
// Custom theme lives at ./theme/index.ts — shared brand tokens
// with apps/site/ via ../../brand/brand.css. Logo, fonts, palette,
// and Shiki theme are aligned between the marketing site and the
// docs so they read as one product. See
// tasks/landing-site-netlify-deploy/5-docs-rebrand-and-netlify-configs.md.
```

### 11. Verify all docs pages still build

The custom theme extends the default — none of the existing
markdown pages should break. Still:

- `pnpm docs:check` — passes.
- `pnpm docs:gate` — passes.
- `pnpm docs:snippets` — passes.
- `pnpm docs:build` — passes; output bundle size has not regressed
  by more than 10%. Tailwind is **not** in the docs build; only
  VitePress's CSS plus the brand.css import.

### 12. Light-mode and dark-mode pass

VitePress ships a built-in dark/light toggle. Tab through both modes
on a sample page (e.g. `/getting-started/write-your-first-script`)
and verify:

- Background, text, links, code blocks, and the nav read correctly
  in both modes.
- Contrast hits AA at minimum on body text.
- The logo stays legible in both modes (the SVG should not have a
  baked-in fill color — let CSS color it).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `brand/brand.css` | Create (move) | Shared brand tokens, single source of truth. |
| `brand/README.md` | Create | Names the directory's purpose, ≤ 30 lines. |
| `apps/site/app/styles/globals.css` | Modify | Repoint `brand.css` import to the new path. |
| `docs/.vitepress/theme/index.ts` | Create | Extend the default theme, register components. |
| `docs/.vitepress/theme/style.css` | Create | Brand-aligned VitePress CSS variable overrides. |
| `docs/.vitepress/theme/components/BrandLogoMark.vue` | Create | SVG monogram (hand-copied geometry). |
| `docs/.vitepress/config.ts` | Modify | `base: "/"`, logo, siteTitle, Shiki theme. |
| `docs/public/logo.svg` | Create (copy from apps/site/public/favicon.svg) | Nav logo. |
| `docs/public/favicon.svg` | Create (copy) | Favicon parity with apps/site/. |
| `netlify/site.toml` | Create | Build + functions config for chartlang.invinite.com. |
| `netlify/docs.toml` | Create | Build + headers config for docs.chartlang.invinite.com. |
| Root `package.json` | Modify | Add `@fontsource-variable/*` to root devDependencies. |

## Gates

- `pnpm install` — clean.
- `pnpm docs:build` — green; the built site uses the indigo brand
  color.
- `pnpm docs:check`, `pnpm docs:gate`, `pnpm docs:snippets` — all
  green.
- `pnpm site:build` — still green after the `brand.css` move.
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm readme:check` —
  all green.
- Visual: side-by-side screenshots of the marketing site and a docs
  page show the same palette and font.

## Changeset

None.

## Acceptance Criteria

- [ ] `brand/brand.css` moved from `apps/site/app/styles/` and
      imported by both sites.
- [ ] `docs/.vitepress/theme/` exists with `index.ts`, `style.css`,
      and a `BrandLogoMark.vue` matching the marketing site's mark.
- [ ] `docs/.vitepress/config.ts` sets `base: "/"`, `siteTitle:
      "chartlang"`, logo path, and Shiki theme `github-dark-dimmed`.
- [ ] `docs/public/{logo,favicon}.svg` are byte-identical to
      `apps/site/public/favicon.svg`.
- [ ] `netlify/site.toml` builds the site app; `netlify/docs.toml`
      builds the docs.
- [ ] All docs gates pass.
- [ ] Side-by-side screenshots in the PR description prove visual
      alignment.
- [ ] Light mode and dark mode both render correctly on a sample
      docs page.
- [ ] Every new file starts with the appropriate license header
      style (TS / Vue / CSS file-header comment).
