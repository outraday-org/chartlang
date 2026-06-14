# Task 2 — Brand system + shared layout shell

> **Status: TODO**

## Goal

Define the chartlang brand identity as a small set of design tokens
(colors, typography, spacing, radii) and apply it across `apps/site/`
via Tailwind v4 + shadcn CSS variables. Ship the shared layout shell —
top nav with anchor links, footer, dark-mode-first treatment — and a
simple logo (wordmark + monogram SVG). The tokens are exported in a
form that Task 5 can mirror into the VitePress theme so the marketing
site and the docs are visually one product.

## Prerequisites

- Task 1 complete — `apps/site/` exists, runs, lints, typechecks.

## Current Behavior

`apps/site/` shows a `<h1>chartlang</h1>` heading on a default
browser white background. No fonts loaded. No logo. No nav. No
footer. shadcn's default CSS variables (grayscale + amber-ish accent
from the b0 preset's defaults) are in `globals.css`.

## Desired Behavior

After this task:

- The brand palette **indigo + slate + emerald** is encoded as CSS
  variables in `apps/site/app/styles/brand.css` and consumed via
  Tailwind v4's `@theme` block plus shadcn's `--background`,
  `--foreground`, `--primary`, … convention.
- The site renders in dark mode by default (the brand's primary
  register). Tokens are defined for both color schemes so a later
  toggle works without re-theming.
- Fonts: **Inter** (variable) for UI, **JetBrains Mono** for code.
  Loaded via `@fontsource-variable/inter` and
  `@fontsource-variable/jetbrains-mono` so no runtime Google Fonts
  fetch happens.
- `__root.tsx` defines a global layout: a sticky top nav (logo on the
  left, anchor links `Features`, `Quickstart`, `Demo`, `Docs` on the
  right; the `Docs` link points at
  `https://docs.chartlang.invinite.com`), a `<main>` region that
  renders nested routes, and a minimal footer.
- A `Logo` component renders a 24-px monogram + wordmark, with an
  isolated monogram-only mode for the nav.
- `public/favicon.svg` and a placeholder `public/og.png` ship with
  the brand colors.
- The `app/styles/brand.css` file is **self-contained** and
  `@import`-friendly — Task 5 will import it into the VitePress
  theme. No dependency on Tailwind directives inside `brand.css`
  itself; pure CSS custom properties.

## Requirements

### 1. Palette tokens (`apps/site/app/styles/brand.css`)

Encode the palette as CSS variables on `:root` and `.dark`. Use OKLCH
(Tailwind v4's preferred format; also what shadcn's b0 preset emits)
so colors stay perceptually uniform across the dark→light flip.

**Note on file location:** This file lands at
`apps/site/app/styles/brand.css` in this task. Task 5 hoists it to
repo-root `brand/brand.css` so the VitePress theme can import the
same tokens. The schema and contents stay identical; only the path
changes — keep that move in mind if you find yourself tempted to put
brand-specific concerns elsewhere.

```css
/* apps/site/app/styles/brand.css
 *
 * Brand tokens for chartlang. Self-contained — no Tailwind or
 * framework directives — so the same file can be imported by the
 * VitePress theme (Task 5) and any future surface (e.g. an Electron
 * shell). Do not @apply, @layer, or @import a non-CSS-spec rule here.
 */

:root {
    /* Brand */
    --brand-indigo-50:  oklch(0.96 0.02 270);
    --brand-indigo-100: oklch(0.92 0.05 270);
    --brand-indigo-300: oklch(0.74 0.14 270);
    --brand-indigo-500: oklch(0.58 0.22 270);  /* primary */
    --brand-indigo-700: oklch(0.42 0.20 270);
    --brand-indigo-900: oklch(0.26 0.12 270);

    --brand-slate-50:   oklch(0.98 0.005 240);
    --brand-slate-100:  oklch(0.94 0.01 240);
    --brand-slate-300:  oklch(0.78 0.02 240);
    --brand-slate-500:  oklch(0.58 0.03 240);
    --brand-slate-700:  oklch(0.34 0.03 240);
    --brand-slate-900:  oklch(0.18 0.02 240);
    --brand-slate-950:  oklch(0.12 0.02 240);

    --brand-emerald-300: oklch(0.82 0.16 160);
    --brand-emerald-500: oklch(0.68 0.20 160);  /* accent / positive */
    --brand-emerald-700: oklch(0.48 0.16 160);

    /* Semantic shadcn tokens — light mode (dark mode overrides below) */
    --background:        var(--brand-slate-50);
    --foreground:        var(--brand-slate-900);
    --muted:             var(--brand-slate-100);
    --muted-foreground:  var(--brand-slate-500);
    --border:            var(--brand-slate-100);
    --input:             var(--brand-slate-100);
    --primary:           var(--brand-indigo-500);
    --primary-foreground: var(--brand-slate-50);
    --accent:            var(--brand-emerald-500);
    --accent-foreground: var(--brand-slate-900);
    --ring:              var(--brand-indigo-500);
    --radius:            0.625rem;
}

.dark {
    --background:        var(--brand-slate-950);
    --foreground:        var(--brand-slate-50);
    --muted:             var(--brand-slate-900);
    --muted-foreground:  var(--brand-slate-300);
    --border:            var(--brand-slate-700);
    --input:             var(--brand-slate-700);
    --primary:           var(--brand-indigo-300);
    --primary-foreground: var(--brand-slate-950);
    --accent:            var(--brand-emerald-300);
    --accent-foreground: var(--brand-slate-950);
    --ring:              var(--brand-indigo-300);
}
```

The semantic tokens shadow shadcn's defaults. The shadcn primitives
generated by the b0 preset already read from `--background`,
`--foreground`, etc., so they pick up the new palette without
component-level edits.

### 2. Bridge to Tailwind v4 (`apps/site/app/styles/globals.css`)

Tailwind v4 reads design tokens from a `@theme` block. Wire the brand
CSS into Tailwind so `bg-background`, `text-foreground`, `text-primary`,
`bg-accent` work in JSX:

```css
/* apps/site/app/styles/globals.css */
@import "tailwindcss";
@import "./brand.css";
@import "@fontsource-variable/inter/wght.css";
@import "@fontsource-variable/jetbrains-mono/wght.css";

@theme {
    --color-background: var(--background);
    --color-foreground: var(--foreground);
    --color-muted: var(--muted);
    --color-muted-foreground: var(--muted-foreground);
    --color-border: var(--border);
    --color-input: var(--input);
    --color-primary: var(--primary);
    --color-primary-foreground: var(--primary-foreground);
    --color-accent: var(--accent);
    --color-accent-foreground: var(--accent-foreground);
    --color-ring: var(--ring);

    --font-sans: "Inter Variable", ui-sans-serif, system-ui, sans-serif;
    --font-mono: "JetBrains Mono Variable", ui-monospace, monospace;

    --radius-sm: calc(var(--radius) - 4px);
    --radius-md: calc(var(--radius) - 2px);
    --radius-lg: var(--radius);
    --radius-xl: calc(var(--radius) + 4px);
}

@layer base {
    html { color-scheme: dark; }
    html.dark { color-scheme: dark; }
    body {
        background-color: var(--background);
        color: var(--foreground);
        font-family: var(--font-sans);
        font-feature-settings: "cv11", "ss01", "ss03";
    }
    code, pre, kbd { font-family: var(--font-mono); }
}
```

Dark-mode-first is enforced by adding `class="dark"` to `<html>` in
the TanStack Start root document. A toggle is deferred (see README's
Deferred section).

### 3. Font dependencies

Add to `apps/site/package.json`:

```json
{
    "dependencies": {
        "@fontsource-variable/inter": "^5.0.0",
        "@fontsource-variable/jetbrains-mono": "^5.0.0"
    }
}
```

Run `pnpm install` from the root. These ship the variable-weight WOFF2
files; the CSS `@import`s above hand Vite enough to fingerprint and
bundle them.

### 4. Logo component (`apps/site/app/components/brand/Logo.tsx`)

A reusable SVG-in-React component with a `variant` prop:

- `variant="mark"` — monogram only (a stylised `c|` cursor mark or
  the letter `c` inside a 24×24 square). Indigo fill, emerald accent
  bar.
- `variant="full"` — monogram + `chartlang` wordmark in Inter
  ExtraBold, foreground color.

Spec:

```tsx
// apps/site/app/components/brand/Logo.tsx
import type { ReactElement } from "react";

export type LogoProps = Readonly<{
    variant?: "mark" | "full";
    className?: string;
    size?: number;
}>;

export function Logo({ variant = "full", className, size = 24 }: LogoProps): ReactElement {
    // SVG implementation: 24x24 viewBox for the mark; full variant
    // adds an inline <text> element rendered with --font-sans 800.
    // …
}
```

Keep the SVG hand-written — no external icon library. The mark must
be legible at 16 px (favicon) and crisp at 96 px (hero).

### 5. Favicon + OG image

- `apps/site/public/favicon.svg` — the monogram, 64×64 viewBox,
  indigo background + emerald accent. Solid background so it stays
  visible against any browser chrome.
- `apps/site/public/og.png` — 1200×630, dark slate background, full
  logo centered, optional tagline ("Open scripts for technical
  analysis. Run anywhere."). Acceptable placeholder: render the SVG
  in Figma / Excalidraw, export PNG. The image is small enough to
  hand-roll; do not pull a generator dependency.
- Reference both from `__root.tsx`'s `<head>`:

```tsx
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<meta property="og:image" content="/og.png" />
<meta name="twitter:card" content="summary_large_image" />
```

### 6. Root layout (`apps/site/app/routes/__root.tsx`)

Define the shared shell. Imports below are illustrative — use the paths
the scaffold actually emits (see README → "TanStack Start / shadcn
snippet caveat").

```tsx
// apps/site/app/routes/__root.tsx
import { Outlet, createRootRoute } from "@tanstack/start/router"; // see caveat
import { Logo } from "~/components/brand/Logo";

export const Route = createRootRoute({
    component: RootShell,
    head: () => ({
        meta: [
            { title: "chartlang — open scripts for technical analysis" },
            {
                name: "description",
                content:
                    "Open-source TypeScript eDSL for indicator, drawing, and alert scripts that run on any conforming chart adapter.",
            },
            { property: "og:title", content: "chartlang" },
            { property: "og:description", content: "Open scripts for technical analysis. Run anywhere." },
            { property: "og:image", content: "/og.png" },
            { name: "twitter:card", content: "summary_large_image" },
        ],
        links: [
            { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
        ],
    }),
});

function RootShell() {
    return (
        <html lang="en" className="dark">
            <body>
                <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
                    <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
                        <a href="/" className="flex items-center gap-2">
                            <Logo variant="full" />
                        </a>
                        <ul className="flex items-center gap-6 text-sm text-muted-foreground">
                            <li><a href="#features" className="hover:text-foreground">Features</a></li>
                            <li><a href="#quickstart" className="hover:text-foreground">Quickstart</a></li>
                            <li><a href="#demo" className="hover:text-foreground">Demo</a></li>
                            <li>
                                <a
                                    href="https://docs.chartlang.invinite.com"
                                    className="hover:text-foreground"
                                >
                                    Docs
                                </a>
                            </li>
                            <li>
                                <a
                                    href="https://github.com/outraday-org/chartlang"
                                    className="hover:text-foreground"
                                    aria-label="GitHub"
                                >
                                    GitHub
                                </a>
                            </li>
                        </ul>
                    </nav>
                </header>
                <main className="mx-auto max-w-6xl px-6 py-12">
                    <Outlet />
                </main>
                <footer className="border-t border-border">
                    <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 text-xs text-muted-foreground">
                        <span>© 2026 Invinite. MIT-licensed.</span>
                        <span>
                            <a
                                href="https://github.com/outraday-org/chartlang"
                                className="hover:text-foreground"
                            >
                                Source on GitHub
                            </a>
                        </span>
                    </div>
                </footer>
            </body>
        </html>
    );
}
```

Anchor links (`#features`, `#quickstart`, `#demo`) are inert until
Task 3 / Task 4 plant their target sections. That's fine — broken
in-page anchors don't fail any gate.

### 7. Update the hello-world index route

Replace Task 1's placeholder with a minimal hero-shaped stub that
verifies typography + tokens are wired. Same import caveat applies.

```tsx
// apps/site/app/routes/index.tsx
import { createFileRoute } from "@tanstack/start/router"; // see caveat

export const Route = createFileRoute("/")({ component: HomeRoute });

function HomeRoute() {
    return (
        <section className="py-20">
            <p className="font-mono text-xs uppercase tracking-widest text-accent">chartlang</p>
            <h1 className="mt-3 text-5xl font-extrabold tracking-tight text-foreground">
                Open scripts for technical analysis.
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
                Write an indicator once. Run it on any conforming chart adapter.
                Section content lands in Task 3.
            </p>
        </section>
    );
}
```

Confirm in the browser: indigo accent, slate background, Inter
applied to body, JetBrains Mono on the eyebrow.

### 8. README touch-up

Append a "Brand" section to `apps/site/README.md` (≤ 10 lines)
naming the palette and the font choice so a contributor doesn't need
to spelunk through `brand.css` to find them.

### 9. Do not modify the docs theme yet

Task 5 owns the VitePress rebrand. Do **not** edit `docs/.vitepress/`
in this task — the goal here is to design tokens that are simple
enough to copy verbatim in Task 5.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `apps/site/app/styles/brand.css` | Create | Self-contained CSS variable palette. |
| `apps/site/app/styles/globals.css` | Modify | Tailwind v4 `@theme` bridge + body defaults. |
| `apps/site/app/components/brand/Logo.tsx` | Create | Mark + wordmark variants. |
| `apps/site/app/routes/__root.tsx` | Modify | Layout shell, nav, footer, head meta. |
| `apps/site/app/routes/index.tsx` | Modify | Brand-typed placeholder hero. |
| `apps/site/public/favicon.svg` | Create | Monogram favicon. |
| `apps/site/public/og.png` | Create | 1200×630 social card placeholder. |
| `apps/site/package.json` | Modify | Add `@fontsource-variable/inter` + `…/jetbrains-mono`. |
| `apps/site/README.md` | Modify | Append Brand section (≤ 10 lines). |

## Gates

- `pnpm install` — clean, new fontsource packages resolved.
- `pnpm site:dev` — site renders with indigo accent on slate
  background, Inter loaded (visible in DevTools Network).
- `pnpm typecheck` — green workspace-wide.
- `pnpm lint` — green; biome's import-sorting may reorder the
  `@fontsource-variable/*` imports — accept it.
- `pnpm site:build` — green; tree-shaken CSS does not regress.
- `pnpm readme:check` — green; `apps/site/README.md` ≤ 100 lines.
- Lighthouse (manual) — Accessibility ≥ 95 on the
  index route with only the layout shell + placeholder hero. Color
  contrast (slate-50 on slate-950, indigo-500 on slate-50) must hit
  AA at minimum.

## Changeset

None.

## Acceptance Criteria

- [ ] `apps/site/app/styles/brand.css` defines the indigo + slate +
      emerald palette with `:root` and `.dark` blocks.
- [ ] `globals.css` imports `brand.css`, Inter Variable, and
      JetBrains Mono Variable; sets up the Tailwind v4 `@theme`
      bridge.
- [ ] `<html>` carries `class="dark"`; dark mode is the default.
- [ ] `Logo` renders both `mark` and `full` variants; the full
      variant is wired into the nav.
- [ ] `__root.tsx` shows a sticky top nav with the five anchor
      links and an `https://docs.chartlang.invinite.com` link.
- [ ] Footer renders MIT + GitHub link.
- [ ] `favicon.svg` and `og.png` ship under `public/`; the head
      block references both.
- [ ] `pnpm site:dev` confirms Inter loaded (DevTools → Network →
      `*.woff2`), accent color matches the indigo token.
- [ ] All gates green per the list above.
- [ ] Every new `.ts`/`.tsx` file starts with the two-line MIT
      header.
- [ ] PR description includes a screenshot of the rendered layout
      shell.
