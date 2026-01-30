import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import * as TOML from '@iarna/toml';
import { claudeCodeAdapter } from '../../src/agents/claude-code.ts';
import { claudeDesktopAdapter } from '../../src/agents/claude-desktop.ts';
import { codexAdapter } from '../../src/agents/codex.ts';
import { opencodeAdapter } from '../../src/agents/opencode.ts';
import type { NormalizedServer } from '../../src/types.ts';

describe('Litmus Tests - Config File Operations', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'mcp-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  const testServer: NormalizedServer = {
    id: 'test/server',
    displayName: 'Test Server',
    description: 'A test server',
    transport: {
      type: 'stdio',
      command: 'node',
      args: ['server.js'],
      env: { KEY: 'value' },
    },
    secrets: [],
  };

  describe('Claude Code Adapter', () => {
    it('should read empty config when file does not exist', async () => {
      const config = await claudeCodeAdapter.readConfig('project', tempDir);
      expect(config.servers).toEqual({});
    });

    it('should write and read config', async () => {
      await claudeCodeAdapter.addServer('project', tempDir, testServer, {});

      const config = await claudeCodeAdapter.readConfig('project', tempDir);
      expect(config.servers).toHaveProperty('server');
      expect(config.servers['server']).toMatchObject({
        type: 'stdio',
        command: 'node',
        args: ['server.js'],
        env: { KEY: 'value' },
      });
    });

    it('should list installed servers', async () => {
      await claudeCodeAdapter.addServer('project', tempDir, testServer, {});

      const installed = await claudeCodeAdapter.listInstalled('project', tempDir);
      expect(installed).toHaveLength(1);
      expect(installed[0]!.name).toBe('server');
    });

    it('should remove server', async () => {
      await claudeCodeAdapter.addServer('project', tempDir, testServer, {});
      await claudeCodeAdapter.removeServer('project', tempDir, 'server');

      const config = await claudeCodeAdapter.readConfig('project', tempDir);
      expect(config.servers).not.toHaveProperty('server');
    });

    it('should preserve other config when removing server', async () => {
      await claudeCodeAdapter.addServer('project', tempDir, testServer, {});

      const configPath = claudeCodeAdapter.getConfigPath('project', tempDir);
      const existingConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
      existingConfig.otherKey = 'otherValue';
      writeFileSync(configPath, JSON.stringify(existingConfig, null, 2));

      await claudeCodeAdapter.removeServer('project', tempDir, 'server');

      const finalConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
      expect(finalConfig.otherKey).toBe('otherValue');
    });
  });

  describe('Codex Adapter', () => {
    it('should write and read TOML config', async () => {
      await codexAdapter.addServer('project', tempDir, testServer, {});

      const configPath = codexAdapter.getConfigPath('project', tempDir);
      expect(existsSync(configPath)).toBe(true);

      const config = await codexAdapter.readConfig('project', tempDir);
      expect(config.servers).toHaveProperty('server');
    });

    it('should preserve TOML structure', async () => {
      await codexAdapter.addServer('project', tempDir, testServer, {});

      const configPath = codexAdapter.getConfigPath('project', tempDir);
      const content = readFileSync(configPath, 'utf-8');

      // Should be valid TOML with mcp_servers section
      const parsed = TOML.parse(content);
      expect(parsed).toHaveProperty('mcp_servers');
    });
  });

  describe('OpenCode Adapter', () => {
    it('should write and read JSON config', async () => {
      await opencodeAdapter.addServer('project', tempDir, testServer, {});

      const config = await opencodeAdapter.readConfig('project', tempDir);
      expect(config.servers).toHaveProperty('server');
      expect(config.servers['server']).toMatchObject({
        type: 'local',
        command: ['node', 'server.js'],
        enabled: true,
      });
    });

    it('should handle http transport', async () => {
      const httpServer: NormalizedServer = {
        id: 'http-server',
        displayName: 'HTTP Server',
        transport: {
          type: 'http',
          url: 'https://example.com/mcp',
          headers: { Authorization: 'Bearer token' },
        },
        secrets: [],
      };

      await opencodeAdapter.addServer('project', tempDir, httpServer, {});

      const config = await opencodeAdapter.readConfig('project', tempDir);
      expect(config.servers['http-server']).toMatchObject({
        type: 'remote',
        url: 'https://example.com/mcp',
        headers: { Authorization: 'Bearer token' },
      });
    });
  });
});
