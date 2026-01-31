import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  readFileSync,
  existsSync,
  mkdirSync,
  unlinkSync,
} from 'fs';
import { join } from 'path';
import { tmpdir, homedir } from 'os';
import * as TOML from '@iarna/toml';
import * as commentJson from 'comment-json';
import { claudeCodeAdapter } from '../../src/agents/claude-code.ts';
import {
  claudeDesktopAdapter,
  normalizedToDesktopConfig,
  desktopConfigToNormalized,
} from '../../src/agents/claude-desktop.ts';
import { codexAdapter } from '../../src/agents/codex.ts';
import { opencodeAdapter } from '../../src/agents/opencode.ts';
import {
  readLockFile,
  writeLockFile,
  addLockEntry,
  removeLockEntry,
  getLockEntry,
  listLockEntries,
  generateMetadataHash,
} from '../../src/lock.ts';
import { runCheck } from '../../src/check.ts';
import type { LockFile, NormalizedServer } from '../../src/types.ts';

// These tests require Docker environment with proper filesystem access
describe('Integration Tests - Docker Environment Required', () => {
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
    tempDir = mkdtempSync(join(tmpdir(), 'mcp-integration-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);

    // Clear lock file
    const lockPath = join(homedir(), '.agents', '.mcp-lock.json');
    if (existsSync(lockPath)) {
      unlinkSync(lockPath);
    }
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tempDir, { recursive: true, force: true });

    // Clean up lock file
    const lockPath = join(homedir(), '.agents', '.mcp-lock.json');
    if (existsSync(lockPath)) {
      unlinkSync(lockPath);
    }
  });

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

    it('should correctly round-trip stdio server config', async () => {
      await claudeCodeAdapter.addServer('project', tempDir, stdioServer, {});
      const installed = await claudeCodeAdapter.listInstalled('project', tempDir);

      expect(installed).toHaveLength(1);
      const roundTripped = installed[0]!.server;

      expect(roundTripped.id).toBe('filesystem');
      expect(roundTripped.transport.type).toBe('stdio');
      expect(roundTripped.transport.command).toBe(stdioServer.transport.command);
      expect(roundTripped.transport.args).toEqual(stdioServer.transport.args);
    });
  });

  describe('Claude Desktop Adapter', () => {
    beforeEach(() => {
      // Create mock Claude Desktop config directory
      const mockConfigDir = join(tempDir, 'Library/Application Support/Claude');
      mkdirSync(mockConfigDir, { recursive: true });
      process.env.CLAUDE_DESKTOP_CONFIG_DIR = mockConfigDir;
    });

    afterEach(() => {
      delete process.env.CLAUDE_DESKTOP_CONFIG_DIR;
    });

    it('should only support user scope', () => {
      expect(claudeDesktopAdapter.supportedScopes).toEqual(['user']);
    });

    it('should throw when requesting project scope', () => {
      expect(() => {
        claudeDesktopAdapter.getConfigPath('project', tempDir);
      }).toThrow('only supports user scope');
    });

    it('should generate correct mcpServers structure', () => {
      const config = normalizedToDesktopConfig(stdioServer);

      expect(config.command).toBe('npx');
      expect(config.args).toEqual(['-y', '@modelcontextprotocol/server-filesystem', '/tmp']);
      expect(config.env).toEqual({ DEBUG: 'true' });
    });

    it('should parse desktop config back to normalized', () => {
      const desktopConfig = {
        command: 'node',
        args: ['server.js', '--port', '3000'],
        env: { NODE_ENV: 'production' },
      };

      const normalized = desktopConfigToNormalized('my-server', desktopConfig);

      expect(normalized.id).toBe('my-server');
      expect(normalized.displayName).toBe('my-server');
      expect(normalized.transport.type).toBe('stdio');
      expect(normalized.transport.command).toBe('node');
      expect(normalized.transport.args).toEqual(['server.js', '--port', '3000']);
      expect(normalized.transport.env).toEqual({ NODE_ENV: 'production' });
    });

    it('should skip http servers with warning', async () => {
      const httpOnlyServer: NormalizedServer = {
        id: 'http-server',
        displayName: 'HTTP Server',
        transport: {
          type: 'http',
          url: 'https://example.com/mcp',
        },
        secrets: [],
      };

      await expect(
        claudeDesktopAdapter.addServer('user', tempDir, httpOnlyServer, {})
      ).resolves.not.toThrow();
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

      const parsed = TOML.parse(content);
      expect(parsed).toHaveProperty('mcp_servers');
    });

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
      });
    });

    it('should preserve existing TOML config', async () => {
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

      expect(parsed.settings).toMatchObject({
        model: 'gpt-4',
        temperature: 0.7,
      });
      expect(parsed.mcp_servers).toHaveProperty('existing');
      expect(parsed.mcp_servers).toHaveProperty('filesystem');
    });

    it('should correctly round-trip stdio config', async () => {
      await codexAdapter.addServer('project', tempDir, stdioServer, {});
      const installed = await codexAdapter.listInstalled('project', tempDir);

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
      await opencodeAdapter.addServer('project', tempDir, httpServer, {});

      const config = await opencodeAdapter.readConfig('project', tempDir);
      expect(config.servers['mcp']).toMatchObject({
        type: 'remote',
        url: 'https://api.example.com/mcp',
        headers: { Authorization: 'Bearer token123' },
      });
    });

    it('should prefer opencode.jsonc if it exists', async () => {
      writeFileSync(join(tempDir, 'opencode.jsonc'), '{}');

      const path = opencodeAdapter.getConfigPath('project', tempDir);
      expect(path).toBe(join(tempDir, 'opencode.jsonc'));
    });

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

      expect(parsed.model).toBe('claude-3-opus');
      expect(parsed.temperature).toBe(0.7);
      expect(parsed.mcp.servers).toHaveProperty('existing');
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

      expect(content).toContain('// Model configuration');
      expect(content).toContain('filesystem');
    });

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

  describe('Lock File Operations', () => {
    it('should generate consistent hash for same server', () => {
      const hash1 = generateMetadataHash(testServer);
      const hash2 = generateMetadataHash(testServer);
      expect(hash1).toBe(hash2);
    });

    it('should generate different hash for different servers', () => {
      const differentServer: NormalizedServer = {
        id: 'different/server',
        displayName: 'Different Server',
        transport: {
          type: 'stdio',
          command: 'python',
          args: ['server.py'],
        },
        secrets: [],
      };

      const hash1 = generateMetadataHash(testServer);
      const hash2 = generateMetadataHash(differentServer);
      expect(hash1).not.toBe(hash2);
    });

    it('should generate 16 character hash', () => {
      const hash = generateMetadataHash(testServer);
      expect(hash.length).toBe(16);
    });

    it('should return default lock file when none exists', () => {
      const lock = readLockFile();
      expect(lock.version).toBe(1);
      expect(lock.servers).toEqual({});
    });

    it('should write and read lock file', () => {
      const lock: LockFile = {
        version: 1,
        servers: {
          'test/server': {
            serverId: 'test/server',
            source: { type: 'local', url: '/path/to/server' },
            metadataHash: 'abc123',
            targets: [{ agent: 'claude-code', scope: 'project', installedName: 'server' }],
            installedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      };

      writeLockFile(lock);
      const read = readLockFile();

      expect(read.version).toBe(1);
      expect(read.servers['test/server']).toBeDefined();
    });

    it('should add lock entry', () => {
      addLockEntry('test/server', { type: 'local', url: '/path/to/server' }, testServer, [
        { agent: 'claude-code', scope: 'project', installedName: 'server' },
      ]);

      const entry = getLockEntry('test/server');
      expect(entry).toBeDefined();
      expect(entry?.serverId).toBe('test/server');
      expect(entry?.source.type).toBe('local');
      expect(entry?.targets).toHaveLength(1);
    });

    it('should list all lock entries', () => {
      addLockEntry('server1', { type: 'local', url: '/path/to/server1' }, testServer, [
        { agent: 'claude-code', scope: 'project', installedName: 'server1' },
      ]);

      const differentServer: NormalizedServer = {
        ...testServer,
        id: 'server2',
      };

      addLockEntry('server2', { type: 'local', url: '/path/to/server' }, differentServer, [
        { agent: 'codex', scope: 'user', installedName: 'server2' },
      ]);

      const entries = listLockEntries();
      expect(entries).toHaveLength(2);
      expect(entries.map(e => e.serverId).sort()).toEqual(['server1', 'server2']);
    });

    it('should remove lock entry', () => {
      addLockEntry('test/server', { type: 'local', url: '/path/to/server' }, testServer, [
        { agent: 'claude-code', scope: 'project', installedName: 'server' },
      ]);

      expect(getLockEntry('test/server')).toBeDefined();

      removeLockEntry('test/server');

      expect(getLockEntry('test/server')).toBeUndefined();
    });
  });

  describe('Check Command', () => {
    it('should show message when no servers tracked', async () => {
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (...args) => logs.push(args.join(' '));

      await runCheck();

      console.log = originalLog;

      const output = logs.join('\n');
      expect(output).toContain('Install servers with usemcps add');
    });

    it('should list tracked servers', async () => {
      addLockEntry('server1', { type: 'local', url: '/path/to/server1' }, testServer, [
        { agent: 'claude-code', scope: 'project', installedName: 'server1' },
      ]);

      const server2: NormalizedServer = {
        ...testServer,
        id: 'server2',
      };

      addLockEntry('server2', { type: 'local', url: '/path/to/server2' }, server2, [
        { agent: 'claude-code', scope: 'project', installedName: 'server2' },
        { agent: 'codex', scope: 'project', installedName: 'server2' },
      ]);

      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (...args) => logs.push(args.join(' '));

      await runCheck();

      console.log = originalLog;

      const output = logs.join('\n');
      expect(output).toContain('server1');
      expect(output).toContain('server2');
      expect(output).toContain('local');
      expect(output).toContain('claude-code');
      expect(output).toContain('codex');
    });
  });
});
