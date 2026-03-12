# /memories - Search Project Memories

Search per-project memory index for past solutions and lessons learned.

## Usage

```
/memories <keywords>     # Search memories
/memory <keywords>       # Alias
/mem <keywords>          # Shorthand
```

## Examples

```
/memories OAuth          # Search for OAuth-related memories
/mem auth redirect       # Search for auth redirect issues
/memory CVE dependency   # Search for security-related memories
```

## What It Returns

Memory entries matching keywords:

| ID      | Category | Date       | Summary                 | File             |
| ------- | -------- | ---------- | ----------------------- | ---------------- |
| MEM-001 | auth     | 2026-03-10 | OAuth redirect loop fix | MEM-001-oauth.md |
| MEM-002 | security | 2026-03-11 | CVE in dependency X     | MEM-002-cve.md   |

## Memory Categories

- **auth**: Authentication and authorization
- **security**: Security issues and fixes
- **deployment**: Deployment and infrastructure
- **performance**: Performance optimizations
- **design**: UI/UX and design decisions
- **architecture**: Architecture and patterns

## Memory Format

Each memory file (`.opencode/memories/MEM-{id}.md`):

```markdown
# MEM-001: OAuth Redirect Loop

**Category:** auth  
**Date:** 2026-03-10  
**SPEC Reference:** SPEC-001.md

## Problem
Infinite redirect after Google OAuth callback in production

## Root Cause
AUTH_CALLBACK_URL env var missing in production

## Solution
1. Added AUTH_CALLBACK_URL to `.env.production`
2. Updated `src/auth/config.ts` line 23

## Files Changed
- `.env.production` (added AUTH_CALLBACK_URL)
- `src/auth/config.ts` (line 23)

## When Stuck, Check This If...
- Seeing "redirect_uri_mismatch" error
- OAuth works locally but fails in production
- Environment-specific auth failures
```

## When to Use

Use `/memories` when:
- Seeing recurring errors
- Debugging environment-specific issues
- About to implement something similar to past work
- Stuck on a problem that might have been solved before

## Related Commands

- `search_memories` tool - Advanced search with category filters
- `search_decisions` - Search decision logs
- `search_mistakes` - Search mistake logs

## Philosophy

> Memory helps when you're **stuck**, not to **prevent errors**.
> 
> Use it as a reference library, not a guardrail.

---

**Note**: If no memories exist, command suggests creating first memory with lessons learned.
