# Agent Guidelines for MCP CLI Repository

## Build & Development Commands

```bash
# Development - run CLI directly
pnpm dev

# Build for production
pnpm build

# Type checking
pnpm type-check

# Linting
pnpm lint              # Check for issues
pnpm lint:fix          # Auto-fix issues

# Formatting
pnpm format            # Format all files
pnpm format:check      # Check formatting

# Testing
pnpm test              # Run tests in watch mode
pnpm test:run          # Run tests once

# Run single test file
pnpm vitest run tests/smoke/add-command.test.ts

# Run tests matching pattern
pnpm vitest run --reporter=verbose tests/litmus/
```

## Code Style Guidelines

### TypeScript Configuration
- Target: ESNext with ESNext modules
- Strict mode enabled
- Module resolution: bundler
- Import extensions required: `import './file.ts'` not `import './file'`

### Imports
- Use `.ts` extensions for all imports (e.g., `import { foo } from './bar.ts'`)
- Group imports: Node.js built-ins first, then external deps, then internal
- Use `type` keyword for type-only imports: `import type { Foo } from './types.ts'`
- Prefer namespace imports for libraries: `import * as p from '@clack/prompts'`

### Naming Conventions
- **Files**: kebab-case (e.g., `claude-code.ts`, `add-command.test.ts`)
- **Functions**: camelCase (e.g., `parseAddOptions`, `runAdd`)
- **Types/Interfaces**: PascalCase (e.g., `NormalizedServer`, `AddOptions`)
- **Constants**: UPPER_SNAKE_CASE for true constants
- **Boolean variables**: Use prefixes like `is`, `has`, `should` (e.g., `isInstalled`)

### Error Handling
- Use descriptive error messages
- Wrap CLI errors with `pc.red()` for colored output
- Always handle errors in async functions with try/catch
- Exit with code 1 on fatal errors: `process.exit(1)`

### Types & Interfaces
- Define types in `src/types.ts`
- Use explicit return types on exported functions
- Prefer interfaces over type aliases for object shapes
- Use `Record<string, unknown>` for dynamic config objects

### Code Organization
- CLI commands in root of `src/` (add.ts, list.ts, remove.ts, etc.)
- Agent adapters in `src/agents/`
- Source parsers in `src/sources/`
- Tests mirror source structure under `tests/`

### Testing
- Use Vitest with globals enabled
- Test files: `*.test.ts`
- Group tests with `describe()` blocks
- Use `beforeEach`/`afterEach` for setup/teardown
- Tests run sequentially (parallelism disabled)

### Linting Rules
- Unused vars prefixed with `_` are ignored
- `console.log` allowed (CLI tool)
- `any` type allowed when necessary
- Non-null assertions allowed

### Git Hooks
- Pre-commit runs eslint --fix and prettier --write
- Uses lint-staged for staged files only
