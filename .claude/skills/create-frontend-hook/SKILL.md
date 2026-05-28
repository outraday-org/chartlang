---
name: create-frontend-hook
description: Guide for creating frontend data fetching hooks using Convex queries, mutations, actions, and React Query. Use when building React hooks for data fetching.
---

# Create Frontend Hook

This skill guides you through creating frontend hooks for data fetching.

## Hook Types

| Type | Use Case | Library |
|------|----------|---------|
| Convex Query Hook | Real-time subscriptions | `convex/react` |
| Convex Mutation Hook | State changes | `convex/react` |
| External Data Hook | Convex actions + caching | `@tanstack/react-query` |

## File Naming Convention

Use snake-case: `use-[feature].ts`

```
src/api/hooks/
├── use-list-items.ts
├── use-get-item-by-id.ts
├── use-create-item.ts
├── use-external-data.ts
└── use-search-results.ts
```

## Convex Query Hook (Real-time)

```typescript
// src/api/hooks/use-list-items.ts
import type { Doc, Id } from "convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";

export type UseListItemsArgs = {
    userId: Id<"users">;
    status?: "active" | "archived";
    enabled?: boolean;
};

export const useListItems = ({ userId, status, enabled = true }: UseListItemsArgs) => {
    // useQuery returns undefined while loading, then the data
    // Automatically re-renders when data changes (real-time)
    const items = useQuery(
        api.feature.feature.listItems,
        enabled ? { userId, status } : "skip"
    );

    return {
        items: items ?? [],
        isLoading: items === undefined
    };
};
```

### With Skip Condition

```typescript
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";

export const useGetItem = (itemId: Id<"items"> | undefined) => {
    // Pass "skip" to disable the query
    const item = useQuery(
        api.feature.feature.getItemById,
        itemId ? { id: itemId } : "skip"
    );

    return {
        item,
        isLoading: item === undefined && itemId !== undefined
    };
};
```

## Convex Mutation Hook

```typescript
// src/api/hooks/use-create-item.ts
import type { Id } from "convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { useState } from "react";

export const useCreateItem = () => {
    const createItemMutation = useMutation(api.feature.feature.createItem);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const createItem = async (args: { name: string; data?: unknown }) => {
        setIsLoading(true);
        setError(null);

        try {
            const itemId = await createItemMutation(args);
            return itemId;
        } catch (err) {
            const error = err instanceof Error ? err : new Error("Failed to create item");
            setError(error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    return {
        createItem,
        isLoading,
        error
    };
};
```

### Update Hook

```typescript
// src/api/hooks/use-update-item.ts
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";

export const useUpdateItem = () => {
    const updateItemMutation = useMutation(api.feature.feature.updateItem);

    const updateItem = async (args: {
        id: Id<"items">;
        name?: string;
        status?: string;
    }) => {
        await updateItemMutation(args);
    };

    return { updateItem };
};
```

## External Data Hook (Action + React Query)

For Convex actions that call external APIs, use React Query for caching:

```typescript
// src/api/hooks/use-external-data.ts
import type { ExternalData } from "convex/externalBackend/types";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAction } from "convex/react";
import { api } from "convex/_generated/api";

export type UseExternalDataArgs = {
    query: string;
    enabled?: boolean;
};

export const useExternalData = ({ query, enabled = true }: UseExternalDataArgs) => {
    const fetchData = useAction(api.feature.feature.getExternalDataAction);

    const queryResult = useQuery<ExternalData>({
        queryKey: ["externalData", query],
        enabled: enabled && Boolean(query),
        queryFn: async () => {
            return await fetchData({ query });
        },
        // Cache configuration for external data
        staleTime: 60 * 60 * 1000,     // 1 hour - don't refetch if fresh
        gcTime: 60 * 60 * 1000,        // 1 hour - keep in cache
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false
    });

    return {
        data: queryResult.data,
        isLoading: queryResult.isLoading,
        isError: queryResult.isError,
        error: queryResult.error,
        refetch: queryResult.refetch
    };
};
```

### With Mutation for Updates

```typescript
// src/api/hooks/use-external-data-mutation.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAction } from "convex/react";
import { api } from "convex/_generated/api";

export const useRefreshExternalData = () => {
    const queryClient = useQueryClient();
    const fetchData = useAction(api.feature.feature.getExternalDataAction);

    return useMutation({
        mutationFn: async ({ query }: { query: string }) => {
            return await fetchData({ query });
        },
        onSuccess: (data, { query }) => {
            // Update cache with new data
            queryClient.setQueryData(["externalData", query], data);
        }
    });
};
```

## Paginated Query Hook

```typescript
// src/api/hooks/use-list-items-paginated.ts
import { usePaginatedQuery } from "convex/react";
import { api } from "convex/_generated/api";

export type UseListItemsPaginatedArgs = {
    userId: Id<"users">;
    status?: string;
    pageSize?: number;
};

export const useListItemsPaginated = ({
    userId,
    status,
    pageSize = 20
}: UseListItemsPaginatedArgs) => {
    const {
        results,
        status: paginationStatus,
        loadMore,
        isLoading
    } = usePaginatedQuery(
        api.feature.feature.listItemsPaginated,
        { userId, status },
        { initialNumItems: pageSize }
    );

    return {
        items: results,
        isLoading,
        canLoadMore: paginationStatus === "CanLoadMore",
        isLoadingMore: paginationStatus === "LoadingMore",
        loadMore: () => loadMore(pageSize)
    };
};
```

## Combined Hook Pattern

Sometimes you need to combine multiple data sources:

```typescript
// src/api/hooks/use-item-with-details.ts
import { useQuery } from "convex/react";
import { useQuery as useReactQuery } from "@tanstack/react-query";
import { useAction } from "convex/react";
import { api } from "convex/_generated/api";

export const useItemWithDetails = (itemId: Id<"items"> | undefined) => {
    // Real-time Convex query
    const item = useQuery(
        api.feature.feature.getItemById,
        itemId ? { id: itemId } : "skip"
    );

    // External data via action + React Query
    const fetchDetails = useAction(api.feature.feature.getItemDetailsAction);

    const { data: details, isLoading: detailsLoading } = useReactQuery({
        queryKey: ["itemDetails", itemId],
        enabled: Boolean(itemId),
        queryFn: () => fetchDetails({ itemId: itemId! }),
        staleTime: 5 * 60 * 1000  // 5 minutes
    });

    return {
        item,
        details,
        isLoading: item === undefined || detailsLoading
    };
};
```

## Error Handling Pattern

```typescript
// src/api/hooks/use-safe-mutation.ts
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { useState, useCallback } from "react";
import { toast } from "sonner";

export const useSafeMutation = () => {
    const mutation = useMutation(api.feature.feature.riskyOperation);
    const [isLoading, setIsLoading] = useState(false);

    const execute = useCallback(async (args: { data: string }) => {
        setIsLoading(true);

        try {
            const result = await mutation(args);
            toast.success("Operation completed successfully");
            return result;
        } catch (error) {
            // Handle Convex errors
            if (error instanceof Error) {
                const message = error.message;

                // Check for specific error types
                if (message.includes("Unauthorized")) {
                    toast.error("You don't have permission to perform this action");
                } else if (message.includes("not found")) {
                    toast.error("The item was not found");
                } else {
                    toast.error("An error occurred");
                }

                console.error("Mutation error:", error);
            }
            throw error;
        } finally {
            setIsLoading(false);
        }
    }, [mutation]);

    return { execute, isLoading };
};
```

## React Query Configuration

Standard options for external data hooks:

```typescript
// Long-lived financial data
const FINANCIAL_DATA_OPTIONS = {
    staleTime: 60 * 60 * 1000,     // 1 hour
    gcTime: 60 * 60 * 1000,        // 1 hour
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false
};

// Frequently changing data
const LIVE_DATA_OPTIONS = {
    staleTime: 30 * 1000,          // 30 seconds
    gcTime: 5 * 60 * 1000,         // 5 minutes
    refetchOnWindowFocus: true,
    refetchInterval: 30 * 1000     // Poll every 30s
};

// User-specific data
const USER_DATA_OPTIONS = {
    staleTime: 5 * 60 * 1000,      // 5 minutes
    gcTime: 30 * 60 * 1000,        // 30 minutes
    refetchOnWindowFocus: true
};
```

## Usage Examples

```typescript
// In a component
const { items, isLoading } = useListItems({
    userId: currentUser._id,
    status: "active"
});

const { createItem, isLoading: isCreating } = useCreateItem();

const handleCreate = async () => {
    const id = await createItem({ name: "New Item" });
    navigate(`/items/${id}`);
};

// Paginated list
const { items, loadMore, canLoadMore, isLoadingMore } = useListItemsPaginated({
    userId: currentUser._id,
    pageSize: 20
});

return (
    <div>
        {items.map(item => <ItemCard key={item._id} item={item} />)}
        {canLoadMore && (
            <button onClick={loadMore} disabled={isLoadingMore}>
                {isLoadingMore ? "Loading..." : "Load More"}
            </button>
        )}
    </div>
);
```

## Best Practices

1. **Use Convex `useQuery` for real-time data** - automatic reactivity
2. **Use React Query for external data** - caching and deduplication
3. **Always handle loading and error states**
4. **Use `"skip"` for conditional queries** - not `enabled: false`
5. **Set appropriate `staleTime` and `gcTime`** - prevent unnecessary refetches
6. **Export argument types** - for component prop typing
7. **Return normalized shape** - `{ data, isLoading, error }`
