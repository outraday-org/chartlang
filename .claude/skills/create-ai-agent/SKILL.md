---
name: create-ai-agent
description: Guide for creating a new AI agent including folder structure, types, system prompts, HTTP endpoints, and frontend hooks. Use when building new AI-powered features.
---

# Create AI Agent

## Note on Imported Anthropic Docs

Some reference files in this skill are imported markdown snapshots and contain
site-relative links such as `/docs/en/...`. Treat those as relative to
`https://docs.anthropic.com` (for example, `/docs/en/api/messages` maps to
`https://docs.anthropic.com/docs/en/api/messages`).

This comprehensive guide covers building production-grade AI agents in this
project. It integrates philosophy, patterns, and project-specific implementation
details.

## Quick Navigation

- [Core Philosophy](#core-philosophy)
- [Architecture Patterns](#architecture-patterns)
- [The Agent Loop](#the-agent-loop)
- [Project Implementation](#project-implementation)
- [Programmatic Tool Calling](#programmatic-tool-calling-beta)
- [Prompt Engineering](#prompt-engineering)
- [Context Engineering](#context-engineering)
- [Multi-Agent Systems](#multi-agent-systems)
- [Production Reliability](#production-reliability)
- [AI Models Reference](#ai-models-reference)
- [Reference Documentation](#reference-documentation)
- [File Checklist](#file-checklist)

---

## Core Philosophy

### Simplicity First

> "The most successful implementations start with simple prompts and tools,
> adding complexity only when needed."

**Key Principles:**

1. **Start simple** - Begin with the simplest solution that could work
2. **Add complexity incrementally** - Only when simpler approaches fail
3. **Measure before optimizing** - Build evaluation systems early
4. **Treat context as precious** - Every token counts

### Workflows vs Agents Decision Matrix

Understanding this distinction is fundamental:

| Aspect      | Workflows                | Agents                      |
| ----------- | ------------------------ | --------------------------- |
| Control     | Predefined code paths    | LLM-directed decisions      |
| Flexibility | Fixed orchestration      | Dynamic tool/path selection |
| Reliability | More predictable         | More adaptive               |
| Best for    | Well-defined processes   | Open-ended problems         |
| Complexity  | Lower                    | Higher                      |

**Recommendation:** Start with workflows, graduate to agents only when the task
demands dynamic decision-making.

---

## Architecture Patterns

### Pattern 1: Prompt Chaining

**Use when:** Task has clear sequential steps with dependencies.

```
[Input] → [LLM Call 1] → [Gate/Check] → [LLM Call 2] → [Output]
```

**Project example:** `earningsCallBriefAgent` uses 3-pass chaining:

1. **Extract pass**: Chunk transcript → extract key topics
2. **Compose pass**: Synthesize topics → generate structured brief
3. **Verify pass**: Add topic suggestions and validation

### Pattern 2: Routing

**Use when:** Input requires different specialized handling paths.

```
              ┌─→ [Handler A] ─┐
[Input] → [Router] → [Handler B] → [Output]
              └─→ [Handler C] ─┘
```

**Best Practices:**

- Use classification with well-defined categories
- Include confidence thresholds for routing decisions
- Have a fallback/general handler

### Pattern 3: Parallelization

**Use when:** Task can be decomposed into independent subtasks.

**Variants:**

1. **Sectioning** - Split input, process sections in parallel
2. **Voting** - Multiple attempts, aggregate results

### Pattern 4: Orchestrator-Workers

**Use when:** Complex tasks requiring dynamic decomposition.

```
                    ┌─→ [Worker 1] ─┐
[Orchestrator] ─────┼─→ [Worker 2] ─┼──→ [Synthesizer]
                    └─→ [Worker N] ─┘
```

**Project example:** `earningsCallBriefAgent` orchestrates analysis with specialized
tools for different data operations.

### Pattern 5: Evaluator-Optimizer

**Use when:** Output quality benefits from iterative refinement.

```
[Generator] → [Output] → [Evaluator] → [Feedback] → [Generator] (loop)
```

---

## The Agent Loop

The core feedback loop that powers effective agents:

```
┌──────────────────────────────────────────────────┐
│                                                  │
│   ┌─────────────┐    ┌─────────────┐            │
│   │   GATHER    │ →  │    TAKE     │            │
│   │   CONTEXT   │    │   ACTION    │            │
│   └─────────────┘    └─────────────┘            │
│          ↑                  │                    │
│          │                  ↓                    │
│   ┌─────────────┐    ┌─────────────┐            │
│   │   ITERATE   │ ←  │   VERIFY    │            │
│   │             │    │    WORK     │            │
│   └─────────────┘    └─────────────┘            │
│                                                  │
└──────────────────────────────────────────────────┘
```

### Phase 1: Gather Context

**Strategies:**

1. **Agentic Search** (Preferred) - File system navigation, let agent discover
2. **Semantic Search** (Supplementary) - Qdrant vector search for transcripts
3. **Just-in-Time Retrieval** - Load data into context only when needed

### Phase 2: Take Action

**Action Types:**

1. **Tools** - Primary actions (well-defined, discoverable)
2. **Convex Actions** - Database operations via `ctx.runAction`
3. **Code Generation** - Precise, composable outputs

### Phase 3: Verify Work

| Method        | Best For                 | Robustness |
| ------------- | ------------------------ | ---------- |
| Defined Rules | Structured outputs       | High       |
| Linting/Tests | Code generation          | High       |
| LLM-as-Judge  | Fuzzy quality assessment | Lower      |

### Phase 4: Iterate

- Track progress explicitly (step enums, status tracking)
- Know when to stop (success criteria, cost limits)
- Handle failures gracefully

---

## Project Implementation

### Architecture Overview

```
┌─────────────────┐     ┌─────────────────────┐     ┌──────────────────┐
│   HTTP Request  │────▶│   Agent Handler     │────▶│   LLM + Tools    │
│   (streaming)   │     │   (orchestrator)    │     │   (AI SDK)       │
└─────────────────┘     └─────────────────────┘     └──────────────────┘
         │                       │                          │
         │                       ▼                          ▼
         │              ┌─────────────────────┐    ┌──────────────────┐
         │              │   Convex Actions    │    │   Step Tracking  │
         │              │   (data access)     │    │   (status enum)  │
         │              └─────────────────────┘    └──────────────────┘
         │
         ▼
┌─────────────────┐
│   SSE Stream    │
│   (response)    │
└─────────────────┘
```

### Folder Structure

```
convex/agent/agents/<agentName>/
├── <agentName>.ts              # Main agent entry point
├── <agentName>SystemPrompt.ts  # System prompt
├── <agentName>MaxSteps.ts      # Max steps configuration
├── types/
│   ├── <agentName>Request.ts   # Request type with Zod schema
│   ├── <agentName>Response.ts  # Response type
│   └── <agentName>Enums.ts     # Status/step enums
├── lib/
│   └── helpers.ts              # Helper functions
└── subagentTools/ (optional)
    └── mySubagent.ts           # Subagent tool definitions
```

### Step-by-Step Implementation

#### 1. Define Types

```typescript
// convex/agent/agents/myAgent/types/myAgentEnums.ts
export enum MyAgentStatus {
    PENDING = "pending",
    PROCESSING = "processing",
    SUCCESS = "success",
    ERROR = "error",
}

export enum MyAgentStep {
    ANALYZING = "analyzing",
    FETCHING_DATA = "fetchingData",
    GENERATING = "generating",
}

export type MyAgentStepType = "message" | MyAgentStep;
```

```typescript
// convex/agent/agents/myAgent/types/myAgentRequest.ts
import { z } from "zod";
import { AiModel } from "../../../types/AiModel";

export const MyAgentRequestSchema = z.object({
    aiModel: z.nativeEnum(AiModel),
    input: z.object({
        query: z.string(),
        context: z.string().optional(),
    }),
});

export type MyAgentRequest = z.infer<typeof MyAgentRequestSchema>;
```

```typescript
// convex/agent/agents/myAgent/types/myAgentResponse.ts
export type MyAgentResponse = {
    text: string;
    error?: string;
    cost?: number;
    toolCalls?: Array<{
        name: string;
        args: unknown;
        result: unknown;
    }>;
};
```

#### 2. Create System Prompt

```typescript
// convex/agent/agents/myAgent/myAgentSystemPrompt.ts
export const MY_AGENT_SYSTEM_PROMPT =
    `You are a specialized AI assistant for [purpose].

## Your Capabilities
- [Capability 1]
- [Capability 2]

## Guidelines
1. [Guideline 1]
2. [Guideline 2]

## Output Format
[Describe expected output format]
`;
```

#### 3. Set Max Steps and Cost Limit

```typescript
// convex/agent/agents/myAgent/myAgentMaxSteps.ts
export const MY_AGENT_MAX_STEPS = 10;
export const MY_AGENT_COST_LIMIT_USD = 2.0; // Safety limit
```

#### 4. Create Agent Handler

```typescript
// convex/agent/agents/myAgent/myAgent.ts
"use node";

import type { GenericActionCtx, GenericDataModel } from "convex/server";
import { generateText, tool } from "ai";
import { z } from "zod";

import type { Id } from "../../../_generated/dataModel";
import { internal } from "../../../_generated/api";
import { getAiModel } from "../../lib/getAiModel";
import { AiModel } from "../../types/AiModel";

import { MY_AGENT_SYSTEM_PROMPT } from "./myAgentSystemPrompt";
import { MY_AGENT_COST_LIMIT_USD, MY_AGENT_MAX_STEPS } from "./myAgentMaxSteps";
import type { MyAgentRequest, MyAgentResponse } from "./types/myAgentRequest";
import { MyAgentStep, type MyAgentStepType } from "./types/myAgentEnums";

type MyAgentInput = {
    ctx: GenericActionCtx<GenericDataModel>;
    userId: Id<"users">;
    teamId: Id<"teams">;
    input: MyAgentRequest["input"];
    writeStepPart: (step: MyAgentStepType) => void;
    abortSignal?: AbortSignal;
};

// Cost tracking
let totalCost = 0;
const trackCost = (
    usage: { promptTokens: number; completionTokens: number },
) => {
    const inputCost = (usage.promptTokens / 1000) * 0.003;
    const outputCost = (usage.completionTokens / 1000) * 0.015;
    totalCost += inputCost + outputCost;

    if (totalCost > MY_AGENT_COST_LIMIT_USD) {
        throw new Error(`Cost limit exceeded: $${totalCost.toFixed(2)}`);
    }
};

// Define tools
const createTools = (ctx: GenericActionCtx<GenericDataModel>) => ({
    searchData: tool({
        description: "Search for relevant data",
        parameters: z.object({
            query: z.string().describe("Search query"),
        }),
        execute: async ({ query }) => {
            return await ctx.runAction(internal.someModule.searchAction, {
                query,
            });
        },
    }),
});

export const runMyAgent = async ({
    ctx,
    userId,
    teamId,
    input,
    writeStepPart,
    abortSignal,
}: MyAgentInput): Promise<MyAgentResponse> => {
    totalCost = 0;

    try {
        writeStepPart(MyAgentStep.ANALYZING);

        const { text, toolCalls, usage } = await generateText({
            model: getAiModel(AiModel.CLAUDE_SONNET_4_6),
            system: MY_AGENT_SYSTEM_PROMPT,
            prompt: `User query: ${input.query}\n\nContext: ${
                input.context ?? "None"
            }`,
            tools: createTools(ctx),
            maxSteps: MY_AGENT_MAX_STEPS,
            abortSignal,
            onStepFinish: ({ toolCalls, usage }) => {
                for (const call of toolCalls) {
                    if (call.toolName === "searchData") {
                        writeStepPart(MyAgentStep.FETCHING_DATA);
                    }
                }
                if (usage) {
                    trackCost(usage);
                }
            },
        });

        writeStepPart(MyAgentStep.GENERATING);

        return {
            text,
            cost: totalCost,
            toolCalls: toolCalls?.map((tc) => ({
                name: tc.toolName,
                args: tc.args,
                result: tc.result,
            })),
        };
    } catch (error) {
        return {
            text: "",
            error: error instanceof Error ? error.message : "Unknown error",
            cost: totalCost,
        };
    }
};
```

#### 5. Create HTTP Endpoint

```typescript
// convex/http.ts
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { runMyAgent } from "./agent/agents/myAgent/myAgent";
import { MyAgentRequestSchema } from "./agent/agents/myAgent/types/myAgentRequest";

http.route({
    path: "/api/ai/my-agent",
    method: "POST",
    handler: httpAction(async (ctx, req) => {
        // Resolve team context
        const { user, teamId } = await ctx.runQuery(
            internal.teams.teamHelpers.resolveTeamContext,
            { teamId: undefined },
        );
        if (!user) {
            return new Response("Unauthorized", { status: 401 });
        }

        // Check usage access before running agent
        await ctx.runAction(api.stripe.usageAccessActions.checkTeamUsageAccess, {
            teamId,
            userId: user._id,
            productType: ProductType.WEB_ACCESS,
        });

        const body = await req.json();
        const parseResult = MyAgentRequestSchema.safeParse(body);
        if (!parseResult.success) {
            return new Response("Invalid request", { status: 400 });
        }

        const { input } = parseResult.data;

        const stream = createUIMessageStream({
            execute: async ({ writer }) => {
                const writeStepPart = (step: string) => {
                    writer.write({
                        type: "data-step",
                        id: crypto.randomUUID(),
                        data: { type: step },
                        transient: true,
                    });
                };

                await runMyAgent({
                    ctx,
                    userId: user._id,
                    teamId,
                    input,
                    writeStepPart,
                    abortSignal: req.signal,
                });
            },
        });

        return createUIMessageStreamResponse({
            stream,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
            },
        });
    }),
});

// CORS OPTIONS handler
http.route({
    path: "/api/ai/my-agent",
    method: "OPTIONS",
    handler: httpAction(async () => {
        return new Response(null, {
            status: 204,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
            },
        });
    }),
});
```

#### 6. Create Frontend Hook

```typescript
// src/hooks/use-my-agent.ts
import { useState } from "react";
import { useAuth } from "@clerk/clerk-react";

type MyAgentInput = {
    query: string;
    context?: string;
};

type MyAgentStatus = "idle" | "loading" | "success" | "error";

export const useMyAgent = () => {
    const { getToken } = useAuth();
    const [status, setStatus] = useState<MyAgentStatus>("idle");
    const [result, setResult] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const run = async (input: MyAgentInput) => {
        setStatus("loading");
        setError(null);

        try {
            const token = await getToken({ template: "convex" });

            const response = await fetch("/api/ai/my-agent", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    aiModel: "claude-sonnet-4-6",
                    input,
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            while (reader) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value);
                console.log("Chunk:", chunk);
            }

            setStatus("success");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unknown error");
            setStatus("error");
        }
    };

    return { run, status, result, error };
};
```

### Tool Definition Pattern

```typescript
import { tool } from "ai";
import { z } from "zod";

const myTool = tool({
    description: `Clear description of what this tool does.

When to use: Finding specific information.
When NOT to use: Browsing structure (use list_items instead).

Example queries:
- "quarterly revenue for Q3 2024"
- "mentions of supply chain risks"`,
    parameters: z.object({
        query: z.string().describe("Natural language search query"),
        maxResults: z.number().optional().describe("Max results (default: 10)"),
    }),
    execute: async ({ query, maxResults = 10 }) => {
        // Tool logic
        return { matches: [], total: 0, hasMore: false };
    },
});
```

### Programmatic Tool Calling (Beta)

Programmatic tool calling allows Claude to write Python code that calls tools
programmatically within a code execution container. This reduces latency and
token consumption for multi-tool workflows.

**When to Use:**

- Processing large datasets where you only need aggregates
- Multi-step workflows with 3+ dependent tool calls
- Operations requiring filtering, sorting, or transformation
- Parallel operations across many items

**Quick Example:**

```typescript
// API request with programmatic tool calling
const response = await anthropic.beta.messages.create({
    model: "claude-sonnet-4-6",
    betas: ["advanced-tool-use-2025-11-20"],
    max_tokens: 4096,
    messages: [{ role: "user", content: "Analyze sales across all regions" }],
    tools: [
        {
            type: "code_execution_20250825",
            name: "code_execution",
        },
        {
            name: "query_database",
            description: "Execute SQL query. Returns JSON array of rows.",
            input_schema: {
                type: "object",
                properties: {
                    sql: { type: "string", description: "SQL query" },
                },
                required: ["sql"],
            },
            allowed_callers: ["code_execution_20250825"], // Key field!
        },
    ],
});
```

**How It Works:**

1. Claude writes Python code calling tools as async functions
2. Code runs in sandboxed container
3. Tool calls pause execution → you provide results
4. Results feed back to code (NOT to Claude's context)
5. Final output returned to Claude

**Token Savings:** ~90% reduction for multi-tool workflows since intermediate
tool results don't consume context tokens.

**Key Configuration:**

```typescript
// allowed_callers options:
["direct"]                              // Default - only Claude calls directly
["code_execution_20250825"]             // Only from code execution
["direct", "code_execution_20250825"]   // Both (not recommended)
```

**Advanced Patterns Claude Can Use:**

```python
# Batch processing with loops
regions = ["West", "East", "Central"]
results = {}
for region in regions:
    data = await query_database(f"SELECT * FROM sales WHERE region='{region}'")
    results[region] = sum(row["revenue"] for row in data)

# Early termination
for endpoint in endpoints:
    if await check_health(endpoint) == "healthy":
        print(f"Found: {endpoint}")
        break

# Data filtering before returning
logs = await fetch_logs(server_id)
errors = [log for log in logs if "ERROR" in log][-10:]  # Last 10 only
```

**Constraints:**

- Requires beta header: `"advanced-tool-use-2025-11-20"`
- Models: Claude Opus 4.5, Claude Sonnet 4.5 only
- Container expires after ~4.5 minutes
- No structured outputs, tool choice forcing, or parallel tool disable

→ See
[programmatic-tool-calling.md](./capabilities/programmatic-tool-calling.md) for
full implementation details.

---

## Prompt Engineering

### 7 Core Principles

| #   | Principle                | Key Technique                   |
| --- | ------------------------ | ------------------------------- |
| 1   | Be clear and direct      | Provide context, be specific    |
| 2   | Use examples (few-shot)  | 3-5 diverse, canonical examples |
| 3   | Let Claude think         | Chain of thought, `<thinking>`  |
| 4   | Use XML tags             | `<context>`, `<instructions>`   |
| 5   | Role prompting           | Define persona and expertise    |
| 6   | Chain complex prompts    | Multi-step with validation      |
| 7   | Long context handling    | Documents at top, questions end |

### System Prompt Template

```xml
<context>
[Background about the domain and task]
</context>

<instructions>
[Core behavioral guidelines - numbered steps]
</instructions>

<tool_guidance>
[When and how to use each tool]
</tool_guidance>

<output_format>
[Expected structure with examples]
</output_format>

<examples>
[3-5 diverse, canonical examples]
</examples>
```

### The "Right Altitude"

```
Too Low (Brittle)          Goldilocks Zone           Too High (Vague)
─────────────────────────────────────────────────────────────────────
Complex if-else logic  ←   Clear heuristics   →  Vague guidance
Exact behaviors             Flexible rules        Assumed context
High maintenance            Adaptable             Under-specified
```

**Best Practice:** Start minimal, add instructions based on observed failure
modes. Test with best model first, then add more guidance.

---

## Context Engineering

> "Context is a critical but finite resource. Good context engineering means
> finding the smallest possible set of high-signal tokens."

### Strategy 1: Compaction

**What:** Summarize context when approaching window limits.

**Preserve:**

- Architectural decisions
- Unresolved issues
- Key implementation details
- 5 most recent files/messages

**Discard:**

- Redundant tool outputs
- Resolved conversations
- Intermediate steps

### Strategy 2: Structured Note-Taking

**What:** Persist important information outside context window.

```typescript
const memoryTool = tool({
    name: "update_notes",
    description: "Write/update persistent notes for long tasks",
    parameters: z.object({
        file: z.string().describe("NOTES.md, TODO.md, etc."),
        content: z.string(),
    }),
    execute: async ({ file, content }) => {
        // Persist to filesystem or database
    },
});
```

**What to Track:**

- Progress on multi-step tasks
- Key decisions and rationale
- Unresolved questions/blockers

### Strategy 3: Server-Side Context Editing

**What:** Clear old tool results and thinking blocks automatically.

```typescript
// Clear tool results older than threshold
{
  strategy: "clear_tool_uses",
  trigger: "message_count",
  triggerMessageCount: 8,
  keepLatestNUses: 4,
  excludedToolNames: ["read_memory", "search_results"]
}
```

→ See [automatic-context-compaction.md](./cookbooks/automatic-context-compaction.md)
for full implementation.

---

## Multi-Agent Systems

### Lead Agent + Subagents Pattern

```
┌─────────────────────────────────────────────────┐
│                 LEAD AGENT                       │
│  - High-level planning                          │
│  - Task decomposition                           │
│  - Result synthesis                             │
│  - Only has Task tool                           │
└─────────────────────────────────────────────────┘
           │            │            │
           ▼            ▼            ▼
    ┌──────────┐  ┌──────────┐  ┌──────────┐
    │ Subagent │  │ Subagent │  │ Subagent │
    │ Research │  │ Analysis │  │ Writing  │
    │          │  │          │  │          │
    │ WebSearch│  │ Database │  │ Write    │
    │ Read     │  │ Query    │  │ Read     │
    └──────────┘  └──────────┘  └──────────┘
```

### Subagent Tool Creation

Place in `subagentTools/` folder:

```typescript
// convex/agent/agents/myAgent/subagentTools/researcherSubagent.ts
import { tool } from "ai";
import { z } from "zod";

export const createResearcherSubagentTool = (
    ctx: GenericActionCtx<GenericDataModel>,
) =>
    tool({
        description: `Spawn a research subagent to search and extract information.

Use when: Need to gather information from multiple sources.
Returns: Summary of findings with source references.`,
        parameters: z.object({
            topic: z.string().describe("Research topic"),
            sources: z.array(z.string()).optional().describe("Preferred sources"),
        }),
        execute: async ({ topic, sources }) => {
            // Run subagent with focused tools
            const result = await runResearchSubagent({
                ctx,
                topic,
                sources,
                model: AiModel.CLAUDE_HAIKU_4_5, // Cost-efficient
            });
            return result.summary; // Return condensed results
        },
    });
```

### Multi-Agent Best Practices

1. **Clear role separation** - Each agent has distinct responsibility
2. **Minimal tool sets** - Agents only get tools they need
3. **Condensed returns** - Subagents return summaries, not full context
4. **Parallel execution** - Spawn independent agents concurrently
5. **Progress tracking** - Lead agent maintains state of all subagents

---

## Production Reliability

### Error Handling

```typescript
// Retry with exponential backoff
const retryWithBackoff = async <T>(
    fn: () => Promise<T>,
    maxRetries = 3,
): Promise<T> => {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            const delay = Math.pow(2, i) * 1000;
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }
    throw new Error("Unreachable");
};
```

### Cost Monitoring

```typescript
const COST_RATES: Record<string, { input: number; output: number }> = {
    "claude-sonnet-4-6": { input: 3, output: 15 },
    "claude-haiku-4-5": { input: 1, output: 5 },
    "gpt-5-mini": { input: 0.25, output: 2 },
};

const calculateCost = (
    model: string,
    promptTokens: number,
    completionTokens: number,
): number => {
    const rates = COST_RATES[model] ?? { input: 3, output: 15 };
    return (promptTokens / 1_000_000) * rates.input +
        (completionTokens / 1_000_000) * rates.output;
};
```

### Deployment Checklist

- [ ] Rate limiting configured
- [ ] Cost tracking/alerts with safety limits ($2 USD default)
- [ ] Error monitoring active
- [ ] Graceful degradation paths tested
- [ ] Context limits understood and handled
- [ ] Tool failures handled gracefully
- [ ] Status/step tracking implemented

---

## AI Models Reference

All models from `convex/agent/types/AiModel.ts`:

### OpenAI Models

| Model         | ID            | Speed | Intel | Input$/M | Output$/M | Notes                         |
| ------------- | ------------- | ----- | ----- | -------- | --------- | ----------------------------- |
| GPT 4o mini   | gpt-4o-mini   | 5     | 3     | $0.15    | $0.60     | Fast, cost-effective          |
| GPT 4o        | gpt-4o        | 4     | 4     | $2.50    | $10.00    | Versatile, strong reasoning   |
| GPT 5 mini    | gpt-5-mini    | 4     | 4     | $0.25    | $2.00     | Fast reasoning, excellent value |
| GPT 5         | gpt-5         | 3     | 4     | $1.25    | $10.00    | Advanced reasoning            |
| GPT 5.1       | gpt-5.1       | 3     | 4     | $1.25    | $10.00    | Enhanced instruction following |
| GPT 5.2       | gpt-5.2       | 3     | 5     | $1.75    | $14.00    | Most capable OpenAI model     |

### Anthropic Models

| Model             | ID                | Speed | Intel | Input$/M | Output$/M | Notes                              |
| ----------------- | ----------------- | ----- | ----- | -------- | --------- | ---------------------------------- |
| Claude Haiku 4.5  | claude-haiku-4-5  | 4     | 4     | $1.00    | $5.00     | Fast, strong analytical skills     |
| Claude Sonnet 4.6 | claude-sonnet-4-6 | 3     | 5     | $3.00    | $15.00    | Premium complex reasoning          |
| Claude Opus 4.6   | claude-opus-4-6   | 2     | 5     | $5.00    | $25.00    | Most intelligent, coding focus     |

### Google Models

| Model            | ID                   | Speed | Intel | Input$/M | Output$/M | Notes                      |
| ---------------- | -------------------- | ----- | ----- | -------- | --------- | -------------------------- |
| Gemini 2.5 Flash | gemini-2.5-flash     | 4     | 4     | $0.30    | $2.50     | Fast reasoning, great value |
| Gemini 2.5 Pro   | gemini-2.5-pro       | 3     | 4     | $1.25    | $10.00    | Deep analysis              |
| Gemini 3.0 Flash | gemini-3-flash-preview | 4   | 4     | $0.50    | $3.00     | Next-gen fast (beta)       |
| Gemini 3.0 Pro   | gemini-3-pro-preview | 3     | 5     | $2.00    | $12.00    | Superior reasoning (beta)  |

### Model Selection Guide

| Use Case                 | Recommended Model       |
| ------------------------ | ----------------------- |
| Complex reasoning        | Claude Opus 4.5         |
| General tasks            | Claude Sonnet 4.5       |
| High-volume, focused     | Claude Haiku 4.5        |
| Cost-sensitive subagents | GPT 5 mini              |
| Best value reasoning     | Gemini 2.5 Flash        |

---

## Claude API Essentials

Key patterns for working with the Claude API. For full reference, see
[building-with-claude-api.md](./building-with-claude-api.md).

### Basic Request Pattern

```python
from anthropic import Anthropic

client = Anthropic()  # Uses ANTHROPIC_API_KEY env var

message = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    system="Your system prompt here",  # Optional
    messages=[{"role": "user", "content": "Your prompt"}]
)

text = message.content[0].text
```

### Multi-Turn Pattern

API stores nothing. Send full history with every request.

```python
messages = []

# Add user message
messages.append({"role": "user", "content": user_input})

# Get response
response = client.messages.create(model=model, max_tokens=1024, messages=messages)

# Add assistant response to history
messages.append({"role": "assistant", "content": response.content[0].text})

# Next turn includes full history
messages.append({"role": "user", "content": follow_up})
```

### Pre-fill Technique

Control output format by providing partial assistant message.

```python
messages = [
    {"role": "user", "content": "Extract as JSON: ..."},
    {"role": "assistant", "content": "```json"}  # Pre-fill forces JSON
]

response = client.messages.create(
    model=model,
    max_tokens=1024,
    stop_sequences=["```"],  # Stop at closing fence
    messages=messages
)
# Response contains only raw JSON
```

### Tool Schema Pattern

```python
from anthropic.types import ToolParam

my_tool = ToolParam(
    name="tool_name",
    description="""What the tool does.
When to use: Specific use cases.
Returns: What it returns.""",
    input_schema={
        "type": "object",
        "properties": {
            "param1": {"type": "string", "description": "Param description"},
            "param2": {"type": "number", "description": "Optional param"}
        },
        "required": ["param1"]
    }
)
```

### Prompt Caching (90% Cost Reduction)

Cache repeated content (system prompts, tools) across requests.

```python
response = client.messages.create(
    model=model,
    max_tokens=1024,
    system=[{
        "type": "text",
        "text": "Your long system prompt...",
        "cache_control": {"type": "ephemeral"}  # Enable caching
    }],
    messages=[...]
)

# Check cache usage
print(response.usage.cache_read_input_tokens)  # Tokens read from cache
```

**Rules:** 1-hour duration, minimum 1024 tokens, max 4 breakpoints.

### Streaming Setup

```python
with client.messages.stream(
    model=model,
    max_tokens=1024,
    messages=[{"role": "user", "content": prompt}]
) as stream:
    for text in stream.text_stream:
        print(text, end="", flush=True)

    final = stream.get_final_message()  # For storage
```

---

## Reference Documentation

Deep-dive resources organized by topic:

### Foundational Articles

| File                                                                            | Description                              |
| ------------------------------------------------------------------------------- | ---------------------------------------- |
| [building-effective-agents.md](./articles/building-effective-agents.md)         | Anthropic's core agent patterns guide    |
| [building-agents-with-the-claude-agent-sdk.md](./articles/building-agents-with-the-claude-agent-sdk.md) | Claude Agent SDK implementation |
| [effective-context-engineering-for-agents.md](./articles/effective-context-engineering-for-agents.md) | Context management strategies |
| [multi-agent-research-system.md](./articles/multi-agent-research-system.md)     | Multi-agent architecture patterns        |
| [writing-tools-for-agents.md](./articles/writing-tools-for-agents.md)           | Tool design best practices               |

### Best Practices & API Reference

| File                                                         | Description                                              |
| ------------------------------------------------------------ | -------------------------------------------------------- |
| [agent-best-practices.md](./agent-best-practices.md)         | Comprehensive synthesis of agent building best practices |
| [building-with-claude-api.md](./building-with-claude-api.md) | Claude API patterns and reference                        |

### SDK Capabilities

| File                                                      | Description                          |
| --------------------------------------------------------- | ------------------------------------ |
| [context-editing.md](./capabilities/context-editing.md)   | Server-side context management       |
| [files-api.md](./capabilities/files-api.md)               | File handling and uploads            |
| [images.md](./capabilities/images.md)                     | Image processing capabilities        |
| [pdf-support.md](./capabilities/pdf-support.md)           | PDF document handling                |
| [programmatic-tool-calling.md](./capabilities/programmatic-tool-calling.md) | Call tools from code execution (90% token savings) |
| [prompt-caching.md](./capabilities/prompt-caching.md)     | 90% cost reduction with caching      |
| [tool-search-tool.md](./capabilities/tool-search-tool.md) | Dynamic tool discovery for 30+ tools |
| [usage-tracking.md](./capabilities/usage-tracking.md)     | Track costs and token usage for billing |

### Implementation Cookbooks

| File                                                                           | Description                        |
| ------------------------------------------------------------------------------ | ---------------------------------- |
| [automatic-context-compaction.md](./cookbooks/automatic-context-compaction.md) | Auto-summarization implementation  |
| [memory-and-context-management.md](./cookbooks/memory-and-context-management.md) | Persistent memory patterns       |

### Example Implementations

| File                                                         | Description                        |
| ------------------------------------------------------------ | ---------------------------------- |
| [claude-code-analysis.md](./example-repos/claude-code-analysis.md) | Claude Code architecture analysis |
| [research-agent.md](./example-repos/research-agent.md)       | Research agent implementation      |

### Prompt Engineering (8 Parts)

| File                                                                    | Topic                    |
| ----------------------------------------------------------------------- | ------------------------ |
| [01-overview.md](./prompt-engineering/01-overview.md)                   | Fundamentals overview    |
| [02-be-clear-and-direct.md](./prompt-engineering/02-be-clear-and-direct.md) | Clarity techniques   |
| [03-use-examples.md](./prompt-engineering/03-use-examples.md)           | Few-shot prompting       |
| [04-let-claude-think.md](./prompt-engineering/04-let-claude-think.md)   | Chain of thought         |
| [05-use-xml-tags.md](./prompt-engineering/05-use-xml-tags.md)           | Structured formatting    |
| [06-give-claude-a-role.md](./prompt-engineering/06-give-claude-a-role.md) | Role prompting         |
| [07-chain-complex-prompts.md](./prompt-engineering/07-chain-complex-prompts.md) | Multi-step pipelines |
| [08-long-context-tips.md](./prompt-engineering/08-long-context-tips.md) | Handling large documents |

---

## File Checklist

When creating a new agent, ensure these files exist:

### Backend (Convex)

- [ ] `convex/agent/agents/<name>/types/<name>Enums.ts` - Status/step enums
- [ ] `convex/agent/agents/<name>/types/<name>Request.ts` - Request schema
- [ ] `convex/agent/agents/<name>/types/<name>Response.ts` - Response type
- [ ] `convex/agent/agents/<name>/<name>SystemPrompt.ts` - System prompt
- [ ] `convex/agent/agents/<name>/<name>MaxSteps.ts` - Config (steps, cost limit)
- [ ] `convex/agent/agents/<name>/<name>.ts` - Main agent handler
- [ ] `convex/http.ts` - HTTP endpoint (POST + OPTIONS)

### Frontend

- [ ] `src/hooks/use-<name>.ts` - React hook for agent interaction

### Optional

- [ ] `convex/agent/agents/<name>/subagentTools/` - Subagent tool definitions
- [ ] `convex/agent/agents/<name>/lib/` - Helper functions
