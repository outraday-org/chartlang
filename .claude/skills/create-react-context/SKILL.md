---
name: create-react-context
description: Guide for creating React contexts following project patterns with context selectors for performance. Use when building state containers, shared context providers, or component coordination.
---

# Create React Context

This skill guides you through creating React contexts following project patterns.

## Pattern Overview

The project uses `@fluentui/react-context-selector` to minimize re-renders. This allows components to subscribe to specific parts of the context.

## Basic Pattern

```typescript
// src/contexts/MyContext.tsx
import { createContext, useContextSelector } from "@fluentui/react-context-selector";
import { useMemo, type ReactNode } from "react";

// 1. Define context type
type MyContextValue = {
    data: string;
    count: number;
    updateData: (value: string) => void;
    increment: () => void;
};

// 2. Create context with undefined default
const MyContext = createContext<MyContextValue | undefined>(undefined);

// 3. Create selector hook with error boundary
export const useMyContext = <T,>(
    selector: (state: MyContextValue) => T
): T => {
    const selection = useContextSelector(MyContext, (ctx) => {
        if (ctx === undefined) {
            throw new Error("useMyContext must be used within MyProvider");
        }
        return selector(ctx);
    });
    return selection;
};

// 4. Create provider component
type MyProviderProps = {
    initialData?: string;
    children: ReactNode;
};

export const MyProvider = ({ initialData = "", children }: MyProviderProps) => {
    const [data, setData] = useState(initialData);
    const [count, setCount] = useState(0);

    // 5. Memoize value to prevent unnecessary re-renders
    const value = useMemo<MyContextValue>(
        () => ({
            data,
            count,
            updateData: setData,
            increment: () => setCount((c) => c + 1)
        }),
        [data, count]
    );

    return <MyContext.Provider value={value}>{children}</MyContext.Provider>;
};
```

## Usage in Components

```tsx
// Only re-renders when `data` changes
const DataDisplay = () => {
    const data = useMyContext((ctx) => ctx.data);
    return <div>{data}</div>;
};

// Only re-renders when `count` changes
const CountDisplay = () => {
    const count = useMyContext((ctx) => ctx.count);
    return <div>Count: {count}</div>;
};

// Gets function reference (stable, won't cause re-renders)
const IncrementButton = () => {
    const increment = useMyContext((ctx) => ctx.increment);
    return <button onClick={increment}>+</button>;
};

// Multiple values (re-renders when either changes)
const Summary = () => {
    const data = useMyContext((ctx) => ctx.data);
    const count = useMyContext((ctx) => ctx.count);
    return <div>{data}: {count}</div>;
};
```

## Simple Context (No Selector Optimization)

For simple contexts where re-render optimization isn't critical:

```typescript
// src/contexts/SimpleContext.tsx
import { createContext, useContext, type ReactNode } from "react";

type SimpleContextValue = {
    isExpanded: boolean;
    setIsExpanded: (expanded: boolean) => void;
};

const SimpleContext = createContext<SimpleContextValue | null>(null);

export const useSimpleContext = (): SimpleContextValue => {
    const context = useContext(SimpleContext);
    if (!context) {
        throw new Error("useSimpleContext must be used within SimpleProvider");
    }
    return context;
};

export const SimpleProvider = SimpleContext.Provider;
```

## Context with Editor State (TLDraw Pattern)

```typescript
// src/components/project/shapes/shared/SharedShapeContext.tsx
import { createContext, useContextSelector } from "@fluentui/react-context-selector";
import type { Editor, TLShapeId } from "tldraw";

type SharedShapeContextValue = {
    editor: Editor;
    shapeId: TLShapeId;
    symbols: Array<string>;
    rawSymbols: Array<string>;
    selectedSymbolIndex: number;
    setSelectedSymbolIndex: (index: number) => void;
};

const SharedShapeContext = createContext<SharedShapeContextValue | undefined>(undefined);

export const useSharedShapeContext = <T,>(
    selector: (state: SharedShapeContextValue) => T
): T => {
    const selection = useContextSelector(SharedShapeContext, (ctx) => {
        if (ctx === undefined) {
            throw new Error("useSharedShapeContext must be within SharedShapeContextProvider");
        }
        return selector(ctx);
    });
    return selection;
};

type ProviderProps = {
    editor: Editor;
    shapeId: TLShapeId;
    symbolSourceTab: string;
    symbols: Array<string>;
    sourceListId?: string;
    children: ReactNode;
};

export const SharedShapeContextProvider = ({
    editor,
    shapeId,
    symbolSourceTab,
    symbols: propSymbols,
    sourceListId,
    children
}: ProviderProps) => {
    const [selectedSymbolIndex, setSelectedSymbolIndex] = useState(0);

    // Use custom hook for symbol resolution
    const { rawSymbols, resolvedSymbols } = useSymbolSources({
        editor,
        shapeId,
        symbolSourceTab,
        symbols: propSymbols,
        sourceListId
    });

    const value = useMemo<SharedShapeContextValue>(
        () => ({
            editor,
            shapeId,
            symbols: resolvedSymbols,
            rawSymbols,
            selectedSymbolIndex,
            setSelectedSymbolIndex
        }),
        [editor, shapeId, resolvedSymbols, rawSymbols, selectedSymbolIndex]
    );

    return (
        <SharedShapeContext.Provider value={value}>
            {children}
        </SharedShapeContext.Provider>
    );
};
```

## Context with Derived State

```typescript
// src/contexts/FilterContext.tsx
import { createContext, useContextSelector } from "@fluentui/react-context-selector";

type FilterContextValue = {
    // Raw state
    searchQuery: string;
    selectedTags: Array<string>;
    sortBy: "name" | "date" | "size";

    // Derived state (computed from raw state)
    hasActiveFilters: boolean;
    filterCount: number;

    // Actions
    setSearchQuery: (query: string) => void;
    toggleTag: (tag: string) => void;
    setSortBy: (sort: "name" | "date" | "size") => void;
    clearFilters: () => void;
};

const FilterContext = createContext<FilterContextValue | undefined>(undefined);

export const useFilterContext = <T,>(
    selector: (state: FilterContextValue) => T
): T => {
    return useContextSelector(FilterContext, (ctx) => {
        if (!ctx) throw new Error("Must be within FilterProvider");
        return selector(ctx);
    });
};

export const FilterProvider = ({ children }: { children: ReactNode }) => {
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedTags, setSelectedTags] = useState<Array<string>>([]);
    const [sortBy, setSortBy] = useState<"name" | "date" | "size">("name");

    // Derived state
    const hasActiveFilters = searchQuery !== "" || selectedTags.length > 0;
    const filterCount = (searchQuery ? 1 : 0) + selectedTags.length;

    const value = useMemo<FilterContextValue>(
        () => ({
            searchQuery,
            selectedTags,
            sortBy,
            hasActiveFilters,
            filterCount,
            setSearchQuery,
            toggleTag: (tag) =>
                setSelectedTags((tags) =>
                    tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag]
                ),
            setSortBy,
            clearFilters: () => {
                setSearchQuery("");
                setSelectedTags([]);
            }
        }),
        [searchQuery, selectedTags, sortBy, hasActiveFilters, filterCount]
    );

    return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
};
```

## Compound Component Pattern

```typescript
// src/components/Tabs/TabsContext.tsx
type TabsContextValue = {
    activeTab: string;
    setActiveTab: (tab: string) => void;
};

const TabsContext = createContext<TabsContextValue | undefined>(undefined);

const useTabs = () => {
    const context = useContext(TabsContext);
    if (!context) throw new Error("Must be within Tabs");
    return context;
};

// Root component provides context
const TabsRoot = ({ defaultTab, children }: { defaultTab: string; children: ReactNode }) => {
    const [activeTab, setActiveTab] = useState(defaultTab);

    const value = useMemo(
        () => ({ activeTab, setActiveTab }),
        [activeTab]
    );

    return <TabsContext.Provider value={value}>{children}</TabsContext.Provider>;
};

// Child components consume context
const TabsList = ({ children }: { children: ReactNode }) => (
    <div role="tablist">{children}</div>
);

const Tab = ({ value, children }: { value: string; children: ReactNode }) => {
    const { activeTab, setActiveTab } = useTabs();
    return (
        <button
            role="tab"
            aria-selected={activeTab === value}
            onClick={() => setActiveTab(value)}
        >
            {children}
        </button>
    );
};

const TabPanel = ({ value, children }: { value: string; children: ReactNode }) => {
    const { activeTab } = useTabs();
    if (activeTab !== value) return null;
    return <div role="tabpanel">{children}</div>;
};

// Export compound component
export const Tabs = {
    Root: TabsRoot,
    List: TabsList,
    Tab: Tab,
    Panel: TabPanel
};
```

## Best Practices

### Do's

1. **Always memoize provider value** with `useMemo`
2. **Use context selectors** for performance-critical contexts
3. **Throw error when used outside provider** - fail fast
4. **Keep context focused** - single responsibility
5. **Export provider and hook separately**

### Don'ts

1. **Don't put frequently changing values in context** - use local state
2. **Don't create deeply nested providers** - consider composition
3. **Don't use context for server state** - use React Query/Convex
4. **Don't forget to memoize callbacks** in context value

## File Checklist

- [ ] Create context file in `src/contexts/` or near components
- [ ] Define `ContextValue` type
- [ ] Create context with `createContext<T | undefined>(undefined)`
- [ ] Create `useXxxContext` hook with error handling
- [ ] Create `XxxProvider` with memoized value
- [ ] Export hook and provider
