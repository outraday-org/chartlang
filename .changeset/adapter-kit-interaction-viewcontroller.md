---
"@invinite-org/chartlang-adapter-kit": minor
---

Add a library-agnostic pan/zoom interaction layer under `src/interaction/`,
exported from the root entry. `createViewController()` holds a user x-window +
`userInteracted` flag with pure `resolveXWindow` / `zoomAt` / `panBy` / `reset`
transforms (auto-follow live data until the first gesture, then hold the held
window, clamped to the data bounds — zoom-out cannot exceed all-data).
`yRangeInWindow(candidates, win)` is the shared "auto-fit the price scale to
the visible window" helper. `attachInteraction(el, handlers)` wires
wheel→zoom / drag→pan / dblclick→reset onto a DOM element (the listener
plumbing is the only DOM-bound part; the decision cores `onWheelCore` /
`onDragCore` / `onDblCore` are pure). The four example adapters (canvas2d,
konva, uplot, echarts) consume these for consistent zoom + drag + auto-fit.
