---
name: add-canvas-tool
description: Guide for adding a new custom TLDraw canvas tool including StateNode class creation, tool registration, and UI wiring. Use when creating new interactive tools for the canvas.
---

# Add Canvas Tool

This skill guides you through adding a new custom TLDraw canvas tool.

## Overview

TLDraw tools are `StateNode` classes that handle user interactions. They can:
- Create shapes on click/drag
- Pick context items for AI agents
- Perform custom actions

## Step-by-Step Guide

### 1. Add Tool ID

```typescript
// convex/canvas/tools/toolId.ts
export enum CustomToolId {
    TARGET_AREA = "target-area",
    TARGET_SHAPE = "target-shape",
    CREATE_CUSTOM_SHAPE = "create-custom-shape",
    MY_TOOL = "my-tool"  // <-- ADD
}
```

### 2. Create Tool Class

Tools are `StateNode`s with nested states (`idle`, `pointing`, `dragging`).

```typescript
// src/components/project/tools/MyTool.tsx
import type { VecModel } from "tldraw";
import { StateNode } from "tldraw";
import { CustomToolId } from "convex/canvas/tools/toolId";

export class MyTool extends StateNode {
    static override id = CustomToolId.MY_TOOL;
    static override initial = "idle";
    static override children() {
        return [MyToolIdle, MyToolPointing, MyToolDragging];
    }

    override isLockable = false;

    override onEnter() {
        this.editor.setCursor({ type: "cross", rotation: 0 });
    }

    override onExit() {
        this.editor.setCursor({ type: "default", rotation: 0 });
    }

    override onInterrupt() {
        this.parent.transition("select", {});
    }

    override onCancel() {
        this.parent.transition("select", {});
    }
}

class MyToolIdle extends StateNode {
    static override id = "idle";

    override onPointerDown() {
        this.parent.transition("pointing");
    }
}

class MyToolPointing extends StateNode {
    static override id = "pointing";
    private initialPagePoint: VecModel | undefined;

    override onEnter() {
        this.initialPagePoint = this.editor.inputs.currentPagePoint.clone();
    }

    override onPointerMove() {
        if (this.editor.inputs.isDragging) {
            this.parent.transition("dragging", {});
        }
    }

    override onPointerUp() {
        // Handle single click
        this.handleClick();
        this.editor.setCurrentTool("select");
    }

    private handleClick() {
        const point = this.editor.inputs.currentPagePoint;
        // Create shape, add context, etc.
        console.log("Clicked at:", point);
    }
}

class MyToolDragging extends StateNode {
    static override id = "dragging";

    override onPointerMove() {
        // Update drag preview
        const { originPagePoint, currentPagePoint } = this.editor.inputs;

        this.editor.updateInstanceState({
            brush: {
                x: Math.min(originPagePoint.x, currentPagePoint.x),
                y: Math.min(originPagePoint.y, currentPagePoint.y),
                w: Math.abs(currentPagePoint.x - originPagePoint.x),
                h: Math.abs(currentPagePoint.y - originPagePoint.y)
            }
        });
    }

    override onPointerUp() {
        // Handle drag complete
        this.editor.updateInstanceState({ brush: null });
        this.handleDragComplete();
        this.editor.setCurrentTool("select");
    }

    private handleDragComplete() {
        const { originPagePoint, currentPagePoint } = this.editor.inputs;
        const bounds = {
            x: Math.min(originPagePoint.x, currentPagePoint.x),
            y: Math.min(originPagePoint.y, currentPagePoint.y),
            w: Math.abs(currentPagePoint.x - originPagePoint.x),
            h: Math.abs(currentPagePoint.y - originPagePoint.y)
        };
        console.log("Drag bounds:", bounds);
    }
}
```

### 3. Register Tool with Editor

```typescript
// src/components/project/components/canvas/TldrawCanvas.tsx
import { MyTool } from "./tools/MyTool";

// Custom tools array
const tools = [
    TargetShapeTool,
    TargetAreaTool,
    CreateCustomShapeTool,
    MyTool  // <-- ADD
];

<Tldraw
    // ...
    tools={tools}
/>
```

### 4. Add UI Override (Optional)

```typescript
// src/components/project/lib/tldraw-overrides.ts
import { CustomToolId } from "convex/canvas/tools/toolId";

export const tldrawOverrides: TLUiOverrides = {
    tools: (editor, currentTools) => ({
        ...currentTools,
        [CustomToolId.MY_TOOL]: {
            id: CustomToolId.MY_TOOL,
            label: "My Tool",
            kbd: "m",  // Keyboard shortcut
            icon: "tool-geo",  // TLDraw icon ID
            onSelect() {
                editor.setCurrentTool(CustomToolId.MY_TOOL);
            }
        }
    })
};
```

## Tool Patterns

### Shape Creation Tool

```typescript
import { getMyWidgetShape } from "convex/canvas/customShapes/shapes/myWidgetShape";
import { createShapeId } from "tldraw";

class CreateShapePointing extends StateNode {
    static override id = "pointing";

    override onPointerUp() {
        const point = this.editor.inputs.currentPagePoint;
        const props = getMyWidgetShape();

        // Center shape on click point
        const x = point.x - props.w / 2;
        const y = point.y - props.h / 2;

        const id = createShapeId();
        this.editor.createShape({
            id,
            type: props.type,
            x,
            y,
            props
        });

        this.editor.select(id);
        this.editor.setCurrentTool("select");
    }
}
```

### Context Picking Tool (for AI Agent)

```typescript
import { $agentsAtom } from "@/components/agent/lib/agentsAtom";
import { convertTldrawShapeToSimpleShape } from "shared/format/convertTldrawShapeToSimpleShape";

class PickShapePointing extends StateNode {
    static override id = "pointing";
    private shape: TLShape | undefined;

    override onEnter() {
        const point = this.editor.inputs.currentPagePoint;
        this.shape = this.editor.getShapeAtPoint(point, { hitInside: true });
    }

    override onPointerUp() {
        if (this.shape) {
            // Add shape to all active agents' context
            const agents = $agentsAtom.get(this.editor);
            for (const agent of agents) {
                agent.addToContext({
                    type: "shape",
                    shape: convertTldrawShapeToSimpleShape(this.editor, this.shape),
                    source: "user"
                });
            }
        }
        this.editor.setCurrentTool("select");
    }
}
```

### Area Selection Tool

```typescript
class AreaDragging extends StateNode {
    static override id = "dragging";
    private bounds: Box | undefined;

    override onPointerMove() {
        const { originPagePoint, currentPagePoint } = this.editor.inputs;

        this.bounds = {
            x: Math.min(originPagePoint.x, currentPagePoint.x),
            y: Math.min(originPagePoint.y, currentPagePoint.y),
            w: Math.abs(currentPagePoint.x - originPagePoint.x),
            h: Math.abs(currentPagePoint.y - originPagePoint.y)
        };

        this.editor.updateInstanceState({ brush: this.bounds });
    }

    override onPointerUp() {
        this.editor.updateInstanceState({ brush: null });

        if (this.bounds) {
            // Add area to all active agents' context
            const agents = $agentsAtom.get(this.editor);
            for (const agent of agents) {
                agent.addToContext({
                    type: "area",
                    bounds: this.bounds,
                    source: "user"
                });
            }
        }

        this.editor.setCurrentTool("select");
    }
}
```

## BaseBoxShapeTool (Simpler Pattern)

For tools that just create box shapes, extend `BaseBoxShapeTool`:

```typescript
import { BaseBoxShapeTool } from "tldraw";
import { CustomToolId } from "convex/canvas/tools/toolId";

export class MyWidgetTool extends BaseBoxShapeTool {
    static override id = CustomToolId.MY_WIDGET;
    static override initial = "idle";
    override shapeType = CustomToolId.MY_WIDGET;
}
```

This automatically handles:
- Click to create at point
- Drag to set size
- Shape centering

## Tool Activation

### From UI Button

```typescript
const editor = useEditor();

const handleToolSelect = () => {
    editor.setCurrentTool(CustomToolId.MY_TOOL);
};
```

### From Keyboard Shortcut

Configured in `tldrawOverrides`:

```typescript
[CustomToolId.MY_TOOL]: {
    kbd: "m",  // Press 'm' to activate
    // ...
}
```

### Checking Active Tool

```typescript
const editor = useEditor();
const currentTool = editor.getCurrentTool();

const isMyToolActive = currentTool?.id === CustomToolId.MY_TOOL;
```

## State Machine Diagram

```
┌─────────┐    pointerDown    ┌──────────┐
│  idle   │─────────────────▶│ pointing │
└─────────┘                   └──────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
               pointerUp     isDragging     pointerUp
               (no drag)          │         (with click)
                    │              ▼              │
                    │       ┌──────────┐          │
                    │       │ dragging │          │
                    │       └──────────┘          │
                    │              │              │
                    │         pointerUp           │
                    │              │              │
                    ▼              ▼              ▼
               ┌─────────────────────────────────────┐
               │         "select" tool               │
               └─────────────────────────────────────┘
```

## Testing

1. Press the keyboard shortcut or click the tool button
2. Verify cursor changes
3. Click and verify single-click behavior
4. Drag and verify drag preview and completion
5. Press Escape to verify cancellation
6. Switch tools and verify cleanup

## File Checklist

- [ ] `convex/canvas/tools/toolId.ts` - Add tool ID to enum
- [ ] `src/components/project/tools/MyTool.tsx` - Create tool class
- [ ] `src/components/project/components/canvas/TldrawCanvas.tsx` - Register tool
- [ ] `src/components/project/lib/tldraw-overrides.ts` - Add UI override (optional)
