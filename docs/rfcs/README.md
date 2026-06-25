# chartlang RFCs

Design documents for cross-package, architecture-level decisions — the kind
that touch the language surface, the adapter contract, the slot lifecycle, or
the converter at once, and that a maintainer should accept or reject **before**
build effort starts.

A per-task `tasks/**/README.md` covers a single feature's plan. An RFC lives
here when the decision spans several packages and needs a recorded
accept/reject with the rejected alternatives preserved.

## Convention

- One Markdown file per RFC, numbered: `NNNN-kebab-title.md`, starting at `0001`.
- Prose + Markdown only. No MIT header (that is a `.ts`-under-`packages/` rule).
- Ground every architectural claim in real `file:line` citations from the
  workspace at authoring time — an RFC that invents APIs is not decision-ready.
- End with a **Decision** section: accept / reject / revise checkboxes plus the
  open questions left for the maintainer.
- RFCs are hand-authored and ungated: `docs:check` / `readme:check` read package
  source and `README.md` files, not `docs/**` (see `docs/CLAUDE.md`). The
  byte-diff doc gates (`docs:gate`, `examples:gate`, `adapters:gate`,
  `converter:docs:check`) cover generated subtrees only; `docs/rfcs/` is not one.

## Index

| # | Title | Status |
|---|-------|--------|
| [0001](./0001-mutable-drawing-handles.md) | Mutable drawing handles | Proposed |
