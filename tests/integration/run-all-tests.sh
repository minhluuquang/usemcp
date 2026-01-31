#!/bin/bash
# Combined Test Script - Integration Tests + Real Agent Tests with Playwright MCP
# 
# This script runs:
# 1. Integration tests (filesystem operations, lock file, adapter config operations)
# 2. Real agent tests with REAL MCP clients (Claude Code, Codex, OpenCode)
# 3. REAL MCP server: @playwright/mcp (Microsoft's official Playwright MCP server)

set -e

echo "========================================"
echo "Combined Docker Test Suite"
echo "========================================"
echo ""

# Track overall test results
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

# Ensure PATH includes npm global bin
export PATH="$HOME/.npm-global/bin:$PATH"

cd /app

echo "=== Phase 1: Integration Tests ==="
echo ""

# Run integration tests using pnpm (enable integration tests via env var)
echo "Running integration tests (filesystem, lock file, adapter operations)..."
if VITEST_INCLUDE_INTEGRATION=1 pnpm test:integration 2>&1; then
    report_test "Integration Tests" 0
else
    report_test "Integration Tests" 1
fi
echo ""

echo "=== Phase 2: Real Agent Tests with Playwright MCP ==="
echo ""

# Run the real agent test script
if bash /usr/local/bin/test-real-agents.sh 2>&1; then
    report_test "Real Agent Tests" 0
else
    report_test "Real Agent Tests" 1
fi
echo ""

# Print final summary
echo "========================================"
echo "Final Test Summary"
echo "========================================"
echo "Tests Passed: $TESTS_PASSED"
echo "Tests Failed: $TESTS_FAILED"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo "✓ All tests passed!"
    exit 0
else
    echo "✗ Some tests failed!"
    exit 1
fi
