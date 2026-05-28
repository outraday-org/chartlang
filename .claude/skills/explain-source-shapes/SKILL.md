---
name: explain-source-shapes
description: Explains source shape connection logic including CompanyShape, CompanyListShape, symbol resolution, and port compatibility. Use when working with canvas connections or symbol flow between shapes.
---

# Source Shapes Connection Logic

This skill explains how source shapes (CompanyShape, CompanyListShape) connect
to target shapes and how symbols are resolved from multiple sources.

## Overview

The canvas supports connections between "source" shapes that provide ticker
symbols and "target" shapes (like FundamentalChart) that display data for those
symbols. This system handles:

- Single company sources (CompanyShape)
- Watchlist sources (CompanyListShape)
- Global symbol placeholder (`__GLOBAL__`)
- Mutual exclusivity rules

## Source Shape Definitions

### CompanyShape

Represents a single company ticker:

```typescript
// convex/canvas/customShapes/shapes/companyShape.ts
type TCompanyShape = {
    type: "company";
    symbol: string; // Ticker symbol (e.g., "AAPL") or "__GLOBAL__"
    w: number;
    h: number;
    border: string;
    borderStyle?: string;
};
```

### CompanyListShape

References a watchlist from the database:

```typescript
// convex/canvas/customShapes/shapes/companyListShape.ts
type TCompanyListShape = {
    type: "company-list";
    companyListId?: string; // Reference to companyLists table
    w: number;
    h: number;
    border: string;
    borderStyle?: string;
};
```

## Symbol Source Tabs

Target shapes use `SymbolSourceTab` to determine their symbol source:

```typescript
// convex/canvas/customShapes/shapes/shared/symbolSourceTab.ts
enum SymbolSourceTab {
    CUSTOM = "custom", // Manual symbols in symbols[] array
    GLOBAL = "global", // Uses ProjectContext.selectedSymbol
    COMPANY_LIST = "company-list", // Library watchlist via sourceListId
    CONNECTED = "connected", // Canvas connections (Company/CompanyList shapes)
}
```

## Connection Rules (Mutual Exclusivity)

**Core Rule**: A target shape (e.g., FundamentalChart) can have EITHER:

- Single companies (manual symbols + CompanyShape connections), OR
- One watchlist (library watchlist OR CompanyListShape connection)

**Never both categories simultaneously.**

### Allowed States

| State                  | Description                                         |
| ---------------------- | --------------------------------------------------- |
| Empty                  | No symbols or connections                           |
| Manual only            | Symbols added via UI                                |
| CompanyShapes only     | Multiple CompanyShape connections                   |
| Manual + CompanyShapes | Both (same category)                                |
| Library watchlist      | `sourceListId` set, `symbolSourceTab: COMPANY_LIST` |
| CompanyListShape       | Single CompanyListShape connection                  |

### Forbidden States

| State                      | Reason                     |
| -------------------------- | -------------------------- |
| Manual + Watchlist         | Category conflict          |
| CompanyShapes + Watchlist  | Category conflict          |
| Library + CompanyListShape | Only one watchlist allowed |
| Multiple CompanyListShapes | Only one watchlist allowed |

## Connection Enforcement

Connection rules are enforced in
`validateAndEnforceFundamentalChartConnectionRules()`:

### When CompanyListShape Connects

1. **Removes**: All CompanyShape connections
2. **Removes**: All other CompanyListShape connections
3. **Clears**: Manual symbols (`symbols[]` emptied)
4. **Keeps**: Library watchlist (`sourceListId`) - overridden by
   `symbolSourceTab: CONNECTED`

```typescript
// Toast message examples:
"2 company shape(s) and 3 manual symbol(s) were disconnected from this chart.";
"1 watchlist shape(s) were disconnected from this chart.";
```

### When CompanyShape Connects

1. **Removes**: All CompanyListShape connections
2. **Removes**: Library watchlist (clears `sourceListId`, sets
   `symbolSourceTab: CUSTOM`)
3. **Keeps**: Other CompanyShape connections (multiple allowed)
4. **Keeps**: Manual symbols (same category)

```typescript
// Toast message examples:
"1 watchlist shape(s) were disconnected from this chart.";
"The library watchlist was disconnected from this chart.";
```

## Global Symbol Placeholder

```typescript
// convex/canvas/customShapes/shapes/shared/globalSymbol.ts
const GLOBAL_SYMBOL_PLACEHOLDER = "__GLOBAL__";
```

### Behavior

- Dynamically resolves to `ProjectContext.selectedSymbol`
- CompanyShape can have `symbol: "__GLOBAL__"`
- Stored as placeholder, resolved at runtime
- Multiple entries possible: `__GLOBAL__` (CompanyShape) + "AAPL" (manual) = 2
  separate entries

### Resolution

```typescript
// In use-symbol-sources.ts
const resolvedSymbols = rawSymbols.map((sym) =>
    sym === "__GLOBAL__" && globalSymbol ? globalSymbol : sym
);
```

## Symbol Resolution Hook

Central hook for all symbol calculations:

```typescript
// src/components/canvas/hooks/use-symbol-sources.ts

type UseSymbolSourcesParams = {
    editor?: Editor;
    shapeId?: TLShapeId;
    symbolSourceTab: SymbolSourceTab;
    symbols: string[]; // Manual symbols (legacy)
    symbolEntries?: SymbolEntry[]; // Symbols with source info
    sourceListId?: string; // Library watchlist ID
};
```

### Output Values

| Property                | Description                    | Deduplication | `__GLOBAL__`        |
| ----------------------- | ------------------------------ | ------------- | ------------------- |
| `rawEntries`            | For UI/index calculations      | No            | Kept as placeholder |
| `rawSymbols`            | String array (backward compat) | No            | Kept as placeholder |
| `resolvedSymbols`       | For chart display              | No            | Resolved            |
| `resolvedUniqueSymbols` | For API queries                | Yes           | Resolved            |

### SymbolEntry Type

```typescript
type SymbolEntry = {
    ticker: string;
    source: "manual" | "companyShape";
    shapeId?: string; // Only for companyShape source
};
```

## Connection State Management

### getConnectedSourceTickers()

```typescript
// src/components/canvas/shapes/shared/components/ports/lib/getConnectedSourceTickers.ts
type ConnectedSourceTickers = {
    companySymbols: string[]; // Tickers from CompanyShapes
    companyListIds: string[]; // IDs from CompanyListShapes
    companyShapeIdToSymbol: Record<string, string>; // ShapeId -> ticker
};
```

- Scans all connections to the target shape
- Filters by `PortType.SOURCE` shapes only
- Used by `useSymbolSources` for reactive updates

### connectionState

```typescript
// src/components/canvas/shapes/connection/lib/connectionState.ts
type ConnectionState = {
    draggingConnectionId: TLShapeId | null;
    pendingRemovalConnectionIds: Set<TLShapeId>;
};
```

- Tracks in-progress connection drags
- Marks connections for visual removal indicator (dashed lines)

## Undo Functionality

### Toast with Undo Action

Canvas connections show toast with undo option:

- Duration: 8 seconds
- Restores all removed connections
- Restores manual symbols
- Restores library watchlist

### Race Condition Protection

```typescript
const pendingUndoOperations = new Map<TLShapeId, PendingUndoOperation>();

type PendingUndoOperation = {
    isProcessing: boolean;
    toastId: string | number;
    createdAt: number;
};
```

- Only one pending undo per chart
- New action dismisses previous toast
- Lock during undo processing

## BringToFront Logic

When clicking a CompanyShape, the chart's `selectedSymbolIndex` updates:

```typescript
// src/components/canvas/shapes/shared/lib/bringSymbolToFront.ts
function bringSymbolToFront(
    editor: Editor,
    targetShapeId: TLShapeId,
    companyShapeId: TLShapeId,
): void;
```

### Key Behavior

- Searches by **ShapeId**, not symbol string
- Handles duplicate symbols correctly (two CompanyShapes with same ticker)
- Works with `__GLOBAL__` (matches by ShapeId, not resolved value)

## Visual Indicators

### During Connection Drag

- **Eligible ports**: Highlighted when compatible
- **Pending removal**: Dashed lines, reduced opacity for connections that will
  be removed

### After Connection

- `symbolSourceTab` automatically switches to `CONNECTED` when
  CompanyShape/CompanyListShape connects
- Switches back to `CUSTOM` when last connection removed

## Connection Compatibility

Connection rules are defined via `ALLOWED_INPUT_SHAPES` — which shape types can
connect as inputs to each target shape:

```typescript
// src/components/canvas/shapes/shared/components/ports/lib/connectionCompatibilityMap.ts
export const TICKER_SOURCE_SHAPES = [
    CustomCanvasShapeType.COMPANY,
    CustomCanvasShapeType.COMPANY_LIST,
] as const;

export const ALLOWED_INPUT_SHAPES: Record<CustomCanvasShapeType, ReadonlyArray<CustomCanvasShapeType>> = {
    [CustomCanvasShapeType.FUNDAMENTAL_CHART]: TICKER_SOURCE_SHAPES,
    [CustomCanvasShapeType.AGENT]: ALL_OUTPUT_SHAPES,
    [CustomCanvasShapeType.EARNINGS_CALL]: TICKER_SOURCE_SHAPES,
    [CustomCanvasShapeType.FILING]: TICKER_SOURCE_SHAPES,
    [CustomCanvasShapeType.OUTPUT]: ALL_OUTPUT_SHAPES,
    // Output-only (no input ports):
    [CustomCanvasShapeType.COMPANY]: [],
    [CustomCanvasShapeType.COMPANY_LIST]: [],
    // ...
};

// Helper functions:
canShapeConnectTo(sourceType, targetType): boolean
hasInputPort(shapeType): boolean
hasOutputPort(shapeType): boolean
isTickerSourceShape(shapeType): boolean
```

## Integration with FundamentalChart

The FundamentalChart uses `SharedShapeContextProvider` which wraps
`useSymbolSources`:

```tsx
// FundamentalChartShapeComponent.tsx
<SharedShapeContextProvider
    editor={editor}
    shapeId={partialShape.id}
    symbolSourceTab={partialShape.props.symbolSourceTab}
    symbols={partialShape.props.symbols}
    sourceListId={partialShape.props.sourceListId}
>
    <FundamentalChart ... />
</SharedShapeContextProvider>
```

Components access symbols via:

```typescript
const symbols = useSharedShapeContext((s) => s.symbols); // Resolved
const rawSymbols = useSharedShapeContext((s) => s.rawSymbols); // Raw
const connectedCompanySymbols = useSharedShapeContext((s) =>
    s.connectedCompanySymbols
);
```

## Key Files Reference

| File                           | Purpose                                |
| ------------------------------ | -------------------------------------- |
| `ConnectionShape.tsx`          | Connection rules enforcement           |
| `connectionState.ts`           | Drag state and pending removals        |
| `use-symbol-sources.ts`        | Central symbol resolution              |
| `getConnectedSourceTickers.ts` | Extract connected shape data           |
| `SharedShapeContext.tsx`       | Context provider with resolved symbols |
| `bringSymbolToFront.ts`        | Selected symbol index management       |
| `globalSymbol.ts`              | `__GLOBAL__` placeholder constant      |
| `symbolSourceTab.ts`           | `SymbolSourceTab` enum                 |

## Implementation Checklist

When adding a new target shape that accepts symbol connections:

- [ ] Add `symbolSourceTab` prop to shape definition
- [ ] Add `symbols` array prop for manual symbols
- [ ] Add `sourceListId` optional prop for library watchlist
- [ ] Wrap component in `SharedShapeContextProvider`
- [ ] Use `useSymbolSources` or context for symbol resolution
- [ ] Handle `symbolSourceTab` changes in UI
- [ ] Add connection validation rules if needed
- [ ] Test with all source types (manual, CompanyShape, CompanyListShape,
      global)
