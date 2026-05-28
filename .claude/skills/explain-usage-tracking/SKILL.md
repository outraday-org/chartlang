---
name: explain-usage-tracking
description: Explains the web usage tracking and sync system for billing, including the dual counter pattern, cron jobs, and usage access control. Use when working with usage limits, billing sync, or understanding how usage is tracked.
---

# Web Usage Tracking System

This skill explains the team-scoped usage tracking and sync system for billing.

## Architecture Overview

Usage is tracked at **two levels**: per-member (access control) and team-level
(billing sync + PAYG).

```
┌─────────────────┐     ┌─────────────────────┐     ┌──────────────────┐
│   UI Action     │────▶│   Convex Mutation    │────▶│   Team Record    │
│  (e.g., chat)   │     │ incrementTeamUsage() │     │  webUsagePending │
└─────────────────┘     └─────────────────────┘     └──────────────────┘
                                │                           │
                                ▼                           ▼
                        ┌──────────────────┐     ┌──────────────────┐
                        │  TeamMember Rec  │     │   Cron (5min)    │
                        │  webUsageTotal   │     │ syncWebUsage     │
                        └──────────────────┘     │  ToStripe()      │
                                                 └──────────────────┘
                                                         │
                                                         ▼
                                                 ┌──────────────────┐
                                                 │   Stripe Meter   │
                                                 │   "web_credits"  │
                                                 └──────────────────┘
```

## Schema Fields

### Teams Table (team-level billing)

```typescript
// In convex/schema.ts
teams: defineTable({
    // Stripe sync staging
    webUsagePending: v.optional(v.number()),        // Not yet synced to Stripe

    // PAYG tracking
    webPaygUsageTotal: v.optional(v.number()),      // PAYG charges this period
    webPaygEnabled: v.optional(v.boolean()),
    webPaygCreditLimit: v.optional(v.number()),
    webPaygDollarLimit: v.optional(v.number()),

    // Billing cycle
    nextWebUsageResetDate: v.optional(v.number()),  // Unix timestamp (seconds)

    // Cached tier
    currentTier: v.optional(vPriceTier),

    // Stripe
    stripeCustomerId: v.optional(v.string()),
})
    .index("byWebUsagePending", ["webUsagePending"])
    .index("byNextWebUsageResetDate", ["nextWebUsageResetDate"])
    .index("byStripeCustomerId", ["stripeCustomerId"]);
```

### TeamMembers Table (per-member access control)

```typescript
teamMembers: defineTable({
    teamId: v.id("teams"),
    userId: v.id("users"),
    role: v.union(v.literal("owner"), v.literal("administrator"), v.literal("member")),

    // Per-member usage counter
    webUsageTotal: v.optional(v.number()),
})
    .index("byTeamIdAndUserId", ["teamId", "userId"]);
```

## The Dual-Level Counter Pattern

The system uses counters at two levels:

| Counter                         | Level  | Purpose                  | Reset Timing          |
| ------------------------------- | ------ | ------------------------ | --------------------- |
| `teamMembers.webUsageTotal`     | Member | Access control, PAYG calc| Monthly billing cycle  |
| `teams.webUsagePending`         | Team   | Staging for Stripe sync  | After successful sync  |
| `teams.webPaygUsageTotal`       | Team   | PAYG charges this period | Monthly billing cycle  |

### Why This Design?

1. **Per-member access control**: Each member's usage is checked independently
   against the tier's included credits
2. **PAYG calculation**: When a member exceeds included credits, the overage
   delta is added to the team's PAYG total
3. **Atomic increments**: Member total + team pending increment together
4. **Retry safety**: If Stripe sync fails, `webUsagePending` retains the value
5. **Accurate billing**: Team-level PAYG total always reflects true overage

## Incrementing Usage

```typescript
// convex/stripe/stripeQueriesMutations.ts
export const incrementTeamUsage = internalMutation({
    args: {
        teamId: v.id("teams"),
        userId: v.id("users"),
        amount: v.number(),
        productType: vProductType,
    },
    returns: v.null(),
    handler: async (ctx, { teamId, userId, amount, productType }) => {
        const team = await ctx.db.get(teamId);
        const member = await ctx.db
            .query("teamMembers")
            .withIndex("byTeamIdAndUserId", (q) =>
                q.eq("teamId", teamId).eq("userId", userId),
            )
            .unique();

        // Calculate PAYG increment from member's overage delta
        const baseIncluded = getIncludedUsage(
            team.currentTier ?? PriceTier.FREE,
            productType,
        );
        const memberBefore = member?.webUsageTotal ?? 0;
        const memberAfter = memberBefore + amount;
        const oldOverage = Math.max(0, memberBefore - baseIncluded);
        const newOverage = Math.max(0, memberAfter - baseIncluded);
        const paygIncrement = newOverage - oldOverage;

        // Patch team: staging + PAYG
        await ctx.db.patch(teamId, {
            webUsagePending: (team.webUsagePending ?? 0) + amount,
            ...(paygIncrement > 0 && {
                webPaygUsageTotal:
                    (team.webPaygUsageTotal ?? 0) + paygIncrement,
            }),
        });

        // Patch member
        if (member) {
            await ctx.db.patch(member._id, {
                webUsageTotal: memberAfter,
            });
        }

        return null;
    },
});
```

## Usage Sync to Stripe

```typescript
// convex/stripe/usageSync.ts
"use node";

export const syncWebUsageToStripe = internalAction({
    args: {},
    returns: v.null(),
    handler: async (ctx) => {
        // Get all teams with pending usage > 0 (via byWebUsagePending index)
        const teamsWithPending = await ctx.runQuery(
            internal.stripe.usageSync.getTeamsWithPendingUsage,
            {},
        );

        for (const team of teamsWithPending) {
            if (!team.stripeCustomerId) continue;

            try {
                // Report to Stripe Billing Meter
                await stripe.billing.meterEvents.create({
                    event_name: "web_credits",
                    payload: {
                        value: Math.round(team.webUsagePending).toString(),
                        stripe_customer_id: team.stripeCustomerId,
                    },
                });

                // Reset pending only after successful sync
                await ctx.runMutation(
                    internal.stripe.usageSync.resetTeamUsagePending,
                    { teamId: team._id },
                );
            } catch (error) {
                console.error(
                    `Failed to sync usage for team ${team._id}:`,
                    error,
                );
                // Don't reset pending - will retry on next cron run
            }
        }

        return null;
    },
});
```

## Usage Period Reset

```typescript
// convex/stripe/usageSync.ts
export const checkAndResetTeamUsagePeriods = internalAction({
    args: {},
    returns: v.null(),
    handler: async (ctx) => {
        const now = Math.floor(Date.now() / 1000);

        // Get teams where nextWebUsageResetDate <= now
        const teams = await ctx.runQuery(
            internal.stripe.usageSync.getTeamsNeedingUsageReset,
            { now },
        );

        for (const team of teams) {
            try {
                // Reset team PAYG total + all member usage
                await ctx.runMutation(
                    internal.stripe.usageSync.resetTeamUsagePeriod,
                    { teamId: team._id },
                );
                // resetTeamUsagePeriod:
                //   - webPaygUsageTotal = 0
                //   - Loop through all members → webUsageTotal = 0

                // Calculate next reset date from Stripe or default +1 month
                const nextResetDate = team.stripeCustomerId
                    ? await getNextUsageResetDate(team.stripeCustomerId)
                    : dayjs().add(1, "month").unix();

                await ctx.runMutation(
                    internal.stripe.usageSync.setNextTeamUsageResetDate,
                    { teamId: team._id, nextResetDate },
                );
            } catch (error) {
                console.error(
                    `Failed to reset usage for team ${team._id}:`,
                    error,
                );
            }
        }

        return null;
    },
});
```

## Usage Access Control (Pure Function)

Before performing billable operations, check if the member has access:

```typescript
// convex/stripe/usageAccess.ts
// Pure function — no DB calls
export function checkUsageAccess(
    team: TeamUsageFields,
    memberUsage: MemberUsageFields,
    productType?: ProductType,
    projectedUsage?: number,
): UsageAccessResult {
    const tier = team.currentTier ?? PriceTier.FREE;
    const includedUsage = getIncludedUsage(tier, productType ?? ProductType.WEB_ACCESS);

    const currentUsage = memberUsage.webUsageTotal ?? 0;
    const usageToCheck = currentUsage + (projectedUsage ?? 0);
    const exceedsLimit = usageToCheck > includedUsage;

    if (exceedsLimit) {
        // Free tier: hard block (no PAYG allowed)
        if (tier === PriceTier.FREE) {
            return { allowed: false, reason: "Free plan limit reached", ... };
        }

        // Paid tier without PAYG: block
        if (!team.webPaygEnabled) {
            return { allowed: false, reason: "Enable pay-as-you-go or upgrade", ... };
        }

        // PAYG with credit limit: check team PAYG total
        if (team.webPaygCreditLimit !== undefined) {
            const additionalPayg = Math.max(0, usageToCheck - includedUsage)
                - Math.max(0, currentUsage - includedUsage);
            if ((team.webPaygUsageTotal ?? 0) + additionalPayg > team.webPaygCreditLimit) {
                return { allowed: false, reason: "PAYG limit reached", ... };
            }
        }
    }

    return { allowed: true, currentUsage, includedUsage, tier };
}
```

### Action Wrapper

```typescript
// convex/stripe/usageAccessActions.ts
export const checkTeamUsageAccess = action({
    args: {
        teamId: v.id("teams"),
        userId: v.id("users"),
        productType: vProductType,
        projectedUsage: v.optional(v.number()),
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        // Fetch team and member in parallel
        // Call validateTeamUsageAccess() → wraps checkUsageAccess()
        // Throws ConvexError if denied
    },
});
```

## Cron Jobs

```typescript
// convex/crons.ts
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Sync web usage to Stripe every 5 minutes
crons.cron(
    "sync web usage to stripe",
    "*/5 * * * *",
    internal.stripe.usageSync.syncWebUsageToStripe,
    {},
);

// Check and reset team usage periods every minute
crons.cron(
    "check team usage reset",
    "* * * * *",
    internal.stripe.usageSync.checkAndResetTeamUsagePeriods,
    {},
);

// Check and schedule triggers (conditional: every minute in prod, daily otherwise)
crons.cron(
    "check and schedule triggers",
    "* * * * *", // or "0 0 * * *" in non-prod
    internal.triggers.triggerScheduler.checkAndScheduleTriggers,
    {},
);

// Cleanup stale streaming chats
crons.cron(
    "cleanup stale streaming chats",
    "*/10 * * * *",
    internal.agent.chatCleanup.cleanupStaleStreamingChats,
    {},
);

export default crons;
```

## Frontend Integration

### Increment Usage on Action

```typescript
// In an AI action handler
const { user, teamId } = await ctx.runQuery(
    internal.teams.teamHelpers.resolveTeamContext,
    { teamId: args.teamId },
);

// Check access BEFORE expensive operation
await ctx.runAction(api.stripe.usageAccessActions.checkTeamUsageAccess, {
    teamId,
    userId: user._id,
    productType: ProductType.WEB_ACCESS,
    projectedUsage: estimatedCredits,
});

// Perform operation
const result = await expensiveAIOperation();

// Increment usage AFTER successful operation
await ctx.runMutation(internal.stripe.stripeQueriesMutations.incrementTeamUsage, {
    teamId,
    userId: user._id,
    amount: actualCreditsUsed,
    productType: ProductType.WEB_ACCESS,
});
```

## Flow Summary

```
1. User performs action
   └─▶ checkTeamUsageAccess() - verify member has access

2. Action succeeds
   └─▶ incrementTeamUsage() - increment member total + team pending + PAYG

3. Every 5 minutes (cron)
   └─▶ syncWebUsageToStripe() - report team pending to Stripe meter
       └─▶ resetTeamUsagePending() - clear pending after sync

4. Every minute (cron)
   └─▶ checkAndResetTeamUsagePeriods() - check for billing cycle end
       └─▶ resetTeamUsagePeriod() - reset PAYG total + all member totals
       └─▶ setNextTeamUsageResetDate() - set next reset

5. On invoice.created webhook
   └─▶ handleInvoiceCreated() - sync reset date with Stripe

6. Every 10 minutes (cron)
   └─▶ cleanupStaleStreamingChats() - cleanup orphaned streams
```

## Key Patterns

| Pattern              | Purpose                              |
| -------------------- | ------------------------------------ |
| Dual-level counters  | Member access + team billing sync    |
| PAYG from overage    | Per-member overage → team PAYG total |
| Cron sync            | Batch reporting to Stripe meter      |
| Projected usage      | Pre-check before operations          |
| Pure function check  | Testable usage access logic          |
| Index queries        | Efficient batch processing           |
