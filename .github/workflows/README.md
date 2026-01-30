# CI/CD Documentation

This project uses GitHub Actions for continuous integration and deployment.

## Workflows

### 1. CI (`ci.yml`)

**Triggers:** Push/PR to main/master branches

**Jobs:**
- **Lint & Type Check**: Runs TypeScript type checking and Prettier formatting checks
- **Test**: Runs the full test suite (130 tests)
- **Build**: Builds the project and uploads artifacts

**Status Badge:**
```markdown
![CI](https://github.com/OWNER/REPO/actions/workflows/ci.yml/badge.svg)
```

### 2. Docker Tests (`docker-tests.yml`)

**Triggers:** Push/PR to main/master branches, manual dispatch

**Jobs:**
- **Docker Linux Test**: Tests in Linux container with Node.js
- **Docker Real Agents Test**: Tests with real agents installed (Claude Code, Codex, OpenCode) and Playwright MCP server

This ensures the CLI works correctly in a clean Linux environment with actual agent installations.

### 3. Cross-Platform Tests (`cross-platform.yml`)

**Triggers:** Push/PR to main/master branches

**Matrix:**
- **OS**: Ubuntu, macOS, Windows
- **Node.js versions**: 18, 20, 22

**Special Job:**
- **Real Agents Test (macOS)**: Installs actual agents on macOS runner and tests the CLI

### 4. Release (`release.yml`)

**Triggers:** Push of version tags (v*)

**Steps:**
1. Runs tests
2. Builds the project
3. Creates GitHub Release with binaries
4. Publishes to npm

**Usage:**
```bash
git tag v1.0.0
git push origin v1.0.0
```

**Required Secrets:**
- `NPM_TOKEN`: NPM authentication token for publishing

### 5. Nightly Tests (`nightly.yml`)

**Triggers:** Daily at 2 AM UTC, manual dispatch

**Purpose:**
- Runs full test suite daily
- Creates GitHub issue on failure
- Monitors for regressions

## Required Secrets

Configure these in GitHub Repository Settings > Secrets and variables > Actions:

| Secret | Description | Required For |
|--------|-------------|--------------|
| `NPM_TOKEN` | NPM authentication token | Publishing releases |

## Local Testing

Before pushing, ensure these pass locally:

```bash
# Install dependencies
npm ci

# Run type check
npm run type-check

# Run tests
npm run test:run

# Build
npm run build

# Test CLI
node bin/cli.mjs --version
```

## Docker Testing

Test locally with Docker:

```bash
cd tests/docker

# Basic Linux test
docker-compose -f docker-compose.test.yml up --build

# Real agents test
docker-compose -f docker-compose.test.yml up --build --exit-code-from mcp-test
```

## Troubleshooting

### Common Issues

1. **Tests fail on Windows**: Check path handling in code
2. **Docker build fails**: Ensure .dockerignore excludes node_modules
3. **NPM publish fails**: Check NPM_TOKEN is set and has publish permissions

### Debugging

Enable debug logging in workflows:

```yaml
env:
  DEBUG: '*'
```

## Branch Protection

Recommended branch protection rules for `main`:

- [ ] Require status checks to pass
  - [ ] CI / Lint & Type Check
  - [ ] CI / Test
  - [ ] CI / Build
  - [ ] Docker Tests / Docker Linux Test
- [ ] Require pull request reviews
- [ ] Require linear history
- [ ] Include administrators

## Release Process

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Create git tag: `git tag v1.0.0`
4. Push tag: `git push origin v1.0.0`
5. GitHub Actions will:
   - Run tests
   - Build project
   - Create GitHub Release
   - Publish to npm

## Monitoring

- Check Actions tab for workflow status
- Review nightly test results
- Monitor npm publish status
