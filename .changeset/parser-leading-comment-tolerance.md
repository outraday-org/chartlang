---
"@invinite-org/chartlang-pine-converter": patch
---

Tolerate leading comments/blank lines before the version directive and at the
start of an indented block. The parser now skips comment-only / blank lines
(via a new explicit `TokenCursor.skipNewlines()`) before matching
`//@version=6` and before opening an indented block, so a Pine script with a
license header above the directive — or a block whose first physical line is a
comment — parses cleanly. A genuinely missing directive or empty body still
reports `missing-version-directive` / `expected-token`.
