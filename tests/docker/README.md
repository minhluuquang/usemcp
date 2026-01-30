# Docker Test Environments

## Linux Testing

### Basic Linux Test

Run the unit/integration test suite in a Linux container:

```bash
cd tests/docker
docker-compose -f docker-compose.test.yml up --build
```

### Real Agent Simulation Test

This test simulates having real MCP agents installed (Claude Code, Codex, OpenCode) and tests the full mcp CLI workflow:

```bash
cd tests/docker
docker-compose -f docker-compose.test.yml up --build
```

**What it tests:**
1. ✓ Mock agent detection (creates config dirs for Claude Code, Codex, OpenCode)
2. ✓ mcp --version
3. ✓ mcp list (empty state)
4. ✓ Creating test MCP server config
5. ✓ mcp list (with installed server)
6. ✓ Cross-platform config file handling

**Output:**
```
=== MCP Real Agent Simulation Test ===
✓ Claude Code config created
✓ Codex config created
✓ OpenCode config created
✓ Test server config created
1. Testing mcp --version -> 0.1.0
2. Testing mcp list -> No MCP servers installed
5. Testing mcp list again -> Shows test-filesystem server
Total: 1 server(s)
```

## macOS Testing

For macOS testing, you have several options:

### Option 1: GitHub Actions (CI/CD)
The project includes GitHub Actions workflows that test on macOS runners.

### Option 2: Local macOS
If you're on macOS, tests run natively:

```bash
pnpm test:run
```

### Option 3: Docker-OSX (Experimental)
For testing macOS in Docker (requires Linux host with KVM):

**Quick Start:**
```bash
cd tests/docker/docker-osx
./setup-macos-tests.sh
```

**Manual Setup:**
```bash
cd tests/docker/docker-osx

# Start macOS VM (first boot takes 10-15 minutes)
docker-compose -f docker-compose.osx.yml up -d

# Check boot progress
docker logs -f docker-osx-macos

# Once booted, SSH into the VM
docker exec -it docker-osx-macos ssh -p 50922 user@localhost

# Inside the macOS container
cd /app && pnpm test:run
```

**Automated Testing:**
```bash
# Run tests without interactive SSH
docker exec docker-osx-macos ssh -p 50922 user@localhost 'cd /app && pnpm test:run'

# Stop the VM
docker-compose -f docker-compose.osx.yml down
```

**Requirements:**
- Linux host with KVM support (`/dev/kvm` must exist)
- CPU with virtualization support (VT-x/AMD-V)
- ~50GB free disk space
- 4GB+ RAM allocated to the container

**Note:** Docker-OSX runs macOS via QEMU+KVM inside a container. It's primarily useful for CI/CD environments where you need to test macOS-specific behavior (like config file paths) without a physical Mac.

## Cross-Platform Compatibility

The codebase is designed to be cross-platform:

- **Path handling**: Uses Node.js `path` module
- **Config locations**: Uses `xdg-basedir` for XDG compliance
- **OS detection**: Uses Node.js `os` module for platform-specific paths
- **File operations**: Uses Node.js `fs` promises API

## Test Categories

1. **Litmus Tests** - Fast unit tests (~100ms)
2. **Smoke Tests** - Integration tests (~500ms)
3. **Integration Tests** - Full adapter tests (~1s)

All tests run in sequence to avoid shared state issues.
