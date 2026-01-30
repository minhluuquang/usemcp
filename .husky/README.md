# Git Hooks

This project uses [Husky](https://typicode.github.io/husky/) for Git hooks and [lint-staged](https://github.com/okonet/lint-staged) for running linters on staged files.

## Setup

Git hooks are automatically installed when you run:

```bash
npm install
```

This runs the `prepare` script which initializes Husky.

## Hooks

### Pre-commit

Runs automatically before each commit:

1. **lint-staged**: Lints and formats staged files
   - TypeScript files: ESLint + Prettier
   - JSON/Markdown files: Prettier
2. **Type check**: Runs TypeScript compiler to check types

### Pre-push

Runs automatically before each push:

1. **Tests**: Runs the full test suite
2. **Build**: Builds the project to ensure no build errors

## Manual Hook Execution

You can run hooks manually:

```bash
# Run pre-commit hook
.husky/pre-commit

# Run pre-push hook
.husky/pre-push
```

## Bypassing Hooks

In case you need to bypass hooks (not recommended):

```bash
# Skip pre-commit hook
git commit -m "message" --no-verify

# Skip pre-push hook
git push --no-verify
```

## Troubleshooting

### Hooks not running

1. Ensure Husky is installed:
   ```bash
   npm run prepare
   ```

2. Check if hooks are executable:
   ```bash
   ls -la .husky/
   ```

3. Verify Git hooks path:
   ```bash
   git config core.hooksPath
   # Should output: .husky
   ```

### lint-staged issues

If lint-staged fails, check:

1. ESLint config is valid
2. Prettier config is valid
3. No syntax errors in staged files

## Configuration

- **Husky config**: `.husky/` directory
- **lint-staged config**: `package.json` → `lint-staged` field
- **ESLint config**: `eslint.config.js`
- **Prettier config**: `.prettierrc`
