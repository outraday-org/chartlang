---
"@invinite-org/chartlang-adapter-kit": minor
"@invinite-org/chartlang-runtime": patch
"@invinite-org/chartlang-host-quickjs": patch
"@invinite-org/chartlang-pine-converter": patch
---

Route runtime drawing emissions through the script's resolved pane. Adapters
can now keep converted Pine labels and other `draw.*` marks inside
`overlay: false` indicator panes instead of forcing them onto the price pane.

Preserve standalone Pine label, line, and box constructors at their lexical
callsites, including named label text and text styling. Fractional bar-index
anchors now interpolate between retained bar timestamps so midpoint exit labels
stay visible and aligned with TradingView.
