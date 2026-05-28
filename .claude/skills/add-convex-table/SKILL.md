---
name: add-convex-table
description: Guide for adding a new table to the Convex schema including table definition, validators, indexes, and basic CRUD operations. Use when creating new database tables.
---

# Add Convex Schema Table

This skill guides you through adding a new table to the Convex schema.

## Step-by-Step Guide

### 1. Define Table in Schema

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Import custom validators from feature modules
import { vItemData } from "./items/types";

const schema = defineSchema({
    // ... existing tables

    items: defineTable({
        // Team scoping (required for all resource tables)
        teamId: v.id("teams"),
        userId: v.id("users"),

        // Required fields
        name: v.string(),

        // Optional fields
        description: v.optional(v.string()),

        // Status with union literals
        status: v.union(
            v.literal("draft"),
            v.literal("active"),
            v.literal("archived")
        ),

        // Nested object
        settings: v.object({
            theme: v.optional(v.string()),
            color: v.optional(v.string())
        }),

        // Array of objects
        tags: v.array(v.object({
            id: v.string(),
            name: v.string()
        })),

        // Reference to another table
        projectId: v.optional(v.id("projects")),

        // Custom validator
        data: vItemData,

        // Record with dynamic keys
        metadata: v.optional(v.record(v.string(), v.any())),

        // Timestamps (always include updatedAt)
        updatedAt: v.number()
    })
        // Indexes - team-scoped (name must include all fields)
        .index("byTeamId", ["teamId"])
        .index("byTeamIdAndStatus", ["teamId", "status"])
        .index("byTeamIdAndUpdatedAt", ["teamId", "updatedAt"])
        .index("byProjectId", ["projectId"])

        // Search index for full-text search
        .searchIndex("search_name", {
            searchField: "name",
            filterFields: ["teamId", "status"]
        })
});

export default schema;
```

### 2. Index Naming Convention

**Rule: Always include all fields in the index name**

```typescript
// Good - descriptive and complete
.index("byUserId", ["userId"])
.index("byUserIdAndStatus", ["userId", "status"])
.index("byUserIdAndProjectIdAndStatus", ["userId", "projectId", "status"])
.index("byCreatedAt", ["_creationTime"])

// Bad - missing fields or unclear names
.index("user", ["userId"])  // Too vague
.index("by_user_status", ["userId", "status"])  // Wrong format
.index("userIndex", ["userId", "status"])  // Missing "status" in name
```

### 3. Create Custom Validators

Extract complex validators to separate files:

```typescript
// convex/items/types.ts
import { v } from "convex/values";

// Custom validator for item data
export const vItemData = v.object({
    type: v.union(
        v.literal("text"),
        v.literal("number"),
        v.literal("date")
    ),
    value: v.union(v.string(), v.number(), v.null()),
    format: v.optional(v.string())
});

// TypeScript type derived from validator
export type ItemData = {
    type: "text" | "number" | "date";
    value: string | number | null;
    format?: string;
};

// Discriminated union pattern
export const vItemContent = v.union(
    v.object({
        kind: v.literal("text"),
        text: v.string()
    }),
    v.object({
        kind: v.literal("image"),
        url: v.string(),
        alt: v.optional(v.string())
    }),
    v.object({
        kind: v.literal("link"),
        href: v.string(),
        title: v.string()
    })
);

export type ItemContent =
    | { kind: "text"; text: string }
    | { kind: "image"; url: string; alt?: string }
    | { kind: "link"; href: string; title: string };
```

### 4. Export Types

```typescript
// convex/schemaTypes.ts
import type { Doc, Id } from "./_generated/dataModel";

// Document type
export type Item = Doc<"items">;

// ID type
export type ItemId = Id<"items">;

// Partial type for updates
export type ItemUpdate = Partial<Omit<Item, "_id" | "_creationTime">>;
```

### 5. Create Basic Queries/Mutations

```typescript
// convex/items/items.ts
import { v, ConvexError } from "convex/values";
import { query, mutation } from "../_generated/server";
import { ConvexErrorSeverity } from "../enums";
import {
    assertResourceAccess,
    assertResourceEditAccess,
    assertResourceDeleteAccess,
} from "../teams/teamAuth";
import { TeamAction } from "../teams/teamPermissions";
import { vItemData } from "./types";

// List query — team-scoped
export const listItems = query({
    args: {
        teamId: v.id("teams"),
        status: v.optional(v.string())
    },
    handler: async (ctx, args) => {
        const { teamId } = await assertResourceAccess(
            ctx, args.teamId, TeamAction.VIEW_RESOURCE,
        );

        if (args.status) {
            return await ctx.db
                .query("items")
                .withIndex("byTeamIdAndStatus", (q) =>
                    q.eq("teamId", teamId).eq("status", args.status as string)
                )
                .order("desc")
                .take(100);
        }

        return await ctx.db
            .query("items")
            .withIndex("byTeamId", (q) => q.eq("teamId", teamId))
            .order("desc")
            .take(100);
    }
});

// Get by ID
export const getItemById = query({
    args: { id: v.id("items") },
    handler: async (ctx, args) => {
        const item = await ctx.db.get(args.id);
        if (!item) return null;

        await assertResourceAccess(ctx, item.teamId, TeamAction.VIEW_RESOURCE);
        return item;
    }
});

// Create mutation — team-scoped
export const createItem = mutation({
    args: {
        teamId: v.id("teams"),
        name: v.string(),
        description: v.optional(v.string()),
        status: v.optional(v.string()),
        data: vItemData,
        projectId: v.optional(v.id("projects"))
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
            description: args.description,
            status: (args.status as "draft" | "active" | "archived") ?? "draft",
            settings: {},
            tags: [],
            data: args.data,
            projectId: args.projectId,
            updatedAt: Date.now()
        });
    }
});

// Update mutation — ownership-aware auth
export const updateItem = mutation({
    args: {
        id: v.id("items"),
        name: v.optional(v.string()),
        description: v.optional(v.string()),
        status: v.optional(v.string()),
        data: v.optional(vItemData)
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

        // Smart: EDIT_RESOURCE if owner, EDIT_ANY_RESOURCE if admin
        await assertResourceEditAccess(ctx, item.teamId, item.userId);

        const update: Record<string, unknown> = {
            updatedAt: Date.now()
        };

        if (args.name !== undefined) update.name = args.name;
        if (args.description !== undefined) update.description = args.description;
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

        await assertResourceDeleteAccess(ctx, item.teamId, item.userId);
        await ctx.db.delete(args.id);
        return null;
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
v.int64()      // bigint
v.bytes()      // ArrayBuffer

// IDs - strictly typed
v.id("tableName")

// Optional wrapper
v.optional(v.string())

// Arrays
v.array(v.string())
v.array(v.id("users"))

// Objects
v.object({
    field1: v.string(),
    field2: v.optional(v.number())
})

// Union (either/or)
v.union(v.string(), v.number())

// Literals (exact values)
v.literal("specificValue")
v.literal(42)
v.literal(true)

// Union of literals (enum-like)
v.union(
    v.literal("option1"),
    v.literal("option2"),
    v.literal("option3")
)

// Records (dynamic keys)
v.record(v.string(), v.number())
v.record(v.id("users"), v.object({ score: v.number() }))

// Any (use sparingly!)
v.any()
```

## Search Index Configuration

```typescript
// Simple search
.searchIndex("search_name", {
    searchField: "name"
})

// Search with filters
.searchIndex("search_name", {
    searchField: "name",
    filterFields: ["userId", "status"]
})

// Usage in query
const results = await ctx.db
    .query("items")
    .withSearchIndex("search_name", (q) =>
        q.search("name", searchQuery)
            .eq("userId", userId)
            .eq("status", "active")
    )
    .take(20);
```

## System Fields

Every table automatically has:
- `_id: Id<"tableName">` - Unique identifier
- `_creationTime: number` - Creation timestamp (ms since epoch)

```typescript
// Access in queries
const item = await ctx.db.get(itemId);
console.log(item._id);            // Id<"items">
console.log(item._creationTime);  // number
```

## File Checklist

- [ ] `convex/schema.ts` - Add table definition with `teamId` and team-scoped indexes
- [ ] `convex/<feature>/types.ts` - Create custom validators
- [ ] `convex/schemaTypes.ts` - Export document types
- [ ] `convex/<feature>/<feature>.ts` - Create CRUD operations with `assertResourceAccess`/`assertResourceEditAccess`/`assertResourceDeleteAccess`
- [ ] `src/api/hooks/use-<feature>.ts` - Create frontend hooks
