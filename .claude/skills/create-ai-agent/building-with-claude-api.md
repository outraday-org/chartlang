# Claude API Reference

Practical reference for building with the Claude API. Code examples and key
patterns.

## Model Selection

| Model  | Best For                           | Speed | Cost    |
| ------ | ---------------------------------- | ----- | ------- |
| Opus   | Complex reasoning, multi-step      | Slow  | Highest |
| Sonnet | Balanced tasks, coding             | Mid   | Mid     |
| Haiku  | Real-time, high-volume, no reason  | Fast  | Lowest  |

**Selection rule:** Intelligence priority -> Opus. Speed priority -> Haiku.
Balanced -> Sonnet. Most apps use multiple models based on task.

---

## Basic API Request

```python
from anthropic import Anthropic

client = Anthropic()  # Uses ANTHROPIC_API_KEY env var

message = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    messages=[
        {"role": "user", "content": "What is quantum computing?"}
    ]
)

# Extract text
text = message.content[0].text
```

**Required params:** `model`, `max_tokens`, `messages`

**Response structure:**

- `message.content` - List of content blocks
- `message.content[0].text` - First text block
- `message.usage` - Token counts
- `message.stop_reason` - Why generation stopped

---

## Multi-Turn Conversations

API stores nothing. Send full history with every request.

```python
messages = []

def add_user_message(messages, text):
    messages.append({"role": "user", "content": text})

def add_assistant_message(messages, text):
    messages.append({"role": "assistant", "content": text})

def chat(messages):
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=messages
    )
    return response.content[0].text

# Usage
add_user_message(messages, "What is Python?")
response = chat(messages)
add_assistant_message(messages, response)
add_user_message(messages, "What about JavaScript?")  # Claude remembers context
response = chat(messages)
```

---

## System Prompts

Control HOW Claude responds, not WHAT it responds.

```python
message = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    system="You are a patient math tutor. Give hints, not answers.",
    messages=[{"role": "user", "content": "How do I solve 2x + 5 = 11?"}]
)
```

---

## Temperature

Controls randomness (0-1):

- `0` - Deterministic, always highest probability token
- `1` - More creative/varied output

```python
message = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    temperature=0,  # Factual tasks
    messages=[...]
)
```

**Guidelines:**

- Low (0-0.3): Data extraction, factual tasks
- High (0.7-1): Creative writing, brainstorming

---

## Response Streaming

Display responses chunk-by-chunk as generated.

```python
# Simple streaming
with client.messages.stream(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Write a story"}]
) as stream:
    for text in stream.text_stream:
        print(text, end="", flush=True)

# Get final message for storage
final = stream.get_final_message()
```

**Event types:**

- `message_start` - Initial acknowledgment
- `content_block_delta` - Text chunks (most important)
- `message_stop` - Generation complete

---

## Controlling Output

### Pre-filling Assistant Messages

Steer response direction by providing partial assistant message.

```python
messages = [
    {"role": "user", "content": "Is coffee or tea better?"},
    {"role": "assistant", "content": "Coffee is better because"}  # Pre-fill
]

response = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    messages=messages
)

# Claude continues from "Coffee is better because..."
full_response = "Coffee is better because" + response.content[0].text
```

### Stop Sequences

Force Claude to halt at specific string.

```python
response = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    stop_sequences=[", five"],
    messages=[{"role": "user", "content": "Count from one to ten"}]
)
# Output: "one, two, three, four" (stops before ", five")
```

### Structured Data Extraction

Combine pre-fill + stop sequence for clean output.

```python
messages = [
    {"role": "user", "content": "Extract the key points as JSON"},
    {"role": "assistant", "content": "```json"}  # Pre-fill
]

response = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    stop_sequences=["```"],  # Stop at closing fence
    messages=messages
)
# Response contains only raw JSON, no markdown wrapper
```

---

## Tool Use

### Tool Schema Structure

```python
from anthropic.types import ToolParam

get_weather_schema = ToolParam(
    name="get_weather",
    description="""Get current weather for a location.

When to use: User asks about weather conditions.
Returns: Temperature, conditions, humidity.""",
    input_schema={
        "type": "object",
        "properties": {
            "location": {
                "type": "string",
                "description": "City name or coordinates"
            },
            "units": {
                "type": "string",
                "enum": ["celsius", "fahrenheit"],
                "description": "Temperature units"
            }
        },
        "required": ["location"]
    }
)
```

### Tool Execution Loop

```python
def run_conversation(user_message, tools, tool_functions):
    messages = [{"role": "user", "content": user_message}]

    while True:
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            tools=tools,
            messages=messages
        )

        # Add assistant response to history
        messages.append({"role": "assistant", "content": response.content})

        # Check if done
        if response.stop_reason != "tool_use":
            return response.content[0].text

        # Execute tools
        tool_results = []
        for block in response.content:
            if block.type == "tool_use":
                result = tool_functions[block.name](**block.input)
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": str(result)
                })

        # Add results as user message
        messages.append({"role": "user", "content": tool_results})
```

### Force Tool Calling

```python
response = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    tools=[extraction_tool],
    tool_choice={"type": "tool", "name": "extract_data"},  # Force this tool
    messages=[...]
)
# Access structured data from: response.content[0].input
```

### Batch Tool (Parallel Execution)

Enable Claude to run multiple tools in parallel.

```python
batch_tool_schema = ToolParam(
    name="batch",
    description="Run multiple tools in parallel",
    input_schema={
        "type": "object",
        "properties": {
            "invocations": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "tool_name": {"type": "string"},
                        "arguments": {"type": "string"}  # JSON string
                    }
                }
            }
        }
    }
)

def run_batch(invocations, tool_functions):
    results = []
    for inv in invocations:
        args = json.loads(inv["arguments"])
        result = tool_functions[inv["tool_name"]](**args)
        results.append(result)
    return results
```

---

## Built-in Tools

### Web Search

```python
response = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    tools=[{
        "type": "web_search_20250305",
        "name": "web_search",
        "max_uses": 5,  # Limit searches
        "allowed_domains": ["docs.python.org"]  # Optional restriction
    }],
    messages=[{"role": "user", "content": "What's new in Python 3.12?"}]
)
```

### Text Editor Tool

Built-in schema for file operations (read, write, create, replace).

```python
tools = [{
    "type": "text_editor_20250429",
    "name": "text_editor"
}]
# Schema auto-expands. You implement the actual file operations.
```

---

## RAG Pipeline

### Text Chunking Strategies

**1. Size-based (most common):**

```python
def chunk_by_size(text, chunk_size=1000, overlap=200):
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start = end - overlap
    return chunks
```

**2. Structure-based (for markdown/HTML):**

```python
def chunk_by_headers(text):
    return text.split("\n## ")  # Split on h2 headers
```

**3. Semantic-based:** Group consecutive sentences by similarity.

### Embeddings + Vector Search

```python
from voyageai import Client as VoyageClient

voyage = VoyageClient()

# Generate embeddings
embeddings = voyage.embed(chunks, model="voyage-2")

# Store in vector DB (pseudo-code)
for chunk, embedding in zip(chunks, embeddings):
    vector_store.add(embedding, {"content": chunk})

# Query
query_embedding = voyage.embed([user_query], model="voyage-2")[0]
results = vector_store.search(query_embedding, top_k=5)
```

### Hybrid Search (Vector + BM25)

Combine semantic search with keyword matching using Reciprocal Rank Fusion.

```python
def hybrid_search(query, vector_store, bm25_store, top_k=5):
    vector_results = vector_store.search(query, top_k)
    bm25_results = bm25_store.search(query, top_k)

    # Reciprocal Rank Fusion
    scores = {}
    for rank, doc in enumerate(vector_results):
        scores[doc.id] = scores.get(doc.id, 0) + 1 / (rank + 1)
    for rank, doc in enumerate(bm25_results):
        scores[doc.id] = scores.get(doc.id, 0) + 1 / (rank + 1)

    return sorted(scores.keys(), key=lambda x: scores[x], reverse=True)[:top_k]
```

### Reranking

Use LLM to reorder results by relevance.

```python
def rerank(query, documents):
    prompt = f"""Rank these documents by relevance to: "{query}"
Return document IDs in order of relevance.
Documents: {documents}"""

    response = client.messages.create(
        model="claude-haiku-3-5-20241022",
        max_tokens=100,
        messages=[{"role": "user", "content": prompt}]
    )
    return parse_ids(response.content[0].text)
```

### Contextual Retrieval

Add context to chunks before embedding.

```python
def add_context(chunk, source_doc):
    prompt = f"""Document: {source_doc[:2000]}
Chunk: {chunk}

Write a brief context sentence explaining this chunk's role in the document."""

    response = client.messages.create(
        model="claude-haiku-3-5-20241022",
        max_tokens=100,
        messages=[{"role": "user", "content": prompt}]
    )
    return response.content[0].text + "\n\n" + chunk
```

---

## Prompt Caching

**90% cost reduction** for repeated content.

### Rules

- Cache duration: 1 hour
- Minimum: 1024 tokens
- Max breakpoints: 4 per request
- Order: tools -> system prompt -> messages

### Implementation

```python
# Cache system prompt
response = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    system=[{
        "type": "text",
        "text": "Your long system prompt here...",
        "cache_control": {"type": "ephemeral"}
    }],
    messages=[...]
)

# Cache tools (add to last tool in list)
tools_with_cache = tools.copy()
tools_with_cache[-1] = {**tools[-1], "cache_control": {"type": "ephemeral"}}

# Check usage
print(response.usage.cache_creation_input_tokens)  # First request
print(response.usage.cache_read_input_tokens)      # Subsequent requests
```

---

## Extended Thinking

Enable reasoning before response.

```python
response = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=16000,
    thinking={
        "type": "enabled",
        "budget_tokens": 10000  # Min 1024
    },
    messages=[...]
)

# Response has thinking block + text block
for block in response.content:
    if block.type == "thinking":
        print("Reasoning:", block.thinking)
    elif block.type == "text":
        print("Answer:", block.text)
```

**Note:** `max_tokens` must exceed `budget_tokens`.

---

## Image/PDF Support

### Images

```python
import base64

with open("image.png", "rb") as f:
    image_data = base64.standard_b64encode(f.read()).decode()

response = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    messages=[{
        "role": "user",
        "content": [
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": "image/png",
                    "data": image_data
                }
            },
            {"type": "text", "text": "Describe this image"}
        ]
    }]
)
```

### PDFs

```python
with open("document.pdf", "rb") as f:
    pdf_data = base64.standard_b64encode(f.read()).decode()

response = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    messages=[{
        "role": "user",
        "content": [
            {
                "type": "document",
                "source": {
                    "type": "base64",
                    "media_type": "application/pdf",
                    "data": pdf_data
                }
            },
            {"type": "text", "text": "Summarize this document"}
        ]
    }]
)
```

---

## Citations

Enable source attribution.

```python
response = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    citations={"enabled": True},
    messages=[{
        "role": "user",
        "content": [
            {
                "type": "document",
                "source": {"type": "base64", "media_type": "application/pdf", "data": pdf_data},
                "title": "Research Paper"  # Required for citations
            },
            {"type": "text", "text": "What are the main findings?"}
        ]
    }]
)

# Response includes citation_page_location or citation_char_location
```

---

## Files API + Code Execution

### Upload File

```python
file = client.files.create(
    file=open("data.csv", "rb"),
    purpose="assistants"
)
file_id = file.id
```

### Code Execution

Claude runs Python in isolated Docker containers.

```python
response = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=4096,
    tools=[{"type": "code_execution_20250522", "name": "code_execution"}],
    messages=[{
        "role": "user",
        "content": [
            {
                "type": "container_upload",
                "file_id": file_id
            },
            {"type": "text", "text": "Analyze this CSV and create a chart"}
        ]
    }]
)
```

---

## MCP (Model Context Protocol)

Protocol for providing Claude with context and tools without writing tool
schemas.

### Architecture

```
Your Server <-> MCP Client <-> MCP Server (tools, resources, prompts)
```

### Key Concepts

- **Tools**: Functions MCP server exposes
- **Resources**: Data MCP server provides (read-only)
- **Prompts**: Pre-defined prompt templates

### MCP Client Flow

```python
from mcp import ClientSession

async def main():
    async with ClientSession() as session:
        # List available tools
        tools = await session.list_tools()

        # Call a tool
        result = await session.call_tool("tool_name", {"arg": "value"})

        # Read a resource
        resource = await session.read_resource("docs://documents/123")

        # Get a prompt
        messages = await session.get_prompt("format_doc", {"doc_id": "123"})
```

### Defining MCP Server Tools

```python
from mcp.server import Server
from pydantic import Field

server = Server("my-server")

@server.tool(name="read_doc", description="Read document contents")
async def read_doc(doc_id: str = Field(description="Document ID")):
    return documents[doc_id]
```

---

## Workflows vs Agents

| Aspect        | Workflows                    | Agents                       |
| ------------- | ---------------------------- | ---------------------------- |
| Steps         | Predetermined                | Dynamic, tool-based          |
| Testing       | Easy (known sequence)        | Hard (unpredictable path)    |
| Success Rate  | Higher                       | Lower                        |
| Best For      | Known processes              | Open-ended problems          |

**Recommendation:** Start with workflows. Use agents only when flexibility
required.

### Common Workflow Patterns

1. **Prompt Chaining**: Sequential steps with dependencies
2. **Parallelization**: Independent subtasks run simultaneously, aggregate
3. **Routing**: Categorize input, route to specialized handler
4. **Evaluator-Optimizer**: Generate -> Evaluate -> Refine loop

### Agent Design Principles

- Provide abstract tools (bash, web_fetch) not specialized ones
- Enable environment inspection after each action
- Use small set of flexible tools that combine creatively
