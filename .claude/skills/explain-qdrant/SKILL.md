---
name: explain-qdrant
description: Explains Qdrant vector search architecture including collections, query syntax, boosting, and integration patterns. Use when working with semantic search, vector embeddings, or understanding how Qdrant queries work in this codebase.
---

# Qdrant Vector Search Architecture

This skill documents the Qdrant vector database implementation for semantic search
over financial documents including earnings transcripts, SEC filings, and
presentation slides.

## Overview

Qdrant provides vector-based semantic search enabling natural language queries
across financial content. The implementation uses:

- **Vector Model:** `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`
- **Embedding Dimension:** 384
- **Provider:** HuggingFace Inference API

## Collections (Tables)

Three Qdrant collections store vectorized financial content:

### 1. `earnings_transcripts`

**Purpose:** Vector search over earnings call transcripts and presentation slides

**Location:** `/convex/qdrant/lib/searchTranscripts.ts`

**Payload Schema:**

```typescript
type SearchResultPayload = {
  // Company & Event Info
  cik: string; // SEC Central Index Key
  symbol: string; // Stock ticker
  conferenceDate: string; // ISO date of earnings call
  fiscalYear: number;
  fiscalQuarter: number;

  // Chunk & Content
  chunkIndex: number; // Chunk sequence number
  text: string; // Actual transcript text segment
  type: "preparedRemarks" | "qa" | "transcript" | "presentation";

  // Speaker Info (varies by type)
  speakerLabel?: null | string;
  speakerName?: null | string;
  speakerTitle?: null | string;

  // Timing Info
  startMs?: null | number; // Start time in milliseconds
  endMs?: null | number; // End time in milliseconds
  page?: null | number; // Page number for presentations
};
```

**Content Types:**

- `preparedRemarks` - Opening remarks from management
- `qa` - Question & answer session segments
- `transcript` - Full transcript passages
- `presentation` - Slide presentation content

### 2. `filing_contents`

**Purpose:** Vector search over SEC filings (10-K, 10-Q, 8-K)

**Location:** `/convex/qdrant/lib/searchFilingContents.ts`

**Payload Schema:**

```typescript
type FilingContentPayload = {
  // Filing Identifiers
  accession_number: string; // Unique filing ID
  cik: string;
  symbol: null | string;

  // Filing Metadata
  filing_date: string; // ISO date
  form_type: string; // "10-K", "10-Q", or "8-K"
  fiscal_year: null | number;
  fiscal_quarter: null | number;
  html_url: null | string; // Link to SEC.gov

  // Content Section
  section_id: string; // e.g., "part_i-item_1a"
  html_tag_id: string; // HTML element ID
  chunk_index: number;
  text: string;
};
```

**Supported Form Types:**

- `10-K` - Annual reports
- `10-Q` - Quarterly reports
- `8-K` - Current reports (material events)

**Common Section IDs:**

| Form  | Section ID                  | Description               |
| ----- | --------------------------- | ------------------------- |
| 10-K  | `part_i-item_1`             | Business                  |
| 10-K  | `part_i-item_1a`            | Risk Factors              |
| 10-K  | `part_ii-item_7`            | MD&A                      |
| 10-K  | `part_ii-item_8`            | Financial Statements      |
| 10-Q  | `part_i-item_1`             | Financial Statements      |
| 10-Q  | `part_i-item_2`             | MD&A                      |
| 8-K   | `item_1_01`                 | Material Cybersecurity    |
| 8-K   | `item_2_01`                 | Acquisition/Disposition   |
| 8-K   | `item_2_02`                 | Earnings Results          |

### 3. `presentation_titles`

**Purpose:** Semantic search over presentation slide titles

**Location:** `/convex/qdrant/lib/searchPresentationTitles.ts`

**Payload Schema:**

```typescript
type PresentationTitlePayload = {
  cik: string;
  symbol: string;
  conferenceDate: string;
  fiscalYear: number;
  fiscalQuarter: number;
  pageNumber: number;
  title: null | string;
  normalizedTitle: null | string;
};
```

## Configuration

**Client Setup:** `/convex/qdrant/lib/qdrantClient.ts`

```typescript
import { QdrantClient } from "@qdrant/js-client-rest";
import { envServer } from "../../env.server";

let qdrantClient: QdrantClient | null = null;

export function getQdrantClient(): QdrantClient {
  if (!qdrantClient) {
    qdrantClient = new QdrantClient({
      url: envServer.QDRANT_URL,
      apiKey: envServer.QDRANT_API_KEY,
    });
  }
  return qdrantClient;
}
```

**Environment Variables:**

```
QDRANT_URL=https://your-qdrant-instance.com
QDRANT_API_KEY=your-api-key
HF_ACCESS_TOKEN=your-huggingface-token
```

## Search Query Structure

### Earnings Transcript Query

```typescript
type SearchQuery = {
  queryText: string;
  boosts?: {
    explanationLanguage?: boolean; // +0.05 per match
    numericDensity?: boolean; // +0.03 per match
    forwardLooking?: boolean; // +0.05 per match
  };
  filters?: {
    cik?: string;
    symbols?: Array<string>;
    contentTypes?: Array<"preparedRemarks" | "qa" | "transcript" | "presentation">;
    fiscalYear?: number;
    fiscalQuarter?: number;
    dateRange?: { from?: string; to?: string };
    speakerRoles?: Array<"ceo" | "cfo" | "analyst">;
    syntax?: {
      include: Array<string>; // Keywords MUST appear
      exclude: Array<string>; // Keywords MUST NOT appear
    };
  };
};
```

### Filing Search Query

```typescript
type FilingSearchQuery = {
  queryText: string;
  boosts?: {
    legalRegulatory?: boolean; // +0.05 per match
    financialMetrics?: boolean; // +0.03 per match
    riskDisclosure?: boolean; // +0.05 per match
  };
  filters?: {
    cik?: string;
    symbols?: Array<string>;
    formTypes?: Array<"10-K" | "10-Q" | "8-K">;
    sectionIds?: Array<string>;
    fiscalYear?: number;
    fiscalQuarter?: number;
    dateRange?: { from?: string; to?: string };
    syntax?: {
      include: Array<string>;
      exclude: Array<string>;
    };
  };
};
```

## Search Modes

### Standard Search

Single semantic search across all content types:

```typescript
// convex/qdrant/earningsTranscripts.ts
const results = await searchTranscripts({
  query: { queryText: "revenue growth guidance" },
  limit: 20,
});
```

### Diverse Search

Parallel searches per content type to ensure variety:

```typescript
// convex/qdrant/lib/searchTranscripts.ts
const results = await searchTranscriptsDiverse({
  query: { queryText: "margin expansion" },
  limitPerType: 5, // Max 5 results per content type
});
```

**Benefits:**

- Prevents single content type from dominating results
- Deduplicates by `cik_conferenceDate_chunkIndex`
- Ensures representation from preparedRemarks, qa, transcript, presentation

## Result Boosting & Ranking

### Earnings Transcript Boosts

**File:** `/convex/qdrant/lib/applyBoosts.ts`

| Boost Type            | Boost Value | Triggers                               |
| --------------------- | ----------- | -------------------------------------- |
| `explanationLanguage` | +0.05       | "due to", "because", "driven by", etc. |
| `numericDensity`      | +0.03       | "$XXM", "YY%", "XXbps", etc.           |
| `forwardLooking`      | +0.05       | "expect", "guidance", "project", etc.  |
| Exact match           | +0.20       | Verbatim query match                   |
| Per word match        | +0.05       | Each query word found                  |
| Recency (max)         | +0.08       | Linear decay over 180 days             |

### Filing Boosts

**File:** `/convex/qdrant/lib/applyFilingBoosts.ts`

| Boost Type         | Boost Value | Triggers                                   |
| ------------------ | ----------- | ------------------------------------------ |
| `legalRegulatory`  | +0.05       | "SEC", "compliance", "litigation", etc.    |
| `financialMetrics` | +0.03       | "revenue", "margin", "EBITDA", "debt"      |
| `riskDisclosure`   | +0.05       | "material weakness", "uncertainty", etc.   |
| Exact match        | +0.20       | Verbatim query match                       |
| Per word match     | +0.05       | Each query word found                      |
| Recency (max)      | +0.08       | Linear decay over 365 days                 |

## Query Generation

### AI-Optimized (Earnings)

**File:** `/convex/qdrant/generateSearchQuery.ts`

Uses **Gemini 2.5 Flash** to transform natural language:

```typescript
// User query: "why did Apple's revenue change last quarter?"
// AI transforms to:
{
  queryText: "Apple revenue change explanation factors",
  boosts: { explanationLanguage: true },
  filters: { symbols: ["AAPL"] }
}
```

### Rule-Based (Filings)

**File:** `/convex/qdrant/generateFilingSearchQuery.ts`

Pattern matching for structured extraction:

```typescript
// User query: "risk factors in Microsoft's annual report"
// Rule-based extraction:
{
  queryText: "risk factors",
  filters: {
    symbols: ["MSFT"],
    formTypes: ["10-K"],
    sectionIds: ["part_i-item_1a"]
  }
}
```

## Qdrant Filter Conditions

Filters translate to Qdrant `must` conditions:

```typescript
// Building filter conditions
const mustConditions: Filter[] = [];

// Exact match
if (filters.cik) {
  mustConditions.push({
    key: "cik",
    match: { value: filters.cik },
  });
}

// Multiple value match (OR)
if (filters.symbols?.length) {
  mustConditions.push({
    key: "symbol",
    match: { any: filters.symbols },
  });
}

// Range filter
if (filters.dateRange) {
  mustConditions.push({
    key: "conferenceDate",
    range: {
      gte: filters.dateRange.from,
      lte: filters.dateRange.to,
    },
  });
}
```

## Include/Exclude Syntax

Post-retrieval filtering with keyword constraints:

```typescript
// Query with syntax
const query = {
  queryText: "earnings guidance",
  filters: {
    syntax: {
      include: ["revenue", "growth"], // Both MUST appear
      exclude: ["decline"], // MUST NOT appear
    },
  },
};

// Applied as regex: /\brevenue\b/i, /\bgrowth\b/i
// Results filtered after vector retrieval
```

## Integration Patterns

### Frontend Hook Pattern

```typescript
// src/components/home-search/hooks/use-filing-search.ts
import { useAction } from "convex/react";
import { api } from "convex/_generated/api";

export const useFilingSearch = () => {
  const searchAction = useAction(api.qdrant.filingContents.searchFilingContents);

  const search = async (query: string, filters?: FilingFilters) => {
    return await searchAction({
      query: { queryText: query, filters },
      limit: 20,
    });
  };

  return { search };
};
```

### AI Agent Tool Integration

```typescript
// convex/agent/tools/searchEarningsTranscripts/searchEarningsTranscripts.ts
import { tool } from "ai";
import { z } from "zod";

export const searchEarningsTranscriptsTool = tool({
  description: "Search earnings call transcripts using semantic similarity",
  parameters: z.object({
    query: z.string().min(1),
    symbol: z.string().optional(),
    fiscalYear: z.number().optional(),
    limit: z.number().max(50).optional(),
  }),
  execute: async (input) => {
    const results = await searchTranscripts({
      query: { queryText: input.query, filters: { symbols: input.symbol ? [input.symbol] : undefined } },
      limit: input.limit ?? 20,
    });
    return formatResultsAsMarkdown(results);
  },
});
```

## Data Flow Architecture

```
User Query (Frontend)
    ↓
Convex Action (generateSearchQuery / generateFilingSearchQuery)
    ↓
Transform query with AI / Rules
    ↓
Convex Action (searchTranscripts / searchFilingContents)
    ↓
Generate embedding (HuggingFace API)
    ↓
Query Qdrant (with filters)
    ↓
Apply boosts + sort by score
    ↓
Post-filter with include/exclude syntax
    ↓
Group results by company/filing
    ↓
Sort snippets within groups
    ↓
Return to frontend
```

## Key Files Reference

| File                                        | Purpose                         |
| ------------------------------------------- | ------------------------------- |
| `/convex/qdrant/lib/qdrantClient.ts`        | Qdrant client singleton         |
| `/convex/qdrant/lib/embeddings.ts`          | Vector embedding generation     |
| `/convex/qdrant/lib/searchTranscripts.ts`   | Earnings transcript search      |
| `/convex/qdrant/lib/searchFilingContents.ts`| Filing content search           |
| `/convex/qdrant/lib/applyBoosts.ts`         | Earnings result boosting        |
| `/convex/qdrant/lib/applyFilingBoosts.ts`   | Filing result boosting          |
| `/convex/qdrant/earningsTranscripts.ts`     | Earnings search Convex action   |
| `/convex/qdrant/filingContents.ts`          | Filing search Convex action     |
| `/convex/qdrant/generateSearchQuery.ts`     | AI query transformation         |
| `/convex/qdrant/generateFilingSearchQuery.ts`| Rule-based query transformation|

## Constraints & Limits

- **Minimum query length:** 3 characters
- **Default result limit:** 20
- **Maximum result limit (agents):** 50
- **Recency decay window:** 180 days (earnings), 365 days (filings)
- **Embedding batch size:** ~100 texts per HuggingFace request
