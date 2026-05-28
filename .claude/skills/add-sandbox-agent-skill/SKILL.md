---
name: add-sandbox-agent-skill
description: Guide for creating new skills in the agent-sandbox. Use when adding agent capabilities, tools, or workflows to the sandbox environment.
---

# Add Sandbox Agent Skill

Create new skills for the `agent-sandbox/.claude/skills/` directory following the project's established patterns.

## When to Use

- Adding a new data source or API integration
- Creating query scripts for a database
- Adding specialized analysis workflows

## Skill Directory Structure

```
agent-sandbox/.claude/skills/my-skill/
├── SKILL.md              # Required: metadata + documentation
├── scripts/              # Executable TypeScript scripts
│   ├── my-script.ts      # Entry point scripts (run via tsx)
│   ├── lib/              # Shared utilities
│   │   └── db-client.ts
│   └── types/            # TypeScript types
│       └── types.ts
└── schema/               # Database schema (if applicable)
    ├── schema.ts         # Drizzle ORM schema
    └── relations.ts      # Table relations
```

## SKILL.md Template

Follow this format matching existing skills:

```markdown
---
name: my-skill-name
description: >
  Brief description of what this skill does and when Claude should use it.
  Be specific about triggers and capabilities.
allowed-tools:
  - Bash
  - Read
---

# Skill Title

Brief overview of the skill's purpose.

## Environment Variable

`MY_ENV_VAR` - Pre-configured in container

## CLI Access (Direct SQL)

If database skill:
```bash
psql "$MY_ENV_VAR" -c "SELECT * FROM table LIMIT 5"
```

## Predefined Scripts

Run via Bash with JSON argument:

### Category Name
```bash
tsx /workspace/.agent/skills/my-skill/scripts/my-script.ts '{"param":"value"}'
```

## Schema Reference

See `/workspace/.agent/skills/my-skill/schema/schema.ts` for full schema.

### Key Tables
- `tableName` - Description of table contents
```

## Script Pattern

Entry point scripts accept JSON arguments and output JSON:

```typescript
// scripts/get-data.ts
import { myLib } from "./lib/my-lib";

interface Args {
  identifier: string;
  limit?: number;
}

const args: Args = JSON.parse(process.argv[2] || "{}");

async function main() {
  const result = await myLib.getData(args);
  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error);
```

## Database Skills Pattern

For skills querying Postgres databases:

```typescript
// scripts/lib/db-client.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../schema/schema";

export function getDb() {
  const client = postgres(process.env.MY_DB_URL!);
  return drizzle(client, { schema });
}
```

## Update CLAUDE.md

After creating a skill, add it to `agent-sandbox/CLAUDE.md`:

```markdown
### N. My Skill (`my-skill`)

Brief description.

```bash
tsx /workspace/.agent/skills/my-skill/scripts/<script>.ts '<json>'
```

**Available scripts:**
- `script-name.ts` - What it does
```

## Checklist

1. Create skill directory under `agent-sandbox/.claude/skills/`
2. Write SKILL.md with frontmatter (name, description, allowed-tools)
3. Add scripts in `scripts/` directory
4. Add shared code in `scripts/lib/`
5. Add types in `scripts/types/`
6. Add database schema if applicable
7. Document in `agent-sandbox/CLAUDE.md`
8. Test scripts with example JSON arguments
