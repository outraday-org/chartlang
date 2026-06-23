# Task 6 plan — Docs, skills, example, demo, pine-converter mapping

> Reconstructed during the quality pass (the original Task 6 run left no
> `.plan.md`). Documents the as-shipped surface + the quality-pass fixes.

## Implementation summary (verified)

1. **Generated primitive doc pages** — `genPhase4Docs.ts` gained `time`,
   `session`, and `input.session` `DOC_ENTRIES` (pointing at
   `core/src/time-accessors/{timeAccessors,sessionAccessors}.ts` and
   `core/src/input/input.ts`). `pnpm docs:generate` emits
   `docs/primitives/{time,session,input/session}.md`; `docs:gate` +
   `docs:committed:check` byte-diff them. Pages carry `Since: 1.5`.
2. **Determinism contract page** — `docs/language/time-and-sessions.md`
   (hand-authored): UTC ms epoch, `Date`/`Intl` banned, v1 UTC + fixed-offset
   only, `tz-dst-unsupported` fallback, Pine `dayofweek` `1=Sun..7=Sat`,
   `input.session` usage, Deferred section. Sidebar entries added in
   `docs/.vitepress/config.ts`.
3. **Skill** — the generated `skills/chartlang-coding/references/primitives.md`
   intentionally covers only `ta.*`/`draw.*`/plot-family, so `time.*`/`session.*`
   are taught in the hand-authored `SKILL.md` instead (Primitive surface
   one-liner + UTC caveat + Pine `dayofweek`; Inputs section bumped to
   "Thirteen input kinds" incl. `session`). `skills:gate` green.
4. **Example + demo** — `examples/scripts/session-day-filter.chart.ts`
   (session + weekday filter). Wired into `packages/cli/src/e2e.test.ts`,
   the `DEMO_SCRIPTS` array (`apps/site/.../demo/scripts.ts`), the regenerated
   `docs/examples/session-day-filter.md`, and documented in
   `examples/scripts/CLAUDE.md`. `examples:gate` + `examples:sync` green.
5. **Pine-converter mapping** — `BUILTIN_IDENTIFIER_MAP` lowers bare
   `dayofweek`/`time_close`; `BUILTIN_CALL_MAP` (`builtinCalls.ts`) intercepts
   the call forms (`time()`→`bar.time`, `time_close()`→`time.timeClose(bar.time)`,
   `dayofweek(t[,tz])`→`time.dayofweek(t[,tz])`); `INPUT_MAP` gains
   `input.session`; `usage.ts` force-includes `time`/`session` in imports +
   destructure; new append-only `time-builtin-not-mapped` diagnostic; fixture
   `34-calendar-session` round-trips clean (NOT in `KNOWN_NON_COMPILING`);
   `converter:docs:check` regenerated. `pine-converter/CLAUDE.md` updated.

## Quality-pass fixes applied (were missing from the original run)

- `session-day-filter` was absent from `DEMO_SCRIPTS` → added (+ regenerated
  `docs/examples/`); the example was otherwise dead (not in the demo picker).
- `input.session` JSDoc `@since` was `1.2` (stale task-file placeholder) →
  corrected to `1.5` to match the rest of the feature; pages + hover registry
  regenerated.
- `hoverRegistry.generated.ts` was stale + its count guard (534) unbumped →
  regenerated (555) + added a `1.5` calendar/session assertion block.
- `genPhase4Docs` time/session entries broke the `docs.test.ts` fixture
  (no `time-accessors/` stub) → coverage dropped; added fixture stubs.
- `packages/host-quickjs/dist/dispatcher.js` (committed bundled-core artifact)
  was stale → rebuilt.
- 16 feature files were unformatted → `biome format` applied.

## Out of scope (reported, not fixed)

- The `editor` package is a 6th `InputKind` consumer (exhaustive switch in
  `InputsForm.tsx` / `renderInputsForm.ts`) the Task-3 "five lockstep sites"
  spec omitted — `case "session"` added here (typecheck was red).

## Gates

- `docs:check`, `docs:gate`, `docs:committed:check`, `examples:gate`,
  `examples:sync`, `skills:gate`, `converter:docs:check`, `hover:check`,
  `readme:check`, `adapters:gate` — all green.
- `pnpm -F @invinite-org/chartlang-pine-converter test` (100%, fixture 34
  round-trips), `cli` (100%), `language-service` (100%), `editor` (100%),
  `conformance` (calendar-session scenario pins both plots) — all green.
