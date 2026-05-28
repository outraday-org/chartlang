---
name: create-convex-function
description: Guide for creating Convex queries, mutations, and actions with proper validators, authorization patterns, and error handling. Use when adding new backend functions.
---

# Create Convex Function

This skill guides you through creating Convex queries, mutations, and actions.

## Function Types Overview

| Type | Purpose | Database Access | External APIs |
|------|---------|-----------------|---------------|
| `query` | Read data (public) | Yes | No |
| `internalQuery` | Read data (private) | Yes | No |
| `mutation` | Write data (public) | Yes | No |
| `internalMutation` | Write data (private) | Yes | No |
| `action` | External APIs (public) | Via ctx.runQuery/Mutation | Yes |
| `internalAction` | External APIs (private) | Via ctx.runQuery/Mutation | Yes |

## Team-Scoped Authorization

All resources are team-scoped. Use these helpers from `convex/teams/teamAuth.ts`:

```typescript
import {
    assertResourceAccess,
    assertResourceEditAccess,
    assertResourceDeleteAccess,
} from "../teams/teamAuth";
import { TeamAction } from "../teams/teamPermissions";

// For reads — checks TeamAction.VIEW_RESOURCE (any member can view)
const { user, membership, teamId } = await assertResourceAccess(
    ctx, args.teamId, TeamAction.VIEW_RESOURCE,
);

// For edits — smart: checks EDIT_RESOURCE if owner, EDIT_ANY_RESOURCE if not
const { user, membership, teamId } = await assertResourceEditAccess(
    ctx, resource.teamId, resource.userId,
);

// For deletes — checks DELETE_OWN_RESOURCE if owner, DELETE_ANY_RESOURCE if not
const { user, membership, teamId } = await assertResourceDeleteAccess(
    ctx, resource.teamId, resource.userId,
);
```

### Team Context Resolution

For actions that need to resolve which team the user belongs to:

```typescript
import { internal } from "../_generated/api";

// Resolves teamId — uses personal team as fallback if teamId not provided
const { user, teamId } = await ctx.runQuery(
    internal.teams.teamHelpers.resolveTeamContext,
    { teamId: args.teamId },
);
```

## Query Pattern

```typescript
// convex/feature/feature.ts
import { v } from "convex/values";
import { query, internalQuery } from "../_generated/server";
import { assertResourceAccess } from "../teams/teamAuth";
import { TeamAction } from "../teams/teamPermissions";

// Public query — team-scoped
export const listItems = query({
    args: {
        teamId: v.id("teams"),
        status: v.optional(v.union(
            v.literal("active"),
            v.literal("archived")
        )),
        limit: v.optional(v.number())
    },
    handler: async (ctx, args) => {
        // Team auth — any member can view
        const { teamId } = await assertResourceAccess(
            ctx, args.teamId, TeamAction.VIEW_RESOURCE,
        );

        // Always use index for queries
        if (args.status) {
            return await ctx.db
                .query("items")
                .withIndex("byTeamIdAndStatus", (q) =>
                    q.eq("teamId", teamId).eq("status", args.status as string)
                )
                .order("desc")
                .take(args.limit ?? 50);
        }

        return await ctx.db
            .query("items")
            .withIndex("byTeamId", (q) => q.eq("teamId", teamId))
            .order("desc")
            .take(args.limit ?? 50);
    }
});

// Internal query — only callable from other Convex functions
export const getItemByIdInternal = internalQuery({
    args: { id: v.id("items") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.id);
    }
});

// Search query
export const searchItems = query({
    args: {
        teamId: v.id("teams"),
        searchQuery: v.string(),
        limit: v.optional(v.number())
    },
    handler: async (ctx, args) => {
        await assertResourceAccess(ctx, args.teamId, TeamAction.VIEW_RESOURCE);

        return await ctx.db
            .query("items")
            .withSearchIndex("search_name", (q) =>
                q.search("name", args.searchQuery)
                    .eq("teamId", args.teamId)
            )
            .take(args.limit ?? 20);
    }
});
```

## Mutation Pattern

```typescript
// convex/feature/feature.ts
import { v, ConvexError } from "convex/values";
import { mutation, internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { ConvexErrorSeverity } from "../enums";
import {
    assertResourceAccess,
    assertResourceEditAccess,
    assertResourceDeleteAccess,
} from "../teams/teamAuth";
import { TeamAction } from "../teams/teamPermissions";

// Create mutation — team-scoped
export const createItem = mutation({
    args: {
        teamId: v.id("teams"),
        name: v.string(),
        data: v.optional(v.any())
    },
    returns: v.id("items"),
    handler: async (ctx, args) => {
        const { user, teamId } = await assertResourceAccess(
            ctx, args.teamId, TeamAction.CREATE_RESOURCE,
        );

        return await ctx.db.insert("items", {
            teamId,
            userId: user._id,
            name: args.name,
            status: "active",
            data: args.data ?? null,
            updatedAt: Date.now()
        });
    }
});

// Update mutation — ownership-aware auth
export const updateItem = mutation({
    args: {
        id: v.id("items"),
        name: v.optional(v.string()),
        status: v.optional(v.string()),
        data: v.optional(v.any())
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const item = await ctx.db.get(args.id);
        if (!item) {
            throw new ConvexError({
                severity: ConvexErrorSeverity.MEDIUM,
                message: "Item not found"
            });
        }

        // Smart auth: EDIT_RESOURCE if owner, EDIT_ANY_RESOURCE if admin
        await assertResourceEditAccess(ctx, item.teamId, item.userId);

        const update: Record<string, unknown> = {
            updatedAt: Date.now()
        };

        if (args.name !== undefined) update.name = args.name;
        if (args.status !== undefined) update.status = args.status;
        if (args.data !== undefined) update.data = args.data;

        await ctx.db.patch(args.id, update);
        return null;
    }
});

// Delete mutation — ownership-aware auth
export const deleteItem = mutation({
    args: { id: v.id("items") },
    returns: v.null(),
    handler: async (ctx, args) => {
        const item = await ctx.db.get(args.id);
        if (!item) {
            throw new ConvexError({
                severity: ConvexErrorSeverity.MEDIUM,
                message: "Item not found"
            });
        }

        // Smart auth: DELETE_OWN_RESOURCE if owner, DELETE_ANY_RESOURCE if admin
        await assertResourceDeleteAccess(ctx, item.teamId, item.userId);

        await ctx.db.delete(args.id);
        return null;
    }
});

// Internal mutation — no auth needed
export const createItemInternal = internalMutation({
    args: {
        teamId: v.id("teams"),
        userId: v.id("users"),
        name: v.string(),
        data: v.any()
    },
    returns: v.id("items"),
    handler: async (ctx, args) => {
        return await ctx.db.insert("items", {
            teamId: args.teamId,
            userId: args.userId,
            name: args.name,
            status: "active",
            data: args.data,
            updatedAt: Date.now()
        });
    }
});
```

## Action Pattern

> **Cost optimization:** Inside queries and mutations, replace
> `ctx.runQuery(internal.xxx)` / `ctx.runMutation(internal.xxx)` calls with
> plain helper functions that accept `ctx` as an argument. Each cascading call
> incurs per-call overhead. See the `convex-function-cost` skill.

```typescript
// convex/feature/featureActions.ts
"use node";  // Required for Node.js APIs

import { v } from "convex/values";
import { action, internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

// Plain helper function — reusable server-side
async function fetchExternalData(query: string): Promise<ExternalData> {
    const response = await fetch(`https://api.example.com/data?q=${encodeURIComponent(query)}`);
    if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
    }
    return response.json();
}

// Public action with team context
export const getExternalDataAction = action({
    args: {
        teamId: v.optional(v.id("teams")),
        query: v.string()
    },
    returns: v.any(),
    handler: async (ctx, args) => {
        // Resolve team context (actions can't call assertResourceAccess directly)
        const { user, teamId } = await ctx.runQuery(
            internal.teams.teamHelpers.resolveTeamContext,
            { teamId: args.teamId },
        );

        // Fetch external data
        const data = await fetchExternalData(args.query);

        // Store result via mutation
        await ctx.runMutation(internal.feature.feature.createItemInternal, {
            teamId,
            userId: user._id,
            name: args.query,
            data
        });

        return data;
    }
});

// Internal action for cron jobs
export const syncExternalDataInternal = internalAction({
    args: {},
    returns: v.null(),
    handler: async (ctx) => {
        const items = await ctx.runQuery(internal.feature.feature.getItemsToSync);

        for (const item of items) {
            try {
                const data = await fetchExternalData(item.query);
                await ctx.runMutation(internal.feature.feature.updateItemData, {
                    id: item._id,
                    data
                });
            } catch (error) {
                console.error(`Failed to sync item ${item._id}:`, error);
            }
        }

        return null;
    }
});
```

## Pagination Pattern

```typescript
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "../_generated/server";
import { assertResourceAccess } from "../teams/teamAuth";
import { TeamAction } from "../teams/teamPermissions";

export const listItemsPaginated = query({
    args: {
        teamId: v.id("teams"),
        status: v.optional(v.string()),
        paginationOpts: paginationOptsValidator
    },
    handler: async (ctx, args) => {
        const { teamId } = await assertResourceAccess(
            ctx, args.teamId, TeamAction.VIEW_RESOURCE,
        );

        return await ctx.db
            .query("items")
            .withIndex("byTeamIdAndUpdatedAt", (q) => q.eq("teamId", teamId))
            .order("desc")
            .paginate(args.paginationOpts);

        // Returns: { page: Doc[], isDone: boolean, continueCursor: string }
    }
});
```

## Validator Reference

```typescript
import { v } from "convex/values";

// Primitives
v.string()
v.number()
v.boolean()
v.null()
v.int64()      // For bigint
v.bytes()      // For ArrayBuffer

// IDs
v.id("tableName")

// Optionals
v.optional(v.string())

// Arrays
v.array(v.string())
v.array(v.object({ name: v.string() }))

// Objects
v.object({
    name: v.string(),
    age: v.number(),
    email: v.optional(v.string())
})

// Unions
v.union(v.string(), v.number())
v.union(
    v.literal("active"),
    v.literal("inactive"),
    v.literal("archived")
)

// Literals
v.literal("specific-value")

// Records (dynamic keys)
v.record(v.string(), v.number())
v.record(v.id("users"), v.object({ score: v.number() }))

// Any (use sparingly)
v.any()
```

## Function Calling

```typescript
// From query/mutation/action
await ctx.runQuery(api.feature.feature.listItems, { teamId });
await ctx.runQuery(internal.feature.feature.getItemInternal, { id });

// From mutation/action
await ctx.runMutation(api.feature.feature.createItem, { teamId, name });
await ctx.runMutation(internal.feature.feature.createItemInternal, { teamId, userId, name });

// From action only
await ctx.runAction(api.feature.feature.getExternalDataAction, { teamId, query });
await ctx.runAction(internal.feature.feature.syncExternalDataInternal, {});
```

## Error Handling

```typescript
import { ConvexError } from "convex/values";
import { ConvexErrorSeverity } from "../enums";

// Throw typed error
throw new ConvexError({
    severity: ConvexErrorSeverity.HIGH,
    message: "User not found"
});

throw new ConvexError({
    severity: ConvexErrorSeverity.MEDIUM,
    message: "Item not found",
    itemId: args.id  // Additional context
});

// Severity levels
export enum ConvexErrorSeverity {
    LOW = "low",       // Informational
    MEDIUM = "medium", // User error
    HIGH = "high"      // System error
}
```

## File Organization

```
convex/
├── feature/
│   ├── feature.ts       # Main queries/mutations
│   ├── featureActions.ts # Actions (with "use node")
│   ├── types.ts         # Type definitions and validators
│   └── lib/
│       └── helpers.ts   # Helper functions
├── teams/
│   ├── teamAuth.ts      # assertResourceAccess, assertResourceEditAccess, etc.
│   ├── teamPermissions.ts # TeamAction enum, role hierarchy
│   └── teamHelpers.ts   # resolveTeamContext, resolveTeamIdForUser
```

## Best Practices

1. **Always include `args` and `returns` validators**
2. **Use `returns: v.null()` for void functions**
3. **Always update `updatedAt: Date.now()` in mutations**
4. **Use team-scoped auth** — `assertResourceAccess` for reads, `assertResourceEditAccess` for edits, `assertResourceDeleteAccess` for deletes
5. **Include `teamId` as a standard arg** in public queries and mutations
6. **Use indexes for all queries — never use `.filter()`**
7. **Add `"use node"` at top of file** for actions using Node.js APIs
8. **Never use `ctx.runQuery/Mutation` in queries/mutations** — use plain helper
   functions with `ctx` argument instead; each sub-call incurs validation and
   JS context overhead (see `convex-function-cost` skill). In actions,
   consolidate multiple sequential calls into composite internal
   queries/mutations.
9. **Use internal functions for sensitive operations**
