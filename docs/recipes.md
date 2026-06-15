# Recipes & Workflows

Common workflows and recipes for using Kairos effectively.

## Code Review

```bash
# Review a file
> /review src/main.ts

# Review changed files
> Review the changes in the last commit

# Security review
> /security-scan src/
```

## Test-Driven Development

```bash
# Generate test skeleton
> /test-first src/utils.ts

# Run tests
> /test

# Run tests in watch mode
> /test --watch
```

## Refactoring

```bash
# Analyze code structure
> /ast-scan src/

# Find dead code
> /cleanup src/

# Modernize legacy code
> /modernise src/old.ts

# Transpile JS to TS
> /transpile js-to-ts src/
```

## Documentation

```bash
# Generate API docs
> /generate-api-docs src/

# Sync documentation
> /docs-sync

# Create ADR
> /adr create --title "Use SQLite for memory" --decision "SQLite with FTS5"

# Generate changelog
> /changelog --since v0.1.0
```

## Memory Management

```bash
# Store important facts
> /remember The API uses bearer tokens for authentication

# Search memory
> /recall authentication

# Consolidate memory
> /dream

# View memory stats
> /memdump
```

## Performance Analysis

```bash
# Analyze bundle size
> /bench src/

# Find slow queries
> /query-opt src/

# Memory analysis
> /heap-snapshot

# Profile hotspots
> /profiler start
> /profiler stop
```

## Security Audit

```bash
# Scan for secrets
> /security-scan

# Check dependencies
> /supply-chain audit

# Check licenses
> /license-check

# Monitor advisories
> /advisories check-package lodash
```

## Git Workflows

```bash
# Interactive rebase
> /git rebase -i HEAD~5

# Bisect to find bug
> /bisect start
> /bisect bad HEAD
> /bisect good v0.1.0
> /bisect run npm test

# Generate release notes
> /release-notes --since v0.1.0
```

## Session Management

```bash
# Export session
> /export --format json

# Continue previous session
kairos --continue

# Handoff session
> /handoff --export session.json
```

## Custom Workflows

### Workflow YAML

```yaml
name: code-review
steps:
  - name: lint
    tool: bash
    params:
      command: "bun run lint"
  - name: test
    tool: bash
    params:
      command: "bun test"
  - name: review
    tool: code_review
    params:
      files: "src/**/*.ts"
```

### Run Workflow

```bash
> /workflow run code-review
```

## Next Steps

- [Tools](tools.md) — All available tools
- [Slash Commands](slash-commands.md) — All commands
