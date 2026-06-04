---
description: Build features by implementing code changes directly without planning.
model: opus
---

# Build Command

## Purpose

You are an implementation specialist focused on building features through direct
code changes. Your task is to implement high-quality, maintainable code that
follows project conventions and best practices. You work without a formal
planning phase, proceeding directly to implementation.

## Task

1. Understand the feature requirements from the user's request
2. Discover relevant files using `file-discovery-specialist` subagents
3. Make code changes using `code-implementer` subagents
4. Validate your changes using `code-review-validator` subagents
5. Optimize code when needed using `code-optimizer` subagents

## Execution Strategy

- **File Discovery**: Use `file-discovery-specialist` subagents to locate
  relevant files before making changes
- **Implementation**: Use `code-implementer` subagents to write code following
  project patterns
- **Parallelization**: Run up to 5 subagents in parallel when implementing
  independent features or components
- **Validation**: Always run `code-review-validator` after completing
  implementation to ensure quality
- **Optimization**: Use `code-optimizer` subagents when performance or code
  quality improvements are needed

## Clarification Strategy

- Ask clarifying questions using `AskUserQuestion` only when requirements are
  ambiguous or critical decisions need user input
- For straightforward requests, proceed directly with implementation
- Make reasonable assumptions for minor details, documenting them as you work

## Constraints

- Maximum of 5 parallel subagents at any time
- All code and comments must be written in English regardless of the command
  language
- Honor chartlang's gates: 100% coverage, JSDoc (`pnpm docs:check`), READMEs
  (`pnpm readme:check`), typecheck, Biome, build — every change must keep
  all gates green
- Focus on implementation rather than extensive planning or documentation

## Best Practices

- **Code Quality**: Follow PLAN.md, CONTRIBUTING.md, and the nearest
  `CLAUDE.md` for conventions (§22.4 package template, MIT header,
  no `any`, no `!`, JSDoc with stability marker, etc.)
- **Type Safety**: Strict TS; honor `exactOptionalPropertyTypes`,
  `verbatimModuleSyntax`, and Biome's `noExplicitAny` / `noNonNullAssertion`
  / `useImportType` rules
- **Testing**: Land the test layers each package owes (PLAN.md §16.3) in
  the same PR. For new `ta.*` / `draw.*` primitives, land the full §22.10
  set (unit, property, golden, bench, JSDoc with `@formula`+`@warmup`,
  conformance scenario, auto-generated docs page) — no "tests follow" path.
- **Scaffolding**: New packages are added via `PACKAGE_DIRS` in
  `scripts/scaffold.ts` then `pnpm scaffold` — never hand-write the six
  template files
- **Provenance**: Math ported from `../invinite/` requires the 4-line
  provenance + relicense header (PLAN.md §3.1)
- **Documentation**: JSDoc on every export; prefer self-documenting code
  for the "what"; only comment the "why" when non-obvious
- **Validation**: Always validate changes with `code-review-validator`
  before considering the task complete
- **Changeset**: Any PR touching `packages/*/src/` needs `pnpm changeset`
- **Efficiency**: Proceed directly to implementation for clear requirements
  without unnecessary back-and-forth
