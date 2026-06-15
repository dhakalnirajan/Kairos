# Contributing to Kairos

Thank you for your interest in contributing to Kairos!

## Getting Started

1. Fork the repository
2. Clone your fork
3. Install dependencies: `bun install`
4. Create a branch: `git checkout -b feature/my-feature`
5. Make your changes
6. Run tests: `bun test`
7. Run typecheck: `bun run typecheck`
8. Commit your changes
9. Push to your fork
10. Create a Pull Request

## Development Setup

### Prerequisites

- Bun 1.0+
- Git
- An LLM provider (for testing)

### Quick Start

```bash
git clone https://github.com/your-username/Kairos.git
cd Kairos
bun install
bun run dev
```

### Project Structure

```
src/
├── agent/           # Agent loop, compose pipeline, modes
├── cli/             # CLI entry point, parser, setup wizard
├── config/          # Configuration system
├── daemon/          # Background daemon
├── extensions/      # Extension loader
├── hooks/           # Event bus, hook runner
├── llm/             # LLM clients, provider manager
├── mcp/             # Model Context Protocol
├── memory/          # SQLite memory database
├── security/        # Safety pipeline
├── skills/          # Skill runner
├── tools/           # Tool registry, 68 built-in tools
├── tui/             # Terminal UI (neo-blessed)
├── types/           # TypeScript types
├── utils/           # Logger, paths, tokenizer
└── web/             # Web interface server
```

## Code Style

### TypeScript

- Strict mode enabled
- No `any` types (use `unknown` or specific types)
- No `@ts-ignore` or `@ts-expect-error`
- Use Bun APIs over Node.js where possible

### Code Conventions

- No comments unless explaining non-obvious logic
- Zod schemas for all config and tool parameters
- LLM streaming via `AsyncGenerator<StreamEvent>`
- Path handling via `path` module (no hardcoded `/` or `\`)

### Commit Messages

Follow conventional commits:

```
feat: add new feature
fix: bug fix
docs: documentation
refactor: code refactoring
test: add tests
chore: maintenance
```

## Testing

```bash
# Run all tests
bun test

# Run specific test
bun test tests/agent.test.ts

# Run with coverage
bun test --coverage
```

## Type Checking

```bash
bun run typecheck
```

Always run typecheck before committing.

## Adding a New Tool

1. Create `src/tools/builtin/my-tool.ts`
2. Export a `ToolInstance`:
   ```typescript
   export const myTool: ToolInstance = {
     name: 'my-tool',
     description: 'My tool description',
     parameters: { type: 'object', properties: { ... } },
     riskLevel: 'read',
     isIdempotent: true,
     async execute(params, ctx) { ... },
   };
   ```
3. Register in `src/tools/builtin/index.ts`
4. Add tests in `tests/tools/`
5. Update documentation

## Adding a New Slash Command

1. Add command handler in `src/tui/index.ts`
2. Update help text
3. Add tests
4. Update documentation

## Reporting Issues

- Use GitHub Issues
- Include reproduction steps
- Include error messages
- Include environment info (OS, Bun version)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
