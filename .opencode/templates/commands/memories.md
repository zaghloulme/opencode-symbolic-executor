# /memories — Search Project Memories (via Serena)

Search and manage project memories stored in Serena's memory system.

## Instructions

1. Call `mcp__serena__list_memories` to get all available memory entries
2. If the user provided search keywords, filter results by relevance
3. For detailed content, call `mcp__serena__read_memory` with the memory name
4. Present results in a table:

| Name | Summary |
|------|---------|
| ...  | ...     |

## Writing Memories

To save a new memory, call `mcp__serena__write_memory` with:
- `topic`: category/name (e.g. "decisions/auth-strategy", "bugs/redirect-loop")
- `content`: detailed content including context, solution, and relevant file paths

## When to Use Memories

- After completing a SPEC task (persist what was learned)
- At session start (recall prior context with `mcp__serena__list_memories` + `mcp__serena__read_memory`)
- When debugging a recurring issue
- Before implementing something similar to past work
