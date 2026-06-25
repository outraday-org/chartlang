---
"@invinite-org/chartlang-adapter-kit": patch
---

Scale the screen-space `draw.table` HUD by `Viewport.pxRatio` so it renders at
its intended physical size on device-pixel canvases.

`decomposeTable` authors its cell / font / padding / border sizes in CSS pixels
but resolves positions against `Viewport.pxWidth`/`pxHeight`. On a device-px
adapter (uplot, lightweight-charts paint into an unscaled device-px canvas) a
`12px` table font rendered at `12` device px — half physical size on a Retina
(dpr 2) display. `Viewport` gains an optional `pxRatio` (default `1`);
`decomposeTable` multiplies all table sizes by it, so a device-px adapter that
sets `pxRatio` to its device-pixel ratio renders the HUD at the same physical
size as a CSS-px adapter (canvas2d, konva, webgl). World-anchored geometry is
unaffected.

With `pxRatio` omitted (`1`) the decomposer output is byte-identical to before,
so every pinned adapter golden (none carry a table) is untouched. The bundled
uplot / lightweight-charts example adapters now pass their device-pixel ratio
onto the viewport; the echarts / konva example adapters fix the same
`draw.table` rendering through adapter-local changes (off-screen positioning,
zrender default-black fill, and Konva text-anchor alignment).
