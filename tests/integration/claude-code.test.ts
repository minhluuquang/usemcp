import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir, homedir } from 'os';
import { claudeCodeAdapter } from '../../src/agents/claude-code.ts';
import type { NormalizedServer, Scope } from '../../src/types.ts';

describe('Integration Tests - Claude Code Adapter', () => {
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
    tempDir = mkdtempSync(join(tmpdir(), 'claude-code-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Config Path Resolution', () => {
    it('should return project config path', () => {
      const path = claudeCodeAdapter.getConfigPath('project', tempDir);
      expect(path).toBe(join(tempDir, '.mcp.json'));
    });

    it('should return user config path', () => {
      const path = claudeCodeAdapter.getConfigPath('user', tempDir);
      expect(path).toContain('.claude');
      expect(path).toContain('config.json');
    });
  });

  describe('Server Installation', () => {
    it('should install stdio server to project scope', async () => {
      await claudeCodeAdapter.addServer('project', tempDir, stdioServer, {});

      const config = await claudeCodeAdapter.readConfig('project', tempDir);
      expect(config.servers).toHaveProperty('filesystem');
      expect(config.servers['filesystem']).toMatchObject({
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
        env: { DEBUG: 'true' },
      });
    });

    it('should install http server to project scope', async () => {
      await claudeCodeAdapter.addServer('project', tempDir, httpServer, {});

      const config = await claudeCodeAdapter.readConfig('project', tempDir);
      expect(config.servers).toHaveProperty('mcp');
      expect(config.servers['mcp']).toMatchObject({
        type: 'http',
        url: 'https://api.example.com/mcp',
        headers: { Authorization: 'Bearer token123' },
      });
    });

    it('should create config file if it does not exist', async () => {
      const configPath = claudeCodeAdapter.getConfigPath('project', tempDir);
      expect(existsSync(configPath)).toBe(false);

      await claudeCodeAdapter.addServer('project', tempDir, stdioServer, {});

      expect(existsSync(configPath)).toBe(true);
    });

    it('should preserve existing config when adding server', async () => {
      const configPath = join(tempDir, '.mcp.json');
      const existingConfig = {
        someOtherSetting: 'value',
        mcpServers: {
          existing: {
            type: 'stdio',
            command: 'existing',
            args: [],
          },
        },
      };
      writeFileSync(configPath, JSON.stringify(existingConfig, null, 2));

      await claudeCodeAdapter.addServer('project', tempDir, stdioServer, {});

      const finalConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
      expect(finalConfig.someOtherSetting).toBe('value');
      expect(finalConfig.mcpServers).toHaveProperty('existing');
      expect(finalConfig.mcpServers).toHaveProperty('filesystem');
    });
  });

  describe('Server Removal', () => {
    it('should remove server from config', async () => {
      await claudeCodeAdapter.addServer('project', tempDir, stdioServer, {});
      await claudeCodeAdapter.removeServer('project', tempDir, 'filesystem');

      const config = await claudeCodeAdapter.readConfig('project', tempDir);
      expect(config.servers).not.toHaveProperty('filesystem');
    });

    it('should not fail when removing non-existent server', async () => {
      await expect(
        claudeCodeAdapter.removeServer('project', tempDir, 'non-existent')
      ).resolves.not.toThrow();
    });
  });

  describe('List Installed Servers', () => {
    it('should list all installed servers', async () => {
      await claudeCodeAdapter.addServer('project', tempDir, stdioServer, {});
      await claudeCodeAdapter.addServer('project', tempDir, httpServer, {});

      const installed = await claudeCodeAdapter.listInstalled('project', tempDir);
      expect(installed).toHaveLength(2);
      
      const names = installed.map((s) => s.name).sort();
      expect(names).toEqual(['filesystem', 'mcp']);
    });

    it('should return empty array when no servers installed', async () => {
      const installed = await claudeCodeAdapter.listInstalled('project', tempDir);
      expect(installed).toEqual([]);
    });
  });

  describe('Round-trip Serialization', () => {
    it('should correctly round-trip stdio server config', async () => {
      await claudeCodeAdapter.addServer('project', tempDir, stdioServer, {});
      const installed = await claudeCodeAdapter.listInstalled('project', tempDir);

      expect(installed).toHaveLength(1);
      const roundTripped = installed[0]!.server;

      // The ID is normalized to just the server name (last part)
      expect(roundTripped.id).toBe('filesystem');
      expect(roundTripped.transport.type).toBe('stdio');
      expect(roundTripped.transport.command).toBe(stdioServer.transport.command);
      expect(roundTripped.transport.args).toEqual(stdioServer.transport.args);
    });

    it('should correctly round-trip http server config', async () => {
      await claudeCodeAdapter.addServer('project', tempDir, httpServer, {});
      const installed = await claudeCodeAdapter.listInstalled('project', tempDir);

      expect(installed).toHaveLength(1);
      const roundTripped = installed[0]!.server;

      expect(roundTripped.transport.type).toBe('http');
      expect(roundTripped.transport.url).toBe(httpServer.transport.url);
    });
  });
});
