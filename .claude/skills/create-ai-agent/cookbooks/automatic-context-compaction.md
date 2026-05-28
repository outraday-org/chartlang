# Automatic Context Compaction with Claude Agent SDK (TypeScript)

Original: https://platform.claude.com/cookbook/tool-use-automatic-context-compaction

This cookbook demonstrates automatic context compaction using the TypeScript Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`). The SDK provides built-in context management that automatically compresses conversation history when token usage exceeds thresholds.

## Table of Contents

1. [Introduction](#introduction)
2. [Prerequisites](#prerequisites)
3. [Setup](#setup)
4. [Customer Service Tools](#customer-service-tools)
5. [Baseline: Running Without Monitoring](#baseline-running-without-monitoring)
6. [Monitoring Compaction Events](#monitoring-compaction-events)
7. [Customizing Compaction with Hooks](#customizing-compaction-with-hooks)
8. [Understanding How It Works](#understanding-how-it-works)
9. [Best Practices](#best-practices)

## Introduction

Long-running agentic tasks can exceed context limits. Tool-heavy workflows or extended conversations quickly consume the token context window. The Claude Agent SDK helps manage this by automatically compressing conversation history when token usage exceeds a configurable threshold.

### What is Context Compaction?

When building agentic workflows with tool use, conversations can grow very large as the agent iterates on complex tasks. Compaction provides automatic context management by:

1. **Monitoring token usage** per turn in the conversation
2. **Triggering automatically** when a threshold is exceeded
3. **Generating a summary** of previous messages
4. **Clearing conversation history** and resuming with only the summary
5. **Continuing the task** with compressed context

### Customer Service Workflow Example

Imagine an AI customer service agent processing a queue of support tickets. For each ticket, it must:
- Classify the issue
- Search the knowledge base
- Set priority
- Route to the appropriate team
- Draft a response
- Mark it complete

As tickets are processed, the conversation history fills with tool results—quickly consuming thousands of tokens. Compaction automatically summarizes completed work and clears detailed results.

## Prerequisites

**Required:**
- Node.js 18+ or Bun
- Anthropic API key
- `@anthropic-ai/claude-agent-sdk` >= 0.2.15

**Install dependencies:**

```bash
npm install @anthropic-ai/claude-agent-sdk zod
# or
pnpm add @anthropic-ai/claude-agent-sdk zod
# or
bun add @anthropic-ai/claude-agent-sdk zod
```

## Setup

Set your API key as an environment variable:

```bash
export ANTHROPIC_API_KEY=your_api_key_here
```

## Customer Service Tools

First, let's create the customer service tools using the SDK's MCP server capabilities:

```typescript
// customer-service-tools.ts
import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod/v4";

// Simulated ticket queue
interface Ticket {
  id: string;
  customerName: string;
  issue: string;
  status: "pending" | "in_progress" | "completed";
  category?: string;
  priority?: string;
  team?: string;
  response?: string;
}

let ticketQueue: Ticket[] = [];
let ticketIndex = 0;

// Initialize the ticket queue with sample tickets
export function initializeTicketQueue(numTickets: number) {
  const issues = [
    "Payment method update error - unable to save new card",
    "Missing delivery - order not received after 2 weeks",
    "Email address change request",
    "Wrong item delivered - need replacement",
    "Refund request for cancelled subscription",
    "Account locked - unlock email not working",
    "Unrecognized charge on statement",
    "Product integration question",
    "Plan comparison inquiry",
    "Damaged package - broken product inside",
  ];

  const names = [
    "Sam Smith",
    "Morgan Johnson",
    "Alex Jones",
    "Chris Davis",
    "Taylor Williams",
    "Jordan Brown",
    "Casey Miller",
    "Riley Wilson",
    "Quinn Moore",
    "Avery Taylor",
  ];

  ticketQueue = Array.from({ length: numTickets }, (_, i) => ({
    id: `TICKET-${i + 1}`,
    customerName: names[i % names.length],
    issue: issues[i % issues.length],
    status: "pending",
  }));
  ticketIndex = 0;
}

// Create the MCP server with customer service tools
export const customerServiceServer = createSdkMcpServer({
  name: "customer-service-tools",
  version: "1.0.0",
  tools: [
    tool(
      "get_next_ticket",
      "Retrieve the next unprocessed support ticket from the queue",
      {},
      async () => {
        const ticket = ticketQueue.find((t) => t.status === "pending");
        if (!ticket) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error: "Queue empty - all tickets processed",
                }),
              },
            ],
          };
        }
        ticket.status = "in_progress";
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                ticket_id: ticket.id,
                customer_name: ticket.customerName,
                issue_description: ticket.issue,
              }),
            },
          ],
        };
      }
    ),

    tool(
      "classify_ticket",
      "Categorize a support ticket by issue type",
      {
        ticket_id: z.string().describe("The ticket ID to classify"),
        category: z
          .enum(["billing", "technical", "account", "product", "shipping"])
          .describe("The issue category"),
      },
      async ({ ticket_id, category }) => {
        const ticket = ticketQueue.find((t) => t.id === ticket_id);
        if (!ticket) {
          return {
            content: [
              { type: "text", text: JSON.stringify({ error: "Ticket not found" }) },
            ],
          };
        }
        ticket.category = category;
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                ticket_id,
                category,
                status: "classified",
              }),
            },
          ],
        };
      }
    ),

    tool(
      "search_knowledge_base",
      "Search the knowledge base for relevant articles and solutions",
      {
        query: z.string().describe("Search query for the knowledge base"),
      },
      async ({ query }) => {
        // Simulated knowledge base responses
        const knowledgeBase: Record<string, string> = {
          billing:
            "Billing FAQ: Refunds take 5-7 business days. Pro-rated for annual plans. Billing occurs on the same date monthly/yearly.",
          technical:
            "Technical Support: Max upload 100MB. Supported formats: PDF, DOCX, PNG, JPG, CSV. System requirements: 4GB RAM, modern browsers.",
          account:
            "Account Help: Password reset links expire in 1 hour. Sent from noreply@support.example.com. Check spam folder.",
          shipping:
            "Shipping Info: Standard delivery 5-7 days. Express 2-3 days. Track via order confirmation email.",
          product:
            "Product Info: See documentation at docs.example.com. Contact product-success team for integrations.",
        };

        const category = Object.keys(knowledgeBase).find((k) =>
          query.toLowerCase().includes(k)
        );
        const result = category
          ? knowledgeBase[category]
          : "No specific articles found. General support: support@example.com";

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                query,
                results: [{ title: "Knowledge Base Result", content: result }],
              }),
            },
          ],
        };
      }
    ),

    tool(
      "set_priority",
      "Assign priority level to a ticket",
      {
        ticket_id: z.string().describe("The ticket ID"),
        priority: z
          .enum(["low", "medium", "high", "urgent"])
          .describe("Priority level"),
      },
      async ({ ticket_id, priority }) => {
        const ticket = ticketQueue.find((t) => t.id === ticket_id);
        if (!ticket) {
          return {
            content: [
              { type: "text", text: JSON.stringify({ error: "Ticket not found" }) },
            ],
          };
        }
        ticket.priority = priority;
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ ticket_id, priority, status: "priority_set" }),
            },
          ],
        };
      }
    ),

    tool(
      "route_to_team",
      "Route the ticket to the appropriate support team",
      {
        ticket_id: z.string().describe("The ticket ID"),
        team: z
          .enum([
            "billing-team",
            "technical-support",
            "account-services",
            "product-success",
            "logistics-team",
          ])
          .describe("Target team"),
      },
      async ({ ticket_id, team }) => {
        const ticket = ticketQueue.find((t) => t.id === ticket_id);
        if (!ticket) {
          return {
            content: [
              { type: "text", text: JSON.stringify({ error: "Ticket not found" }) },
            ],
          };
        }
        ticket.team = team;
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ ticket_id, team, status: "routed" }),
            },
          ],
        };
      }
    ),

    tool(
      "draft_response",
      "Create a customer-facing response for the ticket",
      {
        ticket_id: z.string().describe("The ticket ID"),
        response_text: z.string().describe("The response to send to the customer"),
      },
      async ({ ticket_id, response_text }) => {
        const ticket = ticketQueue.find((t) => t.id === ticket_id);
        if (!ticket) {
          return {
            content: [
              { type: "text", text: JSON.stringify({ error: "Ticket not found" }) },
            ],
          };
        }
        ticket.response = response_text;
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                ticket_id,
                response_preview: response_text.substring(0, 100) + "...",
                status: "response_drafted",
              }),
            },
          ],
        };
      }
    ),

    tool(
      "mark_complete",
      "Finalize and close a processed ticket",
      {
        ticket_id: z.string().describe("The ticket ID to complete"),
      },
      async ({ ticket_id }) => {
        const ticket = ticketQueue.find((t) => t.id === ticket_id);
        if (!ticket) {
          return {
            content: [
              { type: "text", text: JSON.stringify({ error: "Ticket not found" }) },
            ],
          };
        }
        ticket.status = "completed";
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                ticket_id,
                final_status: "completed",
                category: ticket.category,
                priority: ticket.priority,
                team: ticket.team,
              }),
            },
          ],
        };
      }
    ),
  ],
});

// Helper to get queue stats
export function getQueueStats() {
  return {
    total: ticketQueue.length,
    pending: ticketQueue.filter((t) => t.status === "pending").length,
    in_progress: ticketQueue.filter((t) => t.status === "in_progress").length,
    completed: ticketQueue.filter((t) => t.status === "completed").length,
  };
}
```

## Baseline: Running Without Monitoring

Here's a basic example that processes tickets without monitoring compaction:

```typescript
// baseline-example.ts
import { query, type SDKMessage, type SDKResultMessage } from "@anthropic-ai/claude-agent-sdk";
import { customerServiceServer, initializeTicketQueue, getQueueStats } from "./customer-service-tools";

const NUM_TICKETS = 5;

async function runBaseline() {
  // Initialize the ticket queue
  initializeTicketQueue(NUM_TICKETS);
  console.log(`\nInitialized queue with ${NUM_TICKETS} tickets`);
  console.log("=".repeat(60));

  const systemPrompt = `You are an AI customer service agent. Your task is to process support tickets from a queue.

For EACH ticket, you must complete ALL these steps:

1. **Fetch ticket**: Call get_next_ticket() to retrieve the next unprocessed ticket
2. **Classify**: Call classify_ticket() to categorize the issue (billing/technical/account/product/shipping)
3. **Research**: Call search_knowledge_base() to find relevant information for this ticket type
4. **Prioritize**: Call set_priority() to assign priority (low/medium/high/urgent) based on severity
5. **Route**: Call route_to_team() to assign to the appropriate team
6. **Draft**: Call draft_response() to create a helpful customer response using KB information
7. **Complete**: Call mark_complete() to finalize this ticket
8. **Continue**: Immediately fetch the next ticket and repeat

IMPORTANT RULES:
- Process tickets ONE AT A TIME in sequence
- Complete ALL 7 steps for each ticket before moving to the next
- Keep fetching and processing tickets until you get an error that the queue is empty
- There are ${NUM_TICKETS} tickets total - process all of them
- Be thorough but efficient

Begin by fetching the first ticket.`;

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let turnCount = 0;

  // Run the agent
  const queryIterator = query({
    prompt: systemPrompt,
    options: {
      model: "claude-sonnet-4-6",
      mcpServers: {
        "customer-service": customerServiceServer,
      },
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
    },
  });

  for await (const message of queryIterator) {
    if (message.type === "assistant") {
      turnCount++;
      const usage = message.message.usage;
      totalInputTokens += usage.input_tokens;
      totalOutputTokens += usage.output_tokens;

      console.log(
        `Turn ${turnCount.toString().padStart(2)}: ` +
          `Input=${usage.input_tokens.toLocaleString().padStart(7)} tokens | ` +
          `Output=${usage.output_tokens.toLocaleString().padStart(5)} tokens | ` +
          `Cumulative In=${totalInputTokens.toLocaleString().padStart(8)}`
      );
    }

    if (message.type === "result") {
      const result = message as SDKResultMessage;
      console.log("\n" + "=".repeat(60));
      console.log("BASELINE RESULTS");
      console.log("=".repeat(60));
      console.log(`Total turns: ${turnCount}`);
      console.log(`Input tokens: ${totalInputTokens.toLocaleString()}`);
      console.log(`Output tokens: ${totalOutputTokens.toLocaleString()}`);
      console.log(`Total tokens: ${(totalInputTokens + totalOutputTokens).toLocaleString()}`);
      console.log(`Total cost: $${result.total_cost_usd.toFixed(4)}`);
      console.log("=".repeat(60));
    }
  }

  console.log("\nQueue stats:", getQueueStats());
}

runBaseline().catch(console.error);
```

## Monitoring Compaction Events

The Claude Agent SDK automatically triggers compaction when context approaches limits. You can monitor these events:

```typescript
// compaction-monitoring.ts
import {
  query,
  type SDKMessage,
  type SDKCompactBoundaryMessage,
  type SDKStatusMessage,
  type SDKResultMessage,
} from "@anthropic-ai/claude-agent-sdk";
import { customerServiceServer, initializeTicketQueue, getQueueStats } from "./customer-service-tools";

const NUM_TICKETS = 10; // More tickets to trigger compaction

async function runWithCompactionMonitoring() {
  initializeTicketQueue(NUM_TICKETS);
  console.log(`\nInitialized queue with ${NUM_TICKETS} tickets`);
  console.log("=".repeat(60));
  console.log("RUNNING WITH COMPACTION MONITORING");
  console.log("=".repeat(60));

  const systemPrompt = `You are an AI customer service agent. Process all ${NUM_TICKETS} support tickets from the queue.

For EACH ticket:
1. Fetch with get_next_ticket()
2. Classify with classify_ticket()
3. Research with search_knowledge_base()
4. Set priority with set_priority()
5. Route with route_to_team()
6. Draft response with draft_response()
7. Complete with mark_complete()
8. Continue to next ticket

Process all tickets until the queue is empty. Be thorough but efficient.`;

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let turnCount = 0;
  let compactionCount = 0;
  let tokensBeforeCompaction = 0;

  const queryIterator = query({
    prompt: systemPrompt,
    options: {
      model: "claude-sonnet-4-6",
      mcpServers: {
        "customer-service": customerServiceServer,
      },
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
    },
  });

  for await (const message of queryIterator) {
    // Track assistant messages for token usage
    if (message.type === "assistant") {
      turnCount++;
      const usage = message.message.usage;
      totalInputTokens += usage.input_tokens;
      totalOutputTokens += usage.output_tokens;

      console.log(
        `Turn ${turnCount.toString().padStart(2)}: ` +
          `Input=${usage.input_tokens.toLocaleString().padStart(7)} tokens | ` +
          `Output=${usage.output_tokens.toLocaleString().padStart(5)} tokens | ` +
          `Cumulative=${totalInputTokens.toLocaleString().padStart(8)}`
      );
    }

    // Monitor compaction status changes
    if (message.type === "system" && message.subtype === "status") {
      const statusMsg = message as SDKStatusMessage;
      if (statusMsg.status === "compacting") {
        tokensBeforeCompaction = totalInputTokens;
        console.log("\n" + "=".repeat(60));
        console.log("🔄 COMPACTION STARTED");
        console.log(`   Tokens before compaction: ${tokensBeforeCompaction.toLocaleString()}`);
      }
    }

    // Track compaction completion
    if (message.type === "system" && message.subtype === "compact_boundary") {
      const compactMsg = message as SDKCompactBoundaryMessage;
      compactionCount++;
      console.log("✓ COMPACTION COMPLETED");
      console.log(`   Trigger: ${compactMsg.compact_metadata.trigger}`);
      console.log(`   Pre-compaction tokens: ${compactMsg.compact_metadata.pre_tokens.toLocaleString()}`);
      console.log("=".repeat(60) + "\n");
    }

    // Final results
    if (message.type === "result") {
      const result = message as SDKResultMessage;
      console.log("\n" + "=".repeat(60));
      console.log("OPTIMIZED RESULTS (WITH COMPACTION)");
      console.log("=".repeat(60));
      console.log(`Total turns: ${turnCount}`);
      console.log(`Compactions: ${compactionCount}`);
      console.log(`Input tokens: ${totalInputTokens.toLocaleString()}`);
      console.log(`Output tokens: ${totalOutputTokens.toLocaleString()}`);
      console.log(`Total tokens: ${(totalInputTokens + totalOutputTokens).toLocaleString()}`);
      console.log(`Total cost: $${result.total_cost_usd.toFixed(4)}`);
      console.log("=".repeat(60));
    }
  }

  console.log("\nQueue stats:", getQueueStats());
}

runWithCompactionMonitoring().catch(console.error);
```

## Customizing Compaction with Hooks

Use the `PreCompact` hook to customize compaction behavior:

```typescript
// custom-compaction.ts
import {
  query,
  type SDKMessage,
  type SDKResultMessage,
  type HookCallback,
  type PreCompactHookInput,
} from "@anthropic-ai/claude-agent-sdk";
import { customerServiceServer, initializeTicketQueue } from "./customer-service-tools";

const NUM_TICKETS = 10;

// Custom summary instructions for customer service workflow
const CUSTOM_SUMMARY_PROMPT = `You are processing customer support tickets from a queue.

Create a focused summary that preserves:

1. **COMPLETED TICKETS**: For each ticket you've fully processed:
   - Ticket ID and customer name
   - Issue category and priority assigned
   - Team routed to
   - Brief outcome

2. **IN-PROGRESS TICKET**: If there's a partially processed ticket:
   - Ticket ID and current step
   - What's been completed so far
   - What steps remain

3. **PROGRESS STATUS**:
   - How many tickets you've completed
   - Approximately how many remain in the queue

4. **NEXT STEPS**: Continue processing the next ticket

Be concise but complete. This summary will replace the full conversation history.`;

// Hook callback for pre-compaction customization
const preCompactHook: HookCallback = async (input, _toolUseId, _options) => {
  const hookInput = input as PreCompactHookInput;

  console.log("\n📋 PreCompact Hook Triggered");
  console.log(`   Trigger type: ${hookInput.trigger}`);

  // Return custom instructions for the summary
  return {
    continue: true,
    hookSpecificOutput: {
      hookEventName: "PreCompact" as const,
      additionalContext: CUSTOM_SUMMARY_PROMPT,
    },
  };
};

async function runWithCustomCompaction() {
  initializeTicketQueue(NUM_TICKETS);
  console.log(`\nInitialized queue with ${NUM_TICKETS} tickets`);
  console.log("=".repeat(60));
  console.log("RUNNING WITH CUSTOM COMPACTION");
  console.log("=".repeat(60));

  const systemPrompt = `You are an AI customer service agent. Process all ${NUM_TICKETS} support tickets.

For EACH ticket:
1. Fetch with get_next_ticket()
2. Classify with classify_ticket()
3. Research with search_knowledge_base()
4. Set priority with set_priority()
5. Route with route_to_team()
6. Draft response with draft_response()
7. Complete with mark_complete()

Process all tickets until complete.`;

  let compactionCount = 0;

  const queryIterator = query({
    prompt: systemPrompt,
    options: {
      model: "claude-sonnet-4-6",
      mcpServers: {
        "customer-service": customerServiceServer,
      },
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      // Register the PreCompact hook
      hooks: {
        PreCompact: [
          {
            hooks: [preCompactHook],
          },
        ],
      },
    },
  });

  for await (const message of queryIterator) {
    if (message.type === "system" && message.subtype === "compact_boundary") {
      compactionCount++;
      console.log(`\n✓ Compaction #${compactionCount} completed with custom summary`);
    }

    if (message.type === "result") {
      const result = message as SDKResultMessage;
      console.log("\n" + "=".repeat(60));
      console.log("RESULTS WITH CUSTOM COMPACTION");
      console.log("=".repeat(60));
      console.log(`Compactions with custom summary: ${compactionCount}`);
      console.log(`Total cost: $${result.total_cost_usd.toFixed(4)}`);
      console.log("=".repeat(60));
    }
  }
}

runWithCustomCompaction().catch(console.error);
```

## Understanding How It Works

### SDK vs Python SDK Differences

| Aspect | Python SDK | TypeScript Agent SDK |
|--------|------------|---------------------|
| **Compaction Control** | Explicit `compaction_control` parameter | Built-in automatic (inherited from Claude Code) |
| **Threshold Config** | `context_token_threshold` parameter | Automatic based on model context limits |
| **Summary Model** | Configurable via `model` parameter | Uses same model (automatic) |
| **Custom Prompts** | `summary_prompt` parameter | Via `PreCompact` hook |
| **Monitoring** | Parse response manually | `SDKCompactBoundaryMessage` events |

### How the SDK Handles Compaction

1. **Automatic Triggering**: The SDK monitors token usage and triggers compaction when approaching context limits

2. **Summary Generation**: Claude generates a summary preserving:
   - Task progress and completed work
   - Important context and decisions
   - Next steps to continue

3. **History Replacement**: The conversation history is replaced with the summary

4. **Seamless Continuation**: The agent continues with compressed context

### Message Types for Monitoring

```typescript
// Status message when compaction starts
interface SDKStatusMessage {
  type: "system";
  subtype: "status";
  status: "compacting" | null;
}

// Boundary message when compaction completes
interface SDKCompactBoundaryMessage {
  type: "system";
  subtype: "compact_boundary";
  compact_metadata: {
    trigger: "manual" | "auto";
    pre_tokens: number;
  };
}
```

## Best Practices

### When to Use Compaction

**Ideal for:**
- Sequential processing (like ticket workflows)
- Multi-phase workflows with natural checkpoints
- Batch operations processing many independent items
- Extended analysis sessions

**Avoid for:**
- Short tasks completing within normal context
- Tasks requiring full audit trails
- Highly iterative refinement needing exact historical details

### Design Tips

1. **Structure for Independence**: Design task phases to be independent so summaries capture progress effectively

2. **Natural Boundaries**: Place checkpoints at logical boundaries (after completing each ticket, phase, or batch)

3. **Monitor Token Usage**: Track `input_tokens` in assistant messages to understand growth patterns

4. **Use Custom Summaries**: For domain-specific workflows, use the `PreCompact` hook to guide summary generation

5. **Test with Realistic Loads**: Use production-like data volumes to observe actual compaction behavior

### Example: Production Configuration

```typescript
const queryIterator = query({
  prompt: taskPrompt,
  options: {
    model: "claude-sonnet-4-6",
    mcpServers: {
      "your-tools": yourToolServer,
    },
    permissionMode: "bypassPermissions",
    allowDangerouslySkipPermissions: true,
    maxTurns: 100, // Safety limit
    maxBudgetUsd: 5.0, // Cost limit

    // Custom compaction behavior
    hooks: {
      PreCompact: [
        {
          hooks: [
            async (input) => {
              // Log compaction events
              console.log("Compaction triggered:", input);

              // Add domain-specific summary instructions
              return {
                continue: true,
                hookSpecificOutput: {
                  hookEventName: "PreCompact",
                  additionalContext: DOMAIN_SPECIFIC_SUMMARY_PROMPT,
                },
              };
            },
          ],
        },
      ],
    },
  },
});
```

## Alternative: Using Raw Anthropic SDK ToolRunner

If you prefer more direct control or want a closer match to the Python SDK, you can use the raw `@anthropic-ai/sdk` package's `BetaToolRunner` with explicit `compactionControl`:

```typescript
// raw-sdk-example.ts
import Anthropic from "@anthropic-ai/sdk";
import type { CompactionControl } from "@anthropic-ai/sdk/lib/tools/CompactionControl";
import { betaTool } from "@anthropic-ai/sdk";

const client = new Anthropic();

// Simulated ticket data
let ticketQueue = [
  { id: "TICKET-1", customer: "Sam Smith", issue: "Payment error", status: "pending" },
  { id: "TICKET-2", customer: "Alex Jones", issue: "Missing delivery", status: "pending" },
  { id: "TICKET-3", customer: "Chris Davis", issue: "Account locked", status: "pending" },
  { id: "TICKET-4", customer: "Morgan Brown", issue: "Refund request", status: "pending" },
  { id: "TICKET-5", customer: "Taylor Wilson", issue: "Integration question", status: "pending" },
];

// Define tools using betaTool decorator
const getNextTicket = betaTool({
  name: "get_next_ticket",
  description: "Retrieve the next unprocessed support ticket from the queue",
  inputSchema: {},
  func: async () => {
    const ticket = ticketQueue.find((t) => t.status === "pending");
    if (!ticket) {
      return JSON.stringify({ error: "Queue empty" });
    }
    ticket.status = "in_progress";
    return JSON.stringify(ticket);
  },
});

const classifyTicket = betaTool({
  name: "classify_ticket",
  description: "Categorize a support ticket",
  inputSchema: {
    type: "object" as const,
    properties: {
      ticket_id: { type: "string" as const },
      category: {
        type: "string" as const,
        enum: ["billing", "technical", "account", "product", "shipping"],
      },
    },
    required: ["ticket_id", "category"],
  },
  func: async ({ ticket_id, category }) => {
    const ticket = ticketQueue.find((t) => t.id === ticket_id);
    if (ticket) ticket.category = category;
    return JSON.stringify({ ticket_id, category, status: "classified" });
  },
});

const markComplete = betaTool({
  name: "mark_complete",
  description: "Finalize a processed ticket",
  inputSchema: {
    type: "object" as const,
    properties: {
      ticket_id: { type: "string" as const },
    },
    required: ["ticket_id"],
  },
  func: async ({ ticket_id }) => {
    const ticket = ticketQueue.find((t) => t.id === ticket_id);
    if (ticket) ticket.status = "completed";
    return JSON.stringify({ ticket_id, status: "completed" });
  },
});

// Compaction configuration - matches Python SDK API
const compactionControl: CompactionControl = {
  enabled: true,
  contextTokenThreshold: 5000, // Low for demo, use 50k-100k in production
  // Optional: custom summary prompt
  summaryPrompt: `You are processing customer support tickets.

Create a focused summary that preserves:
1. **COMPLETED TICKETS**: ID, customer, category, outcome
2. **PROGRESS STATUS**: Completed count, remaining count
3. **NEXT STEPS**: Continue processing

Wrap your summary in <summary></summary> tags.`,
  // Optional: use a different model for summaries
  // model: "claude-3-5-haiku-latest",
};

async function runWithCompaction() {
  console.log("Starting ticket processing with compaction...\n");

  let totalInput = 0;
  let totalOutput = 0;
  let turnCount = 0;

  // Create the tool runner with compaction enabled
  const runner = client.beta.messages.toolRunner({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    tools: [getNextTicket, classifyTicket, markComplete],
    messages: [
      {
        role: "user",
        content: `Process all 5 support tickets. For each:
1. Fetch with get_next_ticket()
2. Classify with classify_ticket()
3. Complete with mark_complete()
Continue until the queue is empty.`,
      },
    ],
    compactionControl,
  });

  // Iterate through responses
  for await (const message of runner) {
    turnCount++;
    totalInput += message.usage.input_tokens;
    totalOutput += message.usage.output_tokens;

    console.log(
      `Turn ${turnCount}: ` +
        `Input=${message.usage.input_tokens.toLocaleString()} | ` +
        `Output=${message.usage.output_tokens.toLocaleString()} | ` +
        `Cumulative=${totalInput.toLocaleString()}`
    );

    // Check for compaction indicator in messages
    const params = runner.params;
    const lastMessage = params.messages[params.messages.length - 1];
    if (
      lastMessage &&
      typeof lastMessage.content === "string" &&
      lastMessage.content.includes("<summary>")
    ) {
      console.log("\n🔄 COMPACTION OCCURRED - History replaced with summary\n");
    }
  }

  // Get final message
  const finalMessage = await runner.done();

  console.log("\n" + "=".repeat(60));
  console.log("RESULTS WITH COMPACTION");
  console.log("=".repeat(60));
  console.log(`Total turns: ${turnCount}`);
  console.log(`Input tokens: ${totalInput.toLocaleString()}`);
  console.log(`Output tokens: ${totalOutput.toLocaleString()}`);
  console.log(`Total tokens: ${(totalInput + totalOutput).toLocaleString()}`);
  console.log("=".repeat(60));

  // Print final response
  const textBlock = finalMessage.content.find((c) => c.type === "text");
  if (textBlock && textBlock.type === "text") {
    console.log("\nFinal response:");
    console.log(textBlock.text);
  }
}

runWithCompaction().catch(console.error);
```

### Compaction Control Options

The `compactionControl` parameter accepts these options:

```typescript
interface CompactionControl {
  // Required - enables/disables compaction
  enabled: boolean;

  // Token threshold that triggers compaction (default: 100,000)
  contextTokenThreshold?: number;

  // Custom prompt for generating summaries
  summaryPrompt?: string;

  // Model to use for summaries (defaults to main model)
  model?: string;
}
```

### Comparison: Claude Agent SDK vs Raw SDK

| Feature | Claude Agent SDK | Raw Anthropic SDK |
|---------|------------------|-------------------|
| **API** | `query()` function | `client.beta.messages.toolRunner()` |
| **Compaction** | Automatic, built-in | Explicit `compactionControl` parameter |
| **Threshold** | Automatic | `contextTokenThreshold` (default 100k) |
| **Custom Summary** | `PreCompact` hook | `summaryPrompt` string |
| **Summary Model** | Automatic | `model` parameter |
| **Tools** | MCP servers | `betaTool` decorator or tool objects |
| **Best For** | Full Claude Code experience | Direct API control |

Choose the **Claude Agent SDK** when you want the full Claude Code agent experience with file access, bash commands, and built-in tooling.

Choose the **Raw Anthropic SDK** when you want direct API control, simpler setup, or integration with existing code that doesn't need Claude Code features.

## Summary

The Claude Agent SDK provides automatic context compaction that enables long-running agentic workflows to exceed typical context limits. Key benefits:

- **Automatic Management**: No manual configuration required for basic usage
- **Event Monitoring**: Track compaction via `SDKCompactBoundaryMessage` events
- **Customization**: Use `PreCompact` hooks to guide summary generation
- **Seamless Integration**: Works with MCP tools and all SDK features

By understanding how compaction works and when to customize it, you can build reliable agents that handle complex, multi-step tasks efficiently.
