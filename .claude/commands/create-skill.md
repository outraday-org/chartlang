---
description: Create a new skill.
model: opus
---

# Create Skill Command

## Purpose

You are a skill creation specialist focused on building new reusable skills for the Claude Code system. Your task is to create well-documented, structured skills that can be invoked via slash commands (e.g., `/skill-name`) to guide implementation of specific patterns or features.

## Task

1. Understand the skill requirements and what pattern or workflow it should document
2. Create the skill directory and file structure
3. Write comprehensive, step-by-step documentation in the skill file
4. Include code examples, file paths, and checklists
5. Add proper frontmatter with name and description

## File Structure

Skills are located in `.claude/skills/` with the following structure:

```
.claude/skills/
└── <skill-name>/          # Kebab-case directory name
    └── SKILL.md           # Uppercase filename (required)
```

**Important Naming Conventions:**
- Directory name: Use kebab-case (e.g., `add-canvas-shape`, `create-ai-agent`)
- Skill file: Must be named `SKILL.md` (uppercase)
- The skill name in frontmatter should match the directory name

## Frontmatter Format

Every skill file must start with YAML frontmatter:

```yaml
---
name: skill-name
description: Brief description of what this skill does and when to use it.
---
```

**Frontmatter Fields:**
- `name`: Kebab-case skill name matching the directory (required)
- `description`: Clear, concise description of the skill's purpose and when to invoke it (required)

## Skill Content Structure

After the frontmatter, structure your skill documentation as follows:

### 1. Title and Introduction
- Start with a clear H1 title
- Provide a brief overview of what the skill accomplishes

### 2. Architecture Overview (if applicable)
- Include diagrams or folder structure for complex patterns
- Explain how the components fit together

### 3. Step-by-Step Guide
- Number each major step clearly
- Include file paths for every code example
- Show exact code snippets with proper syntax highlighting
- Use inline comments to highlight additions (`// <- add` or `// <-- ADD`)

### 4. Code Examples
- Always include complete, working examples
- Show imports and full context
- Use proper TypeScript types and patterns from the codebase
- Reference existing files as examples when possible

### 5. File Checklist
- End with a checklist of all files that need to be created or modified
- Use checkbox format: `- [ ] path/to/file.ts - Description`

## Best Practices

**Documentation Quality:**
- Write in imperative mood ("Add the shape type", not "You should add")
- Be specific with file paths (absolute paths from project root)
- Include both backend and frontend considerations
- Explain "why" for architectural decisions, not just "what"

**Code Examples:**
- Use real patterns from the existing codebase
- Show full import statements
- Include type definitions and validation
- Demonstrate proper error handling

**Organization:**
- Group related steps together
- Use clear section headers (H2, H3)
- Keep examples close to their explanations
- Cross-reference related skills when applicable

**Maintenance:**
- Keep examples up-to-date with current codebase patterns
- Reference specific files that serve as good examples
- Include version-specific notes if patterns change

## Example Skill Structure

```markdown
---
name: add-ta-primitive
description: Guide for adding a new ta.* primitive including JSDoc tags, the §22.10 set, the conformance scenario, and the changeset. Use when implementing a new technical-analysis primitive in packages/runtime.
---

# Add a `ta.*` Primitive

This skill guides you through adding a new `ta.*` primitive to
`packages/runtime`, satisfying every gate in one PR.

## Overview

A new `ta.*` primitive requires:
1. Source file under `packages/runtime/src/ta/<id>.ts` with MIT header
2. JSDoc with `@example`, `@since`, stability marker, `@formula`,
   `@anchors`, and `@warmup`
3. Unit, property (fast-check), golden, and bench tests
4. Conformance scenario under `packages/conformance/scenarios/`
5. Auto-generated docs page (do **not** hand-edit)
6. Changeset (`pnpm changeset`)

## Step-by-Step Guide

### 1. Add the source file

\`\`\`typescript
// packages/runtime/src/ta/rsi.ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Series } from "@invinite-org/chartlang-core";

/**
 * Relative Strength Index.
 *
 * @formula RSI(n) = 100 - 100 / (1 + RS); RS = AvgGain(n) / AvgLoss(n)
 * @anchors series.close
 * @warmup n bars
 * @example
 *   const r = ta.rsi(series.close, 14);
 * @since 0.1.0
 * @experimental
 */
export function rsi(source: Series, length: number): number {
  // implementation
}
\`\`\`

### 2. Add the tests

- Unit: `packages/runtime/src/ta/rsi.test.ts`
- Property: `packages/runtime/src/ta/rsi.property.test.ts` (fast-check)
- Golden: `packages/runtime/src/ta/__goldens__/rsi.json`
- Bench: `packages/runtime/src/ta/rsi.bench.ts`

### 3. Add the conformance scenario

\`\`\`typescript
// packages/conformance/scenarios/rsi.ts
// ... scenario definition that adapters can re-run
\`\`\`

### 4. Regenerate the primitive docs page

\`\`\`bash
pnpm tsx packages/cli/src/gen-docs.ts
\`\`\`

This regenerates `docs/primitives/ta/rsi.md`. **Never hand-edit** that
file.

### 5. Add the changeset

\`\`\`bash
pnpm changeset
# pick @invinite-org/chartlang-runtime, semver bump = minor (new export)
\`\`\`

## File Checklist

- [ ] `packages/runtime/src/ta/rsi.ts` — implementation + JSDoc
- [ ] `packages/runtime/src/ta/rsi.test.ts` — unit
- [ ] `packages/runtime/src/ta/rsi.property.test.ts` — property
- [ ] `packages/runtime/src/ta/__goldens__/rsi.json` — golden bars
- [ ] `packages/runtime/src/ta/rsi.bench.ts` — bench
- [ ] `packages/conformance/scenarios/rsi.ts` — conformance
- [ ] `docs/primitives/ta/rsi.md` — **auto-generated**, do not hand-edit
- [ ] `.changeset/<name>.md` — minor bump on `@invinite-org/chartlang-runtime`
```

## Execution Strategy

**Discovery Phase:**
1. Examine existing skills in `.claude/skills/` to understand patterns
2. Identify similar features or components that can serve as examples
3. Gather requirements for what the skill should document

**Creation Phase:**
1. Create directory: `.claude/skills/<skill-name>/`
2. Create file: `.claude/skills/<skill-name>/SKILL.md`
3. Add frontmatter with name and description
4. Write comprehensive documentation following the structure above

**Validation Phase:**
1. Verify all file paths are correct and match current codebase structure
2. Test code examples for syntax correctness
3. Ensure checklist is complete
4. Confirm the skill can be invoked via `/skill-name`

## Skills Directory Location

**Skills Location:** `.claude/skills/`

Each skill lives in its own subdirectory with the `SKILL.md` file
containing all documentation.

**Related Files:**

- `.claude/commands/` — command files that orchestrate skills

## Constraints

- Skill files must be named `SKILL.md` (uppercase)
- Directory names must use kebab-case
- Frontmatter name must match directory name
- All code examples must use TypeScript with proper types and the MIT
  header where they live under `packages/*/src/`
- File paths must be project-root-relative
- Always include a file checklist at the end
- Skills must reflect chartlang conventions: §22.4 package template,
  100% coverage gate, JSDoc gate, README gate, conformance scenarios
  for adapter / primitive surface changes, changesets for
  `packages/*/src/` changes, provenance header for `../invinite/` ports

## Common Skill Types

- **add-***: Skills for adding new artifacts (e.g. `add-ta-primitive`,
  `add-draw-primitive`, `add-adapter`)
- **create-***: Skills for creating new packages or scaffolding-heavy
  surfaces (e.g. `create-package`, `create-host`)
- **explain-***: Skills that explain existing patterns (e.g.
  `explain-compiler-passes`, `explain-capability-surface`)
- **port-***: Skills for porting from `../invinite/` with the provenance
  workflow

Choose the appropriate prefix based on the skill's purpose.
