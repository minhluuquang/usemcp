import { describe, it, expect } from 'vitest';
import {
  validateServerJson,
  normalizeServerJson,
  parseServerJson,
} from '../src/manifests/server-json.ts';
import type { ServerJsonManifest } from '../src/manifests/server-json.ts';
import type { StdioTransport, HttpTransport, SseTransport } from '../src/types.ts';

describe('Server.json Parsing', () => {
  describe('validateServerJson', () => {
    it('should validate a valid stdio manifest', () => {
      const manifest: ServerJsonManifest = {
        name: 'test-server',
        transport: 'stdio',
        command: 'node',
        args: ['server.js'],
      };

      expect(validateServerJson(manifest)).toBe(true);
    });

    it('should validate a valid http manifest', () => {
      const manifest: ServerJsonManifest = {
        name: 'test-server',
        transport: 'http',
        url: 'https://example.com/mcp',
      };

      expect(validateServerJson(manifest)).toBe(true);
    });

    it('should reject manifest without name', () => {
      const manifest = {
        transport: 'stdio',
        command: 'node',
      };

      expect(validateServerJson(manifest)).toBe(false);
    });

    it('should reject manifest without transport', () => {
      const manifest = {
        name: 'test-server',
        command: 'node',
      };

      expect(validateServerJson(manifest)).toBe(false);
    });

    it('should reject stdio manifest without command', () => {
      const manifest = {
        name: 'test-server',
        transport: 'stdio',
        args: ['server.js'],
      };

      expect(validateServerJson(manifest)).toBe(false);
    });

    it('should reject http manifest without url', () => {
      const manifest = {
        name: 'test-server',
        transport: 'http',
      };

      expect(validateServerJson(manifest)).toBe(false);
    });

    it('should reject invalid transport type', () => {
      const manifest = {
        name: 'test-server',
        transport: 'invalid',
      };

      expect(validateServerJson(manifest)).toBe(false);
    });

    it('should reject non-object input', () => {
      expect(validateServerJson(null)).toBe(false);
      expect(validateServerJson('string')).toBe(false);
      expect(validateServerJson(123)).toBe(false);
    });
  });

  describe('normalizeServerJson', () => {
    it('should normalize stdio transport', () => {
      const manifest: ServerJsonManifest = {
        name: 'io.github.user/server',
        description: 'Test server',
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem'],
        env: { KEY: 'value' },
        cwd: '/tmp',
      };

      const normalized = normalizeServerJson(manifest);

      expect(normalized.id).toBe('io.github.user/server');
      expect(normalized.displayName).toBe('io.github.user/server');
      expect(normalized.description).toBe('Test server');
      const stdioTransport = normalized.transport as StdioTransport;
      expect(stdioTransport.type).toBe('stdio');
      expect(stdioTransport.command).toBe('npx');
      expect(stdioTransport.args).toEqual(['-y', '@modelcontextprotocol/server-filesystem']);
      expect(stdioTransport.env).toEqual({ KEY: 'value' });
      expect(stdioTransport.cwd).toBe('/tmp');
    });

    it('should normalize http transport', () => {
      const manifest: ServerJsonManifest = {
        name: 'http-server',
        transport: 'http',
        url: 'https://api.example.com/mcp',
        headers: { Authorization: 'Bearer token' },
      };

      const normalized = normalizeServerJson(manifest);

      expect(normalized.id).toBe('http-server');
      const httpTransport = normalized.transport as HttpTransport;
      expect(httpTransport.type).toBe('http');
      expect(httpTransport.url).toBe('https://api.example.com/mcp');
      expect(httpTransport.headers).toEqual({ Authorization: 'Bearer token' });
    });

    it('should normalize sse transport', () => {
      const manifest: ServerJsonManifest = {
        name: 'sse-server',
        transport: 'sse',
        url: 'https://events.example.com/sse',
      };

      const normalized = normalizeServerJson(manifest);

      const sseTransport = normalized.transport as SseTransport;
      expect(sseTransport.type).toBe('sse');
      expect(sseTransport.url).toBe('https://events.example.com/sse');
    });

    it('should handle secrets', () => {
      const manifest: ServerJsonManifest = {
        name: 'server-with-secrets',
        transport: 'stdio',
        command: 'node',
        secrets: [
          { name: 'API_KEY', description: 'API key', required: true },
          { name: 'OPTIONAL_KEY', required: false },
        ],
      };

      const normalized = normalizeServerJson(manifest);

      expect(normalized.secrets).toHaveLength(2);
      expect(normalized.secrets[0]).toEqual({
        name: 'API_KEY',
        description: 'API key',
        required: true,
      });
      expect(normalized.secrets[1]).toEqual({
        name: 'OPTIONAL_KEY',
        required: false,
      });
    });

    it('should default args to empty array', () => {
      const manifest: ServerJsonManifest = {
        name: 'simple-server',
        transport: 'stdio',
        command: 'node',
      };

      const normalized = normalizeServerJson(manifest);

      const stdioTransport = normalized.transport as StdioTransport;
      expect(stdioTransport.args).toEqual([]);
    });

    it('should default secrets to empty array', () => {
      const manifest: ServerJsonManifest = {
        name: 'no-secrets-server',
        transport: 'stdio',
        command: 'node',
      };

      const normalized = normalizeServerJson(manifest);

      expect(normalized.secrets).toEqual([]);
    });
  });

  describe('parseServerJson', () => {
    it('should parse valid JSON string', () => {
      const json = JSON.stringify({
        name: 'test-server',
        transport: 'stdio',
        command: 'node',
      });

      const normalized = parseServerJson(json);

      expect(normalized.id).toBe('test-server');
    });

    it('should throw on invalid JSON', () => {
      expect(() => parseServerJson('not json')).toThrow('Invalid JSON');
    });

    it('should throw on invalid manifest', () => {
      const json = JSON.stringify({ name: 'test' });
      expect(() => parseServerJson(json)).toThrow('Invalid server.json manifest');
    });
  });
});
