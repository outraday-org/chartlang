---
"@invinite-org/chartlang-cli": patch
---

Remove the `AUTO_GENERATED_HEADER` sentinel from generated primitive docs
pages. The docs site renders with `markdown.html: false`, so the leading
`<!-- AUTO-GENERATED ... -->` HTML comment surfaced as visible text at the
top of every page. Generated pages now open directly with their `# ` title
heading. The `AUTO_GENERATED_HEADER` export is removed from
`@invinite-org/chartlang-cli` — it was a human marker only, never a
functional overwrite guard, so the `docs:gate` byte-diff still protects
against drift.
