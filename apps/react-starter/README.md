# chartlang-react-starter

> **Stability: experimental.**

A clonable **chartlang workspace starter** — a private TanStack Start
app you scaffold with `npm create @invinite-org/chartlang@latest` and then own and
extend yourself. It pairs a script editor with a live chart: write a
chartlang indicator/drawing/alert script on the left, see it render on
the right. Private workspace package (`"private": true`); not published
to npm. The published installer that clones it is `@invinite-org/create-chartlang`.

This is a **starter, not the chartlang product**: it ships the stock
**shadcn Base UI default (neutral) theme** so you can re-theme it freely.

## Public surface

N/A — an app, not a library (`"private": true`, unpublished).

## What's here today (Task 1)

The app shell only: TanStack Start routing, a neutral root layout with a
sonner `<Toaster/>`, the shadcn Base UI primitives later tasks need
(`src/components/ui/`), and a resizable two-pane workspace
(`src/routes/index.tsx`) with "Editor" / "Chart" placeholder cards. The
compiler route, SQLite store, EODData source, and the real editor/chart
panes land in later tasks (see `tasks/react-starter/`).

## Theming — it's yours, re-theme freely

Unlike `apps/site/`, this starter does **NOT** import the repo
`brand/brand.css` and does **NOT** use the site's `b0` brand preset. Its
`src/styles.css` carries the plain shadcn neutral `:root` / `.dark`
token block. This is the one place the repo's `brand/` single-source-of-
truth contract is intentionally relaxed (see `apps/CLAUDE.md`): the
cloned tree belongs to the user, so it must look like a blank shadcn app
they can paint however they like. Edit the OKLCH values in
`src/styles.css`, or drop in any shadcn theme.

## Local dev

```bash
pnpm install
pnpm --filter chartlang-react-starter dev
```

Then open `http://localhost:3100` (port 3100 so it can run alongside the
site, which uses 3000).

## Build

```bash
pnpm --filter chartlang-react-starter build
```

Produces a Vite client + SSR build under `apps/react-starter/dist/`.

## Environment (later tasks)

A future `.env` (added in Task 4) will hold the EODData API key and the
SQLite path, e.g.:

```
EODDATA_API_KEY=your-key
DATABASE_URL=file:./data/starter.db
```

`.env*` is gitignored. None of this is wired yet in Task 1.

## Typecheck

```bash
pnpm --filter chartlang-react-starter typecheck
```

The root `biome.json` ignores `apps/**` (the shadcn-generated source
uses 2-space indent + no semicolons, clashing with the repo-wide
4-space + semicolons style), so there is no Biome lint gate here.
Typecheck uses the workspace base tsconfig with per-app overrides for
`jsx`, `moduleResolution: "Bundler"`, and the `@/*` path alias.

## License

MIT.
