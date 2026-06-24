---
---

Bring the lightweight-charts reference adapter's plot rendering to feature
parity: forward `plot.color` to BOTH `filled-band` edge series (the same
colour-drop the line path had); fold an `area` plot's `fillAlpha` into the
Area series' `lineColor` + `topColor`/`bottomColor` gradient; render the five
glyph kinds distinctly instead of one hardcoded blue circle — native LC v5
markers where the plugin can express the shape (`arrow` → `arrowUp`/`arrowDown`,
`marker`/`shape` circle/square, `character`/`label` as text markers, with real
position/colour/size), and the canvas overlay (via the shared
`@invinite-org/chartlang-adapter-kit/canvas` glyph helper, NOT a hand-port) for
the rest (triangle / diamond / cross / xcross / flag); and recolour
`candle-override` PER BAR by direction (`close > open ⇒ bull`, `< ⇒ bear`, else
`doji ?? bull`) on the candlestick data point — body + border + wick — instead
of a whole-series tint, with a same-bar `bar-color`/`bar-override` winning. The
`MockLwcApi` `setMarkers` recorder now captures the full marker payload
(shape / position / text / colour / size), not just the count, with the
`LwcRecordedCall` union + `canonicalise` grown in lockstep. Private example
package — no published surface; empty changeset.
