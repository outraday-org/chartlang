---
name: explain-file-storage
description: Explains Convex file storage for images, videos, PDFs and other files. Use when uploading files, managing storage IDs, getting signed URLs, or working with file metadata.
---

# Convex File Storage

This skill explains how to work with Convex file storage for images, videos,
PDFs, and other files.

## Overview

Convex provides built-in file storage for large files. Files are stored as
`Blob` objects and accessed via signed URLs.

## Key Concepts

| Concept                 | Description                        |
| ----------------------- | ---------------------------------- |
| `Id<"_storage">`        | Unique identifier for stored files |
| `ctx.storage.store()`   | Upload a Blob to storage           |
| `ctx.storage.get()`     | Get a Blob from storage            |
| `ctx.storage.getUrl()`  | Get signed URL for a file          |
| `ctx.storage.delete()`  | Delete a file from storage         |
| `_storage` system table | Query file metadata                |

## Basic Operations

### Upload File (Action)

```typescript
// convex/files/files.ts
"use node";

import { ConvexError, v } from "convex/values";
import { action, internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";

export const uploadFile = action({
    args: {
        filename: v.string(),
        mediaType: v.string(),
        data: v.bytes(), // ArrayBuffer
    },
    returns: v.object({
        storageId: v.id("_storage"),
        storageUrl: v.string(),
    }),
    handler: async (ctx, args) => {
        const user = await ctx.runQuery(
            internal.users.users.getCurrentUserOrThrow,
        );

        // Convert to Blob and store
        const blob = new Blob([args.data], { type: args.mediaType });
        const storageId = await ctx.storage.store(blob);

        // Get signed URL
        const storageUrl = await ctx.storage.getUrl(storageId);
        if (!storageUrl) {
            throw new ConvexError({ message: "Failed to get storage URL" });
        }

        // Save file metadata to database
        await ctx.runMutation(internal.files.files.createFileRecord, {
            userId: user._id,
            filename: args.filename,
            mediaType: args.mediaType,
            storageId,
            storageUrl,
        });

        return { storageId, storageUrl };
    },
});

// Internal mutation to create file record
export const createFileRecord = internalMutation({
    args: {
        userId: v.id("users"),
        filename: v.string(),
        mediaType: v.string(),
        storageId: v.id("_storage"),
        storageUrl: v.string(),
    },
    returns: v.id("files"),
    handler: async (ctx, args) => {
        return await ctx.db.insert("files", {
            userId: args.userId,
            filename: args.filename,
            mediaType: args.mediaType,
            storageId: args.storageId,
            storageUrl: args.storageUrl,
        });
    },
});
```

### Download File (Action)

```typescript
export const downloadFile = action({
    args: {
        storageId: v.id("_storage"),
    },
    returns: v.bytes(),
    handler: async (ctx, args) => {
        const blob = await ctx.storage.get(args.storageId);
        if (!blob) {
            throw new ConvexError({ message: "File not found" });
        }
        return await blob.arrayBuffer();
    },
});
```

### Get File URL (Query)

```typescript
import { query } from "../_generated/server";

export const getFileUrl = query({
    args: {
        storageId: v.id("_storage"),
    },
    handler: async (ctx, args) => {
        return await ctx.storage.getUrl(args.storageId);
    },
});
```

### Delete File (Mutation)

```typescript
export const deleteFile = mutation({
    args: {
        fileId: v.id("files"),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        const file = await ctx.db.get(args.fileId);
        if (!file) {
            throw new ConvexError({ message: "File not found" });
        }

        // Delete from storage
        await ctx.storage.delete(file.storageId);

        // Delete database record
        await ctx.db.delete(args.fileId);

        return null;
    },
});
```

## Query File Metadata

Use the `_storage` system table to get file metadata. **Do NOT use the
deprecated `ctx.storage.getMetadata()`**.

```typescript
import { query } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

type FileMetadata = {
    _id: Id<"_storage">;
    _creationTime: number;
    contentType?: string;
    sha256: string;
    size: number;
};

export const getFileMetadata = query({
    args: {
        storageId: v.id("_storage"),
    },
    handler: async (ctx, args) => {
        // Query the _storage system table
        const metadata: FileMetadata | null = await ctx.db.system.get(
            args.storageId,
        );
        return metadata;
    },
});
```

## Schema for Files Table

```typescript
// convex/schema.ts
files: defineTable({
    userId: v.id("users"),
    filename: v.string(),
    mediaType: v.string(),
    storageId: v.id("_storage"),
    storageUrl: v.string(),
    // Optional: additional metadata
    fileData: v.optional(v.object({
        width: v.optional(v.number()),
        height: v.optional(v.number()),
        duration: v.optional(v.number()),
        pageCount: v.optional(v.number()),
    })),
})
    .index("byUserId", ["userId"])
    .index("byStorageId", ["storageId"])
    .index("byStorageUrl", ["storageUrl"])
    .searchIndex("search_filename", {
        searchField: "filename",
    });
```

## Frontend Upload Pattern

```typescript
// src/hooks/use-upload-file.ts
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";

export const useUploadFile = () => {
    const uploadFile = useMutation(api.files.files.uploadFile);

    const upload = async (file: File) => {
        const arrayBuffer = await file.arrayBuffer();

        const result = await uploadFile({
            filename: file.name,
            mediaType: file.type,
            data: new Uint8Array(arrayBuffer),
        });

        return result;
    };

    return { upload };
};
```

### File Input Component

```tsx
// src/components/FileUpload.tsx
import { useUploadFile } from "@/hooks/use-upload-file";

export const FileUpload = (
    { onUpload }: { onUpload: (url: string) => void },
) => {
    const { upload } = useUploadFile();
    const [isUploading, setIsUploading] = useState(false);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const { storageUrl } = await upload(file);
            onUpload(storageUrl);
        } catch (error) {
            console.error("Upload failed:", error);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <input
            type="file"
            onChange={handleFileChange}
            disabled={isUploading}
        />
    );
};
```

## Image Processing Pattern

```typescript
// convex/files/lib/fileConversions.ts
"use node";

import type { GenericActionCtx, GenericDataModel } from "convex/server";

export type FileData = {
    type: "image" | "video" | "pdf" | "other";
    width?: number;
    height?: number;
    duration?: number;
    pageCount?: number;
    textContent?: string;
};

export const convertFileToFileData = async ({
    ctx,
    storageUrl,
    mediaType,
    arrayBuffer,
}: {
    ctx: GenericActionCtx<GenericDataModel>;
    storageUrl: string;
    mediaType: string;
    arrayBuffer: ArrayBuffer;
}): Promise<FileData> => {
    if (mediaType.startsWith("image/")) {
        // Process image (get dimensions)
        return {
            type: "image",
            // ... extract dimensions using sharp or similar
        };
    }

    if (mediaType.startsWith("video/")) {
        return {
            type: "video",
            // ... extract duration
        };
    }

    if (mediaType === "application/pdf") {
        return {
            type: "pdf",
            // ... extract page count
        };
    }

    return { type: "other" };
};
```

## Batch Operations

```typescript
// Batch upload
export const batchUpload = action({
    args: {
        files: v.array(v.object({
            id: v.string(),
            filename: v.string(),
            mediaType: v.string(),
            data: v.bytes(),
        })),
    },
    returns: v.array(v.object({
        id: v.string(),
        status: v.union(v.literal("success"), v.literal("error")),
        storageId: v.optional(v.id("_storage")),
        storageUrl: v.optional(v.string()),
        error: v.optional(v.string()),
    })),
    handler: async (ctx, args) => {
        const results = await Promise.all(
            args.files.map(async (file) => {
                try {
                    const blob = new Blob([file.data], {
                        type: file.mediaType,
                    });
                    const storageId = await ctx.storage.store(blob);
                    const storageUrl = await ctx.storage.getUrl(storageId);

                    return {
                        id: file.id,
                        status: "success" as const,
                        storageId,
                        storageUrl: storageUrl ?? undefined,
                    };
                } catch (error) {
                    return {
                        id: file.id,
                        status: "error" as const,
                        error: error instanceof Error
                            ? error.message
                            : "Unknown error",
                    };
                }
            }),
        );

        return results;
    },
});
```

## Signed URLs

Convex storage URLs are signed and expire after some time. For long-term storage
references:

1. **Store `storageId`** in your database (permanent)
2. **Generate URL on demand** using `ctx.storage.getUrl()` when needed
3. **Cache URLs on frontend** but refresh periodically

```typescript
// Get fresh URL when needed
export const getFreshFileUrl = query({
    args: { fileId: v.id("files") },
    handler: async (ctx, args) => {
        const file = await ctx.db.get(args.fileId);
        if (!file) return null;

        // Always get fresh URL
        const freshUrl = await ctx.storage.getUrl(file.storageId);
        return freshUrl;
    },
});
```

## Important Notes

1. **Files are stored as Blobs** - convert ArrayBuffer to Blob before storing
2. **Use `ctx.db.system.get()`** to query `_storage` metadata, not
   `ctx.storage.getMetadata()`
3. **Storage URLs expire** - regenerate when needed
4. **Delete from both storage and database** when removing files
5. **Use actions for upload/download** - they support `ctx.storage` operations
