# Task 3 — Landing-page content (Hero, Features, Quickstart)

> **Status: TODO**

## Goal

Populate the single-page landing route with three marketing sections —
**Hero**, **Features**, **Quickstart** — built from shadcn primitives
on the Task 2 brand tokens, with syntax-highlighted code snippets
that double as the canonical examples in the root `README.md`.
The embedded live demo lands in Task 4 below these sections.

## Prerequisites

- Task 2 complete — brand tokens, layout shell, Logo, fonts, dark
  mode default.

## Current Behavior

The home route renders the Task 2 placeholder hero (`<p>Section
content lands in Task 3.</p>`). No features section, no quickstart,
no anchor targets. The nav's `#features`, `#quickstart`, `#demo`
anchor links don't scroll anywhere.

## Desired Behavior

After this task:

- `apps/site/app/routes/index.tsx` renders three composed sections
  in order — `<Hero />`, `<Features />`, `<Quickstart />`.
- The Hero shows the chartlang elevator pitch plus the canonical
  EMA-cross code snippet (same code as the root README), syntax-
  highlighted with Shiki using a theme aligned to the brand.
- The Features section communicates **what chartlang is and what it
  can do** — three to five cards, each with a concise headline,
  short body, and a small code or diagram snippet.
- The Quickstart shows the three-line, role-specific install snippet
  (script author / adapter author / embedder) and the
  compile-then-render flow, mirroring the root README's "Quickstart"
  section.
- Each section is anchored (`id="features"`, `id="quickstart"`); the
  nav links from Task 2 now scroll smoothly.
- All marketing copy is in English, no emoji, no jargon beyond the
  vocabulary the docs site already uses (no need to define
  "indicator" — link to docs).

## Requirements

### 1. Add Shiki for syntax highlighting

Add to `apps/site/package.json`:

```json
{
    "dependencies": {
        "shiki": "^1.20.0"
    }
}
```

VitePress also uses Shiki — pinning the same engine means the
marketing site and the docs (Task 5) render code identically. Pick
the `github-dark-dimmed`-adjacent theme and override the background
to `var(--background)` so code blocks blend into the page rather
than floating on a default Shiki dark gray.

Create `apps/site/app/components/landing/CodeBlock.tsx`:

```tsx
// apps/site/app/components/landing/CodeBlock.tsx
import { type ReactElement, useEffect, useState } from "react";
import { codeToHtml } from "shiki";

export type CodeBlockProps = Readonly<{
    code: string;
    lang?: "ts" | "tsx" | "bash" | "json";
    /** Visible filename above the block. */
    filename?: string;
}>;

export function CodeBlock(props: CodeBlockProps): ReactElement {
    const { code, lang = "ts", filename } = props;
    const [html, setHtml] = useState<string>("");
    useEffect(() => {
        void codeToHtml(code, {
            lang,
            theme: "github-dark-dimmed",
            transformers: [{ pre(node) { node.properties.style = "background:transparent"; } }],
        }).then(setHtml);
    }, [code, lang]);

    return (
        <figure className="overflow-hidden rounded-lg border border-border bg-muted/40">
            {filename ? (
                <figcaption className="border-b border-border px-4 py-2 font-mono text-xs text-muted-foreground">
                    {filename}
                </figcaption>
            ) : null}
            <pre
                className="overflow-x-auto p-4 text-sm leading-relaxed"
                // biome-ignore lint/security/noDangerouslySetInnerHtml: Shiki output is pre-escaped HTML
                dangerouslySetInnerHTML={{ __html: html || `<code>${code}</code>` }}
            />
        </figure>
    );
}
```

The `useEffect` highlights client-side. Server-side highlighting is
also possible (TanStack Start exposes a server function shape) but
optional — the initial paint shows the raw code, then Shiki swaps it
in. Acceptable trade for the marketing page; the demo (Task 4) is the
real interactive surface.

### 2. Hero (`apps/site/app/components/landing/Hero.tsx`)

The hero is the first paint above the fold. Required content:

- Eyebrow: small uppercase tracked text — `OPEN SOURCE · MIT-LICENSED`.
- Headline (h1): "Open scripts for technical analysis. Run on any chart."
- Subhead (p, muted-foreground): one or two sentences explaining the
  one-script-many-charts pitch. Use the same wording as the root
  README to keep them in lockstep.
- Two CTA buttons (shadcn `Button` composed on Base UI):
    - Primary: "Try the demo" → `href="#demo"`.
    - Secondary: "Read the docs" →
      `href="https://docs.chartlang.invinite.com"`.
- A `CodeBlock` showing the EMA-cross example from the root README,
  filename `ema-cross.chart.ts`.

Layout: two-column on `md+` (text left, code block right); stacked
on small viewports. Use the brand's max-width container; do not
escape the layout shell from Task 2.

Hard-code the EMA-cross snippet as a single template literal in the
component. Do **not** import it from `packages/` — keep marketing
copy decoupled from the workspace so it doesn't break when
primitive signatures evolve.

### 3. Features (`apps/site/app/components/landing/Features.tsx`)

Anchor: `id="features"`.

Render a grid of four cards. Each card has a short headline, a
two-sentence body, and a small code or diagram snippet. Use the
shadcn `Card` (or compose `<article>` + Tailwind if Card doesn't
exist in the b0 preset by default — both fine).

Suggested cards (pick wording verbatim; do not paraphrase past the
chartlang vocabulary):

1. **One script, many charts.**
   - Body: "Write a `.chart.ts` once. The adapter contract makes it
     run on Lightweight Charts, ECharts, Highcharts, or your own
     renderer."
   - Snippet: tiny TS fragment showing `import { defineIndicator }`
     and a one-line `compute()`.

2. **Typed primitives, no DSL surprises.**
   - Body: "`ta.*` for technical analysis, `plot` / `draw.*` for
     visuals, `alert` for signals, `input.*` for parameters. All
     typed; the editor catches mistakes before compile."
   - Snippet: a four-line example showing `ta.ema`, `plot`,
     `input.int`.

3. **Sandbox-safe — runs anywhere a worker runs.**
   - Body: "The compiler emits a self-contained ESM bundle with no
     ambient globals. Drop it in a Web Worker, a QuickJS-WASM
     sandbox, or a Node alert server — same artifact, same output."
   - Snippet: a short CLI-style block showing
     `chartlang compile foo.chart.ts` and the three output files.

4. **Conformance-tested for portability.**
   - Body: "Every adapter is validated against a shared scenario
     suite. If your chart passes conformance, every chartlang script
     written against `apiVersion: 1` works on it."
   - Snippet: a short bash block showing `pnpm conformance` exit 0.

Each card's snippet uses `CodeBlock` with `filename` set
appropriately. Keep snippets short — readers scan, they do not
study.

### 4. Quickstart (`apps/site/app/components/landing/Quickstart.tsx`)

Anchor: `id="quickstart"`.

Mirror the root README's "Quickstart" section. Three role-tabs:

- **Script author** — `pnpm add @invinite-org/chartlang-core`,
  then the EMA-cross snippet (same as Hero) abbreviated.
- **Adapter author** — `pnpm add @invinite-org/chartlang-adapter-kit`,
  then a minimal adapter stub (5-6 lines).
- **Embedder** — the four-package install line from the root README,
  then a one-line `createScriptRunner` call.

Use shadcn `Tabs` (Base UI primitive) for the role switcher. If the
Tabs primitive is not installed in the b0 preset out of the box,
add it via `pnpm dlx shadcn@latest add tabs` from inside
`apps/site/` — the registry resolves Base UI variants.

Append a final paragraph below the tabs:
"See the [docs](https://docs.chartlang.invinite.com/) for the
complete API reference and a step-by-step
[Getting started guide](https://docs.chartlang.invinite.com/getting-started/write-your-first-script)."

### 5. Compose the index route

```tsx
// apps/site/app/routes/index.tsx
import { createFileRoute } from "@tanstack/start/router";
import { Hero } from "~/components/landing/Hero";
import { Features } from "~/components/landing/Features";
import { Quickstart } from "~/components/landing/Quickstart";

export const Route = createFileRoute("/")({ component: HomeRoute });

function HomeRoute() {
    return (
        <>
            <Hero />
            <Features />
            <Quickstart />
            {/* <EmbeddedDemo /> ships in Task 4 */}
        </>
    );
}
```

### 6. Section spacing convention

Each section is `<section className="py-20 md:py-28">` with an
`id` for the in-page anchor. Headings inside sections use `h2`
(`text-3xl md:text-4xl font-bold`). Body copy maxes at
`max-w-2xl text-muted-foreground` for readability.

### 7. No links to non-existent docs pages

Every external link must point at a docs URL that exists today.
Verify against `docs/.vitepress/config.ts` nav before linking.
Internal anchors (`#features`, `#quickstart`, `#demo`) are fine
even though `#demo` will not exist until Task 4 — the broken anchor
is a known, scoped, time-limited state.

### 8. Smoke test (e2e, deferred)

A Playwright `landing.spec.ts` covering the marketing surface is
written in Task 4 alongside the demo's smoke test. Task 3 does
**not** ship a test — it has no logic to test beyond static
rendering, which the build itself verifies via TanStack Start's
production output.

### 9. Coverage carve-out

`apps/site/` does not run vitest (per Task 1). Components in this
task do not need unit tests. The `CodeBlock` `useEffect` Shiki
integration is the only piece of logic; visual verification in the
browser plus the Task 4 Playwright smoke test cover it.

### 10. README touch-up

Add the three section names ("Hero, Features, Quickstart") to the
`apps/site/README.md` "Public surface" line so a contributor knows
where each section lives. Stay ≤ 100 lines.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `apps/site/app/components/landing/Hero.tsx` | Create | Above-the-fold marketing block + code snippet. |
| `apps/site/app/components/landing/Features.tsx` | Create | Four-card "what it does" grid. |
| `apps/site/app/components/landing/Quickstart.tsx` | Create | Role-tabbed install + first-script flow. |
| `apps/site/app/components/landing/CodeBlock.tsx` | Create | Shared Shiki-driven code-snippet component. |
| `apps/site/app/routes/index.tsx` | Modify | Compose the three section components. |
| `apps/site/package.json` | Modify | Add `shiki`. |
| `apps/site/README.md` | Modify | Add component list to public-surface paragraph. |

## Gates

- `pnpm install` — clean.
- `pnpm site:dev` — three sections render; smooth-scroll anchors
  work from the nav.
- `pnpm site:build` — green; check the Shiki bundle size in build
  output (warn at 500 KB+; Task 4 may need to lazy-load it if it
  bloats further).
- `pnpm typecheck` — green workspace-wide.
- `pnpm lint` — green; biome's a11y rules pass on the marketing
  components.
- `pnpm readme:check` — green; `apps/site/README.md` ≤ 100 lines.
- Manual: Lighthouse ≥ 90 on Performance, ≥ 95 on Accessibility,
  ≥ 100 on Best Practices on the index route.

## Changeset

None.

## Acceptance Criteria

- [ ] `Hero` renders the canonical EMA-cross snippet, primary and
      secondary CTA, eyebrow text.
- [ ] `Features` renders four cards, each with a headline, body,
      and code snippet, in a responsive grid.
- [ ] `Quickstart` renders role-tabbed install + first-script
      content. Tabs primitive added if not present in b0 preset.
- [ ] `CodeBlock` highlights code with Shiki and respects the brand
      background (`transparent` over the muted card).
- [ ] All section anchors (`#features`, `#quickstart`) are wired to
      the nav from Task 2; smooth-scroll works.
- [ ] External links point at real `docs.chartlang.invinite.com`
      and GitHub URLs only (verify before committing).
- [ ] No reference to anything in `packages/` from the marketing
      components — the copy is hard-coded.
- [ ] All gates green per the list above.
- [ ] Lighthouse scores in PR description.
- [ ] PR description includes a desktop + mobile screenshot of each
      section.
- [ ] Every new `.tsx` file starts with the two-line MIT header.
