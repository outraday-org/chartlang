# GL context + program + program-cache + VAO + geometry

> **Status: TODO**

## Goal

Port invinite's low-level WebGL2 plumbing: the context wrapper
(`gl-context.ts`), the shader-compile/link `Program` abstraction
(`program.ts`), the per-gl lazy `program-cache.ts`, the `Vao` wrapper
(`vao.ts`), and the static `geometry.ts` quads. This is the GPU
foundation every program in later tasks builds on.

## Prerequisites

Task 1 (package exists, factory surface defined).

## Current Behavior

The webgl adapter has a capabilities-only factory; no GL plumbing.

## Desired Behavior

`src/webgl/` contains the context + program + cache + VAO + geometry
primitives, faithfully ported, browser-only at the `gl.*` boundary but
with pure parts (option constants, shader-source assembly hooks)
unit-tested.

## Requirements

1. **`src/webgl/gl-context.ts`** — port `getContext("webgl2", CONTEXT_OPTIONS)`
   with `{ alpha:true, antialias:true, premultipliedAlpha:true,
   preserveDrawingBuffer:false }` (MSAA on the default framebuffer — the
   core of the "smooth" look). Port `resize(cssW, cssH, dpr)` (the SINGLE
   device-px rounding site contract), the `MAX_CANVAS_PX = 16384` clamp
   guard, and `dispose()` (no `loseContext()`; explicit resource cleanup).
   Throw a typed error when `getContext("webgl2")` returns null (carry a
   remediation hint, as invinite does). Accept an injected
   `WebGL2RenderingContext` (the `opts.gl` test seam from Task 1) so a
   browser test can supply a real or stub context.

2. **`src/webgl/program.ts`** — port the `Program` class: compile vertex
   + fragment shaders, link, cache uniform/attribute locations, typed
   `setUniform1f/2f/3f/4f/Matrix3fv/...` setters, `use()`, `dispose()`.
   Surface shader-compile/link errors with the shader source + info log.

3. **`src/webgl/program-cache.ts`** — port the per-`gl` lazy singleton
   registry (`getProgram(gl, key, factory)`), so programs are
   instantiated once per context and reused across panes; cleared on
   dispose. Handles same-canvas remounts.

4. **`src/webgl/vao.ts`** — port the `Vao` wrapper:
   `new Vao(gl, layouts)` → `createVertexArray` + per-layout
   `bindBuffer`/`enableVertexAttribArray`/`vertexAttribPointer`/optional
   `vertexAttribDivisor`; `bind()`/`unbind()`/`dispose()`.

5. **`src/webgl/geometry.ts`** — port the static `UNIT_QUAD_TRIANGLE_STRIP`
   + `Y_ZERO_QUAD_TRIANGLE_STRIP` Float32Arrays (uploaded `STATIC_DRAW`).

6. **Provenance header** (§8 of README) on every file. Drop invinite's
   React/bus coupling; keep the pure WebGL2 surface.

7. **Tests (headless where possible).** Unit-test: `CONTEXT_OPTIONS` is
   the exact bag; `resize` device-px rounding math (pure — extract the
   rounding into a pure helper if needed and test it); the
   `MAX_CANVAS_PX` clamp; the program-cache returns the same instance for
   the same key and a fresh one per gl. The raw `gl.*` calls (compile,
   link, VAO binding) are browser-only and NOT unit-tested in node
   (acceptable — not coverage-gated). Where a stub `WebGL2RenderingContext`
   is cheap to fake (records `createShader`/`shaderSource`/etc. calls),
   add a light fake to cover the `Program`/`Vao` call sequence.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `examples/webgl-adapter/src/webgl/gl-context.ts` | Create | WebGL2 context + resize + dispose |
| `examples/webgl-adapter/src/webgl/program.ts` | Create | Shader compile/link + uniforms |
| `examples/webgl-adapter/src/webgl/program-cache.ts` | Create | Per-gl lazy program registry |
| `examples/webgl-adapter/src/webgl/vao.ts` | Create | Vertex array object wrapper |
| `examples/webgl-adapter/src/webgl/geometry.ts` | Create | Static unit-quad geometry |
| `examples/webgl-adapter/src/webgl/*.test.ts` | Create | Pure-math + call-sequence tests |

## Gates

- `pnpm typecheck` · `pnpm lint` · `pnpm format:check` · `pnpm test`
- `pnpm conformance` (unchanged — still capabilities-only default)

## Changeset

None (private example package).

## Acceptance Criteria

- Context wrapper enables `antialias:true` MSAA, clamps to 16384 px, and
  has the single device-px rounding site.
- `Program` / `Vao` / `program-cache` / `geometry` ported with
  provenance headers; React/bus coupling removed.
- Pure rounding + cache + options logic unit-tested; build + typecheck +
  lint green; no npm chart-lib dependency added.
