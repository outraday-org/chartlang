---
name: code-quality-analysis
description: |
  Analyzes code quality, reusability, and Convex type patterns. Use this skill when:
  - User mentions "code quality", "complexity", "tech debt", or "maintainability"
  - User asks about "duplicates", "reusability", "deduplication", or "type patterns"
  - User asks about Convex validator extraction or `Infer<typeof>` patterns
  - Before/after refactoring or when reviewing code changes
allowed-tools: Bash, Read, Glob, Grep, Edit, Write
---

# Code Quality & Reusability Analysis

You are an expert code quality analyzer combining PMAT static analysis, reusability/deduplication scanning, and Convex type pattern enforcement for this codebase.

## When to Activate

1. User asks about code quality, complexity, tech debt, or maintainability
2. User asks about duplicates, reusability, or "search before creating"
3. User asks about Convex type patterns, validator extraction, or `Infer<typeof>`
4. Before/after refactoring or when reviewing code changes

## Section 1: PMAT Static Analysis

### Commands

| Command | Purpose |
|---------|---------|
| `pmat analyze quality --path <path>` | Overall health score, complexity, maintainability |
| `pmat analyze complexity --path <path>` | Cyclomatic + cognitive complexity per function |
| `pmat analyze dead-code --path <path>` | Unused functions, variables, imports |
| `pmat analyze satd --path <path>` | TODO, FIXME, HACK comment detection |

### Thresholds

| Metric | Threshold | Action |
|--------|-----------|--------|
| Cyclomatic complexity | >10 | Refactor — extract methods |
| Cognitive complexity | >15 | High mental load — simplify |
| Maintainability index | <50 | Poor — needs attention |
| SATD annotations | >5 per file | High tech debt — triage |

## Section 2: Reusability & Deduplication

### Scan Priorities

1. `/src/components/` — UI component duplication
2. `/src/api/hooks/` — Data fetching pattern inconsistencies
3. `/convex/` — Backend function duplication
4. `/src/lib/` — Utility function overlap
5. `/src/components/project/shapes/` — Canvas shape pattern inconsistencies

### What to Scan For

- **Duplicated logic**: Similar functions, copy-pasted patterns across files
- **Dead code**: Unused exports, unreachable branches, orphaned files
- **Inconsistent patterns**: Same thing done different ways
- **TODO/FIXME/HACK comments**: Deferred work (overlaps with PMAT SATD)
- **Over-engineering**: Unnecessary abstractions, unused flexibility
- **Frontend types duplicating Convex types**: Manual type definitions that should use `Doc<"table">` or `Id<"table">`

### Search-Before-Creating Checklist

Before creating anything new, check these locations (mirrors CLAUDE.md):

| Looking for… | Search first |
|--------------|-------------|
| UI components | `/src/components/ui/`, `/src/components/` |
| Hooks | Nearest `hooks/`, `/src/api/hooks/` |
| Utilities | `/src/lib/`, feature-specific `lib/` |
| Types | `/convex/` for backend, nearest `types/` for frontend |
| Convex functions | `/convex/` — reuse via `ctx.runQuery/Mutation/Action` |
| Constants/enums | Feature-specific `constants/`, `pnpm gen:metric-trees` |

### Detection Commands

```bash
# Duplicate functions across utility locations
Grep for function/export name across /src/lib/ and /src/components/**/lib/

# Duplicate hooks across all hooks directories
Grep for hook name across all hooks/ dirs

# Duplicate components
Glob for component name across /src/components/

# Orphaned exports (exported but never imported)
Grep for export name, check if imported anywhere
```

### Best Practices

- Focus on patterns that cause real maintenance burden, not cosmetic issues
- Prefer extracting shared abstractions over picking one duplicate as canonical
- Consider whether a "duplication" is actually intentional variation
- Group related findings by root cause
- Present as prioritized list with impact (high/medium/low)

## Section 3: Convex Type Pattern Enforcement

### Pattern A: Extracted Validators

Reference: `convex/projects/types/viewportBookmark.ts`

```typescript
import type { Infer } from "convex/values";
import { v } from "convex/values";

export const vViewportCamera = v.object({ x: v.number(), y: v.number(), z: v.number() });
export type ViewportCamera = Infer<typeof vViewportCamera>;

export const vViewportBookmark = v.object({
    id: v.string(),
    name: v.string(),
    pageId: v.string(),
    camera: vViewportCamera,
    createdAt: v.number()
});
export type ViewportBookmark = Infer<typeof vViewportBookmark>;
```

**Rules:**
- `v` prefix on all validators (`vMyType`)
- Derive types with `Infer<typeof vMyType>` — never write types manually
- Place in `/convex/<feature>/types/*.ts`
- Import validators into `schema.ts`

### Pattern B: Discriminated Unions

Reference: `convex/companyLists/types.ts`

```typescript
export const vCompanyListItemTicker = v.object({
    type: v.literal(CompanyListItemType.TICKER),
    ticker: v.string()
});
export type CompanyListItemTicker = Infer<typeof vCompanyListItemTicker>;

export const vCompanyListItemSection = v.object({
    type: v.literal(CompanyListItemType.SECTION),
    id: v.string(),
    name: v.string()
});
export type CompanyListItemSection = Infer<typeof vCompanyListItemSection>;

export const vCompanyListItem = v.union(vCompanyListItemTicker, vCompanyListItemSection);
export type CompanyListItem = Infer<typeof vCompanyListItem>;
```

### Pattern C: Enum + Validator

Reference: `convex/aiChats/types/aiChatStatus.ts`

```typescript
export const AI_CHAT_STATUSES = ["idle", "streaming", "error", "stopped"] as const;
export type AiChatStatus = (typeof AI_CHAT_STATUSES)[number];
export const vAiChatStatus = v.union(
    v.literal("idle"),
    v.literal("streaming"),
    v.literal("error"),
    v.literal("stopped")
);
```

### Pattern D: Dual Convex + Zod

Reference: `convex/agent/types/messageTypes.ts`

**ONLY use when** data crosses a `v.any()` boundary or needs runtime parsing (AI streaming, external APIs). **NOT** the default for every type.

```typescript
// Convex validator — for schema/functions
export const vTextPart = v.object({
    type: v.literal("text"),
    text: v.string(),
});

// Zod schema — for runtime parsing of external data
export const TextPartSchema = z.object({
    type: z.literal("text"),
    text: z.string(),
});
export type TextPart = z.infer<typeof TextPartSchema>;
```

### Anti-Patterns to Flag

| Anti-pattern | Fix |
|-------------|-----|
| Inline `v.object({...})` in `schema.ts` | Extract to `/convex/<feature>/types/*.ts` |
| Inline complex `v.object({...})` in mutation/query `args` | Extract to shared validator |
| Manually written types instead of `Infer<typeof>` | Derive from validator |
| Missing `v` prefix on validators | Rename to `vMyType` |
| Zod schemas where only Convex validators are needed | Remove Zod, use Convex only |

## Section 4: Quick Checklist

```
[ ] PMAT quality + complexity on changed files
[ ] SATD: check for new TODO/FIXME/HACK
[ ] Duplicates: Grep function/hook/component names across codebase
[ ] Schema: no new inline v.object({}) in schema.ts
[ ] Types: new validators use Infer<typeof> in types/ files
[ ] Zod: only present where v.any() boundary exists
[ ] Imports: no frontend types duplicating Convex Doc<>/Id<> types
```
