---
"@invinite-org/chartlang-adapter-kit": minor
"@invinite-org/chartlang-runtime": minor
"chartlang-example-canvas2d-adapter": minor
"@invinite-org/chartlang-conformance": minor
---

Phase 3 Task 18 — Containers (`group` / `frame`). The FINAL per-port
task: after this lands all 61 `DrawingKind`s have real validator /
emit / renderer / dispatch arms. Both kinds map to the `other`
bucket and ship as flat methods (`draw.group(childHandleIds)` /
`draw.frame(a, b, opts?)`) per the Task-11 Option-C decision.

- **adapter-kit** — 2 new per-kind validators (`validateGroupState`,
  `validateFrameState`) + 2 tiny shared helpers
  (`validateOptionalChildHandleIds`, `validateFrameOpts`). `group`
  pins `childHandleIds.length ≤ 100`; `frame` reuses Task-2's
  `validateAnchorPair`, accepts degenerate anchors (silent no-op at
  the renderer per the rest of Phase-3's degenerate-input
  precedent). The permissive-default test fixture
  (`validateEmission.test.ts:1516`) flips from
  `permissively-accepts` to a rejecting `validateGroupState`
  assertion + a new gate-only test that asserts unknown kinds drop
  with `unsupported-drawing-kind` upstream. After Task 18 every
  `DrawingKind` has a real validator arm — the
  `default: return { ok: true };` arm in `validateStateByKind` is
  removed; TS's exhaustiveness check now catches a future
  `DrawingKind` addition without a validator.
- **runtime** — 2 new emit functions under
  `packages/runtime/src/emit/draw/containers/` wired into the
  `DRAW_NAMESPACE` `KIND_IMPLS` map as flat methods. `group` is a
  2-arg dual-overload `(slotId, childHandleIds)`; `frame` is a 4-arg
  dual-overload `(slotId, a, b, opts?)` mirroring `line`. After Task
  18 `IMPL_KIND_NAMES.size === 61`; the Proxy's else-branch
  fall-through to core's throwing-stub is dead code on the
  `DrawNamespace` type surface — kept as defence-in-depth for
  property access outside that type. The pre-Task-18
  "still-stubbed" assertions in `namespace.test.ts` /
  `primitives.test.ts` / `buildComputeContext.test.ts` are replaced
  with a positive cardinality sweep that asserts every
  `DrawingKind` resolves to a real runtime impl that throws the
  in-step-only sentinel (NOT the core stub sentinel).
- **canvas2d-adapter** — 1 real renderer (`renderFrame`) + 1 pure
  no-op renderer (`renderGroup`). `renderFrame` strokes a closed
  4-corner rectangle defaulting to slate `#64748b`, optionally
  paints a `fillRect` background when `style.bgColor` is set, and
  optionally paints a `fillText` label inset 6 px from the top-left
  when `style.label` is set. Degenerate anchors (zero width or zero
  height in canvas space) silently no-op. `renderGroup` is a pure
  no-op for Phase 3 — the visible bounding-box envelope around
  grouped drawings is a Phase-4 follow-up tied to
  `Viewport.drawingsById` plumbing (Viewport currently exposes only
  `xMin/xMax/yMin/yMax/pxWidth/pxHeight`). `drawingDispatch`'s
  `// Containers (Task 18)` arms flip from `return;` no-ops to
  `return renderGroup(...)` / `return renderFrame(...)`. The
  `drawingDispatch.test.ts` describe labels bump:
  `Task-18+ stubs` → `'group' no-op + exhaustiveness`;
  `Tasks 5–17 shipped` → `Tasks 5–18 shipped`.
- **conformance** — 2 new per-kind scenarios (`drawGroup`,
  `drawFrame`) + 1 bundle (`drawContainersAll`, 2 emissions).
  Pinned `drawing-hash` assertions for each:
  - `draw-group`:
    `6e32e387543ef421d1e53c1c15612cc32a814c85c2d969ad86d9f47b8d0359a2`
  - `draw-frame`:
    `4b54e0b6e75ad40904e0f70ac5b34067afa6c1237d43060823889f04b86d900b`
  - `draw-containers-all`:
    `e6ba183dfc04145a5126e6ea75a4cb7117694adc13eea84853239c68810e91fe`
  `TEST_CAPABILITIES.drawings` widens with
  `...capBuilders.allContainerDrawings()`; the `PHASE_1_SCENARIOS`
  `toEqual` array (in `scenarios.test.ts` and `index.test.ts`)
  appends the 3 new scenarios under
  `// Phase 3 Task 18 — Containers.`.

### Divergences from spec (`tasks/phase-3-drawing-parity/18-containers.md`)

1. **Spec § Runtime Notes says `draw.group(children:
   ReadonlyArray<DrawingHandle>)` accepts handle objects.** Landed
   core surface takes `ReadonlyArray<string>` (handle ids) directly
   — the runtime impl uses the landed shape so the wire payload is
   1:1 with what the script passes. Documented in `draw.group`'s
   JSDoc with the canonical `draw.group([a.id, b.id])` pattern.
2. **Spec § Renderer Notes says `group` renders a dashed bounding
   box derived from children's `view.drawingsById.get(childId).state`
   extrema.** Landed `Viewport` exposes no `drawingsById` field;
   adding it is a foundation-level Viewport change beyond a per-port
   task. Phase 3 ships `renderGroup` as a pure no-op (children
   render themselves per `GroupState`'s metadata contract);
   bounding-box envelope deferred to Phase 4.
3. **Spec § Kinds Landed says `group.style: { lineWidth?; color? }`
   for the boundary box.** Landed `GroupState` has no `style` field
   (only `childHandleIds` + optional `meta`). Use the landed shape;
   the boundary-box style lands with the Phase-4 renderer rework.
4. **Spec § Tests says degenerate `frame` anchors are a warning
   diagnostic.** Landed `validateAnchorPair` only enforces finite
   `time`/`price`; degenerate frames pass validation and the
   renderer silently no-ops on `width === 0 || height === 0`. This
   matches the rest of Phase 3's "no-op on degenerate input"
   precedent (gann/fib/elliott/cycles).
5. **Per-kind property tests skipped** — same Tasks 5–17 precedent.
   The per-kind validator describe arms cover happy + wrong-shape
   per kind; the `childHandleIds.length ≤ 100` cap is exercised
   directly in the group describe block.

### Open / deferred

- `GroupState` boundary-box style + `view.drawingsById` plumbing for
  the visible group envelope land in Phase 4 (Divergence §2 + §3).
- `gen-docs` regeneration for `docs/primitives/draw/{group,frame}.md`
  defers to Task 21 (same precedent as Tasks 11–17 — the
  draw-namespace docs walker is Task 21's deliverable).
- Workspace-wide gates (`pnpm typecheck`, `pnpm test` at the root)
  defer to Task 22's phase closeout. Per-package gates
  (adapter-kit / runtime / canvas2d / conformance) all green and
  100% coverage held.
