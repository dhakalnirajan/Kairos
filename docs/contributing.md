# Contributing to Kairos

## Development Setup

```bash
git clone https://github.com/dhakalnirajan/Kairos.git
cd Kairos
bun install
bun run dev
```

## Code Style

- TypeScript strict mode
- No `any` types
- Use `bun:sqlite` not `better-sqlite3`
- Zod schemas for config
- No comments unless necessary

## Testing

```bash
bun test              # Run all tests
bun run typecheck     # Type check
bun run build         # Build
```

## Pull Requests

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Run `bun run typecheck` and `bun test`
6. Submit a pull request

## Adding Tools

1. Create file in `src/tools/builtin/`
2. Implement `ToolInstance` interface
3. Register in `src/tools/builtin/index.ts`
4. Add tests

## Adding Providers

1. Create client class in `src/llm/client.ts`
2. Add to `createLLMClient` factory
3. Add provider definition in `src/llm/providers.ts`
4. Add tests
