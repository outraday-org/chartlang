# Task 2 — `alert` fixtures + compile round-trip + docs

> **Status: TODO**

## Goal

Lock Task 1's `alert(message, freq)` lowering with a converter fixture triple
that compiles, and document the mapping (incl. the dropped-frequency behaviour)
in the converter docs + skill surface.

## Prerequisites

- **Task 1** (alert lowering + `alert-frequency-not-mapped`).

## Current Behavior

- No fixture exercises a Pine `alert(...)` call (grep
  `packages/pine-converter/fixtures/*.pine`).
- `docs/converter/supported.md` / `diagnostics.md` do not mention `alert`
  message/frequency mapping.

## Desired Behavior

A fixture whose Pine `if cond` / `alert(msg, alert.freq_all)` converts to a
chartlang `if (cond) { alert(msg); }` that passes the compile round-trip, plus
a documented `alert-frequency-not-mapped` info entry.

## Requirements

### 1. Fixture triple

- Add `NN-alert-message-freq.pine` (next free `NN` via `ls
  packages/pine-converter/fixtures` at implementation time) +
  `NN-alert-message-freq.expected.chart.ts` +
  `NN-alert-message-freq.expected.diagnostics.json`.
- Cover: an `if cond` / `alert(message, alert.freq_all)`; a message built by
  string concat (`'{"a":"' + syminfo.ticker + '"}'`); at least one other
  frequency enum (`alert.freq_once_per_bar`); the `expected.diagnostics.json`
  asserts one `alert-frequency-not-mapped` (info) per dropped frequency.
- The clean conversion must pass the compile round-trip in
  `packages/pine-converter/src/tests/fixtures-compile.test.ts` — do **not** add
  it to `KNOWN_NON_COMPILING`.

### 2. Docs + skill

- `docs/converter/supported.md`: add the `alert(message, freq)` → `alert(message)`
  row (frequency dropped, info).
- `docs/converter/diagnostics.md` is generated — ensure the
  `alert-frequency-not-mapped` entry renders (run the generator).
- If the converter skill enumerates supported builtins, add `alert`
  (`pnpm skills:generate` / skills:gate).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/pine-converter/fixtures/NN-alert-message-freq.pine` | Create | Input fixture. |
| `packages/pine-converter/fixtures/NN-alert-message-freq.expected.chart.ts` | Create | Expected output. |
| `packages/pine-converter/fixtures/NN-alert-message-freq.expected.diagnostics.json` | Create | Expected diagnostics (incl. info). |
| `docs/converter/supported.md` | Modify | Document the alert mapping. |
| `.changeset/pine-converter-alert.md` | Create | `@invinite-org/chartlang-pine-converter` **patch**. |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm -F @invinite-org/chartlang-pine-converter test` (100% coverage;
  fixture compile round-trip green)
- `pnpm docs:check`
- `pnpm skills:generate` + skills:gate (if the skill surface changed)

## Changeset

`.changeset/pine-converter-alert.md` — `@invinite-org/chartlang-pine-converter`
**patch** (covers Task 1 + Task 2).

## Acceptance Criteria

- The `alert` fixture converts and **compiles** via the round-trip test.
- `expected.diagnostics.json` pins the `alert-frequency-not-mapped` info.
- Docs + generated diagnostics page updated; changeset committed.
