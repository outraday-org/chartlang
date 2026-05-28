---
name: create-cron-job
description: Guide for creating scheduled cron jobs in Convex with intervals and cron expressions. Use when adding scheduled tasks, periodic syncs, or background jobs.
---

# Create Cron Job

This skill guides you through creating scheduled cron jobs in Convex.

## Overview

Convex supports scheduled jobs via `cronJobs()`. Jobs can run on intervals or cron expressions and call internal actions or mutations.

## Cron Definition File

All crons are defined in a single file:

```typescript
// convex/crons.ts
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Define cron jobs here...

export default crons;
```

## Scheduling Methods

### Cron Expression (`crons.cron`)

Standard cron syntax: `minute hour day-of-month month day-of-week`

```typescript
// Every 5 minutes
crons.cron(
    "sync usage to stripe",
    "*/5 * * * *",
    internal.stripe.usageSync.syncUsageToStripe,
    {}
);

// Every minute
crons.cron(
    "check ui usage reset",
    "* * * * *",
    internal.stripe.usageSync.checkAndResetUsagePeriods,
    {}
);

// Daily at 02:00 UTC
crons.cron(
    "sync companies from backend",
    "0 2 * * *",
    internal.crons.syncCompaniesFromBackend,
    {}
);

// Every Monday at 9:00 AM UTC
crons.cron(
    "weekly report",
    "0 9 * * 1",
    internal.reports.generateWeeklyReport,
    {}
);

// First day of month at midnight
crons.cron(
    "monthly cleanup",
    "0 0 1 * *",
    internal.maintenance.monthlyCleanup,
    {}
);
```

### Interval (`crons.interval`)

Simpler syntax for fixed intervals:

```typescript
// Every 5 minutes
crons.interval(
    "sync usage",
    { minutes: 5 },
    internal.stripe.usageSync.syncUsageToStripe,
    {}
);

// Every hour
crons.interval(
    "hourly check",
    { hours: 1 },
    internal.maintenance.hourlyCheck,
    {}
);

// Every 30 seconds
crons.interval(
    "frequent poll",
    { seconds: 30 },
    internal.polling.checkExternalService,
    {}
);
```

## Cron Expression Reference

```
┌───────────── minute (0-59)
│ ┌───────────── hour (0-23)
│ │ ┌───────────── day of month (1-31)
│ │ │ ┌───────────── month (1-12)
│ │ │ │ ┌───────────── day of week (0-6, Sunday=0)
│ │ │ │ │
* * * * *
```

| Expression | Description |
|------------|-------------|
| `* * * * *` | Every minute |
| `*/5 * * * *` | Every 5 minutes |
| `0 * * * *` | Every hour |
| `0 0 * * *` | Daily at midnight |
| `0 2 * * *` | Daily at 2:00 AM |
| `0 9 * * 1` | Every Monday at 9:00 AM |
| `0 0 1 * *` | First of month at midnight |
| `0 0 * * 0` | Every Sunday at midnight |

## Creating the Handler Function

Cron handlers must be **internal actions or internal mutations**:

```typescript
// convex/crons.ts
import { cronJobs } from "convex/server";
import { api, internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

const crons = cronJobs();

// Define handler as internalAction
export const syncCompaniesFromBackend = internalAction({
    args: {},
    handler: async (ctx): Promise<null> => {
        // Fetch from external source
        const { items } = await ctx.runAction(
            api.externalBackend.backend.companies.listCompaniesAction,
            {
                searchName: undefined,
                limit: 1000,
                offset: 0
            }
        );

        // Transform data
        const companies = items.map((row) => ({
            cik: row.cik,
            name: row.name,
            ticker: row.ticker,
            // ... map other fields
        }));

        // Upsert to Convex
        await ctx.runMutation(api.companies.companies.batchInsertCompanies, {
            companies
        });

        // Cleanup
        await ctx.runMutation(api.companies.companies.deleteDelistedCompanies);

        return null;
    }
});

// Register the cron
crons.cron(
    "sync companies from backend",
    "0 2 * * *",
    internal.crons.syncCompaniesFromBackend,
    {}
);

export default crons;
```

## Handler Patterns

### Simple Internal Mutation Call

```typescript
// In convex/maintenance/cleanup.ts
export const cleanupExpiredSessions = internalMutation({
    args: {},
    handler: async (ctx) => {
        const expiredSessions = await ctx.db
            .query("sessions")
            .withIndex("byExpiresAt")
            .filter((q) => q.lt(q.field("expiresAt"), Date.now()))
            .collect();

        for (const session of expiredSessions) {
            await ctx.db.delete(session._id);
        }

        return null;
    }
});

// In convex/crons.ts
crons.cron(
    "cleanup expired sessions",
    "0 * * * *",  // Every hour
    internal.maintenance.cleanup.cleanupExpiredSessions,
    {}
);
```

### Action with External API Call

```typescript
// In convex/stripe/usageSync.ts
export const syncUsageToStripe = internalAction({
    args: {},
    handler: async (ctx): Promise<null> => {
        // Get users with pending usage
        const usersWithPending = await ctx.runQuery(
            internal.users.users.listUsersWithPendingUsage
        );

        for (const user of usersWithPending) {
            if (!user.stripeMeteredSubscriptionId) continue;

            try {
                // Report to Stripe
                await stripe.subscriptionItems.createUsageRecord(
                    user.stripeMeteredSubscriptionId,
                    {
                        quantity: user.webUsagePending,
                        timestamp: Math.floor(Date.now() / 1000),
                        action: "increment"
                    }
                );

                // Reset pending counter
                await ctx.runMutation(internal.users.users.resetPendingUsage, {
                    userId: user._id
                });
            } catch (error) {
                console.error(`Failed to sync usage for ${user._id}:`, error);
            }
        }

        return null;
    }
});
```

### Batch Processing Pattern

```typescript
export const processQueuedJobs = internalAction({
    args: {},
    handler: async (ctx): Promise<null> => {
        const BATCH_SIZE = 100;

        // Get pending jobs
        const pendingJobs = await ctx.runQuery(
            internal.jobs.jobs.listPendingJobs,
            { limit: BATCH_SIZE }
        );

        if (pendingJobs.length === 0) {
            return null;
        }

        // Process in parallel with concurrency limit
        const results = await Promise.allSettled(
            pendingJobs.map(async (job) => {
                await ctx.runMutation(internal.jobs.jobs.markJobProcessing, {
                    jobId: job._id
                });

                try {
                    // Process the job
                    await processJob(ctx, job);

                    await ctx.runMutation(internal.jobs.jobs.markJobComplete, {
                        jobId: job._id
                    });
                } catch (error) {
                    await ctx.runMutation(internal.jobs.jobs.markJobFailed, {
                        jobId: job._id,
                        error: error instanceof Error ? error.message : "Unknown error"
                    });
                }
            })
        );

        console.log(`Processed ${results.length} jobs`);
        return null;
    }
});
```

## Passing Arguments

Cron handlers can receive static arguments:

```typescript
// Handler with args
export const sendScheduledNotifications = internalAction({
    args: {
        notificationType: v.string()
    },
    handler: async (ctx, args): Promise<null> => {
        console.log(`Sending ${args.notificationType} notifications`);
        // ... implementation
        return null;
    }
});

// Register with different args
crons.cron(
    "daily digest",
    "0 8 * * *",
    internal.notifications.sendScheduledNotifications,
    { notificationType: "daily_digest" }
);

crons.cron(
    "weekly summary",
    "0 9 * * 1",
    internal.notifications.sendScheduledNotifications,
    { notificationType: "weekly_summary" }
);
```

## Error Handling

```typescript
export const robustCronHandler = internalAction({
    args: {},
    handler: async (ctx): Promise<null> => {
        try {
            // Main logic
            const data = await fetchExternalData();
            await ctx.runMutation(internal.data.data.upsertData, { data });
        } catch (error) {
            // Log error but don't throw - cron will retry on failure
            console.error("Cron job failed:", error);

            // Optionally record failure
            await ctx.runMutation(internal.logs.logs.recordCronFailure, {
                jobName: "robustCronHandler",
                error: error instanceof Error ? error.message : "Unknown error",
                timestamp: Date.now()
            });
        }

        return null;
    }
});
```

## Common Cron Patterns

### Usage Sync (Every 5 Minutes)

```typescript
crons.cron(
    "sync usage to stripe",
    "*/5 * * * *",
    internal.stripe.usageSync.syncUsageToStripe,
    {}
);
```

### Daily Data Sync (2 AM UTC)

```typescript
crons.cron(
    "sync companies from backend",
    "0 2 * * *",
    internal.crons.syncCompaniesFromBackend,
    {}
);
```

### Minute-Level Checks

```typescript
crons.cron(
    "check usage periods",
    "* * * * *",
    internal.stripe.usageSync.checkAndResetUsagePeriods,
    {}
);
```

### Weekly Reports (Monday 9 AM)

```typescript
crons.cron(
    "weekly analytics report",
    "0 9 * * 1",
    internal.reports.generateWeeklyAnalytics,
    {}
);
```

## Important Notes

1. **Use internal functions** - Always use `internal.*.*` references, not `api.*.*`
2. **Handler type** - Both `internalAction` and `internalMutation` are valid cron handlers
3. **Return type** - Handlers should return `Promise<null>` explicitly
4. **Time zone** - All cron expressions use UTC
5. **Idempotency** - Design handlers to be idempotent (safe to run multiple times)
6. **Timeouts** - Actions have a 10-minute timeout; long jobs should be chunked
7. **Rate limits** - Be mindful of external API rate limits in cron handlers
8. **Logging** - Add console.log for monitoring cron execution

## Complete Example

```typescript
// convex/crons.ts
import { cronJobs } from "convex/server";
import { api, internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

const crons = cronJobs();

// Handler for syncing external data
export const syncCompaniesFromBackend = internalAction({
    args: {},
    handler: async (ctx): Promise<null> => {
        const { items } = await ctx.runAction(
            api.externalBackend.backend.companies.listCompaniesAction,
            {
                searchName: undefined,
                limit: 1000,
                offset: 0
            }
        );

        const companies = items.map((row) => ({
            category: row.category,
            cik: row.cik,
            name: row.name,
            ticker: row.ticker,
            // ... other fields
        }));

        await ctx.runMutation(api.companies.companies.batchInsertCompanies, {
            companies
        });

        await ctx.runMutation(api.companies.companies.deleteDelistedCompanies);

        return null;
    }
});

// Daily sync at 02:00 UTC
crons.cron(
    "sync first 100 companies from Supabase",
    "0 2 * * *",
    internal.crons.syncCompaniesFromBackend,
    {}
);

// Usage sync every 5 minutes
crons.cron(
    "sync usage to stripe",
    "*/5 * * * *",
    internal.stripe.usageSync.syncUsageToStripe,
    {}
);

// Usage reset check every minute
crons.cron(
    "check team usage reset",
    "* * * * *",
    internal.stripe.usageSync.checkAndResetTeamUsagePeriods,
    {}
);

// Check and schedule triggers (conditional scheduling)
crons.cron(
    "check and schedule triggers",
    "* * * * *",
    internal.triggers.triggerScheduler.checkAndScheduleTriggers,
    {}
);

// Cleanup stale streaming chats every 10 minutes
crons.interval(
    "cleanup stale streaming chats",
    { minutes: 10 },
    internal.agent.chatCleanup.cleanupStaleStreamingChats,
    {}
);

export default crons;
```

## Checklist

- [ ] Create handler as `internalAction` in appropriate module
- [ ] Handler returns `Promise<null>`
- [ ] Add error handling with logging
- [ ] Register cron in `convex/crons.ts`
- [ ] Use `internal.*.*` reference (not `api.*.*`)
- [ ] Test handler manually before enabling cron
- [ ] Document the cron schedule in comments
