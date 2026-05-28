# Research Agent

## Pattern Overview

**Overall:** Hierarchical multi-agent orchestration with role-based
specialization and delegation.

**Key Characteristics:**

- **Lead agent coordination**: Single entry point (lead agent) that decomposes
  complex research tasks into subtasks
- **Parallel subagent spawning**: Multiple specialized agents work
  simultaneously on different research angles
- **Progressive workflow**: Sequential stages (research → analysis → reporting)
  with dependencies
- **Hook-based instrumentation**: Pre/post-tool-use hooks capture all subagent
  activity without modifying agent code
- **File-based data pipeline**: Agents communicate through shared files in
  `files/` directory

## Layers

**Orchestration Layer:**

- Purpose: Decompose user requests, spawn subagents, coordinate workflow
  progression
- Location: `research_agent/agent.py` (main event loop),
  `research_agent/prompts/lead_agent.txt` (orchestration strategy)
- Contains: AsyncIO event loop, ClaudeSDKClient initialization, hook setup,
  interactive chat interface
- Depends on: Claude Agent SDK, subagent definitions, prompts
- Used by: User interaction loop

**Subagent Execution Layer:**

- Purpose: Execute specialized tasks (research, analysis, reporting) with
  delegated tools
- Location: Managed by Claude Agent SDK via `AgentDefinition` (lines 53-91 in
  `agent.py`)
- Contains: Three agent types (researcher, data-analyst, report-writer) with
  specific prompts and tool allowlists
- Depends on: SDK tool ecosystem (WebSearch, Write, Glob, Read, Bash, Skill),
  external APIs
- Used by: Lead agent via Task tool, orchestrated through message stream

**Tracking & Instrumentation Layer:**

- Purpose: Monitor all tool invocations, associate calls with originating
  subagent, log structured audit trail
- Location: `research_agent/utils/subagent_tracker.py` (hook handlers and
  session management)
- Contains: `SubagentTracker` (session/call tracking), `SubagentSession`
  (per-subagent metadata), `ToolCallRecord` (individual call logs)
- Depends on: Hook system (PreToolUse/PostToolUse), JSONL logging
- Used by: Agent event loop (hook registration), message processor (subagent
  spawn detection)

**Message Processing Layer:**

- Purpose: Parse assistant message stream, detect subagent spawning events,
  update tracker context
- Location: `research_agent/utils/message_handler.py` (process_assistant_message
  function)
- Contains: Message block parsing (TextBlock, ToolUseBlock), Task tool
  interception
- Depends on: Message object structure (content blocks, parent_tool_use_id),
  tracker API
- Used by: Main event loop (async receive_response stream)

**Utilities Layer:**

- Purpose: Session management, transcript I/O, logging configuration
- Location: `research_agent/utils/transcript.py`
- Contains: `TranscriptWriter` (dual console/file output), `setup_session`
  (directory structure)
- Depends on: Filesystem, logging module
- Used by: Main agent initialization, all message processing

## Data Flow

**User Query → Research → Analysis → Reporting:**

1. **Initiation**: User enters query in interactive chat (line 131 in
   `agent.py`)
2. **Orchestration**: Query sent to lead agent via
   `client.query(prompt=user_input)` (line 142)
3. **Decomposition**: Lead agent analyzes topic, spawns 2-4 researcher subagents
   via Task tool in parallel (orchestrated by `lead_agent.txt` lines 27-38)
4. **Researcher Execution**: Each researcher subagent:
   - Executes WebSearch calls (tracked by pre_tool_use_hook)
   - Extracts quantitative data from search results
   - Writes findings to `files/research_notes/{topic}.md` via Write tool
   - Completion detected by message stream
5. **Data Analysis**: Lead agent spawns data-analyst subagent after researchers
   complete:
   - Reads all `files/research_notes/*.md` via Glob/Read
   - Parses quantitative data
   - Generates visualizations via Bash (Python/matplotlib)
   - Saves charts to `files/charts/` and summary to `files/data/data_summary.md`
6. **Report Generation**: Lead agent spawns report-writer subagent:
   - Reads research notes, data summary, chart files
   - Generates PDF via Bash (Python/reportlab)
   - Saves final report to `files/reports/{topic}_report_YYYYMMDD.pdf`
7. **Completion**: User receives file paths; session logs saved to
   `logs/session_YYYYMMDD_HHMMSS/`

**State Management:**

- **Session State**: Maintained in `SubagentTracker.sessions` dict (key:
  parent_tool_use_id)
- **Execution Context**: `SubagentTracker._current_parent_id` tracks which
  subagent is currently executing (updated via `set_current_context()` in
  message handler)
- **Call Records**: `SubagentTracker.tool_call_records` map (key: tool_use_id)
  enables efficient post-hook lookup
- **Persistent Logging**: Tool calls logged to JSONL immediately (no in-memory
  buffering)

## Key Abstractions

**SubagentDefinition (SDK-provided):**

- Purpose: Declarative specification of subagent capabilities, constraints, and
  behavior
- Examples: Lines 54-90 in `agent.py` (researcher, data-analyst, report-writer
  definitions)
- Pattern: Each agent specifies `description`, `tools`, `prompt`, `model`
  - `description`: User-facing hint for when to spawn this agent
  - `tools`: Allowlist of tools available to agent (e.g., ["WebSearch", "Write"]
    for researcher)
  - `prompt`: System prompt controlling agent behavior
  - `model`: Model size (haiku for cost efficiency)

**SubagentTracker:**

- Purpose: Centralized tracking system that maps tool calls to originating
  subagents without modifying agent code
- Pattern: Hook-based interception (pre_tool_use_hook at line 181,
  post_tool_use_hook at line 234)
  - Pre-hook: Creates ToolCallRecord when tool invoked
  - Post-hook: Enriches record with output/errors
- Enables: Query-able audit trail (`tool_calls.jsonl`), per-subagent metrics

**TranscriptWriter:**

- Purpose: Dual-output logging (console + file) with optional file-only writes
- Pattern: Methods `write()` (both), `write_to_file()` (file only), context
  manager support
- Enables: User-facing console output + detailed file logging without redundancy

## Entry Points

**Interactive Chat Loop:**

- Location: `research_agent/agent.py` lines 127-151
- Triggers: User input or programmatic `query()` call
- Responsibilities:
  1. Load environment and validate API key (lines 31-35)
  2. Initialize session, transcript, tracker (lines 38-50)
  3. Loop: read user input → send to agent → stream response → process message
     blocks

**Agent Instantiation:**

- Location: `research_agent/agent.py` lines 109-117 (`ClaudeAgentOptions`)
- Triggers: Program startup
- Responsibilities:
  1. Load prompts from `research_agent/prompts/` directory (lines 44-47)
  2. Configure ClaudeSDKClient with:
     - System prompt (lead agent behavior)
     - Subagent definitions (researcher, data-analyst, report-writer)
     - Hook matchers (all tools tracked)
     - Allowed tools (Task only for lead agent, diverse for subagents)

**Hook Registration:**

- Location: `research_agent/agent.py` lines 94-107
- Triggers: Client initialization
- Responsibilities: Register PreToolUse/PostToolUse hooks that call tracker
  methods

## Error Handling

**Strategy:** Non-blocking observation with logging. Errors in tool execution
tracked but don't halt workflow.

**Patterns:**

- **Tool Errors**: Captured in PostToolUse hook (line 246-251 in
  `subagent_tracker.py`)
  - Error stored in `ToolCallRecord.error`
  - Logged to console/JSONL with warning level
  - Execution continues (hook returns `{'continue_': True}` line 271)
- **Missing Files**: Subagents fail gracefully when Glob/Read return empty
  (handled by agent retry logic)
- **API Failures**: WebSearch failures logged but don't block other researchers
  (parallel execution isolation)

## Cross-Cutting Concerns

**Logging:**

- **Framework**: Python `logging` module + custom TranscriptWriter
- **Approach**:
  - SDK hooks trigger `logger.info()` calls (lines 107-111 in
    `subagent_tracker.py`)
  - TranscriptWriter writes to both stdout and `logs/session_*/transcript.txt`
  - JSONL structured logs to `logs/session_*/tool_calls.jsonl` for analytics
  - HTTP debug logs suppressed (line 26 in `transcript.py`)

**Validation:**

- **API Key**: Required at startup (lines 31-35 in `agent.py`), error if missing
- **Prompt Files**: Loaded at initialization (lines 44-47), FileNotFoundError if
  missing
- **Tool Allowlists**: Enforced by SDK (Lead agent limited to Task tool only)

**Authentication:**

- **Pattern**: ANTHROPIC_API_KEY read from environment (line 31 in `agent.py`)
- **Scope**: Applied globally to ClaudeSDKClient (all subagents inherit auth)
- **SDK-managed**: No manual token handling in application code
