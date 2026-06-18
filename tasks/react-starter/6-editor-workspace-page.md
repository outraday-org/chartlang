# Editor pane + workspace page

> **Status: TODO**

## Goal

Assemble the full workspace: the `<ChartlangEditor>` editor pane (with a
hybrid language service that proxies diagnostics to `/api/compile`), a
symbol picker fed by EODData, a saved-scripts sidebar backed by SQLite,
and the compile→chart flow that ties the editor, Task 4's data, and Task
5's `ChartPane` together into the `apps/react-starter` index route.

## Prerequisites

- Task 4 (EOD symbol search + `loadSymbol` + usage).
- Task 5 (`ChartPane` + `activeAdapter`).
- (Transitively Tasks 2 + 3.)

## Current Behavior

The index route shows two placeholder cards (Task 1). The editor, symbol
picker, and saved-scripts UI don't exist yet.

## Desired Behavior

A complete single-page workspace: write/edit a chartlang script with
diagnostics in the gutter, pick a US symbol, see the compiled script
render over that symbol's real daily bars, and save / load / rename /
delete scripts from a sidebar — all persisted in SQLite.

## Requirements

### 1. Hybrid language service — `src/components/workspace/hybridLanguageService.ts`

Port `apps/site/src/components/demo/hybridLanguageService.ts`: a local
`createLanguageService()` for the pure-TS surface (hover, completions,
signature help, intervals) **plus** a `compileToDiagnostics` that POSTs
to `/api/compile` and returns the mapped diagnostics + the compiled
artifact (`{ moduleSource, manifest }`) for the chart. Debounce compiles
(e.g. 300 ms) to respect the editor's edit cadence.

### 2. Editor pane — `src/components/workspace/EditorPane.tsx`

Port `apps/site/src/components/demo/EditorPane.tsx`:

- `<ChartlangEditor>` from `@invinite-org/chartlang-editor/react` with
  the hybrid service injected via `opts.service`.
- **Theme:** use the editor's default/light theme to match the **stock
  shadcn** look — do **not** assume `chartlangDark` (the site uses it for
  the brand). Pick whichever editor theme reads well on the default
  shadcn neutral background; document the choice.
- `onSourceChange` feeds the debounced compile; the latest good artifact
  flows to `ChartPane`.

### 3. Symbol picker — `src/components/workspace/SymbolPicker.tsx`

- A shadcn `command`/`dialog` combobox calling `searchSymbols` (Task 4).
- On select → `loadSymbol` → bars to `ChartPane`; show the `source`
  (cache/network) and a **quota badge** (`remaining/100`) from
  `usage()`. Surface `quotaExceeded` / missing-key errors as toasts.
- US-only helper text (free tier constraint).

### 4. Saved-scripts sidebar — `src/components/workspace/ScriptsSidebar.tsx`

- `listScripts()` → a list (name + symbol + updatedAt); click loads
  source into the editor **and** triggers `loadSymbol(script.symbol)`.
- Save button → `saveScript({ id?, name, source, symbol })` (prompt for
  a name on first save via a shadcn `dialog`); rename + delete actions;
  optimistic refresh of the list.
- The current script id is tracked so re-saving updates in place.

### 5. The workspace page — `src/routes/index.tsx`

- `resizable` layout: sidebar (scripts) | editor pane | chart pane (or a
  two-pane split with the sidebar as a collapsible panel).
- Top bar: symbol picker + quota badge + Save/New buttons + an alerts
  indicator.
- State: `source`, `symbol`, `bars`, `artifact`, `diagnostics`,
  `currentScriptId`. Compile is debounced; the last successful artifact
  is retained on a failing compile (chart doesn't blank — mirror the
  site behavior). Diagnostics show in the gutter + a status line.
- Boots with the seed script (Task 3) + its symbol loaded.

### 6. Empty / error states

- No key set → editor + compile work; symbol picker shows "add
  EODDATA_API_KEY to .env".
- Quota exhausted → cached symbols still load; new ones show the
  friendly error.
- Compile error → gutter diagnostics + retained last-good chart.

### Edge cases

- **Debounce vs quota:** editing the script must **not** re-fetch EOD
  data (only re-compile); bars are re-fetched only on symbol change. Keep
  the two flows independent so typing never burns API calls.
- **Unsaved changes** indicator when `source` differs from the loaded
  script; confirm before loading another script over unsaved edits.
- **Large script** (>64 KiB) → blocked at save + compile boundaries with
  a clear message.

### Test (e2e)

`tests/workspace.spec.ts` — end-to-end happy path: open app → seed
script visible + compiled → chart renders → edit script → diagnostics
update without an EOD fetch → pick a (mocked) symbol → chart reloads,
quota badge increments once → save script → appears in sidebar → reload
page → script + symbol restored from SQLite cache (no new API call).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `apps/react-starter/src/components/workspace/hybridLanguageService.ts` | Create | local LS + `/api/compile` diagnostics |
| `apps/react-starter/src/components/workspace/EditorPane.tsx` | Create | `<ChartlangEditor>` wiring |
| `apps/react-starter/src/components/workspace/SymbolPicker.tsx` | Create | EODData symbol combobox + quota badge |
| `apps/react-starter/src/components/workspace/ScriptsSidebar.tsx` | Create | saved-script CRUD UI |
| `apps/react-starter/src/routes/index.tsx` | Modify | the full workspace page |
| `apps/react-starter/package.json` | Modify | `@invinite-org/chartlang-editor`, codemirror deps |
| `apps/react-starter/tests/workspace.spec.ts` | Create | full workspace e2e |

## Gates

- `pnpm typecheck`
- `pnpm --filter chartlang-react-starter build`
- `pnpm --filter chartlang-react-starter e2e` (workspace happy path)
- No coverage/changeset gate (apps-exempt).

## Changeset

None — `apps/*` is changeset-exempt.

## Acceptance Criteria

- The workspace compiles + charts the seed script over real daily bars
  on first load.
- Editing re-compiles (debounced) with gutter diagnostics and **no** EOD
  fetch; symbol changes re-fetch bars and bump the quota badge once
  (cache hits don't).
- Save/load/rename/delete persist to SQLite; a page reload restores the
  last script + symbol from cache without a new API call.
- The UI is stock shadcn neutral (no brand assets/colors).
</content>
