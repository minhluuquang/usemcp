import { describe, it, expect } from 'vitest';
import { parseListOptions } from '../../src/list.ts';

describe('Smoke Tests - List Command', () => {
  describe('parseListOptions', () => {
    it('should parse --global flag', () => {
      const options = parseListOptions(['--global']);
      expect(options.global).toBe(true);
    });

    it('should parse -g shorthand', () => {
      const options = parseListOptions(['-g']);
      expect(options.global).toBe(true);
    });

    it('should parse --agent flag', () => {
      const options = parseListOptions(['--agent', 'claude-code,codex']);
      expect(options.agents).toEqual(['claude-code', 'codex']);
    });

    it('should parse -a shorthand', () => {
      const options = parseListOptions(['-a', 'claude-code']);
      expect(options.agents).toEqual(['claude-code']);
    });

    it('should return empty options when no args', () => {
      const options = parseListOptions([]);
      expect(options).toEqual({});
    });
  });
});
