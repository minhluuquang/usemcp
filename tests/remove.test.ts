import { describe, it, expect } from 'vitest';
import { parseRemoveOptions } from '../src/remove.ts';

describe('parseRemoveOptions', () => {
  it('should parse server names', () => {
    const result = parseRemoveOptions(['server1', 'server2']);
    expect(result.servers).toEqual(['server1', 'server2']);
  });

  it('should parse --global flag', () => {
    const result = parseRemoveOptions(['--global', 'server1']);
    expect(result.options.global).toBe(true);
    expect(result.servers).toEqual(['server1']);
  });

  it('should parse -g shorthand', () => {
    const result = parseRemoveOptions(['-g', 'server1']);
    expect(result.options.global).toBe(true);
  });

  it('should parse --agent flag', () => {
    const result = parseRemoveOptions(['--agent', 'claude-code', 'server1']);
    expect(result.options.agents).toEqual(['claude-code']);
  });

  it('should parse -a shorthand', () => {
    const result = parseRemoveOptions(['-a', 'claude-code', 'server1']);
    expect(result.options.agents).toEqual(['claude-code']);
  });

  it('should parse --yes flag', () => {
    const result = parseRemoveOptions(['--yes', 'server1']);
    expect(result.options.yes).toBe(true);
  });

  it('should parse -y shorthand', () => {
    const result = parseRemoveOptions(['-y', 'server1']);
    expect(result.options.yes).toBe(true);
  });

  it('should handle empty server list', () => {
    const result = parseRemoveOptions([]);
    expect(result.servers).toEqual([]);
  });
});
