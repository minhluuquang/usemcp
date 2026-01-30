import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { parseRemoveOptions, runRemove } from '../../src/remove.ts';
import { claudeCodeAdapter } from '../../src/agents/claude-code.ts';
import type { NormalizedServer } from '../../src/types.ts';

describe('Smoke Tests - Remove Command', () => {
  let tempDir: string;
  let originalCwd: string;

  const testServer: NormalizedServer = {
    id: 'test/server',
    displayName: 'Test Server',
    transport: {
      type: 'stdio',
      command: 'node',
      args: ['server.js'],
    },
    secrets: [],
  };

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'mcp-remove-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('parseRemoveOptions', () => {
    it('should parse server names', () => {
      const { servers, options } = parseRemoveOptions(['server1', 'server2']);
      expect(servers).toEqual(['server1', 'server2']);
    });

    it('should parse --global flag', () => {
      const { servers, options } = parseRemoveOptions(['--global', 'server1']);
      expect(options.global).toBe(true);
      expect(servers).toEqual(['server1']);
    });

    it('should parse -g shorthand', () => {
      const { servers, options } = parseRemoveOptions(['-g', 'server1']);
      expect(options.global).toBe(true);
    });

    it('should parse --agent flag', () => {
      const { servers, options } = parseRemoveOptions(['--agent', 'claude-code', 'server1']);
      expect(options.agents).toEqual(['claude-code']);
    });

    it('should parse -a shorthand', () => {
      const { servers, options } = parseRemoveOptions(['-a', 'claude-code', 'server1']);
      expect(options.agents).toEqual(['claude-code']);
    });

    it('should parse --yes flag', () => {
      const { servers, options } = parseRemoveOptions(['--yes', 'server1']);
      expect(options.yes).toBe(true);
    });

    it('should parse -y shorthand', () => {
      const { servers, options } = parseRemoveOptions(['-y', 'server1']);
      expect(options.yes).toBe(true);
    });

    it('should handle empty server list', () => {
      const { servers, options } = parseRemoveOptions([]);
      expect(servers).toEqual([]);
    });
  });

  describe('runRemove', () => {
    it('should remove specified server', async () => {
      // Install a server first
      await claudeCodeAdapter.addServer('project', tempDir, testServer, {});

      // Verify it's installed
      let installed = await claudeCodeAdapter.listInstalled('project', tempDir);
      expect(installed).toHaveLength(1);

      // Remove it (with --yes to skip prompt)
      await runRemove(['server'], { yes: true });

      // Verify it's removed
      installed = await claudeCodeAdapter.listInstalled('project', tempDir);
      expect(installed).toHaveLength(0);
    });

    it('should handle removing non-existent server', async () => {
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (...args) => logs.push(args.join(' '));

      await runRemove(['non-existent'], { yes: true });

      console.log = originalLog;

      const output = logs.join('\n');
      expect(output).toContain('not found');
    });

    it('should preserve unrelated config entries when removing', async () => {
      // Install server
      await claudeCodeAdapter.addServer('project', tempDir, testServer, {});

      // Add some other config
      const configPath = claudeCodeAdapter.getConfigPath('project', tempDir);
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      config.otherSetting = 'value';
      writeFileSync(configPath, JSON.stringify(config, null, 2));

      // Remove server
      await runRemove(['server'], { yes: true });

      // Verify other setting is preserved
      const finalConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
      expect(finalConfig.otherSetting).toBe('value');
      expect(finalConfig.mcpServers).toEqual({});
    });
  });
});
