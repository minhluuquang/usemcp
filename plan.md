# MCP Installer CLI (Skills-like) - Plan

Build a `skills`-style installer CLI, but for MCP server configs. Initial supported clients: Claude Code, Claude Desktop, Codex, OpenCode. The architecture should make it straightforward to add more MCP clients later.

## Goals

- Provide a single CLI to add/list/remove/check/update MCP servers across multiple clients.
- Default to safe behavior: show full commands/URLs, require confirmation, never auto-execute servers.
- Keep secrets out of repo-scoped config by default.
- Use the same stack and conventions as `/Users/leo/projects/skills` (TS, pnpm, obuild, vitest, clack prompts, picocolors, prettier).

## Key Differences vs Skills

- Skills: install `SKILL.md` directories via copy/symlink into known paths.
- MCP: install by mutating per-client config files (JSON/JSONC/TOML) to register MCP servers.
- MCP includes higher-risk operations (local commands) and more secret handling (env vars/headers).

## Phase 0 - Repository scaffold (same stack as skills)

- TypeScript (ESM), Node >= 18
- pnpm
- `obuild` bundling (`build.config.mjs`)
- `vitest`
- CLI UX: `@clack/prompts`, `picocolors`
- `prettier` formatting
- Minimal deps; add parsers only where needed:
  - TOML parse/write for Codex
  - JSONC parse/write (or preserve comments best-effort) for OpenCode

Deliverables:

- `package.json` with `bin` entrypoints (e.g. `mcp` and `add-mcp` alias)
- `src/cli.ts` command routing
- tests + formatting + build scripts matching skills repo patterns

## Phase 1 - Canonical model + agent adapters (general layout)

### 1) Canonical internal representation

Define one normalized format that can be rendered to each client:

- `NormalizedServer`
  - `id`: stable identifier (prefer MCP Registry `server.json.name`, e.g. `io.github.user/server`)
  - `displayName`, `description`
  - `transport`:
    - `stdio`: `{ command: string; args: string[]; env?: Record<string,string>; cwd?: string }`
    - `http`: `{ url: string; headers?: Record<string,string> }`
    - `sse`: `{ url: string; headers?: Record<string,string> }` (optional; many ecosystems are moving to streamable-http)
  - `secrets`: required env/header fields expressed as placeholders (never store secret values in normalized form)

### 2) Agent adapter interface

Each supported client implements the same adapter interface:

- `AgentAdapter`
  - `id`, `displayName`
  - `detectInstalled(): Promise<boolean>`
  - `supportedScopes: ('project'|'user')[]`
  - `readConfig(scope, cwd): ParsedConfig`
  - `writeConfig(scope, cwd, patch): void`
  - `listInstalled(scope, cwd): InstalledServer[]`
  - `addServer(scope, cwd, normalizedServer, options)`
  - `removeServer(scope, cwd, serverKey)`

This mirrors how `skills` has `src/agents.ts`, but the work is config file mutation rather than filesystem installation.

## Phase 2 - Implement first four client adapters

### A) Claude Code adapter

Targets:

- Project scope: `.mcp.json`
- User scope: `~/.claude.json`

Behavior:

- Write `mcpServers` entries with appropriate transport (`type`, `command/args/env` or `type`, `url/headers`).
- Do not attempt to manage enterprise `managed-mcp.json` initially.

Secrets:

- Prefer env-var references (when supported). Default: do not inline secrets in project-scoped config.

### B) Claude Desktop adapter

Targets:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows later (keep adapter ready)

Behavior:

- Manage local stdio servers via `mcpServers` JSON config.
- Remote connector setup is primarily UI-driven; CLI can warn/skip for remote-only servers.

Secrets:

- If a server needs secrets and no safe env indirection is available, prompt interactively or require explicit flags in non-interactive mode.

### C) Codex adapter

Targets:

- Project scope: `.codex/config.toml`
- User scope: `~/.codex/config.toml`

Behavior:

- Render `[mcp_servers.<name>]` entries.
- Support stdio (`command`, `args`, `env`, `cwd`) and streamable HTTP (`url`, auth fields).

Secrets:

- Prefer token env-var fields (dont write raw tokens into TOML by default).

### D) OpenCode adapter

Targets:

- Project scope: `opencode.json` / `opencode.jsonc`
- User scope: `~/.config/opencode/opencode.json`

Behavior:

- Write into `mcp` object:
  - local: `{ type: "local", command: [..], environment, enabled }`
  - remote: `{ type: "remote", url, headers, oauth, enabled }`
- Use OpenCode `{env:VAR}` substitution for secrets by default.
- Respect OpenCode config merging model; only edit chosen scope.

## Phase 3 - Sources (where servers come from)

Support `skills`-like ergonomics:

1) MCP Registry (default)

- Input: `io.github.user/server`
- Fetch latest metadata and convert `server.json` -> `NormalizedServer`

2) Git repo / URL / local path

- Clone/open and discover `server.json` in conventional places:
  - `server.json` at repo root
  - `servers/**/server.json`
  - `.mcp/**/server.json`
- `--list`: show servers found
- `--server <id...>` / `--all`: select what to install

## Phase 4 - CLI commands (mirror skills UX)

### Commands

- `mcp add <source>`
  - `--agent <agents...>` (default: detect installed; if none detected, prompt)
  - `--scope project|user` (default per-agent: project when supported)
  - `--list` (discover only)
  - `--server <id...>` / `--all`
  - `--yes` (non-interactive)
  - Always print an Installation Summary: exact file paths + rendered config diffs/snippets.

- `mcp list` / `mcp ls`
  - Show installed servers per agent + scope + config file path.

- `mcp remove <name>` / `mcp rm`
  - Remove from selected agents/scopes.

- `mcp check`
  - Registry-backed: compare configured vs latest.

- `mcp update`
  - Registry-backed: update pinned versions where applicable.
  - If a config uses floating versions (e.g. `@latest`), report no-op.

## Phase 5 - Lock file + safety

Create `~/.agents/.mcp-lock.json` to track what the CLI installed:

- server id
- source (registry/git/local)
- version/metadata hash
- installed targets: agent + scope + installed-name
- timestamps

Safety:

- Never execute MCP servers; only configure clients.
- Always show full command/args/url/headers before writing.
- Default: do not write secrets into project-scoped config.

## Proposed repository layout

Mirrors `skills/src/*` style:

- `src/cli.ts`
- `src/add.ts`
- `src/list.ts`
- `src/remove.ts`
- `src/check.ts`
- `src/update.ts`
- `src/agents/`
  - `index.ts`
  - `claude-code.ts`
  - `claude-desktop.ts`
  - `codex.ts`
  - `opencode.ts`
- `src/sources/`
  - `source-parser.ts`
  - `registry.ts`
  - `git.ts`
  - `discover.ts`
- `src/manifests/`
  - `server-json.ts`
  - `normalize.ts`
- `src/lock.ts`
- `tests/` (fixtures per client format)

## Testing Strategy

### Test Environment

- **Docker-based cross-platform testing**: Use Docker containers to test on both Linux and macOS without polluting the host machine
  - Linux: Standard Node.js Docker images
  - macOS: Use Docker-OSX (https://github.com/sickcodes/Docker-OSX) to run actual macOS VMs in Docker
    - Runs macOS via QEMU+KVM inside Docker container
    - Supports macOS 10.13 (High Sierra) through 15 (Sequoia)
    - Requires Linux host with KVM support (or macOS host with Linux VM)
    - SSH access enabled on port 50922 for automation
  - Local development: Use Docker Compose to spin up test environments quickly
  - Cross-platform approach: Run tests in Docker-OSX for macOS behavior, standard Node images for Linux

### Test Categories

Create a comprehensive test harness with three test tiers:

1. **Litmus Tests** (Quick sanity checks)
   - Config file parsing for each format (JSON, JSONC, TOML)
   - Agent adapter detection logic
   - NormalizedServer validation
   - Basic CLI command routing

2. **Smoke Tests** (Integration checks)
   - End-to-end `mcp add` flow with mock filesystem
   - `mcp list` across all four agent adapters
   - `mcp remove` preserves unrelated config entries
   - Lock file read/write operations
   - Cross-platform path handling

3. **Regular Tests** (Feature validation)
   - **Adapter tests**: Each agent adapter (Claude Code, Claude Desktop, Codex, OpenCode)
     - Config read/write roundtrips
     - Secret handling (env vars vs inline)
     - Scope selection (project vs user)
   - **Source tests**: Registry, Git, and local path discovery
   - **Command tests**: All CLI commands with various flag combinations
   - **Edge cases**: Malformed configs, missing files, permission errors

### Test Harness as Definition of Completion

Use test coverage as the primary metric for feature readiness:

- **Phase 0 Complete**: All litmus tests passing, build system working in Docker
- **Phase 1 Complete**: Adapter interface tests passing, normalized model validated
- **Phase 2 Complete**: All four agent adapters have >80% test coverage
- **Phase 3 Complete**: Source discovery and registry integration tested
- **Phase 4 Complete**: All CLI commands tested end-to-end
- **Phase 5 Complete**: Lock file and safety mechanisms validated

### Test Infrastructure

```
tests/
├── litmus/           # Quick unit tests
│   ├── parsers.test.ts
│   ├── normalize.test.ts
│   └── adapters.test.ts
├── smoke/            # Integration tests
│   ├── add-flow.test.ts
│   ├── list-flow.test.ts
│   └── cross-platform.test.ts
├── integration/      # Full feature tests
│   ├── claude-code.test.ts
│   ├── claude-desktop.test.ts
│   ├── codex.test.ts
│   ├── opencode.test.ts
│   ├── registry.test.ts
│   └── lockfile.test.ts
├── fixtures/         # Test data
│   ├── configs/      # Sample config files per client
│   └── servers/      # Sample server.json files
└── docker/           # Docker test environments
    ├── Dockerfile.linux
    ├── docker-compose.test.yml
    └── docker-osx/   # Docker-OSX macOS testing
        ├── Dockerfile.osx
        ├── docker-compose.osx.yml
        └── setup-macos-tests.sh
```

### Docker-OSX Local Testing Setup

**Prerequisites:**
- Linux host with KVM support enabled, OR
- macOS host with a Linux VM (UTM, VMware Fusion, Parallels) that has KVM
- Docker and Docker Compose installed
- ~50GB free disk space

**Quick Start:**

```bash
# Start macOS VM in Docker
cd tests/docker/docker-osx
docker-compose -f docker-compose.osx.yml up -d

# Wait for macOS to boot (first boot takes ~10-15 minutes)
# SSH into the macOS container
docker exec -it docker-osx-macos ssh -p 50922 user@localhost

# Run tests inside macOS container
npm test
```

**Docker-OSX Configuration:**

Use `sickcodes/docker-osx:naked-auto` for automated testing:
- Pre-configured SSH access
- Automated command execution via `OSX_COMMANDS` env var
- No GUI needed for headless testing

Example docker-compose.osx.yml:
```yaml
version: '3.8'
services:
  macos-test:
    image: sickcodes/docker-osx:naked-auto
    container_name: docker-osx-macos
    environment:
      - USERNAME=user
      - PASSWORD=alpine
      - OSX_COMMANDS="brew install node pnpm && cd /app && pnpm install && pnpm test"
    volumes:
      - ../../..:/app
      - ./macos-test-data:/home/user/mcp-test
    devices:
      - /dev/kvm
    ports:
      - "50922:10022"
    privileged: true
```

**Testing Workflow:**

1. **Linux Tests** (fast, local):
   ```bash
   docker-compose -f tests/docker/docker-compose.test.yml up --abort-on-container-exit
   ```

2. **macOS Tests** (slower, uses Docker-OSX):
   ```bash
   # Start macOS VM
   docker-compose -f tests/docker/docker-osx/docker-compose.osx.yml up -d
   
   # Run tests (automatic via OSX_COMMANDS or manual via SSH)
   docker exec docker-osx-macos ssh -p 50922 user@localhost 'cd /app && npm test'
   
   # Stop VM when done
   docker-compose -f tests/docker/docker-osx/docker-compose.osx.yml down
   ```

3. **CI/CD** (GitHub Actions):
   - Use `macos-latest` runner for native macOS testing
   - Use Docker-OSX in Linux runners for containerized macOS testing

### CI/CD Integration

- Run litmus tests on every commit
- Run full smoke + integration tests on PRs
- Cross-platform matrix: Ubuntu, macOS latest
- Test against actual client config formats (where possible without installing full clients)

## Milestones / definition of done

1) `mcp add <server>` can install into:
   - Claude Code: `.mcp.json` (project)
   - OpenCode: `opencode.json` (project)
   - Codex: `.codex/config.toml` (project)
   - Claude Desktop: `claude_desktop_config.json` (user, stdio)
2) `mcp list` accurately reads state across all four.
3) `mcp remove` removes only the installed entries and preserves unrelated config.
4) `mcp check/update` works end-to-end for registry-backed servers.
5) Tests cover parsing, rendering, config merges, and lock file behavior.
6) **Test harness validates all features across Linux and macOS via Docker**
