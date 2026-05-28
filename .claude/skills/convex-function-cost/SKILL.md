---
name: convex-function-cost
description: >-
  Convex function call cost optimization patterns. Use when writing or reviewing
  Convex queries, mutations, or actions to avoid unnecessary cascading function
  calls that incur per-call overhead (validation + JS context isolation).
  Covers helper function extraction, ctx argument passing, QueryCtxOrMutationCtx
  typing, and composite internal function patterns.
---

# Convex Function Call Cost Optimization

## Why This Matters

Every `ctx.runQuery()`, `ctx.runMutation()`, and `ctx.runAction()` sub-call
incurs overhead on Convex. Each sub-call:
- Creates a **new isolated JS context**
- Runs **argument and return value validation**
- Allocates its own system resources

`ctx.runAction()` is explicitly documented as a separate billed function call.
For `ctx.runQuery()`/`ctx.runMutation()` within queries/mutations, they share
the same transaction but still pay the validation + JS context overhead.

A mutation that calls 3 internal queries = **1 transaction** but with
**3x the validation and JS context overhead** vs. plain helper calls.

## The Rule

**Inside queries and mutations, NEVER use `ctx.runQuery()` or
`ctx.runMutation()` for shared logic. Use plain TypeScript helper functions
with `ctx` passed as an argument instead.**

This rule does NOT apply to:
- **Actions** (`action`/`internalAction`) — they have no `ctx.db`, so
  `ctx.runQuery`/`ctx.runMutation` is required
- **HTTP actions** (`httpAction`) — same as actions
- **Cross-runtime calls** — `ctx.runAction` when calling from default runtime
  to `"use node"` runtime
- **Scheduled functions** — `ctx.scheduler.runAfter` is a separate invocation
  by design

## Pattern: Extract Helper Function

### Before (3 sub-calls with overhead):

```typescript
export const updateItem = mutation({
    handler: async (ctx, args) => {
        const user = await ctx.runQuery(internal.users.users.getCurrentUserOrThrow);
        const team = await ctx.runQuery(internal.teams.teamQueries.getTeamInternal, { teamId: args.teamId });
        await ctx.runMutation(internal.items.items.doSubThing, { itemId: args.id });
    }
});
```

### After (zero sub-call overhead):

```typescript
import { getCurrentUserOrThrow } from "../users/userHelpers";
import { getTeamInternal } from "../teams/teamHelpers";
import { doSubThing } from "./itemHelpers";

export const updateItem = mutation({
    handler: async (ctx, args) => {
        const user = await getCurrentUserOrThrow(ctx);
        const team = await getTeamInternal(ctx, args.teamId);
        await doSubThing(ctx, args.id);
    }
});
```

## Typing Helpers

### Read-only helpers (callable from queries AND mutations):

```typescript
import type { QueryCtxOrMutationCtx } from "../lib/ctxTypes";

export async function getTeamById(
    ctx: QueryCtxOrMutationCtx,
    teamId: Id<"teams">,
): Promise<Team | null> {
    return await ctx.db.get(teamId);
}
```

### Write helpers (callable from mutations only):

```typescript
import type { MutationCtx } from "../_generated/server";

export async function touchSpace(
    ctx: MutationCtx,
    spaceId: Id<"spaces">,
): Promise<void> {
    await ctx.db.patch(spaceId, { updatedAt: Date.now() });
}
```

### Keeping thin wrappers for action callers:

```typescript
// Plain helper — used by queries and mutations directly
export async function getCurrentUserOrThrow(
    ctx: QueryCtxOrMutationCtx,
): Promise<User> {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ ... });
    const user = await ctx.db
        .query("users")
        .withIndex("byClerkId", (q) => q.eq("clerkId", identity.subject))
        .unique();
    if (!user) throw new ConvexError({ ... });
    return user;
}

// Thin wrapper — only for action callers that need ctx.runQuery
export const getCurrentUserOrThrowQuery = internalQuery({
    args: {},
    handler: async (ctx) => getCurrentUserOrThrow(ctx),
});
```

## Pattern: Consolidate Action Sub-Calls

When an action needs multiple reads, create a single composite internal query:

### Before (action + 3 sub-queries = 4 function calls):

```typescript
export const processChat = internalAction({
    handler: async (ctx, args) => {
        const chat = await ctx.runQuery(internal.aiChats.getChat, { id: args.chatId });
        const user = await ctx.runQuery(internal.users.getUser, { id: chat.userId });
        const prefs = await ctx.runQuery(internal.users.getPrefs, { userId: user._id });
        // ... process
    }
});
```

### After (action + 1 composite query = 2 function calls):

```typescript
// Composite internal query — returns all needed data in one call
export const getChatContext = internalQuery({
    args: { chatId: v.id("aiChats") },
    handler: async (ctx, { chatId }) => {
        const chat = await ctx.db.get(chatId);
        if (!chat) return null;
        const user = await ctx.db.get(chat.userId);
        const prefs = await ctx.db
            .query("userPreferences")
            .withIndex("byUserId", (q) => q.eq("userId", chat.userId))
            .unique();
        return { chat, user, prefs };
    }
});

export const processChat = internalAction({
    handler: async (ctx, args) => {
        const context = await ctx.runQuery(internal.aiChats.getChatContext, { chatId: args.chatId });
        // ... process with context.chat, context.user, context.prefs
    }
});
```

## Decision Tree

When you see `ctx.runQuery` or `ctx.runMutation`:

1. **Is the caller a `query` or `mutation`?**
   - Yes -> Replace with a plain helper function. Always.
2. **Is the caller an `action` or `httpAction`?**
   - Yes -> Keep `ctx.runQuery`/`ctx.runMutation`, but consolidate multiple
     sequential calls into fewer composite internal queries/mutations.
3. **Is the caller an `action` calling `ctx.runAction`?**
   - Is it crossing runtimes (default -> Node.js)? -> Keep it.
   - Same runtime? -> Replace with a plain TypeScript function call.

## File Organization

Helper functions go in `*Helpers.ts` files following the existing convention:

```
convex/feature/
  feature.ts           # Public query/mutation exports (thin, call helpers)
  featureHelpers.ts    # Plain async helpers with ctx argument
  featureActions.ts    # Actions (still use ctx.runQuery/runMutation)
```
