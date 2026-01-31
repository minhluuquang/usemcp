#!/bin/bash
# Real Agent Test with Playwright MCP Server
# 
# This script tests the usemcps CLI with:
# - REAL agents installed (Claude Code, Codex, OpenCode)
# - REAL MCP server: @playwright/mcp (Microsoft's official Playwright MCP server)
# - Verifies MCP server is available in all agents

set -e

echo "=== MCP Real Agent Test with Playwright MCP ==="
echo ""

# Ensure PATH includes npm global bin
export PATH="$HOME/.npm-global/bin:$PATH"

# Track test results
TESTS_PASSED=0
TESTS_FAILED=0

# Function to report test result
report_test() {
    local test_name="$1"
    local result="$2"
    
    if [ "$result" -eq 0 ]; then
        echo "✓ PASS: $test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo "✗ FAIL: $test_name"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

# Check which agents are actually installed
echo "Checking installed agents..."
echo ""

# Check Claude Code
if which claude > /dev/null 2>&1; then
    CLAUDE_VERSION=$(claude --version 2>&1 | head -1 || echo 'version unknown')
    echo "✓ Claude Code installed: $CLAUDE_VERSION"
    # Claude Code uses ~/.claude.json for config (not ~/.claude/config.json)
    echo '{"initialized": true}' > "$HOME/.claude.json"
    CLAUDE_INSTALLED=true
else
    echo "✗ Claude Code not found in PATH"
    CLAUDE_INSTALLED=false
fi

# Check Codex
if which codex > /dev/null 2>&1; then
    CODEX_VERSION=$(codex --version 2>&1 | head -1 || echo 'version unknown')
    echo "✓ Codex installed: $CODEX_VERSION"
    CODEX_INSTALLED=true
else
    echo "✗ Codex not found in PATH"
    CODEX_INSTALLED=false
fi

# Check OpenCode
if which opencode > /dev/null 2>&1; then
    OPENCODE_VERSION=$(opencode --version 2>&1 | head -1 || echo 'version unknown')
    echo "✓ OpenCode installed: $OPENCODE_VERSION"
    mkdir -p "$HOME/.config/opencode"
    echo '{"mcp": {"servers": {}}}' > "$HOME/.config/opencode/opencode.json"
    OPENCODE_INSTALLED=true
else
    echo "✗ OpenCode not found in PATH"
    OPENCODE_INSTALLED=false
fi

echo ""
echo "=== Testing usemcps CLI ==="
echo ""

# Create test directory
TEST_DIR=$(mktemp -d)
echo "Test directory: $TEST_DIR"
cd "$TEST_DIR"

# Test 1: Check usemcps version
echo "Test 1: Checking usemcps --version"
if usemcps --version > /dev/null 2>&1; then
    usemcps --version
    report_test "usemcps --version" 0
else
    report_test "usemcps --version" 1
fi
echo ""

# Test 2: Install Playwright MCP server with user scope (to test agent-specific configs)
echo "Test 2: Installing Playwright MCP server (user scope)"
if usemcps add --yes --scope user playwright -- npx -y @playwright/mcp@latest --headless 2>&1; then
    report_test "Install Playwright MCP" 0
else
    report_test "Install Playwright MCP" 1
fi
echo ""

# Test 3: Check usemcps list --global detects agents with Playwright installed
echo "Test 3: Checking usemcps list detects agents with Playwright"
if usemcps list --global 2>&1 | grep -q "Claude Code\|Codex\|OpenCode"; then
    report_test "usemcps list detects agents" 0
else
    report_test "usemcps list detects agents" 1
fi
echo ""

# Test 4: Verify Playwright appears in usemcps list --global
echo "Test 4: Verifying Playwright appears in usemcps list"
if usemcps list --global 2>&1 | grep -qi "playwright"; then
    report_test "Playwright appears in usemcps list" 0
else
    report_test "Playwright appears in usemcps list" 1
fi
echo ""

# Test 5: Verify Playwright in Claude Code config (user scope: ~/.claude.json)
echo "Test 5: Verifying Playwright in Claude Code config"
if [ "$CLAUDE_INSTALLED" = true ]; then
    # Claude Code with user scope uses ~/.claude.json
    if [ -f "$HOME/.claude.json" ] && grep -q "playwright" "$HOME/.claude.json" 2>&1; then
        report_test "Playwright in Claude Code config" 0
    else
        report_test "Playwright in Claude Code config" 1
    fi
else
    echo "  (Skipped - Claude Code not installed)"
fi
echo ""

# Test 6: Verify Playwright in Codex config (user scope: ~/.codex/config.toml)
echo "Test 6: Verifying Playwright in Codex config"
if [ "$CODEX_INSTALLED" = true ]; then
    # Codex with user scope uses ~/.codex/config.toml
    if [ -f "$HOME/.codex/config.toml" ] && grep -q "playwright" "$HOME/.codex/config.toml" 2>&1; then
        report_test "Playwright in Codex config" 0
    else
        report_test "Playwright in Codex config" 1
    fi
else
    echo "  (Skipped - Codex not installed)"
fi
echo ""

# Test 7: Verify Playwright in OpenCode config (user scope: ~/.config/opencode/opencode.json)
echo "Test 7: Verifying Playwright in OpenCode config"
if [ "$OPENCODE_INSTALLED" = true ]; then
    # OpenCode with user scope uses ~/.config/opencode/opencode.json
    if [ -f "$HOME/.config/opencode/opencode.json" ] && grep -q "playwright" "$HOME/.config/opencode/opencode.json" 2>&1; then
        report_test "Playwright in OpenCode config" 0
    else
        report_test "Playwright in OpenCode config" 1
    fi
else
    echo "  (Skipped - OpenCode not installed)"
fi
echo ""

# Test 8: Verify lock file tracks the installation
echo "Test 8: Verifying lock file tracks Playwright installation"
if [ -f "$HOME/.agents/.mcp-lock.json" ] && grep -q "playwright" "$HOME/.agents/.mcp-lock.json" 2>&1; then
    report_test "Lock file tracks Playwright" 0
else
    report_test "Lock file tracks Playwright" 1
fi
echo ""

# Print test summary
echo "========================================"
echo "Test Summary"
echo "========================================"
echo "Tests Passed: $TESTS_PASSED"
echo "Tests Failed: $TESTS_FAILED"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo "✓ All tests passed!"
    echo ""
    echo "Playwright MCP server is successfully installed and available in all agents."
    echo ""
    echo "Test directory: $TEST_DIR"
    echo "To inspect: docker exec -it mcp-linux-test /bin/bash"
    exit 0
else
    echo "✗ Some tests failed!"
    echo ""
    echo "Test directory: $TEST_DIR"
    echo "To debug: docker exec -it mcp-linux-test /bin/bash"
    exit 1
fi
