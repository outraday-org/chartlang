# Agent Best Practices: Building State-of-the-Art AI Agents with Claude

This comprehensive guide synthesizes best practices from Anthropic's official
documentation, Claude Code architecture analysis, and proven implementation
patterns for building production-grade AI agents.

## Table of Contents

1. [Core Philosophy](#core-philosophy)
2. [Agent Architecture Patterns](#agent-architecture-patterns)
3. [The Agent Loop](#the-agent-loop)
4. [Context Engineering](#context-engineering)
5. [Tool Design](#tool-design)
6. [Programmatic Tool Calling](#programmatic-tool-calling)
7. [Multi-Agent Systems](#multi-agent-systems)
8. [Prompt Engineering](#prompt-engineering)
9. [SDK Features & Optimization](#sdk-features--optimization)
10. [Production Reliability](#production-reliability)
11. [Implementation Checklist](#implementation-checklist)

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

### Workflows vs Agents

Understanding this distinction is fundamental:

| Aspect       | Workflows                     | Agents                        |
| ------------ | ----------------------------- | ----------------------------- |
| Control      | Predefined code paths         | LLM-directed decisions        |
| Flexibility  | Fixed orchestration           | Dynamic tool/path selection   |
| Reliability  | More predictable              | More adaptive                 |
| Best for     | Well-defined processes        | Open-ended problems           |
| Complexity   | Lower                         | Higher                        |

**Recommendation:** Start with workflows, graduate to agents only when the task
demands dynamic decision-making.

---

## Agent Architecture Patterns

### Pattern 1: Prompt Chaining

**Use when:** Task has clear sequential steps with dependencies.

```
[Input] → [LLM Call 1] → [Gate/Check] → [LLM Call 2] → [Output]
```

**Best Practices:**

- Each step should have a single, focused responsibility
- Include validation gates between steps
- Make prompts shorter and more targeted
- Use structured outputs (JSON) for reliable handoffs

**Example Flow:**

```
1. Extract key entities → validate entities found
2. Research each entity → validate completeness
3. Synthesize findings → validate coherence
4. Generate final output
```

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
- Route based on task type, not content complexity

### Pattern 3: Parallelization

**Use when:** Task can be decomposed into independent subtasks.

**Variants:**

1. **Sectioning** - Split input, process sections in parallel
2. **Voting** - Multiple attempts, aggregate results

**Best Practices:**

- Ensure subtasks are truly independent
- Design aggregation strategy upfront
- Consider token costs of parallel calls
- Use for search, analysis, and validation tasks

### Pattern 4: Orchestrator-Workers

**Use when:** Complex tasks requiring dynamic decomposition.

```
                    ┌─→ [Worker 1] ─┐
[Orchestrator] ─────┼─→ [Worker 2] ─┼──→ [Synthesizer]
                    └─→ [Worker N] ─┘
```

**Best Practices:**

- Orchestrator focuses on planning and delegation
- Workers have specialized, focused capabilities
- Workers return condensed results (not full context)
- Orchestrator synthesizes and decides next steps

### Pattern 5: Evaluator-Optimizer

**Use when:** Output quality benefits from iterative refinement.

```
[Generator] → [Output] → [Evaluator] → [Feedback] → [Generator] (loop)
```

**Best Practices:**

- Define clear evaluation criteria upfront
- Set maximum iteration limits
- Track improvement across iterations
- Know when "good enough" is reached

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

1. **Agentic Search** (Preferred)
   - Use file system navigation (glob, grep, head, tail)
   - Let agent discover structure through exploration
   - Metadata provides implicit signals (naming, hierarchy, timestamps)

2. **Semantic Search** (Supplementary)
   - Faster but less accurate
   - Requires embedding infrastructure
   - Use when speed matters more than precision

3. **Just-in-Time Retrieval**
   - Maintain lightweight references (paths, queries, URLs)
   - Load data into context only when needed
   - Mirrors human cognition patterns

**Best Practice:** Start with agentic search; add semantic only if needed.

### Phase 2: Take Action

**Action Types:**

1. **Tools** - Primary actions (well-defined, discoverable)
2. **Bash/Scripts** - Flexible, general-purpose operations
3. **Code Generation** - Precise, composable, reusable outputs
4. **MCPs** - Standardized external integrations

### Phase 3: Verify Work

**Verification Methods:**

| Method          | Best For                    | Robustness |
| --------------- | --------------------------- | ---------- |
| Defined Rules   | Structured outputs          | High       |
| Linting/Tests   | Code generation             | High       |
| Visual Feedback | UI/visual tasks             | Medium     |
| LLM-as-Judge    | Fuzzy quality assessment    | Lower      |

**Best Practice:** Prefer concrete, programmatic verification over LLM judgment.

### Phase 4: Iterate

- Track progress explicitly (todo lists, notes)
- Know when to stop (success criteria, iteration limits)
- Handle failures gracefully (retry with different approach)

---

## Context Engineering

> "Context is a critical but finite resource. Good context engineering means
> finding the smallest possible set of high-signal tokens."

### Understanding Context Constraints

**The Attention Budget:**

- LLMs have limited "working memory" capacity
- Performance degrades as context grows (context rot)
- Every token depletes attention budget
- n² pairwise relationships for n tokens

### System Prompt Design

**The Right Altitude:**

```
Too Low (Brittle)          Goldilocks Zone           Too High (Vague)
─────────────────────────────────────────────────────────────────────
Complex if-else logic  ←   Clear heuristics   →  Vague guidance
Exact behaviors             Flexible rules        Assumed context
High maintenance            Adaptable             Under-specified
```

**Best Practices:**

1. Start minimal, add based on failure modes
2. Use clear section delineation (XML tags, Markdown headers)
3. Provide strong heuristics, not exhaustive rules
4. Test with best model first, then add instructions

**Structure Template:**

```xml
<background_information>
[Context about the domain and task]
</background_information>

<instructions>
[Core behavioral guidelines]
</instructions>

<tool_guidance>
[When and how to use each tool]
</tool_guidance>

<output_format>
[Expected output structure]
</output_format>

<examples>
[Diverse, canonical examples]
</examples>
```

### Context Management Strategies

#### 1. Compaction

**What:** Summarize context when approaching window limits.

**Implementation:**

```typescript
import { createClaudeSDKClient } from "@anthropic-ai/claude-agent-sdk";

const client = createClaudeSDKClient({
  autoCompact: {
    enabled: true,
    threshold: 0.8, // Compact at 80% capacity
    keepRecentMessages: 5,
  },
});
```

**Compaction Best Practices:**

- Preserve: architectural decisions, unresolved issues, key implementation
  details
- Discard: redundant tool outputs, resolved conversations
- Keep 5 most recent files/messages
- Tune for recall first, then precision

#### 2. Structured Note-Taking

**What:** Persist important information outside context window.

**Implementation Approaches:**

```typescript
// File-based memory
const memoryTool = {
  name: "update_notes",
  description: "Write/update persistent notes",
  parameters: {
    file: "string (NOTES.md, TODO.md, etc.)",
    content: "string",
  },
};

// Database-backed memory
const memoryStore = new MemoryToolHandler({
  rootPath: "./.agent-memory",
  maxFileSize: 50000,
});
```

**What to Track:**

- Progress on multi-step tasks
- Key decisions and rationale
- Unresolved questions/blockers
- Important context that would be lost

#### 3. Server-Side Context Editing

**What:** Clear old tool results and thinking blocks automatically.

**Configuration:**

```typescript
// Clear tool results older than threshold
{
  strategy: "clear_tool_uses_20250919",
  trigger: "message_count",
  trigger_message_count: 8,
  keep_latest_n_uses: 4,
  excluded_tool_names: ["read_memory", "search_results"]
}

// Clear extended thinking blocks
{
  strategy: "clear_thinking_20251015",
  trigger: "context_length",
  thinking_context_length_trigger_ratio: 0.5
}
```

---

## Tool Design

> "Tools are the primary contract between agents and their information/action
> space."

### Core Principles

1. **Choose the right tools** - Match tool granularity to task
2. **Minimize tool overlap** - Clear, distinct purposes
3. **Use namespacing** - Logical grouping with prefixes
4. **Return meaningful context** - Enough info for next decision
5. **Optimize token efficiency** - Concise but complete responses

### Tool Description Best Practices

**Structure:**

```typescript
{
  name: "search_documents",
  description: `Search through document collection.

When to use: Finding specific information in documents.
When NOT to use: Browsing/exploring document structure (use list_documents).

Input: Natural language query describing what to find.
Output: Ranked list of relevant excerpts with source references.

Example queries:
- "quarterly revenue for Q3 2024"
- "mentions of supply chain risks"`,
  parameters: {
    query: {
      type: "string",
      description: "Natural language search query"
    },
    max_results: {
      type: "number",
      description: "Maximum results to return (default: 10)"
    }
  }
}
```

### Tool Design Patterns

#### Pattern: Clear vs Ambiguous

```typescript
// BAD: Overlapping functionality
tools: [
  { name: "search", description: "Search for things" },
  { name: "find", description: "Find information" },
  { name: "lookup", description: "Look up data" },
];

// GOOD: Distinct purposes
tools: [
  { name: "search_documents", description: "Full-text search in documents" },
  { name: "query_database", description: "Structured database queries" },
  { name: "web_search", description: "Search the internet" },
];
```

#### Pattern: Namespaced Tools

```typescript
// Organize related tools with prefixes
tools: [
  { name: "file_read", ... },
  { name: "file_write", ... },
  { name: "file_delete", ... },
  { name: "db_query", ... },
  { name: "db_insert", ... },
  { name: "api_get", ... },
  { name: "api_post", ... },
]
```

#### Pattern: Token-Efficient Returns

```typescript
// BAD: Returning everything
return {
  results: entireDatabaseDump,
  metadata: allMetadata,
  debug: fullDebugInfo,
};

// GOOD: Returning what's needed
return {
  matches: topResults.slice(0, 10),
  total_count: totalMatches,
  has_more: totalMatches > 10,
};
```

### Tool Search for Large Tool Sets

**Problem:** Large tool sets create two compounding issues:

1. **Token overhead:** 50+ tools consume 10-20K tokens before work begins
2. **Selection accuracy:** Performance degrades at 30-50 tools as the model
   struggles to identify the right tool

**Solution:** Anthropic's Tool Search Tool enables dynamic tool discovery,
reducing initial context and improving selection accuracy.

#### Official Tool Search Variants

Anthropic provides two built-in tool search implementations:

| Variant | Type Identifier | Search Method |
| ------- | --------------- | ------------- |
| **Regex** | `tool_search_tool_regex_20251119` | Claude constructs regex patterns |
| **BM25** | `tool_search_tool_bm25_20251119` | Natural language keyword queries |

**Recommendation:** BM25 is generally preferred for most use cases as it handles
natural language queries more intuitively.

#### How Tool Search Works

```
Step 1: Define tools with defer_loading: true
        ↓
Step 2: Claude sees only search tool + non-deferred tools initially
        ↓
Step 3: Claude searches when it needs additional tools
        ↓
Step 4: API returns 3-5 most relevant tool_reference blocks
        ↓
Step 5: References auto-expand into full tool definitions
        ↓
Step 6: Claude selects and invokes discovered tools
```

#### Token Savings

| Scenario | Token Usage | Reduction |
| -------- | ----------- | --------- |
| Traditional (200+ tools) | ~77K tokens | — |
| With Tool Search | ~8.7K tokens | **~85%** |

**Accuracy Improvements:**

- Opus 4: 49% → 74% (+25 percentage points)
- Opus 4.5: 79.5% → 88.1% (+8.6 percentage points)

#### Implementation Examples

**Basic Deferred Tool Definition:**

```typescript
// Mark tools for deferred loading
const tools = [
  // Always-available tools (frequently used)
  {
    name: "read_file",
    description: "Read contents of a file",
    input_schema: { /* ... */ }
  },
  // Deferred tools (loaded on demand)
  {
    name: "advanced_sql_query",
    description: "Execute complex SQL with joins and aggregations",
    input_schema: { /* ... */ },
    defer_loading: true  // Only loaded when discovered via search
  },
  {
    name: "financial_ratio_calculator",
    description: "Calculate financial ratios like P/E, ROE, debt-to-equity",
    input_schema: { /* ... */ },
    defer_loading: true
  }
];

// Include the tool search tool
const toolSearchTool = {
  type: "tool_search_tool_bm25_20251119"  // or "tool_search_tool_regex_20251119"
};
```

**MCP Integration with Default Config:**

```typescript
// Configure MCP toolsets with deferred loading
const request = {
  model: "claude-sonnet-4-6",
  max_tokens: 1024,
  tools: [
    { type: "tool_search_tool_bm25_20251119" }
  ],
  mcp_toolsets: [
    {
      server_name: "financial-data",
      server_url: "https://mcp.example.com/financial",
      // Apply defer_loading to all tools from this server
      default_config: {
        defer_loading: true
      }
    },
    {
      server_name: "core-tools",
      server_url: "https://mcp.example.com/core"
      // No default_config = always available
    }
  ],
  messages: [{ role: "user", content: "Calculate the P/E ratio for AAPL" }]
};
```

**Custom Tool Search Implementation:**

```typescript
// Build your own tool search that returns tool_reference blocks
const customToolSearch = {
  name: "search_available_tools",
  description: "Search for tools matching a capability description",
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Natural language description of needed capability"
      }
    },
    required: ["query"]
  }
};

// Handler returns tool_reference content blocks
async function handleToolSearch(query: string): Promise<ToolUseResult> {
  const matches = await searchToolIndex(query);

  return {
    type: "tool_result",
    content: matches.map(tool => ({
      type: "tool_reference",
      tool_id: tool.name,
      // Full tool definition auto-expands from this reference
    }))
  };
}
```

#### When to Use Tool Search

**Good Use Cases:**

| Scenario | Benefit |
| -------- | ------- |
| 10+ tools available | Meaningful token savings |
| Tool definitions >10K tokens | Major context reduction |
| Tool selection accuracy issues | Better discovery |
| MCP systems with 200+ tools | Essential for manageability |

**Less Beneficial:**

| Scenario | Why |
| -------- | --- |
| Less than 10 tools | Overhead not worth it |
| All tools used every session | No benefit from deferral |
| Very small tool definitions (<100 tokens total) | Minimal savings |

#### Optimization Tips

1. **Keep 3-5 most frequent tools non-deferred** — Tools Claude uses in nearly
   every interaction should always be available

2. **Write semantic tool names and descriptions** — Tool search relies on
   matching query terms to tool metadata:
   ```typescript
   // Good: Searchable keywords
   {
     name: "calculate_financial_ratios",
     description: "Calculate financial ratios including P/E, ROE, ROA,
                   debt-to-equity, current ratio, and quick ratio from
                   balance sheet and income statement data"
   }

   // Bad: Vague description
   {
     name: "calc_ratios",
     description: "Calculate ratios"
   }
   ```

3. **Add system prompt guidance** — Describe available tool categories:
   ```xml
   <available_tool_categories>
   - File operations: read, write, search files
   - Financial analysis: ratios, valuations, comparisons
   - Data processing: SQL queries, aggregations, transforms
   - External APIs: market data, SEC filings, news

   Use the tool search to discover specific tools in each category.
   </available_tool_categories>
   ```

4. **Monitor discovery patterns** — Track which tools Claude discovers to
   identify candidates for always-available status

#### Limits

| Constraint | Value |
| ---------- | ----- |
| Maximum tools | 10,000 |
| Search results per query | 3-5 most relevant |
| Regex pattern length | 200 characters max |
| Model support | Sonnet 4.0+, Opus 4.0+ (no Haiku) |

---

## Programmatic Tool Calling

> Programmatic tool calling allows Claude to write code that calls your tools
> programmatically within a code execution container, rather than requiring round
> trips through the model for each tool invocation.

### Overview

This feature reduces latency for multi-tool workflows and decreases token
consumption by allowing Claude to filter or process data before it reaches the
model's context window.

**Requirements:**

- Beta header: `"advanced-tool-use-2025-11-20"`
- Code execution tool must be enabled
- Models: Claude Opus 4.5, Claude Sonnet 4.5

### How It Works

```
1. Claude writes Python code that invokes tools as functions
2. Code runs in a sandboxed container via code execution
3. When a tool function is called, execution pauses and API returns tool_use block
4. You provide tool result, code execution continues
5. Intermediate results NOT loaded into Claude's context (token savings!)
6. Final output returned to Claude for response generation
```

### The `allowed_callers` Field

Controls which contexts can invoke a tool:

```json
{
  "name": "query_database",
  "description": "Execute a SQL query",
  "input_schema": {...},
  "allowed_callers": ["code_execution_20250825"]
}
```

**Values:**

- `["direct"]` - Only Claude can call directly (default)
- `["code_execution_20250825"]` - Only callable from code execution
- `["direct", "code_execution_20250825"]` - Both contexts

**Recommendation:** Choose one or the other for clearer guidance to Claude.

### Advanced Patterns

#### Batch Processing with Loops

```python
# Process multiple items efficiently
regions = ["West", "East", "Central", "North", "South"]
results = {}
for region in regions:
    data = await query_database(f"<sql for {region}>")
    results[region] = sum(row["revenue"] for row in data)

# Aggregate before returning
top_region = max(results.items(), key=lambda x: x[1])
print(f"Top region: {top_region[0]} with ${top_region[1]:,}")
```

**Benefits:**

- Reduces N model round-trips to 1
- Processes large datasets programmatically
- Returns only aggregated conclusions

#### Early Termination

```python
endpoints = ["us-east", "eu-west", "apac"]
for endpoint in endpoints:
    status = await check_health(endpoint)
    if status == "healthy":
        print(f"Found healthy endpoint: {endpoint}")
        break  # Stop early
```

#### Conditional Tool Selection

```python
file_info = await get_file_info(path)
if file_info["size"] < 10000:
    content = await read_full_file(path)
else:
    content = await read_file_summary(path)
```

#### Data Filtering

```python
logs = await fetch_logs(server_id)
errors = [log for log in logs if "ERROR" in log]
print(f"Found {len(errors)} errors")
for error in errors[-10:]:  # Only return last 10
    print(error)
```

### Token Efficiency

**Key insight:** Tool results from programmatic calls do NOT count toward
input/output token usage. Only the final code execution result counts.

| Scenario                        | Token Reduction |
| ------------------------------- | --------------- |
| 10 tools called directly        | Baseline        |
| 10 tools called programmatically| ~90% savings    |

### Best Practices

**Tool Design:**

- Provide detailed output descriptions (JSON structure, field types)
- Return structured data (JSON) for easy parsing
- Keep responses concise

**When to Use:**

| Good Use Cases                                    | Less Ideal                              |
| ------------------------------------------------- | --------------------------------------- |
| Processing large datasets needing only aggregates | Single tool calls with simple responses |
| Multi-step workflows with 3+ dependent calls      | Tools needing immediate user feedback   |
| Operations requiring filtering/transformation     | Very fast operations                    |
| Parallel operations across many items             |                                         |

### Container Lifecycle

- Containers expire after ~4.5 minutes of inactivity
- Reuse containers by passing container ID
- Monitor `expires_at` field to prevent timeouts

### Constraints

**Not supported with programmatic calling:**

- Structured outputs (`strict: true`)
- Tool choice forcing
- `disable_parallel_tool_use: true`
- Web search, web fetch, MCP connector tools

**Message format restriction:** When responding to programmatic tool calls,
messages must contain ONLY `tool_result` blocks (no text content).

→ See [programmatic-tool-calling.md](./capabilities/programmatic-tool-calling.md)
for full API examples and implementation details.

---

## Multi-Agent Systems

### Architecture Patterns

#### Lead Agent + Subagents

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
    │ WebSearch│  │ Bash/Py  │  │ Write    │
    │ Read     │  │ Read     │  │ Read     │
    └──────────┘  └──────────┘  └──────────┘
```

#### Subagent Definition

```typescript
const researcherAgent: SubagentDefinition = {
  name: "researcher",
  description: "Search web and extract information on specific topics",
  model: "haiku", // Cost-efficient for focused tasks
  tools: ["WebSearch", "Read", "Write"],
  prompt: `You are a research specialist. Your task is to:
1. Search for information on the assigned topic
2. Extract key facts and data points
3. Write findings to files/research_notes/{topic}.md
4. Return a brief summary of findings`,
};
```

### Multi-Agent Best Practices

1. **Clear role separation** - Each agent has distinct responsibility
2. **Minimal tool sets** - Agents only get tools they need
3. **Condensed returns** - Subagents return summaries, not full context
4. **Parallel execution** - Spawn independent agents concurrently
5. **Progress tracking** - Lead agent maintains state of all subagents

### Communication Patterns

#### File-Based Data Pipeline

```
Lead Agent
    │
    ├── Spawns → Researcher 1 → writes → files/research/topic_a.md
    ├── Spawns → Researcher 2 → writes → files/research/topic_b.md
    ├── Spawns → Researcher 3 → writes → files/research/topic_c.md
    │
    ├── Waits for completion
    │
    └── Spawns → Analyst → reads files/ → writes → files/analysis.md
                    │
                    └── Spawns → Writer → reads all → final_report.pdf
```

#### Hook-Based Instrumentation

```typescript
// Track all subagent activity without modifying agent code
const tracker = new SubagentTracker();

const hooks = {
  pre_tool_use: (toolCall) => {
    tracker.recordToolStart(toolCall);
    return { continue_: true };
  },
  post_tool_use: (toolCall, result) => {
    tracker.recordToolEnd(toolCall, result);
    return { continue_: true };
  },
};
```

---

## Prompt Engineering

### Principle 1: Be Clear and Direct

**Provide Context:**

```xml
<context>
You are assisting a financial analyst who needs to extract key metrics
from quarterly earnings reports. The reports are in PDF format and may
contain tables, charts, and narrative text.
</context>
```

**Be Specific:**

```
BAD: "Analyze this document"
GOOD: "Extract the following from this 10-K filing:
1. Total revenue for each quarter
2. Year-over-year growth percentage
3. Key risk factors mentioned in Item 1A"
```

**Give Sequential Steps:**

```xml
<instructions>
Process the earnings call transcript:
1. Identify all speakers and their roles
2. Extract key financial metrics mentioned
3. Note any forward-looking statements
4. Summarize sentiment for each major topic
5. Flag any unexpected announcements
</instructions>
```

### Principle 2: Use Examples (Few-Shot)

**3-5 diverse, canonical examples covering:**

- Typical cases
- Edge cases
- Failure modes to avoid

```xml
<examples>
<example>
<input>Q3 revenue was $4.2B, up 15% YoY</input>
<output>{"metric": "revenue", "value": 4.2, "unit": "B", "period": "Q3", "growth": "15%", "comparison": "YoY"}</output>
</example>

<example>
<input>We expect continued headwinds in the consumer segment</input>
<output>{"type": "forward_looking", "segment": "consumer", "sentiment": "negative", "specificity": "vague"}</output>
</example>
</examples>
```

### Principle 3: Let Claude Think

**Basic Chain of Thought:**

```
Before providing your final answer, think through this step by step.
```

**Structured Thinking:**

```xml
<instructions>
For each document:
<thinking>
- What type of document is this?
- What are the key sections?
- What information is most relevant to the query?
</thinking>
<answer>
[Your structured response]
</answer>
</instructions>
```

### Principle 4: Use XML Tags

**Benefits:**

- Clear section delineation
- Enables post-processing extraction
- Reduces ambiguity

**Common Tags:**

```xml
<context>Background information</context>
<instructions>What to do</instructions>
<constraints>Limitations and rules</constraints>
<examples>Sample inputs/outputs</examples>
<output_format>Expected structure</output_format>
<thinking>Reasoning process</thinking>
<answer>Final response</answer>
```

### Principle 5: Role Prompting

**System Prompt Approach:**

```typescript
const systemPrompt = `You are a senior financial analyst with 15 years of
experience in equity research. You specialize in technology sector analysis
and have deep expertise in reading SEC filings, earnings transcripts, and
financial statements.

Your analysis style is:
- Data-driven and precise
- Skeptical of management spin
- Focused on identifying trends and anomalies`;
```

### Principle 6: Chain Complex Prompts

**When to Chain:**

- Multi-step analysis
- Different expertise needed per step
- Validation between steps

**Example Pipeline:**

```
1. [Extract] Raw data extraction from documents
      ↓ (validate: data completeness)
2. [Enrich] Add context and metadata
      ↓ (validate: enrichment accuracy)
3. [Analyze] Identify patterns and insights
      ↓ (validate: logical consistency)
4. [Generate] Create final report
```

### Principle 7: Long Context Handling

**Document Positioning:**

```xml
<documents>
[Place long documents here - at the TOP of the prompt]
</documents>

<instructions>
Using the documents above, answer the following questions:
[Questions here - at the BOTTOM]
</instructions>
```

**Ground Responses:**

```
When answering, quote relevant passages from the source documents
to support your analysis. Format quotes as:
"[quote]" (Source: document_name, section)
```

---

## SDK Features & Optimization

### Prompt Caching

**How it works:**

- Cached prefixes avoid reprocessing
- 5-minute TTL (standard) or 1-hour TTL (Opus)
- Up to 4 cache breakpoints per request
- 90% cost reduction on cache hits

**Minimum Cacheable Tokens:**

| Model         | Minimum Tokens |
| ------------- | -------------- |
| Claude 3.5    | 1024           |
| Claude 3 Opus | 1024           |
| Claude 3 Haiku| 2048           |

**Best Practices:**

```typescript
// Structure for optimal caching
const messages = [
  {
    role: "system",
    content: systemPrompt, // Cached - changes rarely
    cache_control: { type: "ephemeral" },
  },
  {
    role: "user",
    content: toolDefinitions, // Cached - changes rarely
    cache_control: { type: "ephemeral" },
  },
  {
    role: "user",
    content: recentContext, // May be cached
    cache_control: { type: "ephemeral" },
  },
  // Dynamic messages below - not cached
];
```

### Files API

**Use Cases:**

- PDF processing (up to 32MB, 100 pages)
- Image analysis
- Dataset handling

**Pattern: Create Once, Use Many**

```typescript
// Upload once
const file = await client.files.create({
  file: fs.createReadStream("report.pdf"),
  purpose: "user_data",
});

// Reference in multiple conversations
messages.push({
  role: "user",
  content: [
    {
      type: "document",
      source: { type: "file", file_id: file.id },
    },
  ],
});
```

### Memory Tool

**Implementation:**

```typescript
class MemoryToolHandler {
  constructor(options: {
    rootPath: string;
    maxFileSize?: number;
    allowedPaths?: string[];
  }) {
    this.rootPath = options.rootPath;
    this.maxFileSize = options.maxFileSize || 50000;
  }

  async execute(command: MemoryCommand): Promise<string> {
    switch (command.command) {
      case "view":
        return this.viewFile(command.path);
      case "create":
        return this.createFile(command.path, command.content);
      case "str_replace":
        return this.replaceInFile(
          command.path,
          command.old_str,
          command.new_str
        );
      case "insert":
        return this.insertAtLine(
          command.path,
          command.line,
          command.content
        );
      // ...
    }
  }
}
```

---

## Production Reliability

### Error Handling Strategies

#### 1. Graceful Degradation

```typescript
const executeWithFallback = async (primaryFn, fallbackFn) => {
  try {
    return await primaryFn();
  } catch (error) {
    console.warn(`Primary failed: ${error.message}, trying fallback`);
    return await fallbackFn();
  }
};
```

#### 2. Stateful Error Recovery

```typescript
// Track state for recovery
const agentState = {
  currentStep: 0,
  completedSteps: [],
  checkpoint: null,
};

const executeStep = async (step) => {
  agentState.checkpoint = await saveState();
  try {
    const result = await step.execute();
    agentState.completedSteps.push(step.id);
    agentState.currentStep++;
    return result;
  } catch (error) {
    // Can resume from checkpoint
    throw new RecoverableError(error, agentState.checkpoint);
  }
};
```

#### 3. Retry with Backoff

```typescript
const retryWithBackoff = async (fn, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      const delay = Math.pow(2, i) * 1000;
      await sleep(delay);
    }
  }
};
```

### Evaluation & Testing

#### Build Evaluation Sets

```typescript
const evalSet = [
  {
    input: "Summarize Q3 earnings",
    expected_behavior: "Extracts revenue, profit, guidance",
    edge_cases: ["Missing data", "Conflicting numbers"],
  },
  // More test cases...
];
```

#### Metrics to Track

1. **Task completion rate** - Did agent finish successfully?
2. **Accuracy** - Did output meet expectations?
3. **Efficiency** - Token usage, API calls, time
4. **Recovery rate** - How often did retries succeed?

### Deployment Checklist

- [ ] Rate limiting configured
- [ ] Cost tracking/alerts in place
- [ ] Error monitoring active
- [ ] Graceful degradation paths tested
- [ ] Evaluation set covers edge cases
- [ ] Context limits understood and handled
- [ ] Tool failures handled gracefully
- [ ] User feedback mechanisms in place

---

## Implementation Checklist

### Starting a New Agent

- [ ] Define the core task and success criteria
- [ ] Choose architecture pattern (workflow vs agent, single vs multi)
- [ ] Design minimal tool set
- [ ] Write clear system prompt at "right altitude"
- [ ] Create 3-5 diverse examples
- [ ] Build initial evaluation set

### Tool Design

- [ ] Clear, non-overlapping tool purposes
- [ ] Descriptive names and documentation
- [ ] Token-efficient return formats
- [ ] Error messages that enable recovery
- [ ] Consider tool search for 30+ tools

### Context Management

- [ ] Implement compaction strategy
- [ ] Consider memory/note-taking for long tasks
- [ ] Enable context editing for tool results
- [ ] Configure prompt caching
- [ ] Test at context limits

### Multi-Agent Setup

- [ ] Clear role separation between agents
- [ ] Minimal tool sets per agent
- [ ] Defined communication protocol
- [ ] Progress tracking mechanism
- [ ] Aggregation/synthesis strategy

### Production Readiness

- [ ] Comprehensive error handling
- [ ] Cost monitoring and limits
- [ ] Evaluation suite
- [ ] Logging and observability
- [ ] Graceful degradation paths

---

## Quick Reference

### Model Selection

| Use Case                | Recommended Model |
| ----------------------- | ----------------- |
| Complex reasoning       | Claude Opus       |
| General tasks           | Claude Sonnet     |
| High-volume, focused    | Claude Haiku      |
| Cost-sensitive subagents| Claude Haiku      |

### Token Budgets

| Component           | Typical Range   |
| ------------------- | --------------- |
| System prompt       | 1,000 - 5,000   |
| Tool definitions    | 2,000 - 10,000  |
| Examples            | 1,000 - 3,000   |
| Working context     | 10,000 - 50,000 |
| Reserve for output  | 4,000 - 8,000   |

### Cost Optimization

1. Use prompt caching (90% savings on hits)
2. Use Haiku for subagents when appropriate
3. Implement context editing to clear old tool results
4. Return condensed results from tools
5. Compact conversations before hitting limits

---

## Sources

This guide synthesizes information from:

- Anthropic's "Building Effective Agents" article
- Anthropic's "Building Agents with the Claude Agent SDK" article
- Anthropic's "Effective Context Engineering for AI Agents" article
- Anthropic's "Multi-Agent Research System" article
- Anthropic's "Writing Tools for Agents" article
- Anthropic's "Programmatic Tool Calling" documentation
- Claude Agent SDK documentation (context editing, files API, prompt caching)
- Claude Code architecture analysis
- Anthropic's Prompt Engineering guides
