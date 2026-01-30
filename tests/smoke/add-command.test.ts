import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { parseAddOptions, runAdd } from '../../src/add.ts';
import { claudeCodeAdapter } from '../../src/agents/claude-code.ts';
import type { AddOptions } from '../../src/types.ts';

describe('Smoke Tests - Add Command', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'mcp-add-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('parseAddOptions', () => {
    it('should parse source argument', () => {
      const { source, options } = parseAddOptions(['my-server']);
      expect(source).toBe('my-server');
    });

    it('should parse --agent flag', () => {
      const { source, options } = parseAddOptions(['server', '--agent', 'claude-code,codex']);
      expect(options.agents).toEqual(['claude-code', 'codex']);
    });

    it('should parse -a shorthand', () => {
      const { source, options } = parseAddOptions(['server', '-a', 'claude-code']);
      expect(options.agents).toEqual(['claude-code']);
    });

    it('should parse --scope flag', () => {
      const { source, options } = parseAddOptions(['server', '--scope', 'user']);
      expect(options.scope).toBe('user');
    });

    it('should parse -s shorthand', () => {
      const { source, options } = parseAddOptions(['server', '-s', 'project']);
      expect(options.scope).toBe('project');
    });

    it('should parse --list flag', () => {
      const { source, options } = parseAddOptions(['server', '--list']);
      expect(options.list).toBe(true);
    });

    it('should parse --all flag', () => {
      const { source, options } = parseAddOptions(['server', '--all']);
      expect(options.all).toBe(true);
    });

    it('should parse --yes flag', () => {
      const { source, options } = parseAddOptions(['server', '--yes']);
      expect(options.yes).toBe(true);
    });

    it('should parse -y shorthand', () => {
      const { source, options } = parseAddOptions(['server', '-y']);
      expect(options.yes).toBe(true);
    });

    it('should throw when source is missing', () => {
      expect(() => parseAddOptions([])).toThrow('Source is required');
    });

    it('should parse multiple flags together', () => {
      const { source, options } = parseAddOptions([
        'my-server',
        '--agent', 'claude-code',
        '--scope', 'user',
        '--yes',
      ]);
      expect(source).toBe('my-server');
      expect(options.agents).toEqual(['claude-code']);
      expect(options.scope).toBe('user');
      expect(options.yes).toBe(true);
    });
  });
});
