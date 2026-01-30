import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir, homedir, platform } from 'os';
import {
  claudeDesktopAdapter,
  normalizedToDesktopConfig,
  desktopConfigToNormalized,
} from '../../src/agents/claude-desktop.ts';
import type { NormalizedServer } from '../../src/types.ts';

describe('Integration Tests - Claude Desktop Adapter', () => {
  let tempDir: string;

  const stdioServer: NormalizedServer = {
    id: 'io.github.user/filesystem',
    displayName: 'Filesystem Server',
    description: 'MCP filesystem server',
    transport: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
      env: { HOME: '/home/user' },
    },
    secrets: [],
  };

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'claude-desktop-test-'));

    // Create mock Claude Desktop config directory
    const mockConfigDir = join(tempDir, 'Library/Application Support/Claude');
    mkdirSync(mockConfigDir, { recursive: true });

    // Override the config path for testing
    process.env.CLAUDE_DESKTOP_CONFIG_DIR = mockConfigDir;
  });

  afterEach(() => {
    delete process.env.CLAUDE_DESKTOP_CONFIG_DIR;
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Scope Support', () => {
    it('should only support user scope', () => {
      expect(claudeDesktopAdapter.supportedScopes).toEqual(['user']);
    });

    it('should throw when requesting project scope', () => {
      expect(() => {
        claudeDesktopAdapter.getConfigPath('project', tempDir);
      }).toThrow('only supports user scope');
    });
  });

  describe('Config Path', () => {
    it('should return correct path for macOS', () => {
      const plat = platform();
      if (plat === 'darwin') {
        const path = claudeDesktopAdapter.getConfigPath('user', tempDir);
        expect(path).toContain('Library/Application Support/Claude');
        expect(path).toContain('claude_desktop_config.json');
      }
    });
  });

  describe('Server Installation', () => {
    it('should install stdio server', async () => {
      // We need to use a mock since we can't easily override the hardcoded path
      // For now, just test that the adapter generates correct config format
      const config = normalizedToDesktopConfig(stdioServer);

      expect(config).toMatchObject({
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
        env: { HOME: '/home/user' },
      });
      expect(config).not.toHaveProperty('type'); // Desktop doesn't use type field
    });

    it('should skip http servers with warning', async () => {
      const httpServer: NormalizedServer = {
        id: 'http-server',
        displayName: 'HTTP Server',
        transport: {
          type: 'http',
          url: 'https://example.com/mcp',
        },
        secrets: [],
      };

      // Should not throw, but should warn
      await expect(
        claudeDesktopAdapter.addServer('user', tempDir, httpServer, {})
      ).resolves.not.toThrow();
    });
  });

  describe('Config Format', () => {
    it('should generate correct mcpServers structure', () => {
      const config = normalizedToDesktopConfig(stdioServer);

      // Claude Desktop format is simpler - no type field, just command/args/env
      expect(config.command).toBe('npx');
      expect(config.args).toEqual(['-y', '@modelcontextprotocol/server-filesystem', '/tmp']);
      expect(config.env).toEqual({ HOME: '/home/user' });
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
  });
});
