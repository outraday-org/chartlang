# Converter `?script=` URL write-back sync

> **Status: COMPLETE**

## Goal

Make the converter playground's `?script=<id>` deep-link round-trip:
write the param back to the URL when a Pine sample is selected and seed
it once on mount, mirroring the demo's `DemoBody`. After this task,
`/converter?script=<id>` always reflects the shown sample and is
shareable.

## Prerequisites

None.

## Current Behavior

`ConverterBody.tsx` *reads* `?script=` on load (`initialScriptId`,
`:28-33`) but never *writes* it. `switchScript` (`:49-53`) updates React
state (`scriptId`, `source`) only — picking a sample via the
`PineExampleBrowser` dialog leaves the URL untouched, and loading with a
missing/unknown id (which falls back to `PINE_SCRIPTS[0]`) never records
the resolved id in the URL.

## Desired Behavior

- Selecting any sample sets `window.location` to
  `/converter?script=<id>` via `history.replaceState` (no router
  navigation — the body is client-only and lazy), preserving the
  pathname, hash, and any other query params.
- On mount, the resolved initial id (param or fallback) is written back
  once, so a bare `/converter` load becomes `/converter?script=<first>`
  and a `/converter?script=<unknown>` load becomes
  `/converter?script=<first>`.

## Requirements

### 1. Add `syncConverterParam` to `ConverterBody.tsx`

Mirror `DemoBody.tsx`'s `syncDemoParam` (`:57-63`) — a module-private
helper, NOT a cross-import from `demo/` (the two bodies stay
self-contained; `syncDemoParam` is module-private to `DemoBody`).

```ts
/**
 * Persist the converter's `?script=` selection via `history.replaceState`
 * (no router navigation — the converter is client-only + lazy). Leaves the
 * pathname, hash, and every other query param untouched. Mirrors the demo's
 * `syncDemoParam`.
 */
function syncConverterParam(id: string): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  params.set("script", id);
  const { pathname, hash } = window.location;
  history.replaceState(null, "", `${pathname}?${params.toString()}${hash}`);
}
```

### 2. Call it on select + on mount

- Import `useEffect` alongside `useState` (the file currently imports
  `useState` only — line 10: `import { type ReactElement, useState } from "react";`).
- In `switchScript` (`:49-53`), after `setScriptId(id)`, call
  `syncConverterParam(id)`:

  ```ts
  const switchScript = (id: string): void => {
    const next = PINE_SCRIPTS.find((s) => s.id === id);
    setScriptId(id);
    setSource(next?.source ?? "");
    syncConverterParam(id);
  };
  ```

- Add a mount-only effect (mirror `DemoBody.tsx:111-115`), placed in the
  `ConverterBody` body before the `return`:

  ```ts
  // On mount, write the resolved selection back to the URL so it always
  // reflects the shown sample — even when loaded with a missing/unknown
  // `?script=` (which falls back to the first sample above). Runs once.
  useEffect(() => {
    syncConverterParam(scriptId);
    // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only URL seed
  }, []);
  ```

  Use `scriptId` (the resolved `useState(initialScriptId)` value), not
  `script?.id`, so an unknown-param fallback is what gets written.

### 3. e2e — assert the deep-link round-trips

Extend `apps/site/tests/e2e/converter.spec.ts` (or add a focused test
in it) mirroring `demo-examples.spec.ts`'s `?script=` deep-link test:

- **Load a non-default deep-link:** `page.goto("/converter?script=macd")`,
  wait for `.cl-converter .output-editor .cm-content` to `toContainText("MACD")`
  (the converted `defineIndicator` for the MACD sample), proving the
  read path still resolves the param.
- **Write-back on select:** open the sample dialog
  (`button.example-browser-trigger`), pick a different sample (a known
  category + item via `.example-browser-category` / `.example-browser-item`,
  as the existing converter spec does), then assert the URL updated:

  ```ts
  await expect.poll(() => new URL(page.url()).searchParams.get("script")).toBe("<picked-id>");
  ```

- **Mount seed:** `page.goto("/converter")` (no param), wait for the
  converter to mount (`.cl-converter .pane-editor .cm-content` visible),
  then assert `new URL(page.url()).searchParams.get("script")` equals the
  first `PINE_SCRIPTS` id (the fallback, now seeded into the URL).

Keep timeouts at the existing converter-spec scale (30s waits, a
`test.setTimeout(120_000)` for any test that also compiles).

### 4. Docs — `apps/CLAUDE.md`

Add a short bullet to the `apps/site/` demo + compiler invariants
section (near the existing `?script=` demo note around line 193)
recording that the **converter** route also reads + now writes
`?script=<id>` via a local `syncConverterParam` (mirroring
`syncDemoParam`), so converter deep-links round-trip.

### Edge cases

- **No router navigation:** use `history.replaceState`, never a
  TanStack Router `navigate` — the converter body is lazy + client-only
  and a nav would reload it.
- **SSR guard:** `typeof window === "undefined"` early-return (the
  helper may be referenced before hydration).
- **Preserve other params + hash:** build from the live
  `URLSearchParams(window.location.search)` and re-append
  `window.location.hash`, so a future `?strict=`/anchor is not dropped.
- **Unknown/missing param:** `initialScriptId` already falls back to
  `PINE_SCRIPTS[0]`; the mount seed writes that fallback id back (so the
  URL self-heals to a valid sample).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `apps/site/src/components/converter/ConverterBody.tsx` | Modify | Add `syncConverterParam`; call on select + mount; import `useEffect` |
| `apps/site/tests/e2e/converter.spec.ts` | Modify | Deep-link read + write-back + mount-seed assertions |
| `apps/CLAUDE.md` | Modify | Note the converter `?script=` read/write sync |

## Gates

- `pnpm site:typecheck` (TanStack Start tsc)
- `pnpm site:build`
- `pnpm site:e2e` (Playwright — the converter spec, built + previewed on
  `:3201`)
- `pnpm format` / Biome (`apps/**` uses 2-space, no semicolons — match
  the surrounding `ConverterBody.tsx` style; the repo Biome config
  ignores `apps/**`, so follow the file's local conventions)

## Changeset

None — `apps/site` is `"private": true`; the changeset gate is
package-scoped (`apps/CLAUDE.md`).

## Acceptance Criteria

- Selecting a sample updates the address bar to
  `/converter?script=<id>`; a bare `/converter` self-heals to the first
  sample's id.
- `?script=<id>` still deep-links the correct sample on load
  (read path unchanged).
- The converter spec asserts the read deep-link, the write-back on
  select, and the mount seed.
- No cross-import from `demo/` for the sync helper (local copy).
- `site:typecheck`, `site:build`, and the converter e2e are green.
- `apps/CLAUDE.md` documents the converter `?script=` sync.
