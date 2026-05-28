---
name: explain-tldraw-sync
description: Explains TLDraw multi-user sync with Cloudflare Durable Objects and real-time collaboration. Use when working with canvas sync, WebSocket connections, or shape persistence.
---

# TLDraw Multi-User Sync

This skill explains how real-time multiplayer synchronization works with TLDraw
and Cloudflare Durable Objects.

## Overview

The app uses TLDraw's multiplayer store backed by a Cloudflare Durable Object
per canvas. The Durable Object hosts a `TLSocketRoom` which handles CRDT sync
and WebSocket fanout. Room snapshots are persisted to an R2 bucket on a
throttled interval.

## Durable Object Architecture

The worker hosts **6 Durable Object types**, 5 of which are for collaborative
document editing:

### TldrawDurableObject (Canvas Sync)

- Uses TLDraw's `@tldraw/sync-core` `TLSocketRoom` (not Yjs)
- Persists to R2 bucket on a 10s throttle
- One DO per canvas, keyed by canvas ID

### CollaborativeDocumentDO (Abstract Base)

Base class for Yjs-backed collaborative documents. Provides:
- Yjs Y.Doc + Awareness protocol
- SQLite persistence (2s debounce for fast recovery)
- Convex snapshot persistence (5s debounce with 3x retry)
- WebSocket hibernation API

**Concrete subclasses:**

| DO Class                    | Binding               | Purpose                    |
| --------------------------- | --------------------- | -------------------------- |
| `TldrawDurableObject`       | `TLDRAW_DURABLE_OBJECT` | Canvas shapes (TLSocketRoom) |
| `ResearchFileDurableObject` | `RESEARCH_FILE_DO`    | Research file editing      |
| `SyncedBlockDurableObject`  | `SYNCED_BLOCK_DO`     | Synced block content       |
| `GlobalCompanyDurableObject`| `GLOBAL_COMPANY_DO`   | Company page editing       |
| `SkillDurableObject`        | `SKILL_DO`            | Skill instruction editing  |

Each subclass only needs to specify:
```typescript
protected readonly getContentEndpoint: string;   // e.g. "/api/skills/get-content"
protected readonly snapshotEndpoint: string;       // e.g. "/api/skills/snapshot"
protected readonly documentIdField: string;        // e.g. "skillId"
protected readonly logPrefix: string;              // e.g. "SkillDO"
```

## Architecture

```
┌─────────────┐     WebSocket     ┌──────────────────────┐     R2
│   Client    │ ◄──────────────► │  Cloudflare Worker   │ ◄──────► Bucket
│  (TLDraw)   │                   │  (Durable Object)    │
└─────────────┘                   └──────────────────────┘
      │                                    │
      │ useSync()                          │ TLSocketRoom
      │ store                              │ CRDT sync
      ▼                                    ▼
┌─────────────┐                   ┌──────────────────────┐
│   Editor    │                   │   Room Snapshot      │
│   State     │                   │   Persistence        │
└─────────────┘                   └──────────────────────┘
```

## Client Flow

### Store Setup

The canvas creates a synced store via `useSync`, pointing to the worker route:

```typescript
// src/components/tldraw/TldrawCanvas.tsx
const store = useSync({
    uri: `${window.location.origin}/api/projects/${canvas._id}`,
    assets: multiplayerAssetStore,
    shapeUtils: allShapeUtils,
    userInfo: userPreferences,
    getUserPresence: (_store, _user) => {
        const defaults = getDefaultUserPresence(_store, _user);
        if (!defaults) return null;
        return defaults;
    },
});
```

### Editor Wiring

The store is passed to `<Tldraw/>`. External assets and custom tools are
registered on mount:

```tsx
// src/components/tldraw/TldrawCanvas.tsx
<Tldraw
    components={components}
    onMount={(editor) => {
        editorRef.current = editor;
        setEditor(editor);
        editor.registerExternalAssetHandler("url", getBookmarkPreview);
    }}
    overrides={overrides}
    shapeUtils={allShapeUtils}
    store={store}
    tools={tools}
    user={user}
/>;
```

**Notes:**

- `sessionId` is appended by `@tldraw/sync` during WS connect; no client work
  needed
- Presence derives from `TLUserPreferences` (id/name) via `useTldrawUser`

## Worker Routing

The worker exposes routes and forwards to the Durable Object:

```typescript
// worker/worker.ts
.post("/api/stream", stream)
.get("/api/projects/:projectId", connect)
.post("/api/uploads/:uploadId", handleAssetUpload)
.get("/api/uploads/:uploadId", handleAssetDownload)
.get("/api/unfurl", handleUnfurlRequest)
```

### Connection Handler

```typescript
// worker/routes/connect.ts
export async function connect(request: IRequest, env: Env) {
    const id = env.TLDRAW_DURABLE_OBJECT.idFromName(request.params.projectId);
    const room = env.TLDRAW_DURABLE_OBJECT.get(id);
    return room.fetch(request.url, {
        headers: request.headers,
        body: request.body,
    });
}
```

## Durable Object: Room Host and Persistence

One Durable Object instance per canvas (keyed by `projectId`) hosts a
`TLSocketRoom` with the app's shape schema.

### Schema Definition

```typescript
// worker/do/TldrawDurableObject.ts
const schema = createTLSchema({
    shapes: {
        ...defaultShapeSchemas,
        [CustomCanvasShapeType.COMPANY_PRICE_CHART]: {
            props: CompanyPriceChartShapeUtil.props,
            migrations: CompanyPriceChartShapeUtil.migrations,
        },
        [CustomCanvasShapeType.COMPANY_FINANCIALS]: {
            props: CompanyFinancialsShapeUtil.props,
            migrations: CompanyFinancialsShapeUtil.migrations,
        },
        // ... other custom shapes
    },
});
```

### Room Initialization

On first connect, the object stores the `roomId` and serves the WS upgrade:

```typescript
// worker/do/TldrawDurableObject.ts
.get("/api/projects/:projectId", async (request) => {
    if (!this.roomId) {
        await this.ctx.blockConcurrencyWhile(async () => {
            await this.ctx.storage.put("roomId", request.params.projectId);
            this.roomId = request.params.projectId;
        });
    }
    return this.handleConnect(request);
});
```

### WebSocket Connection

```typescript
// worker/do/TldrawDurableObject.ts
async handleConnect(request: IRequest) {
    const sessionId = request.query.sessionId as string;
    if (!sessionId) return error(400, "Missing sessionId");

    const { 0: clientWebSocket, 1: serverWebSocket } = new WebSocketPair();
    serverWebSocket.accept();

    const room: TLSocketRoom<TLRecord, void> = await this.getRoom();
    room.handleSocketConnect({ sessionId, socket: serverWebSocket });

    return new Response(null, { status: 101, webSocket: clientWebSocket });
}
```

### Room Creation with R2 Snapshot

```typescript
// worker/do/TldrawDurableObject.ts
if (!this.roomPromise) {
    this.roomPromise = (async () => {
        // Load snapshot from R2 if exists
        const roomFromBucket = await this.r2.get(`rooms/${roomId}`);
        const initialSnapshot: RoomSnapshot | undefined = roomFromBucket
            ? await roomFromBucket.json<RoomSnapshot>()
            : undefined;

        // Create room with schema and snapshot
        const newRoom: TLSocketRoom<TLRecord, void> = new TLSocketRoom<
            TLRecord,
            void
        >({
            schema,
            initialSnapshot,
            onDataChange: () => {
                this.schedulePersistToR2();
            },
        });

        return newRoom;
    })();
}
```

### Throttled Persistence

Room state changes trigger a throttled persist to R2 (~every 10s):

```typescript
// worker/do/TldrawDurableObject.ts
schedulePersistToR2 = throttle(async () => {
    if (!this.roomPromise || !this.roomId) return;

    const room: TLSocketRoom<TLRecord, void> = await this.getRoom();
    const currentSnapshot: RoomSnapshot = room
        .getCurrentSnapshot() as unknown as RoomSnapshot;
    const snapshot = JSON.stringify(currentSnapshot);

    await this.r2.put(`rooms/${this.roomId}`, snapshot);
}, 10_000);
```

## Infrastructure Bindings (Wrangler)

Durable Objects and R2 bucket are declared in `wrangler.toml`:

```toml
# wrangler.toml
[durable_objects]
bindings = [
    { name = "AGENT_DURABLE_OBJECT", class_name = "AgentDurableObject" },
    { name = "TLDRAW_DURABLE_OBJECT", class_name = "TldrawDurableObject" }
]

[[r2_buckets]]
binding = 'TLDRAW_BUCKET'
bucket_name = 'multiplayer-template'
preview_bucket_name = 'multiplayer-template-preview'
```

## Assets and Unfurls

Binary assets (images, etc.) are uploaded and served via the worker:

```typescript
// worker/worker.ts
.post("/api/uploads/:uploadId", handleAssetUpload)
.get("/api/uploads/:uploadId", handleAssetDownload)
.get("/api/unfurl", handleUnfurlRequest)
```

On the client, the `multiplayerAssetStore` is passed to `useSync`, and unfurl
previews are registered via
`editor.registerExternalAssetHandler("url", getBookmarkPreview)`.

## Custom Shapes: Client and Server Must Match

**Critical:** Both client and server must have matching shape definitions for
CRDT sync to work.

### Client Registration

```typescript
// src/components/tldraw/TldrawCanvas.tsx
const customShapeUtils = useMemo(() => [
    CompanyPriceChartShapeUtil,
    CompanyFinancialsShapeUtil,
    // ... other custom shapes
], []);

const allShapeUtils = useMemo(() => [
    ...defaultShapeUtils,
    ...customShapeUtils,
], []);
```

### Server Registration

```typescript
// worker/do/TldrawDurableObject.ts
const schema = createTLSchema({
    shapes: {
        ...defaultShapeSchemas,
        [CustomCanvasShapeType.COMPANY_PRICE_CHART]: {
            props: CompanyPriceChartShapeUtil.props,
            migrations: CompanyPriceChartShapeUtil.migrations,
        },
        // ... must match client shapes
    },
});
```

**Both sides must stay in lockstep for CRDT sync and migrations.**

## Security and CORS

- The worker enables CORS for `*` and exposes WS and asset endpoints
- Consider tightening origins and adding auth if needed
- The Durable Object rejects connections without a `sessionId`

## Sequence Summary

1. Client mounts `TldrawCanvas` and creates a sync store pointing at
   `/api/projects/:projectId`
2. Worker resolves the Durable Object instance for `:projectId` and forwards the
   request
3. DO loads (or creates) a `TLSocketRoom`, loads snapshot from R2, accepts WS,
   and joins the client by `sessionId`
4. Edits flow over WS via TLDraw's sync protocol; presence and assets are
   handled per the provided handlers
5. Room changes throttle-persist to R2 for durability; subsequent connects
   restore state from the latest snapshot

## Adding a New Custom Shape to Sync

When adding a new custom shape, update both client and worker:

### 1. Create ShapeUtil (Client)

```typescript
// src/canvas/customShapes/MyNewShape/MyNewShapeUtil.ts
export class MyNewShapeUtil extends ShapeUtil<TMyNewShape> {
    static override type = "my-new-shape" as const;
    static override props = myNewShapeProps;
    static override migrations = myNewShapeMigrations;
    // ... implementation
}
```

### 2. Register on Client

```typescript
// src/components/tldraw/TldrawCanvas.tsx
const customShapeUtils = useMemo(() => [
    // ... existing shapes
    MyNewShapeUtil,
], []);
```

### 3. Register on Worker

```typescript
// worker/do/TldrawDurableObject.ts
const schema = createTLSchema({
    shapes: {
        ...defaultShapeSchemas,
        // ... existing shapes
        [CustomCanvasShapeType.MY_NEW_SHAPE]: {
            props: MyNewShapeUtil.props,
            migrations: MyNewShapeUtil.migrations,
        },
    },
});
```

### 4. Export Schema-Only Version

Create a schema-only file for the worker (without React dependencies):

```typescript
// convex/canvas/customShapes/shapes/myNewShape/myNewShapeSchema.ts
export const myNewShapeProps = {
    w: T.number,
    h: T.number,
    // ... only props, no React code
};

export const myNewShapeMigrations = createShapePropsMigrationSequence([
    // ... migrations
]);
```

## Dev Notes

- The worker runs under Cloudflare with Durable Objects and R2
- See `wrangler.toml` for bindings and migrations
- Routes are served at the same origin as the SPA (`assets.run_worker_first` is
  enabled)
- Client uses `window.location.origin` for API calls

## Key Files Reference

| File                                           | Purpose                                   |
| ---------------------------------------------- | ----------------------------------------- |
| `src/components/tldraw/TldrawCanvas.tsx`       | Client-side TLDraw setup with useSync     |
| `worker/worker.ts`                             | Cloudflare Worker router                  |
| `worker/routes/connect.ts`                     | WebSocket connection handler              |
| `worker/do/TldrawDurableObject.ts`             | Durable Object with TLSocketRoom          |
| `worker/do/CollaborativeDocumentDO.ts`         | Abstract base for Yjs-backed DOs          |
| `worker/do/ResearchFileDurableObject.ts`       | Research file collaborative editing       |
| `worker/do/SyncedBlockDurableObject.ts`        | Synced block collaborative editing        |
| `worker/do/GlobalCompanyDurableObject.ts`      | Company page collaborative editing        |
| `worker/do/SkillDurableObject.ts`              | Skill instruction collaborative editing   |
| `wrangler.toml`                                | Infrastructure bindings and migrations    |

## Troubleshooting

### Shapes Not Syncing

- Verify shape is registered on both client AND worker
- Check props and migrations match exactly
- Ensure `CustomCanvasShapeType` enum is updated

### Connection Failures

- Check `sessionId` is being passed
- Verify Durable Object bindings in `wrangler.toml`
- Check R2 bucket permissions

### State Not Persisting

- Verify R2 bucket binding is correct
- Check `schedulePersistToR2` is being called
- Ensure room snapshot is valid JSON
