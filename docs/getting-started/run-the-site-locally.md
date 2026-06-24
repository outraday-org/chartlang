# Run the site locally

The marketing + demo site at
[chartlang.invinite.com](https://chartlang.invinite.com) is the
canonical place to see chartlang work — it embeds a live editor and
chart playground directly on the landing page. This page covers running
that same site against the workspace packages on your machine, which is
the fastest way to iterate on the demo or on the language tooling it
exercises.

## Run it

From the repo root:

```bash
pnpm install
pnpm site:dev
# then open http://localhost:3200
```

`pnpm site:dev` is shorthand for `pnpm --filter chartlang-site dev`. The
site lives at `apps/site/` and consumes `@invinite-org/chartlang-*` via
`workspace:*`, so a workspace install is all you need — there is no
separate build step for local dev.

## What you get

- **The landing page** — the hero, the "what is chartlang" copy, the
  quickstart, and, scrolled below them, the embedded editor + chart
  demo.
- **A live editor** — type a `.chart.ts` script on the left; the chart
  on the right re-renders on every keystroke. Hover, completion, and
  signature help run locally through the chartlang language service.
- **A real compile** — each edit POSTs to `/api/compile`, which runs
  the **real** chartlang compiler in a TanStack Start server route (the
  same code path that deploys as a Netlify Function in production). The
  compiled bundle is then hosted and rendered through the reference
  canvas2d adapter.

No Netlify account or deploy is needed for local dev — the server route
runs inside the local dev server.

## How the compile path works

The compiler imports node builtins and a native esbuild launcher, so it
cannot run in the browser. The site keeps the compiler **server-side**
in `apps/site/src/lib/server/compile.ts` (invoked by the server route at
`apps/site/src/routes/api/compile.ts`) while still letting the language
service load in the browser for hover and completions —
`apps/site/vite.config.ts` aliases `esbuild` and the `node:*` builtins
the language service touches to browser stubs in the **client** build
only. See [Embed in your chart](./embed-in-our-chart) for the full
wiring and the reusable pattern.

## Next steps

- [Embed in your chart](./embed-in-our-chart) — the compile → host →
  adapter pattern the demo is built on, ready to drop into your own app.
- [Write your first script](./write-your-first-script) — author a
  `.chart.ts` from scratch and compile it.
