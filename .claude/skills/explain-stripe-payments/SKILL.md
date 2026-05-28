---
name: explain-stripe-payments
description: Explains the Stripe billing architecture including dual subscription model (FIXED + METERED), webhook handling, feature access control, and team-scoped usage tracking. Use when working with payments, subscriptions, or billing features.
---

# Stripe Payments Architecture

This skill explains the Stripe billing integration patterns used in this
project. **All billing is team-scoped** — usage, subscriptions, and PAYG are
tracked on the `teams` table, with per-member usage on `teamMembers`.

## Architecture Overview

The project uses a **dual subscription model** per team:

- **FIXED subscription** - Base plan (FREE, STARTER, BASIC, PRO)
- **METERED subscription** - Pay-as-you-go overage billing

```
┌─────────────────────────────────────────────────────────────┐
│                  Stripe Customer (Team)                      │
├─────────────────────────────────────────────────────────────┤
│  FIXED Subscription          │  METERED Subscription        │
│  - Monthly/Annual base fee   │  - Usage-based overage       │
│  - Includes X credits        │  - Charged per credit        │
│  - Tier: STARTER/BASIC/PRO   │  - Optional PAYG             │
└─────────────────────────────────────────────────────────────┘
```

## Key Files

```
convex/stripe/
├── webhooks.ts               # Stripe webhook handlers
├── stripeClient.ts           # Stripe SDK client
├── stripeQueriesMutations.ts # Internal DB operations (incrementTeamUsage, etc.)
├── featureAccess.ts          # Feature gating by tier
├── featureFlags.ts           # Feature flag definitions
├── usageAccess.ts            # Usage limit checking (checkUsageAccess pure fn)
├── usageAccessActions.ts     # checkTeamUsageAccess action wrapper
├── usageSync.ts              # Usage sync to Stripe (cron handlers)
├── usageReset.ts             # Usage period reset helpers
├── priceTiers.ts             # Tier definitions and validators
├── usageConfig.ts            # Included credits and PAYG rates per tier
├── metadata.ts               # Subscription metadata types
└── utils.ts                  # Helper functions
```

## Product and Subscription Types

```typescript
// convex/stripe/metadata.ts
export enum ProductType {
    WEB_ACCESS = "web_access", // UI/frontend usage
    API_ACCESS = "api_access", // API usage (separate)
}

export enum SubscriptionType {
    FIXED = "fixed", // Base plan subscription
    METERED = "metered", // Pay-as-you-go overage
}
```

## Price Tiers

```typescript
// convex/stripe/priceTiers.ts
export enum PriceTier {
    FREE = "free",
    STARTER = "starter",
    BASIC = "basic",
    PRO = "pro",
}

// Validators
export const vPriceTier = v.union(
    v.literal("free"),
    v.literal("starter"),
    v.literal("basic"),
    v.literal("pro"),
);

export const isPriceTier = (value: string): value is PriceTier => ...;
export const getTierFromStripePrice = (price: Stripe.Price): PriceTier => ...;
```

## Included Usage Credits

```typescript
// convex/stripe/usageConfig.ts
// Credits per billing period (WEB_ACCESS)
FREE:    100,000 credits
STARTER: 5,000,000 credits
BASIC:   12,000,000 credits
PRO:     30,000,000 credits

// PAYG rates ($ per credit)
FREE:    0.00000 (no PAYG allowed)
STARTER: 0.00001 ($10/million)
BASIC:   0.00001 ($10/million)
PRO:     0.00001 ($10/million)
```

## Team Schema Fields for Billing

```typescript
// In convex/schema.ts — teams table
teams: defineTable({
    // ... other fields

    // Stripe customer ID (team-level)
    stripeCustomerId: v.optional(v.string()),

    // Cached tier from Stripe (set by webhooks)
    currentTier: v.optional(v.union(
        v.literal("free"),
        v.literal("starter"),
        v.literal("basic"),
        v.literal("pro"),
    )),

    // Pay-as-you-go settings
    webPaygEnabled: v.optional(v.boolean()),
    webPaygUsageTotal: v.optional(v.number()),    // PAYG charges this period
    webPaygCreditLimit: v.optional(v.number()),   // Max PAYG credits
    webPaygDollarLimit: v.optional(v.number()),   // Max PAYG dollars

    // Usage sync staging
    webUsagePending: v.optional(v.number()),       // Not yet synced to Stripe

    // Billing cycle
    nextWebUsageResetDate: v.optional(v.number()), // Unix timestamp

    // Seat tracking
    seatCount: v.optional(v.number()),
})
    .index("byStripeCustomerId", ["stripeCustomerId"])
    .index("byWebUsagePending", ["webUsagePending"])
    .index("byNextWebUsageResetDate", ["nextWebUsageResetDate"]);

// teamMembers table — per-member usage
teamMembers: defineTable({
    teamId: v.id("teams"),
    userId: v.id("users"),
    role: v.union(v.literal("owner"), v.literal("administrator"), v.literal("member")),

    // Per-member usage counter (for access control)
    webUsageTotal: v.optional(v.number()),
})
    .index("byTeamIdAndUserId", ["teamId", "userId"]);
```

## Usage Access Checking (Pure Function)

```typescript
// convex/stripe/usageAccess.ts
// Pure function — no database calls, fully testable
export function checkUsageAccess(
    team: TeamUsageFields,
    memberUsage: MemberUsageFields,
    productType?: ProductType,
    projectedUsage?: number,
): UsageAccessResult {
    // 1. Resolve tier (defaults to FREE)
    // 2. Get included usage: getIncludedUsage(tier, ProductType.WEB_ACCESS)
    // 3. Check: memberUsage.webUsageTotal + projectedUsage <= includedUsage
    // 4. FREE tier over limit → deny (no PAYG)
    // 5. Paid tier without PAYG enabled → deny
    // 6. PAYG with credit limit → check team PAYG total
    // 7. Otherwise → allow
}

// Return type
type UsageAccessResult = {
    allowed: boolean;
    reason?: string;
    currentUsage: number;
    includedUsage: number;
    tier: PriceTier;
    teamPaygUsage?: number;
};
```

## Usage Access Action (Team-Scoped)

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
        // 1. Fetch team and member in parallel
        // 2. Call validateTeamUsageAccess() which wraps checkUsageAccess()
        // 3. Throws ConvexError if denied, returns null if allowed
    },
});
```

## Feature Access Checking

```typescript
// convex/stripe/featureAccess.ts
// Feature access uses team.currentTier (cached from Stripe webhooks)
// instead of looking up the Stripe subscription directly

// Check: TIER_ORDER[team.currentTier] >= TIER_ORDER[requiredTier]
```

## Webhook Handling

```typescript
// convex/http.ts
http.route({
    path: "/stripe/webhook",
    method: "POST",
    handler: httpAction(async (ctx, req) => {
        // Verify stripe-signature header
        // Handle event types:
        //   customer.created
        //   customer.subscription.created
        //   customer.subscription.updated   → updates teams.currentTier
        //   customer.subscription.deleted
        //   customer.deleted
        //   invoice.created                 → sync reset date
    }),
});
```

## Usage Increment (Team + Member)

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
        // 1. Fetch team and member (byTeamIdAndUserId index)
        // 2. Calculate old/new member overage
        // 3. PAYG increment = newOverage - oldOverage (only positive)
        // 4. Patch team:
        //    - webUsagePending += amount
        //    - webPaygUsageTotal += paygIncrement (if > 0)
        // 5. Patch member:
        //    - webUsageTotal += amount
    },
});
```

## PAYG Limit Management

```typescript
// convex/stripe/stripeQueriesMutations.ts
export const setTeamPaygLimitPublic = mutation({
    args: {
        teamId: v.id("teams"),
        productType: vProductType,
        dollarLimit: v.union(v.number(), v.null()),
        tier: vPriceTier,
    },
    returns: v.null(),
    handler: async (ctx, args) => {
        // 1. Verify caller has TeamAction.MANAGE_BILLING
        // 2. If dollarLimit === null: clear both limits
        // 3. Otherwise: creditLimit = floor(dollarLimit / paygRate)
        //    Store both webPaygDollarLimit and webPaygCreditLimit
    },
});
```

## Frontend Integration

### Usage Access Hook

```typescript
// Before performing billable operations
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

// Perform operation...

// Increment usage AFTER successful operation
await ctx.runMutation(internal.stripe.stripeQueriesMutations.incrementTeamUsage, {
    teamId,
    userId: user._id,
    amount: actualCreditsUsed,
    productType: ProductType.WEB_ACCESS,
});
```

### Button Component Integration

```typescript
<Button
    featureFlag={FeatureFlag.feature_flag_3} // Tier-based gating
    enableUsageAccessCheck={true}            // Usage limits
    onClick={handleClick}
>
    Premium Feature
</Button>;
```

## Key Concepts Summary

| Concept                  | Description                                  |
| ------------------------ | -------------------------------------------- |
| FIXED subscription       | Base plan with included credits (per team)   |
| METERED subscription     | Pay-as-you-go overage (per team)             |
| `teams.currentTier`      | Cached tier from Stripe webhooks             |
| `teams.webUsagePending`  | Usage not yet synced to Stripe               |
| `teams.webPaygUsageTotal`| PAYG charges accumulated this period         |
| `teamMembers.webUsageTotal` | Per-member usage for access control       |
| `checkUsageAccess()`     | Pure function for usage limit checking       |
| `checkTeamUsageAccess()` | Action wrapper that fetches team + member    |
| Feature flags            | Tier-gated features via `team.currentTier`   |
| PAYG                     | Pay-as-you-go after included credits (no PAYG on FREE) |
