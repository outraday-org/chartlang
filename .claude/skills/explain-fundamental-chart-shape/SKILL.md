---
name: explain-fundamental-chart-shape
description: |
  Explains the FundamentalChart shape architecture including Convex settings storage,
  lazy creation pattern, asset system, deletion flow, templates, and radial menu integration.
  Use as a reference when creating new shapes that store settings in Convex.
user_invocable: true
---

# Fundamental Chart Shape Pattern

The FundamentalChart shape demonstrates a pattern for TLDraw shapes that store comprehensive
settings in Convex rather than in the shape props. This enables real-time sync, cross-project
sharing, and asset management.

## Architecture Overview

### Separation of Canvas Props vs Convex Settings

**Canvas Props (minimal)** - Stored in TLDraw shape on the canvas:
- `w`, `h` - Dimensions (TLDraw canvas properties)
- `convexId` - Reference to Convex record (the only prop linking to settings)

**Convex Settings (comprehensive)** - Stored in `fundamentalCharts` table:
- All chart configuration: metrics, timeframe, colors, display options
- Asset metadata: `savedAsAsset`, `projectIds`, `name`
- Enables cross-project sharing and real-time sync

### File Structure

```
convex/
├── fundamentalChart/
│   ├── fundamentalChart.ts      # CRUD operations (11 functions)
│   └── types.ts                 # Settings validator, map conversion
├── fundamentalChartTemplates/
│   ├── fundamentalChartTemplates.ts  # Template CRUD
│   └── types.ts                      # Template settings validator
├── schema.ts                    # Table definition (lines 160-169)

src/components/project/shapes/fundamental-chart/
├── hooks/
│   ├── use-fundamental-chart-settings.ts  # Lazy creation pattern
│   ├── use-sync-project-id.ts             # Cross-project tracking
│   └── use-missing-record-recovery.ts     # Recovery from deleted records
├── lib/
│   └── clear-convex-id-from-projects.ts   # Deletion helper
├── constants/
│   └── default-settings.ts                # Default settings

src/components/project/components/canvas/radial-menu/
├── RadialMenu.tsx                         # Main radial menu component
├── actions/
│   ├── radial-action-registry.ts          # Action registry pattern
│   └── company-radial-actions.tsx         # Company shape radial actions

src/components/project/components/canvas/canvas-settings-panel/
├── components/radial-actions/radial-fundamental-chart/
│   ├── RadialFundamentalChartSettings.tsx # Radial settings panel
│   └── use-radial-fundamental-chart.ts    # Chart creation from radial

worker/do/TldrawDurableObject.ts           # Worker route for deletion flow

src/routes/(app)/_app/fundamental-chart/
├── -hooks/
│   ├── use-fundamental-chart-page-settings.ts  # Dual-mode settings
│   └── use-save-as-asset.ts                    # Asset saving
```

### Data Flow

```
┌─────────────────┐     convexId      ┌─────────────────────┐
│  TLDraw Shape   │ ────────────────> │  Convex Database    │
│  (Canvas)       │                   │  fundamentalCharts  │
│                 │                   │                     │
│  props.convexId │ <──── settings ── │  settings: {...}    │
└─────────────────┘       (query)     │  projectIds: [...]  │
                                      │  savedAsAsset: bool │
                                      └─────────────────────┘
```

---

## 1. Convex Settings Storage Pattern

### Table Schema

```typescript
// convex/schema.ts (lines 160-169)
fundamentalCharts: defineTable({
    userId: v.id("users"),
    name: v.string(),
    savedAsAsset: v.boolean(),
    projectIds: v.array(v.id("projects")),
    settings: vFundamentalChartSettings,
    updatedAt: v.number()
})
    .index("by_userId", ["userId"])
    .index("by_userId_and_savedAsAsset", ["userId", "savedAsAsset"])
    .index("by_userId_and_savedAsAsset_and_updatedAt", ["userId", "savedAsAsset", "updatedAt"])
```

### Settings Validator with Map-to-Array Conversion

Convex doesn't support `Record<string, T>` directly. Convert to `Array<{key, value}>`:

```typescript
// convex/fundamentalChart/types.ts

// Entry type for overrides
export const vMetricColorOverrideEntry = v.object({
    key: v.string(),
    value: v.string()
});

// In the main settings validator
export const vFundamentalChartSettings = v.object({
    // ... other fields ...

    // Per-metric overrides (converted from z.record to arrays)
    metricColorOverrides: v.optional(v.union(v.array(vMetricColorOverrideEntry), v.null())),
    // ...
});

// Utility functions for conversion
export function entriesToRecord<T>(entries: Array<MapEntry<T>> | null | undefined): null | Record<string, T> {
    if (!entries) return null;
    return Object.fromEntries(entries.map((e) => [e.key, e.value]));
}

export function recordToEntries<T>(record: null | Record<string, T> | undefined): Array<MapEntry<T>> | null {
    if (!record) return null;
    return Object.entries(record).map(([key, value]) => ({ key, value }));
}
```

### CRUD Operations

The `fundamentalChart.ts` file provides 11 functions:

| Function | Purpose |
|----------|---------|
| `getFundamentalChart` | Get single chart by ID |
| `batchGetFundamentalCharts` | Get multiple charts by IDs |
| `listUserFundamentalCharts` | List user's charts with pagination |
| `createFundamentalChart` | Create new chart |
| `updateFundamentalChartSettings` | Shallow merge update settings |
| `updateFundamentalChartName` | Update chart name |
| `addCanvasToFundamentalChart` | Add project to projectIds |
| `removeCanvasFromFundamentalChart` | Remove project from projectIds |
| `deleteFundamentalChart` | Delete chart |
| `updateSavedAsAsset` | Toggle asset flag |
| `maybeDeleteOrphanedFundamentalChart` | Cleanup non-asset orphans |
| `cloneFundamentalChart` | Clone chart for duplication |
| `detachFromAsset` | Create independent copy from asset |

### Shallow Merge Update Pattern

```typescript
// convex/fundamentalChart/fundamentalChart.ts
export const updateFundamentalChartSettings = mutation({
    args: {
        id: v.id("fundamentalCharts"),
        settings: vFundamentalChartSettings.partial() // Accept partial settings
    },
    returns: v.null(),
    handler: async (ctx, { id, settings }) => {
        const existing = await ctx.db.get(id);

        // Shallow merge at settings level
        const mergedSettings = {
            ...existing.settings,
            ...Object.fromEntries(
                Object.entries(settings as Record<string, unknown>).filter(([_, val]) => val !== undefined)
            )
        };

        await ctx.db.patch(id, { settings: mergedSettings, updatedAt: Date.now() });
        return null;
    }
});
```

---

## 2. Lazy Creation Pattern

The shape doesn't create a Convex record until the user makes their first edit.

### Hook Implementation

```typescript
// src/components/project/shapes/fundamental-chart/hooks/use-fundamental-chart-settings.ts

export const useFundamentalChartSettings = ({
    editor,
    shapeId,
    convexId,
    projectId
}: {
    editor: Editor;
    shapeId: TLShapeId;
    convexId: null | string | undefined;
    projectId: Id<"projects">;
}) => {
    // Query Convex if convexId exists, skip otherwise
    const convexRecord = useQuery(
        api.fundamentalChart.fundamentalChart.getFundamentalChart,
        convexId ? { id: convexId as Id<"fundamentalCharts"> } : "skip"
    );

    // Concurrency protection refs
    const isCreatingRef = useRef(false);
    const pendingConvexIdRef = useRef<Id<"fundamentalCharts"> | null>(null);

    // Mutations
    const createFundamentalChart = useMutation(api.fundamentalChart.fundamentalChart.createFundamentalChart);
    const updateFundamentalChartSettings = useMutation(
        api.fundamentalChart.fundamentalChart.updateFundamentalChartSettings
    );

    // Determine settings source
    const settings: FundamentalChartSettings =
        convexId && convexRecord ? convexRecord.settings : DEFAULT_FUNDAMENTAL_CHART_SETTINGS;

    const isLoading = convexId !== undefined && convexRecord === undefined;

    const updateSettings: UpdateSettingsFn = useCallback(
        async (newSettings) => {
            // Case 1: Existing record - just update
            if (convexId) {
                await updateFundamentalChartSettings({
                    id: convexId as Id<"fundamentalCharts">,
                    settings: newSettings
                });
                return;
            }

            // Case 2: Creation completed but shape not updated yet
            if (pendingConvexIdRef.current) {
                await updateFundamentalChartSettings({
                    id: pendingConvexIdRef.current,
                    settings: newSettings
                });
                return;
            }

            // Case 3: First edit - lazy creation
            if (isCreatingRef.current) return; // Prevent duplicates
            isCreatingRef.current = true;

            try {
                const newId = await createFundamentalChart({
                    name: "Untitled Chart",
                    settings: { ...DEFAULT_FUNDAMENTAL_CHART_SETTINGS, ...newSettings },
                    savedAsAsset: false,
                    projectIds: [projectId]
                });

                pendingConvexIdRef.current = newId;

                // Update shape with new convexId
                (editor.updateShape as (shape: unknown) => void)({
                    id: shapeId,
                    type: CustomCanvasShapeType.FUNDAMENTAL_CHART,
                    props: { convexId: newId }
                });
            } finally {
                isCreatingRef.current = false;
            }
        },
        [convexId, editor, shapeId, projectId, createFundamentalChart, updateFundamentalChartSettings]
    );

    return { settings, name, isLoading, updateSettings, updateName, convexRecord };
};
```

### Three Cases Handled

1. **Existing record** - `convexId` exists, update directly
2. **Pending creation** - `pendingConvexIdRef.current` has ID, use that
3. **First edit** - Create record, store ID in ref, update shape props

---

## 3. Recovery & Sync Hooks

### Missing Record Recovery

Handles when a shape's `convexId` points to a deleted record:

```typescript
// src/components/project/shapes/fundamental-chart/hooks/use-missing-record-recovery.ts

export const useMissingRecordRecovery = ({
    editor,
    shapeId,
    convexId,
    convexRecord
}: {
    editor: Editor;
    shapeId: TLShapeId;
    convexId: string | undefined;
    convexRecord: Doc<"fundamentalCharts"> | null | undefined;
}): void => {
    const hasCheckedRef = useRef(false);

    useEffect(() => {
        if (hasCheckedRef.current) return;
        if (!convexId) return;
        if (convexRecord === undefined) return; // Still loading

        hasCheckedRef.current = true;

        if (convexRecord === null) {
            // Record doesn't exist - clear convexId
            toast.error(t`Chart settings not found. Using defaults.`);

            (editor.updateShape as (shape: unknown) => void)({
                id: shapeId,
                type: CustomCanvasShapeType.FUNDAMENTAL_CHART,
                props: { convexId: undefined }
            });
        }
    }, [editor, shapeId, convexId, convexRecord]);
};
```

### Sync Project ID

Tracks which projects use each chart for cross-project visibility:

```typescript
// src/components/project/shapes/fundamental-chart/hooks/use-sync-project-id.ts

export const useSyncProjectId = ({
    convexId,
    projectId
}: {
    convexId: string | undefined;
    projectId: Id<"projects">;
}): void => {
    const addProject = useMutation(api.fundamentalChart.fundamentalChart.addCanvasToFundamentalChart);
    const convexRecord = useQuery(/* ... */);
    const hasAttemptedRef = useRef(false);

    useEffect(() => {
        if (!convexId || !convexRecord || hasAttemptedRef.current) return;

        const alreadyPresent = convexRecord.projectIds.some((pid) => pid === projectId);
        if (alreadyPresent) return;

        hasAttemptedRef.current = true;

        addProject({ id: convexId as Id<"fundamentalCharts">, projectId })
            .catch((error) => {
                console.error("Failed to add projectId:", error);
                hasAttemptedRef.current = false; // Allow retry
            });
    }, [convexId, convexRecord, projectId, addProject]);
};
```

---

## 4. Asset System

### `savedAsAsset` Flag Behavior

- **false (default)**: Chart is tied to its project. Deleted when orphaned.
- **true**: Chart persists independently. Appears in user's asset library.

### Save as Asset Hook

```typescript
// src/routes/(app)/_app/fundamental-chart/-hooks/use-save-as-asset.ts

export const useSaveAsAsset = (): UseSaveAsAssetReturn => {
    const navigate = useNavigate();
    const createFundamentalChart = useMutation(api.fundamentalChart.fundamentalChart.createFundamentalChart);
    const updateSavedAsAsset = useMutation(api.fundamentalChart.fundamentalChart.updateSavedAsAsset);

    const saveAsAsset = useCallback(
        async ({ mode, convexId, settings, name }: SaveAsAssetArgs): Promise<void> => {
            if (mode === "localStorage") {
                // Create new Convex record with savedAsAsset: true
                const newId = await createFundamentalChart({
                    name,
                    settings,
                    savedAsAsset: true,
                    projectIds: [] // No associated projects for standalone
                });

                void navigate({ to: "/fundamental-chart/$id", params: { id: newId } });
                toast.success("Chart saved as asset");
            } else if (convexId) {
                // Update existing record's savedAsAsset flag
                await updateSavedAsAsset({ id: convexId, savedAsAsset: true });
                toast.success("Chart saved as asset");
            }
        },
        [createFundamentalChart, updateSavedAsAsset, navigate]
    );

    return { saveAsAsset, isSaving: false };
};
```

### Orphan Cleanup

```typescript
// convex/fundamentalChart/fundamentalChart.ts

export const maybeDeleteOrphanedFundamentalChart = mutation({
    args: { id: v.id("fundamentalCharts") },
    returns: v.object({ deleted: v.boolean() }),
    handler: async (ctx, { id }): Promise<{ deleted: boolean }> => {
        const existing = await ctx.db.get(id);

        // Delete if: no projects AND not saved as asset
        if (existing.projectIds.length === 0 && !existing.savedAsAsset) {
            await ctx.db.delete(id);
            return { deleted: true };
        }

        return { deleted: false };
    }
});
```

---

## 5. Deletion Flow (Critical)

**Order is critical**: Clear `convexId` from shapes BEFORE deleting the Convex record.

### Step 1: Clear convexId from All Projects

```typescript
// src/components/project/shapes/fundamental-chart/lib/clear-convex-id-from-projects.ts

export async function clearConvexIdFromProjects(
    projectIds: Array<Id<"projects">>,
    convexId: string
): Promise<Array<ClearConvexIdResult>> {
    const promises = projectIds.map(async (projectId) => {
        const response = await fetch(`/api/projects/${projectId}/clear-convex-id`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ convexId })
        });

        const data = await response.json();
        return { projectId, success: data.success, clearedCount: data.clearedCount };
    });

    return Promise.all(promises);
}
```

### Step 2: Worker Route Handler

```typescript
// worker/do/TldrawDurableObject.ts

.post("/api/projects/:projectId/clear-convex-id", async (request) => {
    // Initialize roomId if needed
    if (!this.roomId) {
        await this.ctx.blockConcurrencyWhile(async () => {
            await this.ctx.storage.put("roomId", request.params.projectId);
            this.roomId = request.params.projectId;
        });
    }

    const body = await request.json();
    const convexId = body.convexId;

    return this.handleClearConvexId(convexId);
})

async handleClearConvexId(convexId: string): Promise<Response> {
    let clearedCount = 0;

    // Strategy 1: Room is loaded in memory - update live room
    if (this.roomPromise) {
        const room = await this.roomPromise;
        const snapshot = room.getCurrentSnapshot();

        const shapesToUpdate: Array<TLRecord> = [];

        for (const doc of snapshot.documents) {
            const state = doc.state as Record<string, unknown>;

            if (state?.typeName === "shape" &&
                state.type === CustomCanvasShapeType.FUNDAMENTAL_CHART) {
                const props = state.props as Record<string, unknown>;

                if (props?.convexId === convexId) {
                    shapesToUpdate.push({
                        ...state,
                        props: { ...props, convexId: undefined }
                    } as TLRecord);
                    clearedCount += 1;
                }
            }
        }

        if (shapesToUpdate.length > 0) {
            room.updateStore((updater) => {
                for (const shape of shapesToUpdate) {
                    updater.put(shape);
                }
            });
        }
    } else {
        // Strategy 2: Room not in memory - update R2 directly
        // (Similar logic but modifies R2 snapshot directly)
    }

    return new Response(JSON.stringify({ success: true, clearedCount }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
    });
}
```

### Deletion Sequence

1. Get `projectIds` from the chart record
2. Call `clearConvexIdFromProjects()` for all projects
3. Wait for all responses
4. Delete the Convex record

---

## 6. Template System

### Templates Table

```typescript
// convex/fundamentalChartTemplates/fundamentalChartTemplates.ts

export const createTemplate = mutation({
    args: {
        name: v.string(),
        description: v.optional(v.string()),
        settings: vFundamentalChartTemplateSettings
    },
    returns: v.id("fundamentalChartTemplates"),
    handler: async (ctx, args) => {
        const user = await ctx.runQuery(internal.users.users.getCurrentUserOrThrow);

        return await ctx.db.insert("fundamentalChartTemplates", {
            userId: user._id,
            name: args.name,
            description: args.description,
            settings: args.settings,
            updatedAt: Date.now()
        });
    }
});
```

### Connected Template Sync

When a chart is connected to a template via `connectedTemplateId`, changes sync automatically:

```typescript
// src/components/project/hooks/sync/use-sync-template-metrics.ts

export const useSyncTemplateMetrics = ({
    settings,
    updateSettings
}: {
    settings: FundamentalChartSettings;
    updateSettings: UpdateSettingsFn;
}) => {
    const allMetricPackages = useFundamentalChartTemplateViews();
    const connectedTemplateId = settings.connectedTemplateId;

    useEffect(() => {
        if (!connectedTemplateId) return;

        const connectedPackage = allMetricPackages.find((pkg) => pkg._id === connectedTemplateId);
        if (!connectedPackage) return;

        // Compare and sync: metrics, hiddenMetrics, all overrides
        const packageMetrics = connectedPackage.metrics;

        if (!isEqual(settings.metrics, packageMetrics)) {
            void updateSettings({ metrics: packageMetrics });
        }

        // ... sync other fields
    }, [connectedTemplateId, settings, updateSettings, allMetricPackages]);
};
```

---

## 7. Radial Actions Menu

### Action Registry Pattern

Register radial menu actions for shape types:

```typescript
// src/components/project/components/canvas/radial-menu/actions/radial-action-registry.ts

const radialActionRegistry = new Map<CustomCanvasShapeType, ShapeRadialConfig>();

export const registerRadialActions = (config: ShapeRadialConfig): void => {
    radialActionRegistry.set(config.shapeType, config);
};

export const getRadialActionsForShape = (shapeType: CustomCanvasShapeType): ShapeRadialConfig | undefined => {
    return radialActionRegistry.get(shapeType);
};
```

### Company Shape Radial Actions

```typescript
// src/components/project/components/canvas/radial-menu/actions/company-radial-actions.tsx

const companyRadialActions: Array<RadialMenuAction> = [
    {
        id: "fundamental-chart",
        icon: BarChart3,
        label: "Fundamental Chart",
        settingsType: CanvasSettingsType.RADIAL_FUNDAMENTAL_CHART,
        angle: 30,        // Position at 30° (upper right)
        radiusOffset: 8,
        isVisible: hasSymbol
    },
    {
        id: "earnings-call",
        icon: Mic,
        label: "Earnings Calls",
        settingsType: CanvasSettingsType.RADIAL_EARNINGS_CALLS,
        angle: 120,       // Position at 120° (lower right)
        radiusOffset: 4,
        isVisible: hasSymbol
    },
    // ... more actions
];

const companyRadialConfig: ShapeRadialConfig = {
    shapeType: CustomCanvasShapeType.COMPANY,
    actions: companyRadialActions,
    radius: 75,
    startAngle: -90
};

registerRadialActions(companyRadialConfig);
```

### Radial Settings Panel

When a radial action is clicked, it opens a settings panel:

```typescript
// src/components/project/components/canvas/canvas-settings-panel/components/
//   radial-actions/radial-fundamental-chart/RadialFundamentalChartSettings.tsx

export const RadialFundamentalChartSettings = ({ editor }: Props) => {
    const {
        activeTab, setActiveTab,
        chartSettings, updateChartSettings,
        handleCreate, handleCreateFromAsset,
        // ... other state and handlers
    } = useRadialFundamentalChart({ editor });

    return (
        <div className="flex w-[280px] flex-col">
            {/* Tab navigation: Recommendations | Create | Assets */}
            <div className="flex items-center ...">
                <button onClick={() => setActiveTab("recommendations")}>Recommendations</button>
                <button onClick={() => setActiveTab("create")}>Create</button>
                <button onClick={() => setActiveTab("assets")}>Assets</button>
            </div>

            {/* Tab content */}
            {activeTab === "recommendations" && <RecommendationsTab onSelectMetric={handleCreateWithMetric} />}
            {activeTab === "create" && <CreateTab ... />}
            {activeTab === "assets" && <AssetsTab onSelectAsset={handleCreateFromAsset} />}
        </div>
    );
};
```

### Chart Creation from Radial Menu

```typescript
// src/components/project/components/canvas/canvas-settings-panel/components/
//   radial-actions/radial-fundamental-chart/use-radial-fundamental-chart.ts

export const useRadialFundamentalChart = ({ editor }: { editor: Editor }) => {
    const radialAngle = useCanvasSettingsContext((c) => c.radialAngle);
    const projectId = useProjectContext((s) => s.project._id);
    const createFundamentalChart = useMutation(api.fundamentalChart.fundamentalChart.createFundamentalChart);

    const handleCreate = useCallback(async (metrics: Array<MetricObject>) => {
        // 1. Build FundamentalChartSettings
        const settings: FundamentalChartSettings = {
            symbols: [ticker],
            metrics,
            // ... other settings
        };

        // 2. Create Convex record
        const convexId = await createFundamentalChart({
            name: `${ticker} ${metricNames}`,
            settings,
            projectIds: [projectId]
        });

        // 3. Calculate position based on radialAngle
        const position = calculateShapePosition({
            sourceBounds: bounds,
            angle: radialAngle ?? 90,
            shapeWidth: defaultProps.w,
            shapeHeight: defaultProps.h
        });

        // 4. Create shape WITHOUT convexId first (avoids clone handler)
        editor.createShape({
            id: newShapeId,
            type: CustomCanvasShapeType.FUNDAMENTAL_CHART,
            x: position.x,
            y: position.y,
            props: defaultProps
        });

        // 5. Then update with convexId
        editor.updateShape({
            id: newShapeId,
            type: CustomCanvasShapeType.FUNDAMENTAL_CHART,
            props: { convexId }
        });
    }, [/* deps */]);

    return { handleCreate, ... };
};
```

---

## 8. Standalone Page Pattern

### Route Structure

- `/fundamental-chart` - New chart (localStorage mode)
- `/fundamental-chart/$id` - Existing chart (Convex mode)

### Dual-Mode Settings Hook

```typescript
// src/routes/(app)/_app/fundamental-chart/-hooks/use-fundamental-chart-page-settings.ts

export const useFundamentalChartPageSettings = (convexId: string | undefined): FundamentalChartPageSettings => {
    const mode = convexId ? "convex" : "localStorage";

    // localStorage state
    const localStorageSettings = useLocalStorage((s) => s.standaloneFundamentalChartSettings);
    const setLocalStorageSettings = useLocalStorage((s) => s.setStandaloneFundamentalChartSettings);

    // Convex state
    const convexRecord = useQuery(
        api.fundamentalChart.fundamentalChart.getFundamentalChart,
        convexId ? { id: convexId as Id<"fundamentalCharts"> } : "skip"
    );
    const updateConvexSettings = useMutation(api.fundamentalChart.fundamentalChart.updateFundamentalChartSettings);

    const settings = useMemo(() => {
        if (mode === "convex") {
            return convexRecord?.settings ?? DEFAULT_FUNDAMENTAL_CHART_SETTINGS;
        }
        return localStorageSettings ?? DEFAULT_FUNDAMENTAL_CHART_SETTINGS;
    }, [mode, convexRecord?.settings, localStorageSettings]);

    const updateSettings: UpdateSettingsFn = useCallback(async (newSettings) => {
        if (mode === "convex") {
            await updateConvexSettings({ id: convexId, settings: newSettings });
        } else {
            // Debounced localStorage update
            // ...
        }
    }, [mode, convexId, updateConvexSettings, localStorageSettings, setLocalStorageSettings]);

    return {
        settings,
        updateSettings,
        mode,
        savedAsAsset: mode === "convex" && convexRecord?.savedAsAsset === true,
        convexId,
        convexRecord
    };
};
```

---

## 9. Step-by-Step Implementation Guide

When creating a new shape with this pattern:

### Step 1: Define Convex Schema

```typescript
// convex/schema.ts

myShapes: defineTable({
    userId: v.id("users"),
    name: v.string(),
    savedAsAsset: v.boolean(),
    projectIds: v.array(v.id("projects")),
    settings: vMyShapeSettings,
    updatedAt: v.number()
})
    .index("by_userId", ["userId"])
    .index("by_userId_and_savedAsAsset_and_updatedAt", ["userId", "savedAsAsset", "updatedAt"])
```

### Step 2: Create Types File

```typescript
// convex/myShape/types.ts

export const vMyShapeSettings = v.object({
    // Your settings fields
    // Convert any Record<string, T> to Array<{key, value}>
});

export type MyShapeSettings = Infer<typeof vMyShapeSettings>;
```

### Step 3: Create CRUD Operations

Copy structure from `convex/fundamentalChart/fundamentalChart.ts`:
- `getMyShape`
- `createMyShape`
- `updateMyShapeSettings`
- `addProjectToMyShape`
- `maybeDeleteOrphanedMyShape`
- etc.

### Step 4: Create Frontend Hooks

1. **Settings hook** - `use-my-shape-settings.ts` (copy from `use-fundamental-chart-settings.ts`)
2. **Recovery hook** - `use-missing-record-recovery.ts` (copy and adapt)
3. **Sync hook** - `use-sync-project-id.ts` (copy and adapt)

### Step 5: Create Default Settings

```typescript
// src/components/project/shapes/my-shape/constants/default-settings.ts

export const DEFAULT_MY_SHAPE_SETTINGS: MyShapeSettings = {
    // Default values for all settings
};
```

### Step 6: Add Worker Route for Deletion

Add route to `worker/do/TldrawDurableObject.ts`:

```typescript
.post("/api/projects/:projectId/clear-my-shape-convex-id", async (request) => {
    // Similar to handleClearConvexId but for your shape type
})
```

### Step 7: Create Deletion Helper

```typescript
// src/components/project/shapes/my-shape/lib/clear-convex-id-from-projects.ts

export async function clearMyShapeConvexIdFromProjects(
    projectIds: Array<Id<"projects">>,
    convexId: string
): Promise<Array<ClearConvexIdResult>> {
    // Similar to fundamentalChart implementation
}
```

### File Checklist

- [ ] `convex/myShape/types.ts` - Settings validator
- [ ] `convex/myShape/myShape.ts` - CRUD operations
- [ ] `convex/schema.ts` - Table definition
- [ ] `src/.../shapes/my-shape/constants/default-settings.ts`
- [ ] `src/.../shapes/my-shape/hooks/use-my-shape-settings.ts`
- [ ] `src/.../shapes/my-shape/hooks/use-missing-record-recovery.ts`
- [ ] `src/.../shapes/my-shape/hooks/use-sync-project-id.ts`
- [ ] `src/.../shapes/my-shape/lib/clear-convex-id-from-projects.ts`
- [ ] `worker/do/TldrawDurableObject.ts` - Add clear route
- [ ] Shape component using the hooks

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `/convex/fundamentalChart/types.ts` | Settings validator, map conversion utilities |
| `/convex/fundamentalChart/fundamentalChart.ts` | CRUD operations |
| `/convex/schema.ts` (lines 160-169) | Table definition with indexes |
| `/src/.../shapes/fundamental-chart/hooks/use-fundamental-chart-settings.ts` | Lazy creation pattern |
| `/src/.../shapes/fundamental-chart/hooks/use-sync-project-id.ts` | Cross-project tracking |
| `/src/.../shapes/fundamental-chart/hooks/use-missing-record-recovery.ts` | Recovery from deleted records |
| `/src/.../shapes/fundamental-chart/lib/clear-convex-id-from-projects.ts` | Deletion helper |
| `/worker/do/TldrawDurableObject.ts` | Worker route for deletion |
| `/src/routes/(app)/_app/fundamental-chart/-hooks/use-save-as-asset.ts` | Asset saving |
| `/src/.../radial-menu/actions/radial-action-registry.ts` | Action registry pattern |
| `/src/.../radial-menu/actions/company-radial-actions.tsx` | Company shape radial actions |
| `/src/.../radial-actions/radial-fundamental-chart/RadialFundamentalChartSettings.tsx` | Radial settings panel |
| `/src/.../radial-actions/radial-fundamental-chart/use-radial-fundamental-chart.ts` | Chart creation from radial |
| `/src/components/project/hooks/sync/use-sync-template-metrics.ts` | Template auto-sync |
