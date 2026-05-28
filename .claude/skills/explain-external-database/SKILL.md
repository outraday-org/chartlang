---
name: explain-external-database
description: Explains how to work with external Postgres databases via Drizzle ORM in Convex actions. Use when querying external databases, creating Drizzle queries, or understanding the multi-database architecture.
---

# External Postgres Databases with Drizzle ORM

This skill explains how to work with external Postgres databases via Drizzle ORM
in Convex.

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────────┐     ┌──────────────────┐
│   Client Side   │────▶│   Convex Actions    │────▶│   Postgres DBs   │
│  (React Hooks)  │     │   (Drizzle ORM)     │     │  via Drizzle     │
└─────────────────┘     └─────────────────────┘     └──────────────────┘
```

The project uses two external Postgres databases:

- **Backend DB** (`/convex/externalBackend/backend/`) - Companies, SEC filings,
  financial facts, market data
- **Earnings Backend DB** (`/convex/externalBackend/earningsBackend/`) -
  Earnings call transcripts

## Folder Structure

```
convex/externalBackend/
├── drizzleBackend/
│   └── schema.ts           # Auto-generated via drizzle-kit pull
├── drizzleEarningsBackend/
│   └── schema.ts           # Auto-generated via drizzle-kit pull
├── backend/
│   ├── backendDbClient.ts  # Drizzle client initialization
│   ├── backendTypes.ts     # Type definitions with adjustments
│   ├── companies.ts        # Company queries
│   ├── financialFacts.ts   # Financial data queries
│   └── filings.ts          # SEC filings queries
├── earningsBackend/
│   ├── earningsDbClient.ts
│   ├── earningsBackendTypes.ts
│   └── transcripts.ts
└── enums.ts                # Shared enums
```

## Schema Generation

Schemas are **pulled** from the live Postgres databases using
`drizzle-kit pull`, not manually defined.

```bash
# Generate backend types
pnpm gen:backend-types

# Generate earnings backend types
pnpm gen:earnings-backend-types
```

### Generated Schema Example

```typescript
// convex/externalBackend/drizzleBackend/schema.ts (auto-generated)
import {
    index,
    numeric,
    pgPolicy,
    pgTable,
    varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const companies = pgTable(
    "companies",
    {
        cik: varchar().notNull(),
        ticker: varchar().notNull(),
        name: varchar().notNull(),
        marketCap: numeric("market_cap"),
        // ... more columns
    },
    (table) => [
        index("idx_companies_ticker").using(
            "btree",
            table.ticker.asc().nullsLast().op("text_ops"),
        ),
        pgPolicy("Allow public read access for companies", {
            as: "permissive",
            for: "select",
            to: ["public"],
            using: sql`true`,
        }),
    ],
);
```

### Unused Table Args Pattern

When constraint callbacks don't reference the table, prefix with `_`:

```typescript
// Correct - unused arg prefixed
export const institutionalInvestors = pgTable(
    "institutional_investors",
    {/* columns */},
    (_table) => [ // <-- underscore prefix
        pgPolicy("Allow public read access", {/* ... */}),
    ],
);

// Wrong - causes TypeScript error
export const institutionalInvestors = pgTable(
    "institutional_investors",
    {/* columns */},
    (table) => [ // Error: 'table' is declared but never used
        pgPolicy("Allow public read access", {/* ... */}),
    ],
);
```

## DB Client Setup

```typescript
// convex/externalBackend/backend/backendDbClient.ts
"use node";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { envServer } from "../../env.server";
import * as schema from "../drizzleBackend/schema";

const client = postgres(envServer.PLANETSCALE_BACKEND_DB_URL);
export const backendDbClient = drizzle(client, { schema });
```

## Type Definitions

Types are **inferred from schema** then **adjusted** for project needs:

```typescript
// convex/externalBackend/backend/backendTypes.ts
"use node";

import type { InferSelectModel } from "drizzle-orm";
import type * as backendSchema from "../drizzleBackend/schema";
import type { FinancialStatement, FiscalPeriodType } from "../enums";

// Helper: Convert Postgres numeric (string) to number
export type ValueAsNumber<T extends { value: null | string }> =
    & Omit<T, "value">
    & { value: null | number };

// Base type from schema
export type Company = InferSelectModel<typeof backendSchema.companies>;

// Extended type with project enums and computed fields
export type FinancialFactWithTicker =
    & Omit<
        InferSelectModel<typeof backendSchema.financialFacts>,
        "financialStatement" | "fiscalPeriodType"
    >
    & {
        financialStatement: FinancialStatement; // Project enum
        fiscalPeriodType: FiscalPeriodType; // Project enum
        ticker: string; // Joined field
    };
```

### Why Adjust Types?

| Issue                       | Solution                                   |
| --------------------------- | ------------------------------------------ |
| Postgres `numeric` → string | Convert to `number` via `ValueAsNumber<T>` |
| Raw `varchar` fields        | Narrow to project enums                    |
| JSON columns                | Type as structured objects                 |
| Computed/joined fields      | Add to type (e.g., `ticker`)               |

## Query Implementation Pattern

### Server-Side (Convex Actions)

```typescript
// convex/externalBackend/backend/companies.ts
"use node";

import { v } from "convex/values";
import { and, desc, eq, ilike, inArray, or } from "drizzle-orm";
import type { Company } from "./backendTypes";
import { action } from "../../_generated/server";
import { normalizeNumber } from "../../lib/numberUtils";
import { companies } from "../drizzleBackend/schema";
import { backendDbClient } from "./backendDbClient";

// Plain async helper function - reusable server-side
export async function getCompaniesByTickers(
    tickers: Array<string>,
): Promise<Array<Company>> {
    const processedTickers = tickers
        .map((t) => t.trim().toUpperCase())
        .filter(Boolean);

    if (processedTickers.length === 0) return [];

    const rows = await backendDbClient
        .select()
        .from(companies)
        .where(inArray(companies.ticker, processedTickers));

    // Normalize numeric fields from string to number
    return rows.map((item) => ({
        ...item,
        shortFloatPct: normalizeNumber(item.shortFloatPct),
        insiderOwnPct: normalizeNumber(item.insiderOwnPct),
        instOwnPct: normalizeNumber(item.instOwnPct),
        marketCap: normalizeNumber(item.marketCap),
    }));
}

// Convex action wrapper - exposes to client
export const getCompaniesByTickersAction = action({
    args: {
        tickers: v.array(v.string()),
    },
    returns: v.any(),
    handler: async (_ctx, args) => {
        return await getCompaniesByTickers(args.tickers);
    },
});

// More complex query with pagination
export async function listCompanies(args: {
    searchName?: string;
    limit: number;
    offset: number;
}): Promise<{ items: Array<Company>; total: number }> {
    const conditions = [];

    if (args.searchName) {
        conditions.push(ilike(companies.name, `%${args.searchName}%`));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const items = await backendDbClient
        .select()
        .from(companies)
        .where(whereClause)
        .orderBy(desc(companies.marketCap))
        .limit(args.limit)
        .offset(args.offset);

    // Get total count
    const countResult = await backendDbClient
        .select({ count: sql<number>`count(*)` })
        .from(companies)
        .where(whereClause);

    return {
        items: items.map(normalizeCompany),
        total: countResult[0]?.count ?? 0,
    };
}

export const listCompaniesAction = action({
    args: {
        searchName: v.optional(v.string()),
        limit: v.number(),
        offset: v.number(),
    },
    returns: v.any(),
    handler: async (_ctx, args) => {
        return await listCompanies(args);
    },
});
```

### Common Drizzle Operators

```typescript
import {
    eq,        // Equal
    ne,        // Not equal
    gt,        // Greater than
    gte,       // Greater than or equal
    lt,        // Less than
    lte,       // Less than or equal
    inArray,   // IN (array)
    notInArray,// NOT IN (array)
    like,      // LIKE (case-sensitive)
    ilike,     // ILIKE (case-insensitive)
    and,       // AND
    or,        // OR
    isNull,    // IS NULL
    isNotNull, // IS NOT NULL
    desc,      // ORDER BY DESC
    asc,       // ORDER BY ASC
    sql        // Raw SQL
} from "drizzle-orm";

// Examples
.where(eq(companies.ticker, "AAPL"))
.where(and(
    eq(companies.sector, "Technology"),
    gt(companies.marketCap, 1000000000)
))
.where(or(
    ilike(companies.name, `%apple%`),
    eq(companies.ticker, "AAPL")
))
.where(inArray(companies.cik, ["0000320193", "0001652044"]))
.orderBy(desc(companies.marketCap))
```

## Frontend Hook Pattern

```typescript
// src/api/hooks/use-list-financial-facts-standardized.ts
import type { FinancialFactWithTicker } from "convex/externalBackend/backend/backendTypes";
import type { FiscalPeriodType } from "convex/externalBackend/enums";

import { useQuery } from "@tanstack/react-query";
import { api } from "convex/_generated/api";
import { useAction } from "convex/react";

export type ListFinancialFactsArgs = {
    tickers?: Array<string>;
    ciks?: Array<string>;
    metrics?: Array<string>;
    yearsCount: number;
    fiscalPeriodTypes?: Array<FiscalPeriodType>;
    disabled?: boolean;
};

export const useListFinancialFacts = (args: ListFinancialFactsArgs) => {
    const hasTickers = Boolean(args.tickers && args.tickers.length > 0);
    const hasCiks = Boolean(args.ciks && args.ciks.length > 0);
    const isEnabled = (hasTickers || hasCiks) && !args.disabled;

    // Get action reference
    const listFacts = useAction(
        api.externalBackend.backend.financialFacts.listFinancialFactsAction,
    );

    const queryResult = useQuery<Array<FinancialFactWithTicker>>({
        queryKey: ["listFinancialFacts", args],
        enabled: isEnabled,
        queryFn: async () => {
            return await listFacts(args);
        },
        // Financial data doesn't change frequently
        staleTime: 60 * 60 * 1000, // 1 hour
        gcTime: 60 * 60 * 1000, // 1 hour
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
    });

    const { data, ...rest } = queryResult;

    return { facts: data ?? [], ...rest };
};
```

### Hook File Naming

Use snake-case: `use-[feature].ts`

```
src/api/hooks/
├── use-list-companies.ts
├── use-get-company-by-ticker.ts
├── use-list-financial-facts-standardized.ts
├── use-list-earnings-calls.ts
└── use-search-filings.ts
```

## CRITICAL: Action-Only Exports

**Files that import db clients (`backendDbClient`, `earningsDbClient`) must ONLY
export Convex actions.** Other Convex files must use `ctx.runAction` to call
these functions - never import them directly.

### Why This Matters

Direct imports from files containing Node.js db clients cause **Convex backend
compilation failures**. The Convex bundler cannot properly isolate Node.js
dependencies when they're imported across file boundaries.

### ❌ WRONG - Direct Import (Causes Build Failures)

```typescript
// convex/someOtherFile.ts
import { getCompaniesByTickers } from "./externalBackend/backend/companies";
//       ^^^^^^^^^^^^^^^^^^^^^^ NEVER do this!

export const processData = internalMutation({
    handler: async (ctx, args) => {
        // This breaks the Convex build - Node.js client leaks into non-node file
        const companies = await getCompaniesByTickers(args.tickers);
    },
});
```

### ✅ CORRECT - Use ctx.runAction

```typescript
// convex/someOtherFile.ts
import { internal } from "./_generated/api";

export const processData = internalMutation({
    args: { tickers: v.array(v.string()) },
    returns: v.null(),
    handler: async (ctx, args) => {
        // Correct: call via runAction, isolating Node.js runtime
        const companies = await ctx.runAction(
            internal.externalBackend.backend.companies.getCompaniesByTickersAction,
            { tickers: args.tickers },
        );

        for (const company of companies) {
            await ctx.runMutation(internal.data.saveCompany, { company });
        }

        return null;
    },
});
```

### Export Pattern Summary

| File Type                      | What to Export                    |
| ------------------------------ | --------------------------------- |
| Files importing db clients     | Only `action` / `internalAction`  |
| Files NOT importing db clients | Can export queries/mutations/etc. |

### Within the Same File

Helper functions within the same `"use node"` file can call each other directly:

```typescript
// convex/externalBackend/backend/companies.ts
"use node";

// Private helper - NOT exported
async function getCompaniesByTickers(tickers: Array<string>) {
    return await backendDbClient.select().from(companies)...
}

// Exported action - wraps the helper
export const getCompaniesByTickersAction = action({
    args: { tickers: v.array(v.string()) },
    returns: v.any(),
    handler: async (_ctx, args) => {
        return await getCompaniesByTickers(args.tickers); // OK - same file
    },
});

// Another action in same file can reuse the helper
export const getCompanyByTickerAction = action({
    args: { ticker: v.string() },
    returns: v.any(),
    handler: async (_ctx, args) => {
        const results = await getCompaniesByTickers([args.ticker]); // OK - same file
        return results[0] ?? null;
    },
});
```

## Enum Generation

Project enums are generated from CSVs:

```bash
# Generate all metric/financial fact enums
pnpm gen:metric-trees
```

This updates files in `convex/externalBackend/enums.ts`:

```typescript
// convex/externalBackend/enums.ts
export enum FinancialStatement {
    BALANCE_SHEET = "balance_sheet",
    INCOME_STATEMENT = "income_statement",
    CASH_FLOW = "cash_flow",
}

export enum FiscalPeriodType {
    ANNUAL = "annual",
    QUARTERLY = "quarterly",
}

export enum StandardizedMetricId {
    REVENUE = "revenue",
    NET_INCOME = "net_income",
    TOTAL_ASSETS = "total_assets",
    // ... many more
}
```

## Key Patterns Summary

| Pattern            | Location                    | Purpose                                |
| ------------------ | --------------------------- | -------------------------------------- |
| `drizzle-kit pull` | `drizzle*/schema.ts`        | Source of truth for DB schema          |
| `_table` prefix    | Schema constraint callbacks | Avoid TS unused variable errors        |
| `InferSelectModel` | `*Types.ts` files           | Infer base types from schema           |
| Type transformers  | `*Types.ts` files           | Convert `numeric→number`, add enums    |
| Plain functions    | `backend/*.ts`              | Reusable server-side logic             |
| Action wrappers    | Same files                  | Expose to client via Convex API        |
| React Query hooks  | `src/api/hooks/*.ts`        | Client-side data fetching with caching |

## Common Gotchas

1. **Never import functions from db client files** - only use `ctx.runAction`
   to call actions; direct imports cause Node.js bundling failures
2. **Always add `"use node"` at top of action files** - required for Drizzle
3. **Normalize numeric fields** - Postgres returns strings for `numeric`
4. **Use explicit pagination** - always include `limit` and `offset`
5. **Import types correctly** - use `type` keyword for type-only imports
6. **Action returns validator** - always include `returns: v.any()` for actions
