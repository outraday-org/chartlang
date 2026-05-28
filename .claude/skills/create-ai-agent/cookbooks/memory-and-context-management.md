# Memory & Context Management with Claude Agent SDK (TypeScript)

Original Python cookbook: https://platform.claude.com/cookbook/tool-use-memory-cookbook

This cookbook demonstrates memory and context management using the TypeScript Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) and the raw Anthropic SDK (`@anthropic-ai/sdk`). Build AI agents with persistent memory that learn patterns across conversations.

## Table of Contents

1. [Introduction](#introduction)
2. [Prerequisites](#prerequisites)
3. [Setup](#setup)
4. [Memory Tool Architecture](#memory-tool-architecture)
5. [Basic Memory Usage](#basic-memory-usage)
6. [Cross-Conversation Learning](#cross-conversation-learning)
7. [Context Editing Configuration](#context-editing-configuration)
8. [Code Review Assistant Demo](#code-review-assistant-demo)
9. [Alternative: Claude Agent SDK with MCP](#alternative-claude-agent-sdk-with-mcp)
10. [Best Practices & Security](#best-practices--security)

## Introduction

### The Problem

Large language models have finite context windows (200k tokens for Claude 4 models). Several challenges emerge:

- **Context limits**: Long conversations or complex tasks can exceed available context
- **Computational cost**: Processing large contexts is expensive (attention scales quadratically)
- **Repeated patterns**: Similar tasks across conversations require re-explaining context every time
- **Information loss**: When context fills up, earlier important information gets lost

### The Solution

Claude 4 models introduce powerful context management capabilities:

**Memory Tool (`memory_20250818`)**: Enables cross-conversation learning
- Claude can write down what it learns for future reference
- File-based system under `/memories` directory
- Client-side implementation gives you full control

**Context Editing**: Automatically manages context with two strategies:
- Tool use clearing (`clear_tool_uses_20250919`): Clears old tool results when context grows large
- Thinking management (`clear_thinking_20251015`): Manages extended thinking blocks

**Supported Models**: Claude Opus 4.5, Claude Opus 4.1, Claude Opus 4, Claude Sonnet 4.5, Claude Sonnet 4, Claude Haiku 4.5

### The Benefit

Build AI agents that get better at your specific tasks over time:

- **Session 1**: Claude solves a problem, writes down the pattern
- **Session 2**: Claude applies the learned pattern immediately (faster!)
- **Long sessions**: Context editing keeps conversations manageable

Think of it as giving Claude a notebook to take notes and refer back to - just like humans do.

## Prerequisites

**Required:**
- Node.js 18+ or Bun
- Anthropic API key
- `@anthropic-ai/sdk` >= 0.71.0
- `@anthropic-ai/claude-agent-sdk` >= 0.2.15 (optional, for MCP approach)

**Install dependencies:**

```bash
pnpm add @anthropic-ai/sdk zod
# Optional: for Claude Agent SDK approach
pnpm add @anthropic-ai/claude-agent-sdk
```

## Setup

Set your API key:

```bash
export ANTHROPIC_API_KEY=your_api_key_here
```

## Memory Tool Architecture

The memory tool is a **client-side implementation** - you control the storage. Claude makes tool calls requesting file operations, and your application executes them.

### Memory Tool Commands

| Command | Description | Example Input |
|---------|-------------|---------------|
| `view` | Show directory or file contents | `{command: "view", path: "/memories"}` |
| `create` | Create or overwrite a file | `{command: "create", path: "/memories/notes.md", file_text: "..."}` |
| `str_replace` | Replace text in a file | `{command: "str_replace", path: "...", old_str: "...", new_str: "..."}` |
| `insert` | Insert text at line number | `{command: "insert", path: "...", insert_line: 2, insert_text: "..."}` |
| `delete` | Delete a file or directory | `{command: "delete", path: "/memories/old.txt"}` |
| `rename` | Rename or move a file | `{command: "rename", old_path: "...", new_path: "..."}` |

### TypeScript Memory Tool Handler

```typescript
// memory-tool-handler.ts
import * as fs from "fs";
import * as path from "path";

export interface MemoryToolInput {
  command: "view" | "create" | "str_replace" | "insert" | "delete" | "rename";
  path?: string;
  file_text?: string;
  old_str?: string;
  new_str?: string;
  insert_line?: number;
  insert_text?: string;
  old_path?: string;
  new_path?: string;
}

export class MemoryToolHandler {
  private basePath: string;

  constructor(basePath: string = "./memory_storage") {
    this.basePath = basePath;
    // Ensure base directory exists
    if (!fs.existsSync(basePath)) {
      fs.mkdirSync(basePath, { recursive: true });
    }
    // Ensure /memories directory exists within base
    const memoriesDir = path.join(basePath, "memories");
    if (!fs.existsSync(memoriesDir)) {
      fs.mkdirSync(memoriesDir, { recursive: true });
    }
  }

  /**
   * Resolve and validate path - prevents directory traversal attacks
   */
  private resolvePath(inputPath: string): string {
    // Remove leading slash and resolve
    const normalizedPath = inputPath.replace(/^\//, "");
    const fullPath = path.resolve(this.basePath, normalizedPath);

    // Security: ensure path is within base directory
    if (!fullPath.startsWith(path.resolve(this.basePath))) {
      throw new Error(`Path traversal detected: ${inputPath}`);
    }

    return fullPath;
  }

  /**
   * Execute a memory tool command
   */
  execute(input: MemoryToolInput): string {
    try {
      switch (input.command) {
        case "view":
          return this.view(input.path || "/memories");

        case "create":
          if (!input.path || input.file_text === undefined) {
            return "Error: 'path' and 'file_text' are required for create";
          }
          return this.create(input.path, input.file_text);

        case "str_replace":
          if (!input.path || !input.old_str || input.new_str === undefined) {
            return "Error: 'path', 'old_str', and 'new_str' are required for str_replace";
          }
          return this.strReplace(input.path, input.old_str, input.new_str);

        case "insert":
          if (!input.path || input.insert_line === undefined || !input.insert_text) {
            return "Error: 'path', 'insert_line', and 'insert_text' are required for insert";
          }
          return this.insert(input.path, input.insert_line, input.insert_text);

        case "delete":
          if (!input.path) {
            return "Error: 'path' is required for delete";
          }
          return this.delete(input.path);

        case "rename":
          if (!input.old_path || !input.new_path) {
            return "Error: 'old_path' and 'new_path' are required for rename";
          }
          return this.rename(input.old_path, input.new_path);

        default:
          return `Error: Unknown command '${input.command}'`;
      }
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private view(inputPath: string): string {
    const fullPath = this.resolvePath(inputPath);

    if (!fs.existsSync(fullPath)) {
      return `Error: Path not found: ${inputPath}`;
    }

    const stats = fs.statSync(fullPath);

    if (stats.isDirectory()) {
      const entries = fs.readdirSync(fullPath);
      if (entries.length === 0) {
        return `Directory: ${inputPath} (empty)`;
      }
      return `Directory: ${inputPath}\n${entries.map((e) => `- ${e}`).join("\n")}`;
    }

    // File - return contents with line numbers
    const content = fs.readFileSync(fullPath, "utf-8");
    const lines = content.split("\n");
    const numbered = lines.map((line, i) => `${i + 1}: ${line}`).join("\n");
    return numbered;
  }

  private create(inputPath: string, fileText: string): string {
    const fullPath = this.resolvePath(inputPath);

    // Ensure parent directory exists
    const parentDir = path.dirname(fullPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    fs.writeFileSync(fullPath, fileText, "utf-8");
    return `File created successfully at ${inputPath}`;
  }

  private strReplace(inputPath: string, oldStr: string, newStr: string): string {
    const fullPath = this.resolvePath(inputPath);

    if (!fs.existsSync(fullPath)) {
      return `Error: File not found: ${inputPath}`;
    }

    let content = fs.readFileSync(fullPath, "utf-8");

    if (!content.includes(oldStr)) {
      return `Error: String not found in file: "${oldStr.substring(0, 50)}..."`;
    }

    content = content.replace(oldStr, newStr);
    fs.writeFileSync(fullPath, content, "utf-8");
    return `File ${inputPath} has been edited successfully`;
  }

  private insert(inputPath: string, lineNumber: number, insertText: string): string {
    const fullPath = this.resolvePath(inputPath);

    if (!fs.existsSync(fullPath)) {
      return `Error: File not found: ${inputPath}`;
    }

    const content = fs.readFileSync(fullPath, "utf-8");
    const lines = content.split("\n");

    // Insert at specified line (1-indexed)
    const insertIndex = Math.max(0, Math.min(lineNumber - 1, lines.length));
    lines.splice(insertIndex, 0, insertText);

    fs.writeFileSync(fullPath, lines.join("\n"), "utf-8");
    return `Text inserted at line ${lineNumber} in ${inputPath}`;
  }

  private delete(inputPath: string): string {
    const fullPath = this.resolvePath(inputPath);

    if (!fs.existsSync(fullPath)) {
      return `Error: Path not found: ${inputPath}`;
    }

    const stats = fs.statSync(fullPath);

    if (stats.isDirectory()) {
      fs.rmSync(fullPath, { recursive: true });
      return `Directory deleted: ${inputPath}`;
    }

    fs.unlinkSync(fullPath);
    return `File deleted: ${inputPath}`;
  }

  private rename(oldPath: string, newPath: string): string {
    const fullOldPath = this.resolvePath(oldPath);
    const fullNewPath = this.resolvePath(newPath);

    if (!fs.existsSync(fullOldPath)) {
      return `Error: Source path not found: ${oldPath}`;
    }

    // Ensure parent directory of new path exists
    const parentDir = path.dirname(fullNewPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    fs.renameSync(fullOldPath, fullNewPath);
    return `Renamed ${oldPath} to ${newPath}`;
  }

  /**
   * Clear all memory files (useful for testing)
   */
  clearAllMemory(): void {
    const memoriesDir = path.join(this.basePath, "memories");
    if (fs.existsSync(memoriesDir)) {
      fs.rmSync(memoriesDir, { recursive: true });
      fs.mkdirSync(memoriesDir, { recursive: true });
    }
  }
}
```

## Basic Memory Usage

### Example 1: Learning from a Bug

```typescript
// session-1-learn-pattern.ts
import Anthropic from "@anthropic-ai/sdk";
import { MemoryToolHandler, type MemoryToolInput } from "./memory-tool-handler";

const client = new Anthropic();
const memory = new MemoryToolHandler("./demo_memory");

// Clear previous memories for clean demo
memory.clearAllMemory();

// Sample code with a race condition bug
const codeToReview = `
"""
Concurrent web scraper with a race condition bug.
"""
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict

class WebScraper:
    def __init__(self, max_workers: int = 10):
        self.max_workers = max_workers
        self.results = []  # BUG: Shared mutable state!
        self.failed_urls = []  # BUG: Another race condition!

    def fetch_url(self, url: str) -> Dict[str, any]:
        # ... fetch logic ...
        return {"url": url, "status": 200}

    def scrape_urls(self, urls: List[str]) -> List[Dict]:
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            futures = [executor.submit(self.fetch_url, url) for url in urls]
            for future in as_completed(futures):
                result = future.result()
                if "error" in result:
                    self.failed_urls.append(result["url"])  # RACE!
                else:
                    self.results.append(result)  # RACE!
        return self.results
`;

interface MemoryToolUse {
  type: "tool_use";
  id: string;
  name: "memory";
  input: MemoryToolInput;
}

async function runSession1() {
  console.log("=".repeat(60));
  console.log("SESSION 1: Learning from a bug");
  console.log("=".repeat(60));

  const messages: Anthropic.Messages.MessageParam[] = [
    {
      role: "user",
      content: `I'm reviewing a multi-threaded web scraper that sometimes returns fewer results than expected. The count is inconsistent across runs. Can you find the issue?

\`\`\`python
${codeToReview}
\`\`\``,
    },
  ];

  // Agentic loop with memory tool
  let continueLoop = true;

  while (continueLoop) {
    const response = await client.beta.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: "You are a code reviewer. Use your memory to store patterns you learn.",
      messages,
      tools: [
        {
          type: "memory_20250818",
          name: "memory",
        },
      ],
      betas: ["context-management-2025-06-27"],
    });

    console.log(`\nTurn: Input=${response.usage.input_tokens} Output=${response.usage.output_tokens}`);

    // Process response content
    const toolUses: MemoryToolUse[] = [];
    let textContent = "";

    for (const block of response.content) {
      if (block.type === "text") {
        textContent = block.text;
      } else if (block.type === "tool_use" && block.name === "memory") {
        toolUses.push(block as MemoryToolUse);
        console.log(`Memory tool: ${(block.input as MemoryToolInput).command} ${(block.input as MemoryToolInput).path || ""}`);
      }
    }

    // Add assistant response to messages
    messages.push({ role: "assistant", content: response.content });

    // Execute tool uses if any
    if (toolUses.length > 0) {
      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = toolUses.map((toolUse) => ({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: memory.execute(toolUse.input),
      }));

      messages.push({ role: "user", content: toolResults });
    }

    // Check stop reason
    if (response.stop_reason === "end_turn") {
      continueLoop = false;
      console.log("\nFinal response:");
      console.log(textContent.substring(0, 500) + "...");
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("Session 1 complete! Pattern stored in memory.");
  console.log("=".repeat(60));
}

runSession1().catch(console.error);
```

## Cross-Conversation Learning

### Example 2: Applying Learned Pattern

```typescript
// session-2-apply-pattern.ts
import Anthropic from "@anthropic-ai/sdk";
import { MemoryToolHandler, type MemoryToolInput } from "./memory-tool-handler";

const client = new Anthropic();
const memory = new MemoryToolHandler("./demo_memory"); // Same storage path!

// Different code with similar concurrency issue
const asyncCode = `
"""
Async API client with concurrency issues.
"""
import asyncio
import aiohttp
from typing import List, Dict

class AsyncAPIClient:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.responses = []  # Shared state in async context
        self.error_count = 0  # Counter without synchronization

    async def fetch_endpoint(self, session, endpoint: str) -> Dict:
        url = f"{self.base_url}/{endpoint}"
        try:
            async with session.get(url) as response:
                return {"endpoint": endpoint, "status": response.status}
        except Exception as e:
            return {"endpoint": endpoint, "error": str(e)}

    async def fetch_all(self, endpoints: List[str]) -> List[Dict]:
        async with aiohttp.ClientSession() as session:
            tasks = [self.fetch_endpoint(session, ep) for ep in endpoints]
            for coro in asyncio.as_completed(tasks):
                result = await coro
                if "error" in result:
                    self.error_count += 1  # Not atomic!
                else:
                    self.responses.append(result)  # Race condition!
        return self.responses
`;

interface MemoryToolUse {
  type: "tool_use";
  id: string;
  name: "memory";
  input: MemoryToolInput;
}

async function runSession2() {
  console.log("=".repeat(60));
  console.log("SESSION 2: Applying learned pattern (NEW conversation)");
  console.log("=".repeat(60));

  const messages: Anthropic.Messages.MessageParam[] = [
    {
      role: "user",
      content: `Review this API client code:

\`\`\`python
${asyncCode}
\`\`\``,
    },
  ];

  let continueLoop = true;

  while (continueLoop) {
    const response = await client.beta.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: "You are a code reviewer. Check your memory for patterns you've learned.",
      messages,
      tools: [
        {
          type: "memory_20250818",
          name: "memory",
        },
      ],
      betas: ["context-management-2025-06-27"],
    });

    console.log(`\nTurn: Input=${response.usage.input_tokens} Output=${response.usage.output_tokens}`);

    const toolUses: MemoryToolUse[] = [];
    let textContent = "";

    for (const block of response.content) {
      if (block.type === "text") {
        textContent = block.text;
      } else if (block.type === "tool_use" && block.name === "memory") {
        toolUses.push(block as MemoryToolUse);
        console.log(`Memory tool: ${(block.input as MemoryToolInput).command} ${(block.input as MemoryToolInput).path || ""}`);
      }
    }

    messages.push({ role: "assistant", content: response.content });

    if (toolUses.length > 0) {
      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = toolUses.map((toolUse) => ({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: memory.execute(toolUse.input),
      }));

      messages.push({ role: "user", content: toolResults });
    }

    if (response.stop_reason === "end_turn") {
      continueLoop = false;
      console.log("\nFinal response:");
      console.log(textContent.substring(0, 800) + "...");
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("Session 2 complete!");
  console.log("Notice: Claude checked memory FIRST, found the pattern, and applied it immediately!");
  console.log("=".repeat(60));
}

runSession2().catch(console.error);
```

## Context Editing Configuration

Context editing is applied **server-side** before the prompt reaches Claude. Your client maintains the full conversation history.

### Tool Result Clearing

```typescript
// context-editing-example.ts
import Anthropic from "@anthropic-ai/sdk";
import { MemoryToolHandler, type MemoryToolInput } from "./memory-tool-handler";

const client = new Anthropic();
const memory = new MemoryToolHandler("./demo_memory");

// Context management configuration
const contextManagement: Anthropic.Beta.Messages.MessageCreateParamsNonStreaming["context_management"] = {
  edits: [
    {
      type: "clear_tool_uses_20250919",
      // Trigger when context exceeds this threshold
      trigger: {
        type: "input_tokens",
        value: 30000,
      },
      // Keep the N most recent tool uses
      keep: {
        type: "tool_uses",
        value: 5,
      },
      // Clear at least this many tokens (for cache efficiency)
      clear_at_least: {
        type: "input_tokens",
        value: 5000,
      },
      // Never clear memory tool results
      exclude_tools: ["memory"],
    },
  ],
};

async function runWithContextEditing() {
  const messages: Anthropic.Messages.MessageParam[] = [
    {
      role: "user",
      content: "Review multiple code files for concurrency issues.",
    },
  ];

  const response = await client.beta.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: "You are a code reviewer.",
    messages,
    tools: [
      {
        type: "memory_20250818",
        name: "memory",
      },
    ],
    betas: ["context-management-2025-06-27"],
    context_management: contextManagement,
  });

  // Check if context editing was applied
  if (response.context_management?.applied_edits) {
    for (const edit of response.context_management.applied_edits) {
      if (edit.type === "clear_tool_uses_20250919") {
        console.log(`Context editing: Cleared ${edit.cleared_tool_uses} tool uses`);
        console.log(`Tokens saved: ${edit.cleared_input_tokens}`);
      }
    }
  }

  return response;
}
```

### Thinking Block Clearing

When using extended thinking, manage thinking blocks to control context growth:

```typescript
// thinking-management.ts
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const contextManagement: Anthropic.Beta.Messages.MessageCreateParamsNonStreaming["context_management"] = {
  edits: [
    // Thinking clearing MUST come first when combining strategies
    {
      type: "clear_thinking_20251015",
      keep: {
        type: "thinking_turns",
        value: 2, // Keep last 2 turns of thinking
      },
    },
    {
      type: "clear_tool_uses_20250919",
      trigger: {
        type: "input_tokens",
        value: 50000,
      },
      keep: {
        type: "tool_uses",
        value: 5,
      },
    },
  ],
};

async function runWithThinking() {
  const response = await client.beta.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [{ role: "user", content: "Analyze this complex system..." }],
    // Enable extended thinking
    thinking: {
      type: "enabled",
      budget_tokens: 10000,
    },
    betas: ["context-management-2025-06-27"],
    context_management: contextManagement,
  });

  // Check applied edits
  if (response.context_management?.applied_edits) {
    for (const edit of response.context_management.applied_edits) {
      if (edit.type === "clear_thinking_20251015") {
        console.log(`Cleared ${edit.cleared_thinking_turns} thinking turns`);
        console.log(`Tokens saved: ${edit.cleared_input_tokens}`);
      }
    }
  }

  return response;
}
```

### Preserving Thinking for Cache Hits

To maximize prompt cache hits, keep all thinking blocks:

```typescript
const contextManagement = {
  edits: [
    {
      type: "clear_thinking_20251015",
      keep: "all", // Keep all thinking blocks for cache hits
    },
  ],
};
```

## Code Review Assistant Demo

Complete implementation of a code review assistant with memory and context management:

```typescript
// code-review-assistant.ts
import Anthropic from "@anthropic-ai/sdk";
import { MemoryToolHandler, type MemoryToolInput } from "./memory-tool-handler";

const MODEL = "claude-sonnet-4-6";

interface ReviewSession {
  messages: Anthropic.Messages.MessageParam[];
  totalInputTokens: number;
  totalOutputTokens: number;
  turnCount: number;
}

export class CodeReviewAssistant {
  private client: Anthropic;
  private memory: MemoryToolHandler;
  private contextManagement: Anthropic.Beta.Messages.MessageCreateParamsNonStreaming["context_management"];

  constructor(memoryStoragePath: string = "./memory_storage") {
    this.client = new Anthropic();
    this.memory = new MemoryToolHandler(memoryStoragePath);

    // Configure context management
    this.contextManagement = {
      edits: [
        {
          type: "clear_thinking_20251015",
          keep: { type: "thinking_turns", value: 1 },
        },
        {
          type: "clear_tool_uses_20250919",
          trigger: { type: "input_tokens", value: 35000 },
          keep: { type: "tool_uses", value: 3 },
          clear_at_least: { type: "input_tokens", value: 5000 },
          exclude_tools: ["memory"],
        },
      ],
    };
  }

  private getSystemPrompt(): string {
    return `You are an expert code reviewer specializing in concurrency, security, and best practices.

WORKFLOW:
1. ALWAYS check your memory first for relevant patterns
2. Analyze the code for issues
3. Store any new patterns you discover in memory
4. Provide detailed, actionable feedback

MEMORY USAGE:
- Check /memories at the start of each review
- Store patterns in organized files like /memories/concurrency_patterns.md
- Update existing patterns when you learn variations
- Reference stored patterns in your explanations

Be thorough but concise. Focus on critical issues first.`;
  }

  async reviewCode(
    code: string,
    filename: string,
    description: string = ""
  ): Promise<{ response: string; session: ReviewSession }> {
    const session: ReviewSession = {
      messages: [],
      totalInputTokens: 0,
      totalOutputTokens: 0,
      turnCount: 0,
    };

    // Build initial message
    let userContent = `Review this code file: ${filename}`;
    if (description) {
      userContent += `\n\nContext: ${description}`;
    }
    userContent += `\n\n\`\`\`\n${code}\n\`\`\``;

    session.messages.push({ role: "user", content: userContent });

    let finalResponse = "";
    let continueLoop = true;

    while (continueLoop) {
      const response = await this.client.beta.messages.create({
        model: MODEL,
        max_tokens: 4096,
        system: this.getSystemPrompt(),
        messages: session.messages,
        tools: [{ type: "memory_20250818", name: "memory" }],
        betas: ["context-management-2025-06-27"],
        context_management: this.contextManagement,
        thinking: {
          type: "enabled",
          budget_tokens: 8000,
        },
      });

      session.turnCount++;
      session.totalInputTokens += response.usage.input_tokens;
      session.totalOutputTokens += response.usage.output_tokens;

      // Log context management if applied
      if (response.context_management?.applied_edits) {
        for (const edit of response.context_management.applied_edits) {
          if (edit.type === "clear_tool_uses_20250919") {
            console.log(`  Context editing: Cleared ${edit.cleared_tool_uses} tool uses, saved ${edit.cleared_input_tokens} tokens`);
          }
          if (edit.type === "clear_thinking_20251015") {
            console.log(`  Context editing: Cleared ${edit.cleared_thinking_turns} thinking turns, saved ${edit.cleared_input_tokens} tokens`);
          }
        }
      }

      // Process response
      const toolUses: Array<{ id: string; input: MemoryToolInput }> = [];

      for (const block of response.content) {
        if (block.type === "text") {
          finalResponse = block.text;
        } else if (block.type === "thinking") {
          console.log(`  Thinking: ${block.thinking.substring(0, 100)}...`);
        } else if (block.type === "tool_use" && block.name === "memory") {
          const input = block.input as MemoryToolInput;
          toolUses.push({ id: block.id, input });
          console.log(`  Memory: ${input.command} ${input.path || ""}`);
        }
      }

      session.messages.push({ role: "assistant", content: response.content });

      // Execute tool uses
      if (toolUses.length > 0) {
        const results: Anthropic.Messages.ToolResultBlockParam[] = toolUses.map((tu) => ({
          type: "tool_result",
          tool_use_id: tu.id,
          content: this.memory.execute(tu.input),
        }));
        session.messages.push({ role: "user", content: results });
      }

      if (response.stop_reason === "end_turn") {
        continueLoop = false;
      }
    }

    return { response: finalResponse, session };
  }

  clearMemory(): void {
    this.memory.clearAllMemory();
  }
}

// Demo usage
async function runDemo() {
  const assistant = new CodeReviewAssistant("./demo_memory");

  // Clear for fresh demo
  assistant.clearMemory();

  // Session 1: Review code with race condition
  console.log("\n" + "=".repeat(60));
  console.log("SESSION 1: Learning concurrency pattern");
  console.log("=".repeat(60));

  const threadedCode = `
class DataProcessor:
    def __init__(self):
        self.results = []
        self.errors = []

    def process_batch(self, items):
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(self.process_item, item) for item in items]
            for future in as_completed(futures):
                try:
                    result = future.result()
                    self.results.append(result)  # Race condition!
                except Exception as e:
                    self.errors.append(str(e))  # Race condition!
        return self.results
`;

  const { response: response1, session: session1 } = await assistant.reviewCode(
    threadedCode,
    "data_processor.py",
    "Multi-threaded batch processor that sometimes loses results"
  );

  console.log(`\nSession 1 Stats: ${session1.turnCount} turns, ${session1.totalInputTokens} input tokens`);
  console.log("\nReview Summary:");
  console.log(response1.substring(0, 500) + "...");

  // Session 2: New conversation, apply learned pattern
  console.log("\n" + "=".repeat(60));
  console.log("SESSION 2: Applying learned pattern (NEW conversation)");
  console.log("=".repeat(60));

  const asyncCode = `
class AsyncDataFetcher:
    def __init__(self):
        self.data = []
        self.failed_count = 0

    async def fetch_all(self, urls):
        async with aiohttp.ClientSession() as session:
            tasks = [self.fetch_url(session, url) for url in urls]
            for coro in asyncio.as_completed(tasks):
                result = await coro
                if result.get("error"):
                    self.failed_count += 1
                else:
                    self.data.append(result)
        return self.data
`;

  const { response: response2, session: session2 } = await assistant.reviewCode(
    asyncCode,
    "async_fetcher.py",
    "Async data fetcher"
  );

  console.log(`\nSession 2 Stats: ${session2.turnCount} turns, ${session2.totalInputTokens} input tokens`);
  console.log("\nReview (with learned pattern):");
  console.log(response2.substring(0, 500) + "...");

  console.log("\n" + "=".repeat(60));
  console.log("DEMO COMPLETE");
  console.log("=".repeat(60));
  console.log("\nKey observations:");
  console.log("1. Session 2 checked memory FIRST and found the concurrency pattern");
  console.log("2. Response was faster because Claude applied stored knowledge");
  console.log("3. Memory persists across completely separate conversations");
}

runDemo().catch(console.error);
```

## Alternative: Claude Agent SDK with MCP

For the full Claude Code agent experience with MCP tools, use the Claude Agent SDK:

```typescript
// mcp-memory-server.ts
import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod/v4";
import * as fs from "fs";
import * as path from "path";

const MEMORY_BASE_PATH = "./agent_memory";

// Ensure directories exist
if (!fs.existsSync(MEMORY_BASE_PATH)) {
  fs.mkdirSync(MEMORY_BASE_PATH, { recursive: true });
}
if (!fs.existsSync(path.join(MEMORY_BASE_PATH, "memories"))) {
  fs.mkdirSync(path.join(MEMORY_BASE_PATH, "memories"), { recursive: true });
}

function resolvePath(inputPath: string): string {
  const normalized = inputPath.replace(/^\//, "");
  const fullPath = path.resolve(MEMORY_BASE_PATH, normalized);
  if (!fullPath.startsWith(path.resolve(MEMORY_BASE_PATH))) {
    throw new Error("Path traversal detected");
  }
  return fullPath;
}

export const memoryServer = createSdkMcpServer({
  name: "memory-tools",
  version: "1.0.0",
  tools: [
    tool(
      "view_memory",
      "View a file or directory in memory storage",
      {
        path: z.string().describe("Path to view (e.g., /memories or /memories/patterns.md)"),
      },
      async ({ path: inputPath }) => {
        const fullPath = resolvePath(inputPath);

        if (!fs.existsSync(fullPath)) {
          return {
            content: [{ type: "text", text: `Path not found: ${inputPath}` }],
          };
        }

        const stats = fs.statSync(fullPath);

        if (stats.isDirectory()) {
          const entries = fs.readdirSync(fullPath);
          return {
            content: [
              {
                type: "text",
                text: entries.length === 0
                  ? `Directory: ${inputPath} (empty)`
                  : `Directory: ${inputPath}\n${entries.map((e) => `- ${e}`).join("\n")}`,
              },
            ],
          };
        }

        const content = fs.readFileSync(fullPath, "utf-8");
        const numbered = content
          .split("\n")
          .map((line, i) => `${i + 1}: ${line}`)
          .join("\n");

        return { content: [{ type: "text", text: numbered }] };
      }
    ),

    tool(
      "write_memory",
      "Create or overwrite a memory file",
      {
        path: z.string().describe("Path to the file (e.g., /memories/patterns.md)"),
        content: z.string().describe("Content to write"),
      },
      async ({ path: inputPath, content }) => {
        const fullPath = resolvePath(inputPath);
        const parentDir = path.dirname(fullPath);

        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir, { recursive: true });
        }

        fs.writeFileSync(fullPath, content, "utf-8");

        return {
          content: [{ type: "text", text: `File created: ${inputPath}` }],
        };
      }
    ),

    tool(
      "update_memory",
      "Replace text in a memory file",
      {
        path: z.string().describe("Path to the file"),
        old_text: z.string().describe("Text to find and replace"),
        new_text: z.string().describe("Replacement text"),
      },
      async ({ path: inputPath, old_text, new_text }) => {
        const fullPath = resolvePath(inputPath);

        if (!fs.existsSync(fullPath)) {
          return {
            content: [{ type: "text", text: `File not found: ${inputPath}` }],
          };
        }

        let content = fs.readFileSync(fullPath, "utf-8");

        if (!content.includes(old_text)) {
          return {
            content: [{ type: "text", text: `Text not found in file` }],
          };
        }

        content = content.replace(old_text, new_text);
        fs.writeFileSync(fullPath, content, "utf-8");

        return {
          content: [{ type: "text", text: `File updated: ${inputPath}` }],
        };
      }
    ),

    tool(
      "delete_memory",
      "Delete a memory file or directory",
      {
        path: z.string().describe("Path to delete"),
      },
      async ({ path: inputPath }) => {
        const fullPath = resolvePath(inputPath);

        if (!fs.existsSync(fullPath)) {
          return {
            content: [{ type: "text", text: `Path not found: ${inputPath}` }],
          };
        }

        const stats = fs.statSync(fullPath);

        if (stats.isDirectory()) {
          fs.rmSync(fullPath, { recursive: true });
        } else {
          fs.unlinkSync(fullPath);
        }

        return {
          content: [{ type: "text", text: `Deleted: ${inputPath}` }],
        };
      }
    ),
  ],
});
```

### Using the MCP Memory Server

```typescript
// agent-with-memory.ts
import { query, type SDKResultMessage } from "@anthropic-ai/claude-agent-sdk";
import { memoryServer } from "./mcp-memory-server";

async function runAgentWithMemory() {
  const systemPrompt = `You are a code review assistant with persistent memory.

WORKFLOW:
1. Check /memories at the start using view_memory
2. Analyze code for issues
3. Store patterns with write_memory or update_memory
4. Reference stored knowledge in your reviews

Be thorough and learn from each review.`;

  const queryIterator = query({
    prompt: systemPrompt,
    options: {
      model: "claude-sonnet-4-6",
      mcpServers: {
        memory: memoryServer,
      },
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
    },
  });

  for await (const message of queryIterator) {
    if (message.type === "assistant") {
      console.log(`Turn: ${message.message.usage.input_tokens} input tokens`);
    }

    if (message.type === "result") {
      const result = message as SDKResultMessage;
      console.log(`Total cost: $${result.total_cost_usd.toFixed(4)}`);
    }
  }
}

runAgentWithMemory().catch(console.error);
```

## Best Practices & Security

### Memory Management

**Do:**
- Store task-relevant patterns, not raw conversation history
- Organize with clear directory structure (`/memories/concurrency/`, `/memories/security/`)
- Use descriptive file names
- Periodically review and clean up memory

**Don't:**
- Store sensitive information (passwords, API keys, PII)
- Let memory grow unbounded
- Store everything indiscriminately

### Security: Path Traversal Protection

Always validate paths to prevent directory traversal attacks:

```typescript
private resolvePath(inputPath: string): string {
  const normalizedPath = inputPath.replace(/^\//, "");
  const fullPath = path.resolve(this.basePath, normalizedPath);

  // CRITICAL: Ensure path is within allowed directory
  if (!fullPath.startsWith(path.resolve(this.basePath))) {
    throw new Error(`Path traversal detected: ${inputPath}`);
  }

  return fullPath;
}
```

### Security: Memory Poisoning

Memory files are read back into Claude's context, making them a potential vector for prompt injection.

**Mitigation strategies:**

1. **Content Sanitization**: Filter dangerous patterns before storing
2. **Memory Scope Isolation**: Per-user/per-project isolation
3. **Memory Auditing**: Log and scan all memory operations
4. **Prompt Engineering**: Instruct Claude to ignore instructions in memory

### Context Editing Best Practices

1. **Set appropriate thresholds**: Use 30-50k tokens for most use cases
2. **Exclude critical tools**: Use `exclude_tools` to preserve important context
3. **Clear enough tokens**: Set `clear_at_least` to make cache invalidation worthwhile
4. **Order matters**: `clear_thinking` must come before `clear_tool_uses`

## Summary

| Feature | Raw Anthropic SDK | Claude Agent SDK |
|---------|-------------------|------------------|
| **Memory Tool** | `{type: "memory_20250818"}` | MCP server with custom tools |
| **Context Editing** | `context_management` parameter | Automatic compaction |
| **Extended Thinking** | `thinking` parameter | Built-in |
| **Best For** | Direct API control | Full agent experience |

Both approaches enable:
- Cross-conversation learning via persistent memory
- Long-running sessions via context management
- Patterns that improve over time

Choose the **Raw SDK** for direct control and simpler integration.
Choose the **Claude Agent SDK** for the full Claude Code agent experience with MCP tools, file access, and built-in compaction.
