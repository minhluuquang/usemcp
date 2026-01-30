# MCP Installer CLI

[![CI](https://github.com/vercel-labs/mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/vercel-labs/mcp/actions/workflows/ci.yml)
[![Docker Tests](https://github.com/vercel-labs/mcp/actions/workflows/docker-tests.yml/badge.svg)](https://github.com/vercel-labs/mcp/actions/workflows/docker-tests.yml)
[![Cross-Platform](https://github.com/vercel-labs/mcp/actions/workflows/cross-platform.yml/badge.svg)](https://github.com/vercel-labs/mcp/actions/workflows/cross-platform.yml)

A `skills`-style installer CLI for MCP server configs. Supports Claude Code, Claude Desktop, Codex, and OpenCode.

## Installation

```bash
npx mcp add <source>
```

## Usage

```bash
# Add an MCP server
npx mcp add io.github.user/server

# List installed servers
npx mcp list

# Remove a server
npx mcp remove server-name

# Check for updates
npx mcp check

# Update all servers
npx mcp update
```

## Supported Clients

- **Claude Code**: `.mcp.json` (project), `~/.claude.json` (user)
- **Claude Desktop**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Codex**: `.codex/config.toml` (project), `~/.codex/config.toml` (user)
- **OpenCode**: `opencode.json` (project), `~/.config/opencode/opencode.json` (user)

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build

# Run CLI locally
node bin/cli.mjs --help
```

### Docker Testing

Test with real agents in Docker:

```bash
cd tests/docker
docker-compose -f docker-compose.test.yml up --build
```

This will:
1. Install real agents (Claude Code, Codex, OpenCode)
2. Test the MCP CLI with Playwright MCP server
3. Verify installation across all agents

## CI/CD

This project uses GitHub Actions for:

- **Continuous Integration**: Lint, type check, test, and build on every PR
- **Docker Tests**: Test with real agents in Linux containers
- **Cross-Platform Tests**: Test on Ubuntu, macOS, and Windows
- **Nightly Tests**: Daily scheduled tests
- **Automated Releases**: Publish to npm on version tags

See [`.github/workflows/README.md`](.github/workflows/README.md) for details.

## License

MIT
