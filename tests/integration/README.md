# Docker Integration Tests

This directory contains the comprehensive Docker-based test suite that combines:
1. **Integration Tests** - Filesystem operations, lock file tests, adapter config operations
2. **Real Agent Tests** - Tests with real MCP clients (Claude Code, Codex, OpenCode) and Playwright MCP server

## Running Tests

### Run All Tests (Combined)

```bash
docker compose -f tests/integration/docker-compose.yml up --build
```

This will run both the integration tests and real agent tests in sequence.

### Test Phases

The combined test suite runs in two phases:

**Phase 1: Integration Tests**
- Tests filesystem operations for all adapters (Claude Code, Codex, OpenCode, Claude Desktop)
- Lock file CRUD operations
- Config file read/write operations
- Round-trip serialization tests

**Phase 2: Real Agent Tests**
- Installs real MCP clients globally (Claude Code, Codex, OpenCode)
- Installs Playwright MCP server using `usemcps add`
- Verifies MCP server appears in all agent configs
- Tests lock file tracking

## Environment

Tests run in an isolated Docker container with:
- Node.js 20
- pnpm package manager
- Real MCP clients: @anthropic-ai/claude-code, @openai/codex, opencode-ai
- Playwright MCP server: @playwright/mcp
- Fresh home directory for each test run

## Files

- `Dockerfile` - Combined Docker image with real agents and test setup
- `docker-compose.yml` - Docker Compose configuration
- `run-all-tests.sh` - Main test script that runs both phases
- `integration.test.ts` - Integration test suite
- `test-real-agents.sh` - Real agent test script (copied from tests/docker)

## CI/CD

These tests run in GitHub Actions on every push/PR to main/master branch via the `docker-tests.yml` workflow.
