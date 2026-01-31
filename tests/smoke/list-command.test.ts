import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { parseListOptions, runList } from '../../src/list.ts';
import { claudeCodeAdapter } from '../../src/agents/claude-code.ts';
import { codexAdapter } from '../../src/agents/codex.ts';
import type { NormalizedServer } from '../../src/types.ts';

describe('Smoke Tests - List Command', () => {
  let tempDir: string;
  let originalCwd: string;

  const testServer: NormalizedServer = {
    id: 'test/server',
    displayName: 'Test Server',
    description: 'A test server',
    transport: {
      type: 'stdio',
      command: 'node',
      args: ['server.js'],
    },
    secrets: [],
  };

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'mcp-list-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('parseListOptions', () => {
    it('should parse --global flag', () => {
      const options = parseListOptions(['--global']);
      expect(options.global).toBe(true);
    });

    it('should parse -g shorthand', () => {
      const options = parseListOptions(['-g']);
      expect(options.global).toBe(true);
    });

    it('should parse --agent flag', () => {
      const options = parseListOptions(['--agent', 'claude-code,codex']);
      expect(options.agents).toEqual(['claude-code', 'codex']);
    });

    it('should parse -a shorthand', () => {
      const options = parseListOptions(['-a', 'claude-code']);
      expect(options.agents).toEqual(['claude-code']);
    });

    it('should return empty options when no args', () => {
      const options = parseListOptions([]);
      expect(options).toEqual({});
    });
  });

  describe('runList', () => {
    it('should list installed servers', async () => {
      // Install a server first
      await claudeCodeAdapter.addServer('project', tempDir, testServer, {});

      // Capture console output
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (...args) => logs.push(args.join(' '));

      await runList({});

      console.log = originalLog;

      // Should have logged the server
      const output = logs.join('\n');
      expect(output).toContain('server');
      expect(output).toContain('stdio');
    });

    it('should filter by agent', async () => {
      // Install to Claude Code
      await claudeCodeAdapter.addServer('project', tempDir, testServer, {});

      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (...args) => logs.push(args.join(' '));

      await runList({ agents: ['claude-code'] });

      console.log = originalLog;

      const output = logs.join('\n');
      expect(output).toContain('Claude Code');
    });

    it('should show agents even when no servers', async () => {
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (...args) => logs.push(args.join(' '));

      await runList({});

      console.log = originalLog;

      const output = logs.join('\n');
      // Should show total count even when no servers
      expect(output).toContain('Total: 0 server(s)');
    });
  });
});
