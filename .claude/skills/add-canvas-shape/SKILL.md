---
name: add-canvas-shape
description: Step-by-step guide for adding a new custom TLDraw canvas shape, including backend type definitions, frontend ShapeUtil class, component implementation, and worker sync registration. Use when creating new canvas shapes.
---

# Add Custom Canvas Shape

This skill guides you through adding a new custom TLDraw canvas shape
end-to-end.

## Overview

A custom shape requires changes to:

1. **Backend** - Shape type enum, schema, default props
2. **Frontend** - ShapeUtil class, component, tools
3. **Worker** - Schema registration for multiplayer sync

## Step-by-Step Guide

### 1. Add Shape Type Enum

```typescript
// convex/canvas/customShapes/customCanvasShapes.ts
export enum CustomCanvasShapeType {
    FUNDAMENTAL_CHART = "fundamental-chart",
    COMPANY = "company",
    COMPANY_LIST = "company-list",
    CONNECTION = "connection",
    AGENT = "agent",
    FILE = "file",
    EMBEDDING = "embedding",
    EARNINGS_CALL = "earnings-call",
    FILING = "filing",
    ANNOTATION = "annotation",
    OUTPUT = "output",
    RESEARCH_FILE = "research-file",
    MY_WIDGET = "my-widget", // <-- ADD
}

export const CustomCanvasShapeTypeSchema = z.enum(CustomCanvasShapeType);

// If shape can be added as standalone asset (outside canvas)
export const ASSET_SHAPE_TYPES = [
    CustomCanvasShapeType.FUNDAMENTAL_CHART,
    CustomCanvasShapeType.MY_WIDGET, // <-- ADD if applicable
] as const;
```

### 2. Create Shape Schema

```typescript
// convex/canvas/customShapes/shapes/myWidgetShape.ts
import z from "zod";
import type { TLBaseShape } from "tldraw";
import {
    CustomCanvasShapeBaseSchema,
    CustomCanvasShapeType,
} from "../customCanvasShapes";

export const MyWidgetShapeSchema = CustomCanvasShapeBaseSchema.extend({
    type: z.literal(CustomCanvasShapeType.MY_WIDGET),
    w: z.number().default(400),
    h: z.number().default(240),
    title: z.string().default("My Widget"),
    // Add your props here
});

// Simplified schema for AI agent (omit UI-only props)
export const SimpleMyWidgetShapeSchema = MyWidgetShapeSchema.omit({
    w: true,
    h: true,
    type: true,
});

export type SimpleMyWidgetShape = z.infer<typeof SimpleMyWidgetShapeSchema>;
export type TMyWidgetShape = z.infer<typeof MyWidgetShapeSchema>;
export type TLMyWidgetShape = TLBaseShape<
    CustomCanvasShapeType.MY_WIDGET,
    TMyWidgetShape
>;

// Factory function for default props
export const getMyWidgetShape = (): TMyWidgetShape => ({
    w: 400,
    h: 240,
    type: CustomCanvasShapeType.MY_WIDGET,
    title: "My Widget",
});
```

### 3. Register in TLDraw Type Augmentation

TLDraw 4.3.0+ requires module augmentation to recognize custom shape types. Add
your shape to `TLGlobalShapePropsMap`:

```typescript
// src/types/tldraw-custom-shapes-bindings.d.ts
import type { TMyWidgetShape } from "../../convex/canvas/customShapes/shapes/myWidgetShape";

declare module "tldraw" {
    interface TLGlobalShapePropsMap {
        // ... existing shapes
        [CustomCanvasShapeType.MY_WIDGET]: TMyWidgetShape; // <-- ADD
    }
}
```

This ensures TypeScript recognizes your custom shape type when using
`editor.getShape()` and other TLDraw APIs.

### 4. Register in Utility Functions

```typescript
// convex/canvas/customShapes/customShapePropId.ts
import { CustomCanvasShapeType } from "./customCanvasShapes";

export const getCustomShapePropId = (type: CustomCanvasShapeType): string => {
    switch (type) {
        case CustomCanvasShapeType.CARD:
            return "cardId";
        case CustomCanvasShapeType.MY_WIDGET:
            return "myWidgetId";
            // ...
         // <-- ADD
    }
};
```

```typescript
// convex/canvas/customShapes/getCustomShapeSchema.ts
import { MyWidgetShapeSchema } from "./shapes/myWidgetShape";

export const getCustomShapeSchema = (type: CustomCanvasShapeType) => {
    switch (type) {
        case CustomCanvasShapeType.CARD:
            return CardShapeSchema;
        case CustomCanvasShapeType.MY_WIDGET:
            return MyWidgetShapeSchema;
            // ...
         // <-- ADD
    }
};
```

```typescript
// convex/canvas/customShapes/getDefaultCustomShapeProps.ts
import { getMyWidgetShape } from "./shapes/myWidgetShape";

export const getDefaultCustomShapeProps = (type: CustomCanvasShapeType) => {
    switch (type) {
        case CustomCanvasShapeType.CARD:
            return getCardShape();
        case CustomCanvasShapeType.MY_WIDGET:
            return getMyWidgetShape();
            // ...
         // <-- ADD
    }
};
```

### 5. Add Tool ID and Shape-Tool Mapping

```typescript
// convex/canvas/tools/toolId.ts
export enum CustomToolId {
    CARD = "card",
    MY_WIDGET = "my-widget", // <-- ADD
}
```

```typescript
// convex/canvas/shapeToToolMap.ts
import { CustomCanvasShapeType } from "./customShapes/customCanvasShapes";
import { CustomToolId } from "./tools/toolId";

export const SHAPE_TO_TOOL_MAP: Record<CustomCanvasShapeType, CustomToolId> = {
    [CustomCanvasShapeType.CARD]: CustomToolId.CARD,
    [CustomCanvasShapeType.MY_WIDGET]: CustomToolId.MY_WIDGET, // <-- ADD
};
```

### 6. Add Connection Compatibility

```typescript
// src/components/canvas/shapes/shared/components/ports/lib/connectionCompatibilityMap.ts
// Define which shapes can connect to your new shape as inputs
export const ALLOWED_INPUT_SHAPES: Record<CustomCanvasShapeType, ReadonlyArray<CustomCanvasShapeType>> = {
    // ...existing entries
    [CustomCanvasShapeType.MY_WIDGET]: TICKER_SOURCE_SHAPES, // <-- ADD (accepts Company/CompanyList)
    // Or use [] for output-only shapes (no inputs accepted)
};
```

Key constants for connection compatibility:
- `TICKER_SOURCE_SHAPES`: `[COMPANY, COMPANY_LIST]` — shapes that provide ticker symbols
- `ALL_OUTPUT_SHAPES`: All shapes that can serve as connection sources
- `ATTACHMENT_SHAPES`: `[FILE, EMBEDDING, FUNDAMENTAL_CHART]`
- `AI_HISTORY_SHAPES`: `[AGENT, EARNINGS_CALL, FILING]`

### 7. Add Simple Shape for AI Agent

```typescript
// convex/agent/shapes/types/SimpleShape.ts
import { SimpleMyWidgetShapeSchema } from "../../../canvas/customShapes/shapes/myWidgetShape";

const SimpleShapeMyWidgetSchema = z
    .object({
        _type: z.literal(CustomCanvasShapeType.MY_WIDGET),
        name: SimpleLabel,
        shapeId: z.string(),
        meta: SimpleMetaSchema,
        x: z.number(),
        y: z.number(),
        w: z.number(),
        h: z.number(),
        ...SimpleMyWidgetShapeSchema.shape,
    })
    .meta({
        title: "My Widget",
        description: "A custom widget shape for...",
    });

export type SimpleShapeMyWidget = z.infer<typeof SimpleShapeMyWidgetSchema>;

const SIMPLE_SHAPES = [
    // ... other shapes
    SimpleShapeMyWidgetSchema,
    SimpleUnknownShapeSchema, // Keep last
] as const;
```

### 8. Add Icon and Dictionary Entry

```typescript
// src/components/ui/icons/canvas/CustomCanvasShapeTypeIcon.tsx
import { Puzzle } from "lucide-react";

export const getCustomCanvasShapeTypeIcon = (type: CustomCanvasShapeType) => {
    switch (type) {
        case CustomCanvasShapeType.CARD:
            return Square;
        case CustomCanvasShapeType.MY_WIDGET:
            return Puzzle;
            // ...
         // <-- ADD
    }
};
```

```typescript
// src/dictionary/projects/t-custom-canvas-shape-type.ts
import { t } from "@lingui/core/macro";

export const tCustomCanvasShapeType = (type: CustomCanvasShapeType) => {
    switch (type) {
        case CustomCanvasShapeType.CARD:
            return t`Card`;
        case CustomCanvasShapeType.MY_WIDGET:
            return t`My Widget`;
            // ...
         // <-- ADD
    }
};
```

### 9. Create Schema-Only File for Worker

```typescript
// src/components/canvas/shapes/schemas/my-widget-shape-schema.ts
import { T } from "tldraw";

// Use string literals to avoid importing from convex
export const myWidgetShapeProps = {
    w: T.number,
    h: T.number,
    type: T.literal("my-widget"), // String literal, not enum
    title: T.string,
} as const;

export const myWidgetShapeMigrations = undefined;
```

### 10. Create ShapeUtil Class

```typescript
// src/components/canvas/shapes/my-widget/MyWidgetShape.tsx
import type { RecordProps, TLResizeInfo } from "tldraw";
import type { TLMyWidgetShape } from "convex/canvas/customShapes/shapes/myWidgetShape";
import { CustomCanvasShapeType } from "convex/canvas/customShapes/customCanvasShapes";
import { getMyWidgetShape } from "convex/canvas/customShapes/shapes/myWidgetShape";
import { BaseBoxShapeUtil, HTMLContainer, resizeBox, useEditor } from "tldraw";

import { usePartialShape } from "../../hooks/queries/use-partial-shape";
import { myWidgetShapeProps } from "../schemas/my-widget-shape-schema";
import { MyWidgetShapeComponent } from "./MyWidgetShapeComponent";

export class MyWidgetShapeUtil extends BaseBoxShapeUtil<TLMyWidgetShape> {
    static override type = CustomCanvasShapeType.MY_WIDGET as const;

    static override props: RecordProps<TLMyWidgetShape> =
        myWidgetShapeProps satisfies Record<
            keyof TLMyWidgetShape["props"],
            unknown
        > as RecordProps<TLMyWidgetShape>;

    getDefaultProps(): TLMyWidgetShape["props"] {
        return getMyWidgetShape();
    }

    override canEdit() {
        return true;
    }

    override canResize() {
        return true;
    }

    override isAspectRatioLocked() {
        return false;
    }

    override onResize(
        shape: TLMyWidgetShape,
        info: TLResizeInfo<TLMyWidgetShape>,
    ) {
        return resizeBox(shape, info);
    }

    indicator(shape: TLMyWidgetShape) {
        return <rect height={shape.props.h} width={shape.props.w} />;
    }

    component(shape: TLMyWidgetShape) {
        const isEditing = this.editor.getEditingShapeId() === shape.id;

        return (
            <HTMLContainer
                onPointerDown={isEditing
                    ? this.editor.markEventAsHandled
                    : undefined}
                style={{
                    width: shape.props.w,
                    height: shape.props.h,
                    borderRadius: 6,
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                }}
            >
                <MyWidgetShape shape={shape} />
            </HTMLContainer>
        );
    }
}

export const MyWidgetShape = ({ shape }: { shape: TLMyWidgetShape }) => {
    const editor = useEditor();
    const partialShape = usePartialShape<TLMyWidgetShape["props"]>({
        shapeId: shape.id,
        editor,
    });

    if (!partialShape) return null;

    return (
        <MyWidgetShapeComponent
            editor={editor}
            partialShape={partialShape}
            location="canvas"
        />
    );
};
```

### 11. Create Component

```typescript
// src/components/canvas/shapes/my-widget/MyWidgetShapeComponent.tsx
import type { TMyWidgetShape } from "convex/canvas/customShapes/shapes/myWidgetShape";
import type { Editor } from "tldraw";
import { cn } from "@/lib/utils/classes/cn";
import type { PartialShape } from "../../types/partial-shape";
import type { ShapeLocation } from "../../types/shape-location";
import { useUpdateShape } from "../../hooks/mutations/use-update-shape";

export const MyWidgetShapeComponent = ({
    editor,
    partialShape,
    location,
    className,
    ...props
}: React.ComponentProps<"div"> & {
    editor: Editor;
    partialShape: PartialShape<TMyWidgetShape>;
    location: ShapeLocation;
}) => {
    const updateShape = useUpdateShape<TMyWidgetShape>({
        editor,
        id: partialShape.id,
        type: partialShape.type,
    });

    return (
        <div
            className={cn("flex h-full w-full flex-col p-4", className)}
            {...props}
        >
            <input
                className="w-full rounded border px-2 py-1"
                value={partialShape.props.title}
                onChange={(e) =>
                    updateShape({ props: { title: e.target.value } })}
            />
            {location === "fullscreen" && (
                <div className="mt-4 flex-1 border-t pt-4">
                    Fullscreen-specific content
                </div>
            )}
        </div>
    );
};
```

### 12. Create Tool Class

```typescript
// src/components/canvas/tools/CustomShapeTools.tsx
import { CustomToolId } from "convex/canvas/tools/toolId";
import { BaseBoxShapeTool } from "tldraw";

export class MyWidgetTool extends BaseBoxShapeTool {
    static override id = CustomToolId.MY_WIDGET;
    static override initial = "idle";
    override shapeType = CustomToolId.MY_WIDGET;
}

export const CUSTOM_SHAPE_TOOLS = [
    CardTool,
    // ...other tools
    MyWidgetTool, // <-- ADD
];
```

### 13. Add Toolbar Settings

```typescript
// src/components/canvas/components/canvas/contextual-toolbar/primary-toolbar/components/controls/ControlSwitch.tsx
import { MyWidgetControls } from "./my-widget/MyWidgetControls";

export const ControlSwitch = ({ selectedShape, ...props }) => {
    switch (selectedShape.type) {
        case CustomCanvasShapeType.MY_WIDGET:
            return <MyWidgetControls
                selectedShape={selectedShape}
                {...props}
            />;
            // ...
    }
};
```

### 14. Add to Render Functions

```typescript
// src/components/canvas/components/fullscreen/FullscreenShape.tsx
import { MyWidgetShapeSchema } from "convex/canvas/customShapes/shapes/myWidgetShape";
import { MyWidgetShapeComponent } from "../../shapes/my-widget/MyWidgetShapeComponent";

const FullscreenShapeSwitch = ({ partialShape, editor }) => {
    switch (partialShape.type as FullscreenShapeType) {
        case CustomCanvasShapeType.MY_WIDGET:
            return (
                <MyWidgetShapeComponent
                    editor={editor}
                    location="fullscreen"
                    partialShape={{
                        id: partialShape.id,
                        type: partialShape.type,
                        props: MyWidgetShapeSchema.parse(partialShape.props),
                        meta: partialShape.meta,
                    }}
                />
            );
            // ...
    }
};
```

### 15. Register in Custom Shape Utils

```typescript
// src/components/canvas/shapes/custom-shape-utils.ts
import { MyWidgetShapeUtil } from "./my-widget/MyWidgetShape";

export const customShapeUtils = [
    CardShapeUtil,
    // ...other utils
    MyWidgetShapeUtil, // <-- ADD
];
```

### 16. Register in Worker TLSchema

```typescript
// worker/do/TldrawDurableObject.ts
import { createTLSchema, defaultShapeSchemas } from "tldraw";
import {
    myWidgetShapeMigrations,
    myWidgetShapeProps,
} from "@/components/project/shapes/schemas/my-widget-shape-schema";

// Define locally to avoid importing from convex
const CustomCanvasShapeType = {
    MY_WIDGET: "my-widget",
    // ...
} as const;

const schema = createTLSchema({
    shapes: {
        ...defaultShapeSchemas,
        [CustomCanvasShapeType.MY_WIDGET]: {
            props: myWidgetShapeProps,
            migrations: myWidgetShapeMigrations,
        },
    },
});
```

## File Checklist

- [ ] `convex/canvas/customShapes/customCanvasShapes.ts` - Enum
- [ ] `convex/canvas/customShapes/shapes/myWidgetShape.ts` - Schema
- [ ] `src/types/tldraw-custom-shapes-bindings.d.ts` - TLDraw type augmentation
- [ ] `convex/canvas/customShapes/customShapePropId.ts` - Prop ID
- [ ] `convex/canvas/customShapes/getCustomShapeSchema.ts` - Schema getter
- [ ] `convex/canvas/customShapes/getDefaultCustomShapeProps.ts` - Default props
- [ ] `convex/canvas/tools/toolId.ts` - Tool ID enum
- [ ] `convex/canvas/shapeToToolMap.ts` - Shape-tool mapping
- [ ] `convex/agent/shapes/types/SimpleShape.ts` - AI agent type
- [ ] `src/components/ui/icons/canvas/CustomCanvasShapeTypeIcon.tsx` - Icon
- [ ] `src/dictionary/projects/t-custom-canvas-shape-type.ts` - Translation
- [ ] `src/components/canvas/shapes/schemas/my-widget-shape-schema.ts` - Worker
      schema
- [ ] `src/components/canvas/shapes/my-widget/MyWidgetShape.tsx` - ShapeUtil
- [ ] `src/components/canvas/shapes/my-widget/MyWidgetShapeComponent.tsx` -
      Component
- [ ] `src/components/canvas/tools/CustomShapeTools.tsx` - Tool class
- [ ] `src/components/canvas/shapes/shared/components/ports/lib/portType.ts` -
      Port type
- [ ] `src/components/canvas/shapes/shared/components/ports/lib/connectionCompatibilityMap.ts` -
      Compatibility
- [ ] `src/components/canvas/components/canvas/contextual-toolbar/*/ControlSwitch.tsx` -
      Toolbar
- [ ] `src/components/canvas/components/fullscreen/FullscreenShape.tsx` -
      Fullscreen
- [ ] `src/components/canvas/shapes/custom-shape-utils.ts` - Registration
- [ ] `worker/do/TldrawDurableObject.ts` - Worker schema
