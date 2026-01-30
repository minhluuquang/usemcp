import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import * as commentJson from 'comment-json';
import { opencodeAdapter } from '../../src/agents/opencode.ts';
import type { NormalizedServer } from '../../src/types.ts';

describe('Integration Tests - OpenCode Adapter', () => {
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
    tempDir = mkdtempSync(join(tmpdir(), 'opencode-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Config Path Resolution', () => {
    it('should return project config path (opencode.json)', () => {
      const path = opencodeAdapter.getConfigPath('project', tempDir);
      expect(path).toBe(join(tempDir, 'opencode.json'));
    });

    it('should prefer opencode.jsonc if it exists', () => {
      // Create opencode.jsonc
      writeFileSync(join(tempDir, 'opencode.jsonc'), '{}');

      const path = opencodeAdapter.getConfigPath('project', tempDir);
      expect(path).toBe(join(tempDir, 'opencode.jsonc'));
    });

    it('should return user config path', () => {
      const path = opencodeAdapter.getConfigPath('user', tempDir);
      expect(path).toContain('opencode');
      expect(path).toContain('opencode.json');
    });
  });

  describe('JSON Config Format', () => {
    it('should write valid JSON for local (stdio) server', async () => {
      await opencodeAdapter.addServer('project', tempDir, stdioServer, {});

      const configPath = opencodeAdapter.getConfigPath('project', tempDir);
      const content = readFileSync(configPath, 'utf-8');
      const parsed = commentJson.parse(content);

      expect(parsed).toHaveProperty('mcp');
      expect(parsed.mcp).toHaveProperty('servers');
      expect(parsed.mcp.servers).toHaveProperty('filesystem');
      expect(parsed.mcp.servers.filesystem).toMatchObject({
        type: 'local',
        command: ['npx', '-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
        environment: { DEBUG: 'true' },
        enabled: true,
      });
    });

    it('should write valid JSON for remote (http) server', async () => {
      await opencodeAdapter.addServer('project', tempDir, httpServer, {});

      const configPath = opencodeAdapter.getConfigPath('project', tempDir);
      const content = readFileSync(configPath, 'utf-8');
      const parsed = commentJson.parse(content);

      expect(parsed.mcp.servers).toHaveProperty('mcp');
      expect(parsed.mcp.servers.mcp).toMatchObject({
        type: 'remote',
        url: 'https://api.example.com/mcp',
        headers: { Authorization: 'Bearer token123' },
        enabled: true,
      });
    });

    it('should preserve existing JSON config', async () => {
      const configPath = join(tempDir, 'opencode.json');
      const existingConfig = {
        model: 'claude-3-opus',
        temperature: 0.7,
        mcp: {
          servers: {
            existing: {
              type: 'local',
              command: ['existing'],
              enabled: true,
            },
          },
        },
      };
      writeFileSync(configPath, JSON.stringify(existingConfig, null, 2));

      await opencodeAdapter.addServer('project', tempDir, stdioServer, {});

      const content = readFileSync(configPath, 'utf-8');
      const parsed = commentJson.parse(content);

      // Should preserve top-level settings
      expect(parsed.model).toBe('claude-3-opus');
      expect(parsed.temperature).toBe(0.7);

      // Should preserve existing server
      expect(parsed.mcp.servers).toHaveProperty('existing');

      // Should add new server
      expect(parsed.mcp.servers).toHaveProperty('filesystem');
    });

    it('should preserve comments in JSONC files', async () => {
      const configPath = join(tempDir, 'opencode.jsonc');
      const existingConfig = `{
  // Model configuration
  "model": "claude-3-opus",
  "temperature": 0.7,
  "mcp": {
    "servers": {}
  }
}`;
      writeFileSync(configPath, existingConfig);

      await opencodeAdapter.addServer('project', tempDir, stdioServer, {});

      const content = readFileSync(configPath, 'utf-8');

      // Should preserve comment
      expect(content).toContain('// Model configuration');

      // Should have added server
      expect(content).toContain('filesystem');
    });
  });

  describe('Server Installation', () => {
    it('should install to project scope', async () => {
      await opencodeAdapter.addServer('project', tempDir, stdioServer, {});

      const installed = await opencodeAdapter.listInstalled('project', tempDir);
      expect(installed).toHaveLength(1);
      expect(installed[0]!.name).toBe('filesystem');
    });

    it('should create config file if needed', async () => {
      await opencodeAdapter.addServer('project', tempDir, stdioServer, {});

      expect(existsSync(join(tempDir, 'opencode.json'))).toBe(true);
    });
  });

  describe('Server Removal', () => {
    it('should remove server from JSON config', async () => {
      await opencodeAdapter.addServer('project', tempDir, stdioServer, {});
      await opencodeAdapter.removeServer('project', tempDir, 'filesystem');

      const config = await opencodeAdapter.readConfig('project', tempDir);
      expect(config.servers).not.toHaveProperty('filesystem');
    });
  });

  describe('Round-trip Serialization', () => {
    it('should correctly round-trip local (stdio) config', async () => {
      await opencodeAdapter.addServer('project', tempDir, stdioServer, {});
      const installed = await opencodeAdapter.listInstalled('project', tempDir);

      expect(installed).toHaveLength(1);
      const roundTripped = installed[0]!.server;

      expect(roundTripped.transport.type).toBe('stdio');
      expect(roundTripped.transport.command).toBe('npx');
      expect(roundTripped.transport.args).toEqual([
        '-y',
        '@modelcontextprotocol/server-filesystem',
        '/tmp',
      ]);
    });

    it('should correctly round-trip remote (http) config', async () => {
      await opencodeAdapter.addServer('project', tempDir, httpServer, {});
      const installed = await opencodeAdapter.listInstalled('project', tempDir);

      expect(installed).toHaveLength(1);
      const roundTripped = installed[0]!.server;

      expect(roundTripped.transport.type).toBe('http');
      expect(roundTripped.transport.url).toBe('https://api.example.com/mcp');
    });
  });
});
