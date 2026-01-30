import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import * as TOML from '@iarna/toml';
import { codexAdapter } from '../../src/agents/codex.ts';
import type { NormalizedServer } from '../../src/types.ts';

describe('Integration Tests - Codex Adapter', () => {
  let tempDir: string;

  const stdioServer: NormalizedServer = {
    id: 'io.github.user/filesystem',
    displayName: 'Filesystem Server',
    description: 'MCP filesystem server',
    transport: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
      env: { DEBUG: 'true' },
      cwd: '/home/user',
    },
    secrets: [],
  };

  const httpServer: NormalizedServer = {
    id: 'api.example.com/mcp',
    displayName: 'API Server',
    transport: {
      type: 'http',
      url: 'https://api.example.com/mcp',
      headers: { Authorization: 'Bearer token123' },
    },
    secrets: [],
  };

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'codex-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Config Path Resolution', () => {
    it('should return project config path', () => {
      const path = codexAdapter.getConfigPath('project', tempDir);
      expect(path).toBe(join(tempDir, '.codex/config.toml'));
    });

    it('should return user config path', () => {
      const path = codexAdapter.getConfigPath('user', tempDir);
      expect(path).toContain('.codex');
      expect(path).toContain('config.toml');
    });
  });

  describe('TOML Config Format', () => {
    it('should write valid TOML for stdio server', async () => {
      await codexAdapter.addServer('project', tempDir, stdioServer, {});

      const configPath = codexAdapter.getConfigPath('project', tempDir);
      const content = readFileSync(configPath, 'utf-8');
      const parsed = TOML.parse(content);

      expect(parsed).toHaveProperty('mcp_servers');
      expect(parsed.mcp_servers).toHaveProperty('filesystem');
      expect(parsed.mcp_servers!.filesystem).toMatchObject({
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
        env: { DEBUG: 'true' },
        cwd: '/home/user',
      });
    });

    it('should write valid TOML for http server', async () => {
      await codexAdapter.addServer('project', tempDir, httpServer, {});

      const configPath = codexAdapter.getConfigPath('project', tempDir);
      const content = readFileSync(configPath, 'utf-8');
      const parsed = TOML.parse(content);

      expect(parsed.mcp_servers).toHaveProperty('mcp');
      const server = parsed.mcp_servers!.mcp as Record<string, unknown>;
      expect(server.url).toBe('https://api.example.com/mcp');
      expect(server).toHaveProperty('auth');
    });

    it('should preserve existing TOML config', async () => {
      // Create existing config
      const configDir = join(tempDir, '.codex');
      const configPath = join(configDir, 'config.toml');
      const existingTOML = `
[settings]
model = "gpt-4"
temperature = 0.7

[mcp_servers.existing]
command = "existing"
args = []
`;
      mkdirSync(configDir, { recursive: true });
      writeFileSync(configPath, existingTOML);

      await codexAdapter.addServer('project', tempDir, stdioServer, {});

      const content = readFileSync(configPath, 'utf-8');
      const parsed = TOML.parse(content);

      // Should preserve settings
      expect(parsed.settings).toMatchObject({
        model: 'gpt-4',
        temperature: 0.7,
      });

      // Should preserve existing server
      expect(parsed.mcp_servers).toHaveProperty('existing');

      // Should add new server
      expect(parsed.mcp_servers).toHaveProperty('filesystem');
    });
  });

  describe('Server Installation', () => {
    it('should install to project scope', async () => {
      await codexAdapter.addServer('project', tempDir, stdioServer, {});

      const installed = await codexAdapter.listInstalled('project', tempDir);
      expect(installed).toHaveLength(1);
      expect(installed[0]!.name).toBe('filesystem');
    });

    it('should create .codex directory if needed', async () => {
      await codexAdapter.addServer('project', tempDir, stdioServer, {});

      expect(existsSync(join(tempDir, '.codex'))).toBe(true);
      expect(existsSync(join(tempDir, '.codex/config.toml'))).toBe(true);
    });
  });

  describe('Server Removal', () => {
    it('should remove server from TOML config', async () => {
      await codexAdapter.addServer('project', tempDir, stdioServer, {});
      await codexAdapter.removeServer('project', tempDir, 'filesystem');

      const config = await codexAdapter.readConfig('project', tempDir);
      expect(config.servers).not.toHaveProperty('filesystem');
    });
  });

  describe('Round-trip Serialization', () => {
    it('should correctly round-trip stdio config', async () => {
      await codexAdapter.addServer('project', tempDir, stdioServer, {});
      const installed = await codexAdapter.listInstalled('project', tempDir);

      expect(installed).toHaveLength(1);
      const roundTripped = installed[0]!.server;

      expect(roundTripped.transport.type).toBe('stdio');
      expect(roundTripped.transport.command).toBe('npx');
      expect(roundTripped.transport.args).toEqual(['-y', '@modelcontextprotocol/server-filesystem', '/tmp']);
    });
  });
});
