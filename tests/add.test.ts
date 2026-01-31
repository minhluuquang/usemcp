import { describe, it, expect } from 'vitest';
import { parseAddOptions } from '../src/add.ts';
import type { StdioTransport, HttpTransport, SseTransport } from '../src/types.ts';

describe('parseAddOptions', () => {
  it('should parse stdio server with name and command', () => {
    const { name, transport } = parseAddOptions([
      'my-server',
      '--',
      'npx',
      '-y',
      '@playwright/mcp',
    ]);
    expect(name).toBe('my-server');
    expect(transport.type).toBe('stdio');
    const stdioTransport = transport as StdioTransport;
    expect(stdioTransport.command).toBe('npx');
    expect(stdioTransport.args).toEqual(['-y', '@playwright/mcp']);
  });

  it('should parse --agent flag', () => {
    const result = parseAddOptions([
      'server',
      '--agent',
      'claude-code,codex',
      '--',
      'node',
      'server.js',
    ]);
    expect(result.name).toBe('server');
    expect(result.options.agents).toEqual(['claude-code', 'codex']);
  });

  it('should parse -a shorthand', () => {
    const result = parseAddOptions(['server', '-a', 'claude-code', '--', 'node', 'server.js']);
    expect(result.name).toBe('server');
    expect(result.options.agents).toEqual(['claude-code']);
  });

  it('should parse --scope flag', () => {
    const result = parseAddOptions(['server', '--scope', 'user', '--', 'node', 'server.js']);
    expect(result.name).toBe('server');
    expect(result.options.scope).toBe('user');
  });

  it('should parse -s shorthand', () => {
    const result = parseAddOptions(['server', '-s', 'project', '--', 'node', 'server.js']);
    expect(result.name).toBe('server');
    expect(result.options.scope).toBe('project');
  });

  it('should parse --yes flag', () => {
    const result = parseAddOptions(['server', '--yes', '--', 'node', 'server.js']);
    expect(result.name).toBe('server');
    expect(result.options.yes).toBe(true);
  });

  it('should parse -y shorthand', () => {
    const result = parseAddOptions(['server', '-y', '--', 'node', 'server.js']);
    expect(result.name).toBe('server');
    expect(result.options.yes).toBe(true);
  });

  it('should parse --env flag', () => {
    const { name, transport } = parseAddOptions([
      'server',
      '--env',
      'API_KEY=secret123',
      '--',
      'node',
      'server.js',
    ]);
    expect(name).toBe('server');
    expect(transport.type).toBe('stdio');
    const stdioTransport = transport as StdioTransport;
    expect(stdioTransport.env).toEqual({ API_KEY: 'secret123' });
  });

  it('should parse --transport http with URL', () => {
    const { name, transport } = parseAddOptions([
      '--transport',
      'http',
      'my-api',
      'https://api.example.com/mcp',
    ]);
    expect(name).toBe('my-api');
    expect(transport.type).toBe('http');
    const httpTransport = transport as HttpTransport;
    expect(httpTransport.url).toBe('https://api.example.com/mcp');
  });

  it('should parse --transport sse with URL', () => {
    const { name, transport } = parseAddOptions([
      '--transport',
      'sse',
      'events',
      'https://events.example.com/sse',
    ]);
    expect(name).toBe('events');
    expect(transport.type).toBe('sse');
    const sseTransport = transport as SseTransport;
    expect(sseTransport.url).toBe('https://events.example.com/sse');
  });

  it('should parse --header flag for http transport', () => {
    const { name, transport } = parseAddOptions([
      '--transport',
      'http',
      '--header',
      'Authorization: Bearer token123',
      'api',
      'https://api.example.com',
    ]);
    expect(name).toBe('api');
    expect(transport.type).toBe('http');
    const httpTransport = transport as HttpTransport;
    expect(httpTransport.headers).toEqual({ Authorization: 'Bearer token123' });
  });

  it('should throw when name is missing', () => {
    expect(() => parseAddOptions([])).toThrow('Server name is required');
  });

  it('should throw when command is missing for stdio transport', () => {
    expect(() => parseAddOptions(['my-server'])).toThrow('Command is required for stdio transport');
  });

  it('should throw when URL is missing for http transport', () => {
    expect(() => parseAddOptions(['--transport', 'http', 'my-api'])).toThrow(
      'URL is required for http transport'
    );
  });

  it('should parse multiple flags together', () => {
    const { name, transport, options } = parseAddOptions([
      'my-server',
      '--agent',
      'claude-code',
      '--scope',
      'user',
      '--env',
      'KEY=value',
      '--yes',
      '--',
      'npx',
      '-y',
      '@package/server',
    ]);
    expect(name).toBe('my-server');
    expect(transport.type).toBe('stdio');
    const stdioTransport = transport as StdioTransport;
    expect(stdioTransport.command).toBe('npx');
    expect(stdioTransport.args).toEqual(['-y', '@package/server']);
    expect(stdioTransport.env).toEqual({ KEY: 'value' });
    expect(options.agents).toEqual(['claude-code']);
    expect(options.scope).toBe('user');
    expect(options.yes).toBe(true);
  });
});
