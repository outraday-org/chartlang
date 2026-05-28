---
name: explain-convex
description: Explains Convex database patterns including schema, queries, mutations, actions, and frontend hooks. Use when working with Convex, creating database functions, or understanding the project's data layer.
---

# Convex Database Patterns

This skill explains the Convex database patterns used in this project.

## Folder Structure

```
convex/
├── _generated/          # Auto-generated types and API
│   ├── api.ts           # Public function references (api.*)
│   ├── dataModel.ts     # Type exports (Doc, Id)
│   └── server.ts        # Function decorators
├── schema.ts            # Database schema definition
├── schemaTypes.ts       # Exported schema types
├── enums.ts             # Shared enums
├── env.server.ts        # Server environment variables
├── http.ts              # HTTP endpoints router
├── crons.ts             # Scheduled jobs
├── lib/                 # Shared utilities
└── <feature>/           # Feature-based modules
    ├── <feature>.ts     # Main queries/mutations
    ├── types.ts         # Feature-specific types
    └── lib/             # Feature utilities
```

## Team Context

All resources are team-scoped. The team context system provides authorization
and team resolution.

### Key Files

```
convex/teams/
├── teamAuth.ts        # assertResourceAccess, assertResourceEditAccess, assertResourceDeleteAccess
├── teamPermissions.ts # TeamAction enum, TeamRole, role hierarchy
└── teamHelpers.ts     # resolveTeamContext, resolveTeamIdForUser
```

### Authorization Helpers

```typescript
import {
    assertResourceAccess,
    assertResourceEditAccess,
    assertResourceDeleteAccess,
} from "../teams/teamAuth";
import { TeamAction } from "../teams/teamPermissions";

// For reads:
const { user, membership, teamId } = await assertResourceAccess(
    ctx, args.teamId, TeamAction.VIEW_RESOURCE,
);

// For edits (smart: EDIT_RESOURCE if owner, EDIT_ANY_RESOURCE otherwise):
const { user, membership, teamId } = await assertResourceEditAccess(
    ctx, resource.teamId, resource.userId,
);

// For deletes (smart: DELETE_OWN_RESOURCE if owner, DELETE_ANY_RESOURCE otherwise):
const { user, membership, teamId } = await assertResourceDeleteAccess(
    ctx, resource.teamId, resource.userId,
);
```

### Team Context Resolution (for actions)

```typescript
// In actions, resolve teamId via internal query
const { user, teamId } = await ctx.runQuery(
    internal.teams.teamHelpers.resolveTeamContext,
    { teamId: args.teamId },
);
// Falls back to personal team if teamId not provided
```

### TeamAction Enum

| Action               | Required Role  |
| -------------------- | -------------- |
| VIEW_RESOURCE        | member         |
| CREATE_RESOURCE      | member         |
| EDIT_RESOURCE        | member (owner) |
| EDIT_ANY_RESOURCE    | administrator  |
| DELETE_OWN_RESOURCE  | member (owner) |
| DELETE_ANY_RESOURCE  | administrator  |
| INVITE_MEMBER        | administrator  |
| MANAGE_BILLING       | administrator  |
| TRANSFER_OWNERSHIP   | owner          |
| DELETE_TEAM          | owner          |

## Schema Definition

Define tables in `convex/schema.ts`. **All resource tables should include
`teamId`:**

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Import custom validators from feature modules
import { vCustomType } from "./feature/types";

const schema = defineSchema({
    users: defineTable({
        email: v.string(),
        name: v.string(),
        preference: v.object({
            theme: v.union(v.literal("light"), v.literal("dark")),
            language: v.string(),
        }),
        updatedAt: v.number(),
    })
        .index("byEmail", ["email"]),

    teams: defineTable({
        name: v.string(),
        currentTier: v.optional(v.union(
            v.literal("free"),
            v.literal("starter"),
            v.literal("basic"),
            v.literal("pro"),
        )),
        stripeCustomerId: v.optional(v.string()),
        updatedAt: v.number(),
    })
        .index("byStripeCustomerId", ["stripeCustomerId"]),

    teamMembers: defineTable({
        teamId: v.id("teams"),
        userId: v.id("users"),
        role: v.union(
            v.literal("owner"),
            v.literal("administrator"),
            v.literal("member"),
        ),
        webUsageTotal: v.optional(v.number()),
    })
        .index("byTeamIdAndUserId", ["teamId", "userId"]),

    // Resource tables — always include teamId + userId
    items: defineTable({
        teamId: v.id("teams"),
        userId: v.id("users"),
        name: v.string(),
        status: v.union(
            v.literal("draft"),
            v.literal("active"),
            v.literal("archived"),
        ),
        data: v.optional(vCustomType),
        updatedAt: v.number(),
    })
        .index("byTeamId", ["teamId"])
        .index("byTeamIdAndStatus", ["teamId", "status"])
        .index("byTeamIdAndUpdatedAt", ["teamId", "updatedAt"])
        .searchIndex("search_name", {
            searchField: "name",
            filterFields: ["teamId", "status"],
        }),
});

export default schema;
```

### Index Naming Convention

**Always include all fields in the index name:**

```typescript
// Good
.index("byUserId", ["userId"])
.index("byUserIdAndProjectId", ["userId", "projectId"])
.index("byStatusAndUpdatedAt", ["status", "updatedAt"])

// Bad - missing fields in name
.index("user_project", ["userId", "projectId"])
.index("by_status", ["status", "updatedAt"])
```

### Timestamps: Use `_creationTime` Instead of `createdAt`

**IMPORTANT:** Convex automatically adds an immutable `_creationTime` field to
all documents. Never add a `createdAt` field to your schema.

```typescript
// ❌ BAD - Don't add createdAt
defineTable({
    userId: v.id("users"),
    name: v.string(),
    createdAt: v.number(),  // WRONG - use _creationTime instead
    updatedAt: v.number(),
})

// ✅ GOOD - Use _creationTime (automatic) + updatedAt
defineTable({
    userId: v.id("users"),
    name: v.string(),
    updatedAt: v.number(),  // Only add updatedAt for mutable timestamp
})
```

**When to use which:**

- `_creationTime` - Automatic, immutable timestamp set when document is created.
  Access via `doc._creationTime`.
- `updatedAt` - Mutable timestamp you maintain. Update with
  `updatedAt: Date.now()` on every mutation.
- `lastUsedAt` or similar - When you need a mutable "recency" field that gets
  updated on access (e.g., for "most recently used" ordering).

**Exception:** If you need a mutable timestamp for ordering (e.g., moving items
to "top" of a list), use a descriptive name like `lastUsedAt` instead of
`createdAt`.

### Custom Validators

Extract reusable validators to separate files:

```typescript
// convex/feature/types.ts
import { v } from "convex/values";

export const vCustomType = v.object({
    id: v.string(),
    value: v.number(),
    tags: v.array(v.string()),
});

export type CustomType = {
    id: string;
    value: number;
    tags: Array<string>;
};
```

## Schema Type Exports

**IMPORTANT:** All table schema types and validators MUST be exported from
`convex/schemaTypes.ts` and reused throughout the codebase.

```typescript
// convex/schemaTypes.ts
import type { Doc } from "./_generated/dataModel";
import schema from "./schema";

// Export document type + validator for each table
export type User = Doc<"users">;
export const vUser = schema.tables.users.validator;

export type Team = Doc<"teams">;
export const vTeam = schema.tables.teams.validator;

export type TeamMember = Doc<"teamMembers">;
export const vTeamMember = schema.tables.teamMembers.validator;

export type TeamInvitation = Doc<"teamInvitations">;
export const vTeamInvitation = schema.tables.teamInvitations.validator;

// Resource types
export type Space = Doc<"spaces">;
export const vSpace = schema.tables.spaces.validator;

export type Canvas = Doc<"canvases">;
export const vCanvas = schema.tables.canvases.validator;

export type ResearchFile = Doc<"researchFiles">;
export const vResearchFile = schema.tables.researchFiles.validator;

// Derived types (public-facing)
export type PublicUser = Pick<
    User,
    "_id" | "_creationTime" | "firstName" | "lastName" | "username"
>;
```

### Usage in Convex Functions

Import types and validators from `schemaTypes.ts`:

```typescript
import { v } from "convex/values";
import { query } from "./_generated/server";
import { vProject, type Project } from "./schemaTypes";

export const getProject = query({
    args: { id: v.id("projects") },
    // Use the exported validator for complex returns
    returns: v.union(vProject, v.null()),
    handler: async (ctx, args): Promise<Project | null> => {
        return await ctx.db.get(args.id);
    },
});
```

### Schema Type Export Benefits

1. **Single source of truth** - All types defined in one location
2. **Validator reuse** - Reference validators without duplicating schema
   definition
3. **Consistent typing** - Ensures frontend and backend use identical types
4. **Derived types** - Easy to create public/subset types from full document
   types

## Query Pattern

```typescript
import { v } from "convex/values";
import { internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";

// Public query - exposed to clients
export const listProjects = query({
    args: {
        userId: v.id("users"),
        status: v.optional(v.string()),
    },
    // returns validator is optional for complex types
    handler: async (ctx, args) => {
        // Use index for efficient queries
        const projects = await ctx.db
            .query("projects")
            .withIndex("byUserIdAndStatus", (q) => {
                let query = q.eq("userId", args.userId);
                if (args.status) {
                    query = query.eq("status", args.status);
                }
                return query;
            })
            .order("desc")
            .take(50);

        return projects;
    },
});

// Internal query - only callable from other Convex functions
export const getProjectInternal = internalQuery({
    args: { id: v.id("projects") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.id);
    },
});
```

### Query Best Practices

1. **Never use `.filter()`** - define indexes instead
2. **Use `.withIndex()` for all queries** - required for performance
3. **Use `.order("desc")` for newest first** - default is ascending
4. **Use `.take(n)` to limit results** - avoid unbounded queries
5. **Use `.unique()` for single results** - throws if multiple found

## Mutation Pattern

```typescript
import { ConvexError, v } from "convex/values";
import { internalMutation, mutation } from "./_generated/server";
import { ConvexErrorSeverity } from "./enums";
import {
    assertResourceAccess,
    assertResourceEditAccess,
    assertResourceDeleteAccess,
} from "./teams/teamAuth";
import { TeamAction } from "./teams/teamPermissions";

// Create — team-scoped
export const createItem = mutation({
    args: {
        teamId: v.id("teams"),
        name: v.string(),
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
            status: "draft",
            updatedAt: Date.now(),
        });
    },
});

// Update — ownership-aware auth
export const updateItem = mutation({
    args: {
        id: v.id("items"),
        name: v.optional(v.string()),
        status: v.optional(v.string()),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const item = await ctx.db.get(args.id);
        if (!item) {
            throw new ConvexError({
                severity: ConvexErrorSeverity.MEDIUM,
                message: "Item not found",
            });
        }

        // Smart: EDIT_RESOURCE if owner, EDIT_ANY_RESOURCE if admin
        await assertResourceEditAccess(ctx, item.teamId, item.userId);

        await ctx.db.patch(args.id, {
            ...(args.name !== undefined && { name: args.name }),
            ...(args.status !== undefined && { status: args.status }),
            updatedAt: Date.now(),
        });

        return null;
    },
});

// Delete — ownership-aware auth
export const deleteItem = mutation({
    args: { id: v.id("items") },
    returns: v.null(),
    handler: async (ctx, args) => {
        const item = await ctx.db.get(args.id);
        if (!item) {
            throw new ConvexError({
                severity: ConvexErrorSeverity.MEDIUM,
                message: "Item not found",
            });
        }

        await assertResourceDeleteAccess(ctx, item.teamId, item.userId);
        await ctx.db.delete(args.id);
        return null;
    },
});

// Internal mutation — no auth needed
export const createItemInternal = internalMutation({
    args: {
        teamId: v.id("teams"),
        userId: v.id("users"),
        name: v.string(),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("items", {
            teamId: args.teamId,
            userId: args.userId,
            name: args.name,
            status: "draft",
            updatedAt: Date.now(),
        });
    },
});
```

### Mutation Best Practices

1. **Always include `returns` validator** - use `v.null()` for void
2. **Always update `updatedAt: Date.now()`** - maintain timestamps
3. **Delegate authorization to internal queries** - separation of concerns
4. **Use `ctx.db.patch()` for partial updates** - shallow merge
5. **Use `ctx.db.replace()` for full replacement** - overwrites document

## Action Pattern

Actions are for external API calls and side effects. Require `"use node"` for
Node.js access.

```typescript
"use node";

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

// Helper function (plain async, reusable server-side)
async function fetchExternalData(ticker: string): Promise<ExternalData> {
    const response = await fetch(`https://api.example.com/data/${ticker}`);
    return response.json();
}

// Public action wrapper
export const getExternalDataAction = action({
    args: {
        ticker: v.string(),
    },
    returns: v.any(), // Actions always need returns validator
    handler: async (ctx, args) => {
        // Actions can't use ctx.db directly
        // Must call queries/mutations via ctx.runQuery/runMutation

        const user = await ctx.runQuery(
            internal.users.users.getCurrentUserOrThrow,
        );

        const data = await fetchExternalData(args.ticker);

        // Store result via mutation
        await ctx.runMutation(internal.data.data.saveExternalData, {
            userId: user._id,
            ticker: args.ticker,
            data,
        });

        return data;
    },
});

// Internal action for cron jobs or other internal use
export const syncExternalDataInternal = internalAction({
    args: {},
    returns: v.null(),
    handler: async (ctx) => {
        const items = await ctx.runQuery(internal.data.data.getItemsToSync);

        for (const item of items) {
            const data = await fetchExternalData(item.ticker);
            await ctx.runMutation(internal.data.data.updateItem, {
                id: item._id,
                data,
            });
        }

        return null;
    },
});
```

### Action Best Practices

1. **Add `"use node"` at top of file** - required for Node.js APIs
2. **Always include `returns` validator** - required for actions
3. **Use helper function + action wrapper pattern** - enables server-side reuse
4. **Minimize ctx.runQuery/runMutation calls** - each is a transaction
5. **Never use ctx.db in actions** - actions don't have database access

## Cost Optimization

Inside queries and mutations, `ctx.runQuery` and `ctx.runMutation` incur
per-call validation and JS context overhead. Always use plain helper functions instead:

```typescript
// Helper: plain function, same transaction, zero extra cost
async function getTeamById(ctx: QueryCtxOrMutationCtx, teamId: Id<"teams">): Promise<Team | null> {
    return await ctx.db.get(teamId);
}

// Mutation calls helper directly — zero overhead
export const updateItem = mutation({
    handler: async (ctx, args) => {
        const team = await getTeamById(ctx, args.teamId); // free
        // ... logic
    }
});
```

See the `convex-function-cost` skill for the complete pattern including
action consolidation.

## Function References

```typescript
import { api, internal } from "./_generated/api";

// Public functions: api.*.*
await ctx.runQuery(api.users.users.getUser, { id: userId });
await ctx.runMutation(api.projects.projects.updateProject, { id, name });
await ctx.runAction(api.external.external.fetchData, { ticker });

// Internal functions: internal.*.*
await ctx.runQuery(internal.users.users.getCurrentUser);
await ctx.runMutation(internal.projects.projects.createProjectInternal, {
    userId,
    name,
});
await ctx.runAction(internal.sync.sync.syncData, {});
```

## Frontend Usage

### useQuery (Real-time subscriptions)

```typescript
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";

export const ProjectList = ({ userId }: { userId: Id<"users"> }) => {
    // Automatically re-renders when data changes
    const projects = useQuery(api.projects.projects.listProjects, {
        userId,
        status: "active",
    });

    if (projects === undefined) {
        return <Loading />;
    }

    return <List items={projects} />;
};
```

### useMutation (State changes)

```typescript
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";

export const ProjectEditor = ({ projectId }: { projectId: Id<"projects"> }) => {
    const updateProject = useMutation(api.projects.projects.updateProject);

    const handleSave = async (name: string) => {
        await updateProject({ id: projectId, name });
    };

    return <Form onSubmit={handleSave} />;
};
```

### useAction (External data)

```typescript
import { useAction } from "convex/react";
import { useQuery } from "@tanstack/react-query";
import { api } from "convex/_generated/api";

export const useExternalData = (ticker: string) => {
    const fetchData = useAction(api.external.external.getExternalDataAction);

    return useQuery({
        queryKey: ["externalData", ticker],
        enabled: Boolean(ticker),
        queryFn: () => fetchData({ ticker }),
        staleTime: 60 * 60 * 1000, // 1 hour
        gcTime: 60 * 60 * 1000,
    });
};
```

## Pagination

```typescript
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "./_generated/server";

export const listProjectsPaginated = query({
    args: {
        userId: v.id("users"),
        paginationOpts: paginationOptsValidator,
    },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("projects")
            .withIndex("byUserId", (q) => q.eq("userId", args.userId))
            .order("desc")
            .paginate(args.paginationOpts);
    },
});

// Returns: { page: Doc[], isDone: boolean, continueCursor: string }
```

## TypeScript Types

```typescript
import type { Doc, Id } from "./_generated/dataModel";

// Document type
type Project = Doc<"projects">;

// ID type - use instead of string
type ProjectId = Id<"projects">;

// Strict function signatures
export const getProject = query({
    args: { id: v.id("projects") },
    handler: async (ctx, args): Promise<Doc<"projects"> | null> => {
        return await ctx.db.get(args.id);
    },
});
```

## Key Patterns Summary

| Pattern            | Usage                              |
| ------------------ | ---------------------------------- |
| `query`            | Public read operations             |
| `mutation`         | Public write operations            |
| `action`           | External API calls                 |
| `internalQuery`    | Private read operations            |
| `internalMutation` | Private write operations           |
| `internalAction`   | Private external calls             |
| `api.*.*`          | Public function references         |
| `internal.*.*`     | Private function references        |
| `ctx.runQuery`     | Call query from any function       |
| `ctx.runMutation`  | Call mutation from mutation/action |
| `ctx.runAction`    | Call action from action only       |
| Plain helper fn    | Shared logic in queries/mutations (zero overhead) |
