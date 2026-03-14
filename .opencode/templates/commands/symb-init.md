# /symb-init — Interactive Project Setup

You are setting up a new project with the Symbolic Executor plugin + Serena MCP.

## Step 1: Gather Project Info

Ask the user the following questions one at a time. Use sensible defaults.

1. **Project name** — default: the current directory name
2. **Primary language(s)** — present this list and ask them to pick one or more (comma-separated numbers):
   ```
   Common:
     1. typescript    2. python    3. rust    4. go    5. java
     6. kotlin        7. cpp       8. csharp  9. ruby  10. php
   Other:
     11. swift   12. dart    13. elixir  14. scala  15. lua
     16. bash    17. vue     18. zig     19. haskell 20. clojure
   ```
   Note: For JavaScript projects, use `typescript`. For C projects, use `cpp`.
3. **File encoding** — default: `utf-8` (only ask if they want something different)
4. **Brief project description** — one sentence, used for Serena memory

## Step 2: Create Project Structure

After getting answers, create these files using `write` or `bash mkdir -p`:

### `.opencode/config.json`
```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "serena": {
      "command": ["uvx", "--from", "git+https://github.com/oraios/serena", "serena", "start-mcp-server"],
      "deferLoading": false,
      "description": "Symbolic code operations (always loaded)"
    }
  }
}
```

### `.opencode/constitution.md`
Generate a constitution based on the project info. Include:
- SPEC-driven development principles
- Code quality gates (type safety, linting, tests)
- Architecture boundaries (fill in based on language/framework)
- Verification gates

### `.opencode/SPEC-INDEX.md`
```markdown
# SPEC Index

| ID | Feature | Status | Iteration | Last Updated |
|----|---------|--------|-----------|--------------|

## Active SPECs

## Archived SPECs
```

### `.opencode/specs/` (empty directory)
Create with `bash mkdir -p .opencode/specs`

### `.serena/project.yml`
Generate using the user's answers:
```yaml
project_name: "<project_name>"
languages:
- <language1>
- <language2>
encoding: "<encoding>"
ignore_all_files_in_gitignore: true
ignored_paths: []
read_only: false
excluded_tools: []
included_optional_tools: []
fixed_tools: []
initial_prompt: ""
```

### `.serena/.gitignore`
```
memories/
```

### Do NOT create:
- `.opencode/memories/` (Serena handles memories via `.serena/memories/`)
- `.opencode/decisions/` (decisions go in SPEC files)
- `.opencode/mistakes/` (not needed)
- `.opencode/prompts/` (agents handle prompts)
- `.opencode/tools-catalog.json` (registry handles this)

## Step 3: Activate Serena

After creating all files:

1. Call `activate_project` with the project name from step 1
2. Call `onboarding` to let Serena index the project
3. Call `write_memory` with topic `"project-init"` and content summarizing:
   - Project name and description
   - Languages configured
   - Date initialized
   - Tools available (SPEC tools, hashline, verify_work, git_commit_and_push)

## Step 4: Report Completion

Show the user a summary:
- Files created (list them)
- Serena project activated: yes/no
- Onboarding complete: yes/no
- Next steps:
  1. Review `.opencode/constitution.md` and customize
  2. Start planning: create your first SPEC
  3. Use `search_tools` to discover available tools
