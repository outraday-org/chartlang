---
name: create-http-endpoint
description: Guide for creating HTTP endpoints in Convex including webhooks, API routes, CORS handling, and streaming responses. Use when adding webhooks, REST APIs, or SSE endpoints.
---

# Create HTTP Endpoint

This skill guides you through creating HTTP endpoints in Convex.

## Overview

HTTP endpoints are defined in `convex/http.ts` using `httpAction`. They handle webhooks, API routes, and streaming responses.

## Basic Structure

```typescript
// convex/http.ts
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

// Routes are registered below
http.route({
    path: "/api/my-endpoint",
    method: "POST",
    handler: httpAction(async (ctx, req) => {
        // Handler logic
        return new Response("OK", { status: 200 });
    })
});

export default http;
```

## Route Registration

Routes are registered at **exact paths** - no automatic prefixing:

```typescript
// This endpoint is at /api/users, not /http/api/users
http.route({
    path: "/api/users",
    method: "GET",
    handler: httpAction(async (ctx, req) => {
        const users = await ctx.runQuery(internal.users.users.listUsers);
        return new Response(JSON.stringify(users), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });
    })
});
```

## CORS Handling

Always include OPTIONS handler for CORS preflight:

```typescript
// CORS headers
const corsHeaders = new Headers({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400"
});

// Helper for OPTIONS requests
const handleOptions = (request: Request) => {
    const reqHeaders = request.headers;

    if (
        reqHeaders.get("Origin") !== null &&
        reqHeaders.get("Access-Control-Request-Method") !== null
    ) {
        const responseHeaders = new Headers(corsHeaders);

        // Reflect requested headers
        const requested = reqHeaders.get("Access-Control-Request-Headers");
        if (requested) {
            responseHeaders.set("Access-Control-Allow-Headers", requested);
        }

        return new Response(null, {
            status: 204,
            headers: responseHeaders
        });
    }

    return new Response(null, { status: 204 });
};

// Register both POST and OPTIONS
http.route({
    path: "/api/my-endpoint",
    method: "OPTIONS",
    handler: httpAction(async (_, req) => handleOptions(req))
});

http.route({
    path: "/api/my-endpoint",
    method: "POST",
    handler: httpAction(async (ctx, req) => {
        // ... handler logic

        // Include CORS headers in response
        return new Response(JSON.stringify(result), {
            status: 200,
            headers: {
                "Content-Type": "application/json",
                ...Object.fromEntries(corsHeaders)
            }
        });
    })
});
```

## Authentication Validation

```typescript
import { ConvexError } from "convex/values";
import { internal } from "./_generated/api";

http.route({
    path: "/api/protected",
    method: "POST",
    handler: httpAction(async (ctx, req) => {
        // Validate authentication via Convex's built-in auth
        const user = await ctx.runQuery(internal.users.users.getCurrentUser);

        if (!user) {
            return new Response(
                JSON.stringify({ error: "Unauthorized" }),
                {
                    status: 401,
                    headers: { "Content-Type": "application/json" }
                }
            );
        }

        // Proceed with authenticated user
        const result = await ctx.runAction(internal.someAction, {
            userId: user._id
        });

        return new Response(JSON.stringify(result), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });
    })
});
```

## Webhook Handler Pattern

```typescript
import Stripe from "stripe";
import { envServer } from "./env.server";

http.route({
    path: "/stripe/webhook",
    method: "POST",
    handler: httpAction(async (ctx, req) => {
        // Get signature header
        const signature = req.headers.get("stripe-signature");
        if (!signature) {
            return new Response("Missing signature", { status: 400 });
        }

        // Get raw body
        const body = await req.text();

        // Initialize Stripe
        const stripe = new Stripe(envServer.STRIPE_SECRET_KEY, {
            apiVersion: "2025-12-15.clover"
        });

        // Verify webhook signature
        let event: Stripe.Event;
        try {
            event = await stripe.webhooks.constructEventAsync(
                body,
                signature,
                envServer.STRIPE_WEBHOOK_SECRET
            );
        } catch (err) {
            console.error("Webhook signature verification failed:", err);
            return new Response("Invalid signature", { status: 400 });
        }

        // Handle event types
        switch (event.type) {
            case "customer.created":
                await ctx.runAction(internal.stripe.webhooks.handleCustomerCreated, {
                    customer: event.data.object
                });
                break;

            case "customer.subscription.created":
                await ctx.runAction(internal.stripe.webhooks.handleSubscriptionCreated, {
                    subscription: event.data.object
                });
                break;

            default:
                console.log(`Unhandled event type: ${event.type}`);
        }

        return new Response(JSON.stringify({ received: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });
    })
});
```

## Streaming Response (SSE)

For AI agents and long-running operations:

```typescript
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";

http.route({
    path: "/api/ai/chat",
    method: "POST",
    handler: httpAction(async (ctx, req) => {
        // Validate auth
        const user = await ctx.runQuery(internal.users.users.getCurrentUser);
        if (!user) {
            return new Response("Unauthorized", { status: 401 });
        }

        // Parse request
        const body = await req.json();
        const { message } = body;

        // Create streaming response
        const stream = createUIMessageStream({
            execute: async ({ writer }) => {
                // Write progress updates
                writer.write({
                    type: "data-step",
                    id: crypto.randomUUID(),
                    data: { type: "processing" },
                    transient: true
                });

                // Run agent
                const result = await runAgent({
                    ctx,
                    userId: user._id,
                    message,
                    writer,
                    abortSignal: req.signal
                });

                // Write final result
                writer.write({
                    type: "text",
                    text: result.text
                });
            }
        });

        return createUIMessageStreamResponse({
            stream,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization"
            }
        });
    })
});
```

## Multi-Step Agent Streaming Pattern

For agents with separate init/stream/persist phases:

```typescript
// convex/http.ts
// 1. Initialize chat stream (called by worker before sandbox acquisition)
http.route({
    path: "/api/agent/init-chat-stream",
    method: "POST",
    handler: httpAction(async (ctx, req) => {
        // Auth via webhook secret (not Clerk JWT — called from worker)
        const secret = req.headers.get("X-Webhook-Secret");
        if (secret !== envServer.AGENT_SANDBOX_WEBHOOK_SECRET) {
            return new Response("Unauthorized", { status: 401 });
        }

        const body = await req.json();
        const { clerkUserId } = body;

        // Resolve Convex user from Clerk external ID
        const user = await ctx.runQuery(
            internal.users.users.userByExternalId,
            { externalId: clerkUserId },
        );
        if (!user) return jsonResponse({ error: "User not found" }, 404);

        const result = await initChatStreamCore(ctx, user._id, body);
        return jsonResponse(result);
    }),
});

// 2. Persist streaming message parts
http.route({
    path: "/api/agent/chat/persist-parts",
    method: "POST",
    handler: persistPartsHandler,
});

// 3. Finalize stream (mark complete, calculate usage)
http.route({
    path: "/api/agent/chat/finalize-stream",
    method: "POST",
    handler: finalizeStreamHandler,
});

// 4. Persist artifacts (research diffs, files)
http.route({
    path: "/api/agent/chat/persist-artifact",
    method: "POST",
    handler: persistArtifactHandler,
});
```

## Collaborative Document Endpoints

Each collaborative DO type (ResearchFile, SyncedBlock, Skill, GlobalCompany) has
3 HTTP endpoints for DO ↔ Convex communication:

```typescript
// Pattern for each document type:
http.route({
    path: "/api/<type>/get-content",     // Initial content for DO initialization
    method: "POST",
    handler: httpAction(async (ctx, req) => {
        // Auth: X-Internal-Secret header
        // Returns: { content?: string }
    }),
});

http.route({
    path: "/api/<type>/snapshot",         // Periodic snapshot from DO
    method: "POST",
    handler: httpAction(async (ctx, req) => {
        // Auth: X-Internal-Secret header
        // Body: { documentId, content: string }
    }),
});

http.route({
    path: "/api/<type>/check-access",    // Access validation before WS connect
    method: "POST",
    handler: httpAction(async (ctx, req) => {
        // Auth: Clerk JWT
        // Returns: { allowed: boolean }
    }),
});
```

## Request Body Handling

```typescript
// JSON body
http.route({
    path: "/api/json",
    method: "POST",
    handler: httpAction(async (ctx, req) => {
        const body = await req.json();
        // body is parsed JSON
        return new Response(JSON.stringify({ received: body }));
    })
});

// Text body
http.route({
    path: "/api/text",
    method: "POST",
    handler: httpAction(async (ctx, req) => {
        const body = await req.text();
        // body is string
        return new Response(`Received: ${body}`);
    })
});

// Binary body
http.route({
    path: "/api/binary",
    method: "POST",
    handler: httpAction(async (ctx, req) => {
        const body = await req.bytes();
        // body is ArrayBuffer
        return new Response(`Received ${body.byteLength} bytes`);
    })
});

// Form data
http.route({
    path: "/api/form",
    method: "POST",
    handler: httpAction(async (ctx, req) => {
        const formData = await req.formData();
        const name = formData.get("name");
        return new Response(`Hello, ${name}`);
    })
});
```

## URL Parameters

```typescript
// Path parameters with dynamic segments
http.route({
    path: "/api/users/:userId",
    method: "GET",
    handler: httpAction(async (ctx, req) => {
        const url = new URL(req.url);
        // Extract from URL path
        const pathParts = url.pathname.split("/");
        const userId = pathParts[pathParts.length - 1];

        const user = await ctx.runQuery(internal.users.users.getUserById, {
            id: userId
        });

        return new Response(JSON.stringify(user), {
            headers: { "Content-Type": "application/json" }
        });
    })
});

// Query parameters
http.route({
    path: "/api/search",
    method: "GET",
    handler: httpAction(async (ctx, req) => {
        const url = new URL(req.url);
        const query = url.searchParams.get("q") ?? "";
        const limit = parseInt(url.searchParams.get("limit") ?? "10");

        const results = await ctx.runQuery(internal.search.search, {
            query,
            limit
        });

        return new Response(JSON.stringify(results), {
            headers: { "Content-Type": "application/json" }
        });
    })
});
```

## Error Handling

```typescript
http.route({
    path: "/api/safe",
    method: "POST",
    handler: httpAction(async (ctx, req) => {
        try {
            const body = await req.json();

            // Validate request
            if (!body.required_field) {
                return new Response(
                    JSON.stringify({ error: "Missing required_field" }),
                    { status: 400, headers: { "Content-Type": "application/json" } }
                );
            }

            const result = await ctx.runAction(internal.doSomething, body);

            return new Response(JSON.stringify(result), {
                status: 200,
                headers: { "Content-Type": "application/json" }
            });
        } catch (error) {
            console.error("Endpoint error:", error);

            const message = error instanceof Error ? error.message : "Internal error";
            const status = message.includes("not found") ? 404 : 500;

            return new Response(
                JSON.stringify({ error: message }),
                { status, headers: { "Content-Type": "application/json" } }
            );
        }
    })
});
```

## Complete Example

```typescript
// convex/http.ts
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

// CORS helper
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

// OPTIONS handler
http.route({
    path: "/api/items",
    method: "OPTIONS",
    handler: httpAction(async () => {
        return new Response(null, { status: 204, headers: corsHeaders });
    })
});

// GET - List items
http.route({
    path: "/api/items",
    method: "GET",
    handler: httpAction(async (ctx, req) => {
        const user = await ctx.runQuery(internal.users.users.getCurrentUser);
        if (!user) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { "Content-Type": "application/json", ...corsHeaders }
            });
        }

        const url = new URL(req.url);
        const status = url.searchParams.get("status");

        const items = await ctx.runQuery(internal.items.items.listItems, {
            userId: user._id,
            status: status ?? undefined
        });

        return new Response(JSON.stringify(items), {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders }
        });
    })
});

// POST - Create item
http.route({
    path: "/api/items",
    method: "POST",
    handler: httpAction(async (ctx, req) => {
        const user = await ctx.runQuery(internal.users.users.getCurrentUser);
        if (!user) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { "Content-Type": "application/json", ...corsHeaders }
            });
        }

        const body = await req.json();

        const itemId = await ctx.runMutation(internal.items.items.createItem, {
            userId: user._id,
            name: body.name,
            data: body.data
        });

        return new Response(JSON.stringify({ id: itemId }), {
            status: 201,
            headers: { "Content-Type": "application/json", ...corsHeaders }
        });
    })
});

export default http;
```

## Checklist

- [ ] Define route in `convex/http.ts`
- [ ] Add OPTIONS handler for CORS
- [ ] Validate authentication if needed
- [ ] Parse and validate request body
- [ ] Handle errors gracefully
- [ ] Include proper response headers
- [ ] Export default http router
