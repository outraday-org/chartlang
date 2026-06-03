# Phase 4 — `0.4` Editor + Inputs + Timeframes + Tier-1 Pine Parity

> **Plan reference:** PLAN.md §19 Phase 4, with cross-cuts into §4.5
> (timeframes), §4.6–§4.9 (state / barstate / syminfo / timeframe),
> §12 (inputs), §14 (language service + editor), §7.2 (capabilities
> triad).
> **Prerequisite:** Phase 3 drawing parity shipped.
> **Version target:** `0.4`.

## Goal

A script author opening their editor sees inline diagnostics,
completions, and hover docs. Scripts can declare inputs, pick a
main timeframe, and use the Tier-1 Pine ergonomics so the median
Pine indicator can be rewritten in chartlang without missing
features.

## Deliverables

### Editor

- `@invinite-org/chartlang-language-service` (§14.1) — headless,
  editor-agnostic. `getHoverDoc`, `getCompletions`,
  `compileToDiagnostics`, `getSignatureHelp`, `getDefinition`,
  `getAvailableIntervals`.
- `@invinite-org/chartlang-editor` (§14.2) — CodeMirror 6 reference
  shell. Lezer TS grammar wiring; hover/autocomplete extensions
  delegating to the language service.
- `<ChartlangEditor />` React component + factory
  `createChartlangEditor(opts)`.
- Inputs UI generated from `manifest.inputs`.

### Multi-timeframe surface (single-stream)

- `input.interval(default, opts?)` per §4.5 — user-pickable main
  timeframe.
- `request.security({ interval })` API and types land — adapters
  typically ship `Capabilities.multiTimeframe: false` in 0.4. NaN
  fallback + `multi-timeframe-not-supported` diagnostic when off.
- Compiler enforces literal-only `interval` arg per §5.6
  (`request-security-interval-not-literal`).
- `manifest.requestedIntervals` + `manifest.userPickableInterval`
  populated.

### Capabilities triad

- `Capabilities.intervals` (adapter-defined `IntervalDescriptor[]`).
- `Capabilities.multiTimeframe` (boolean — typically `false` in 0.4).
- `Capabilities.subPanes` (max sub-panes per script).
- Editor hover/completions consume all three.
- `Capabilities.maxDrawingsPerScript` + `Capabilities.symInfoFields`.

### Tier-1 Pine primitives

- `state.*` / `state.tick.*` per §4.6 — user persistent state
  (Pine `var`/`varip`). Two-phase committed/tentative semantics.
- `barstate.*` per §4.7 — `isfirst`, `islast`, `isnew`, `ishistory`,
  `isrealtime`, `isconfirmed`.
- `syminfo.*` per §4.8 — `ticker`, `type`, `mintick`, `currency`,
  `exchange`, `timezone`, `session`, `meta`, capability-gated.
- `timeframe.*` per §4.9 — `period`, `isintraday`, `isdaily`,
  `isweekly`, `ismonthly`, `inSeconds`.
- `ta.nz(value, replacement)` (already shipped in Phase 2 if not
  earlier — verify here).
- Universal `opts.offset` on every `ta.*` primitive (verify shipped).

### Script-author overrides

- `defineIndicator({ maxDrawings, maxBarsBack, format, precision,
  scale, requiresIntervals, shortName })` per §4.1.

## Done criteria

- Editor renders with hover docs, completions, diagnostics, inline
  squiggles. Opening a sample script gives a near-IDE experience.
- Inputs UI auto-generated from the manifest works for every
  `input.*` builder.
- `input.interval()` flow: user picks a timeframe in the script-
  settings UI, adapter switches stream, script re-runs cleanly.
- `request.security` calls compile to literal-only intervals; dynamic
  args fail with the documented diagnostic.
- Capability triad gates correctly: missing intervals →
  `unsupported-interval`; `multiTimeframe: false` →
  `multi-timeframe-not-supported` with NaN secondary bar.
- `state.*` / `state.tick.*` round-trip through snapshot/restore
  byte-identically (cold vs warm).
- `barstate.*` / `syminfo.*` / `timeframe.*` covered by conformance.
- Median Pine indicator (pick three reference scripts from a Pine
  library) rewritten in chartlang without reaching for unmodelled
  features.

## Notes for `/write-tasks`

- Order: language-service first (it's a hard dependency for the
  editor shell), then editor, then inputs, then multi-timeframe
  surface, then Tier-1 primitives.
- `state.*` / `state.tick.*` lands in `STATEFUL_PRIMITIVES` registry
  (§5.5) and uses the existing callsite-id injection.
- `request.security`'s actual multi-stream path can be `false` here
  — it flips to `true` in Phase 5 once adapters wire multi-stream
  candle fetch.
- Hover-doc registry sources from JSDoc on `@invinite-org/chartlang-
  core` — keep JSDoc rich (§17.2).
