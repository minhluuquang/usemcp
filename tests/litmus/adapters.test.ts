import { describe, it, expect } from 'vitest';
import { adapterList, getAdapter } from '../../src/agents/index.ts';
import type { AgentAdapter, Scope } from '../../src/types.ts';

describe('Litmus Tests - Agent Adapters', () => {
  describe('Adapter Interface Compliance', () => {
    const requiredMethods = [
      'detectInstalled',
      'getConfigPath',
      'readConfig',
      'writeConfig',
      'listInstalled',
      'addServer',
      'removeServer',
    ];

    for (const adapter of adapterList) {
      describe(`${adapter.displayName} (${adapter.id})`, () => {
        it('should have all required properties', () => {
          expect(adapter.id).toBeDefined();
          expect(typeof adapter.id).toBe('string');
          expect(adapter.displayName).toBeDefined();
          expect(typeof adapter.displayName).toBe('string');
          expect(adapter.supportedScopes).toBeDefined();
          expect(Array.isArray(adapter.supportedScopes)).toBe(true);
        });

        it('should have at least one supported scope', () => {
          expect(adapter.supportedScopes.length).toBeGreaterThan(0);
          
          for (const scope of adapter.supportedScopes) {
            expect(['project', 'user']).toContain(scope);
          }
        });

        it('should implement all required methods', () => {
          for (const method of requiredMethods) {
            expect(adapter[method as keyof AgentAdapter]).toBeDefined();
            expect(typeof adapter[method as keyof AgentAdapter]).toBe('function');
          }
        });

        it('should have unique id', () => {
          const adaptersWithSameId = adapterList.filter((a) => a.id === adapter.id);
          expect(adaptersWithSameId.length).toBe(1);
        });
      });
    }
  });

  describe('getAdapter', () => {
    it('should return adapter by id', () => {
      const adapter = getAdapter('claude-code');
      expect(adapter).toBeDefined();
      expect(adapter?.id).toBe('claude-code');
    });

    it('should return undefined for unknown id', () => {
      const adapter = getAdapter('unknown-agent');
      expect(adapter).toBeUndefined();
    });

    it('should return all four main adapters', () => {
      const claudeCode = getAdapter('claude-code');
      const claudeDesktop = getAdapter('claude-desktop');
      const codex = getAdapter('codex');
      const opencode = getAdapter('opencode');

      expect(claudeCode).toBeDefined();
      expect(claudeDesktop).toBeDefined();
      expect(codex).toBeDefined();
      expect(opencode).toBeDefined();
    });
  });

  describe('Scope Support', () => {
    it('Claude Code should support both project and user scopes', () => {
      const adapter = getAdapter('claude-code');
      expect(adapter?.supportedScopes).toContain('project');
      expect(adapter?.supportedScopes).toContain('user');
    });

    it('Claude Desktop should only support user scope', () => {
      const adapter = getAdapter('claude-desktop');
      expect(adapter?.supportedScopes).toContain('user');
      expect(adapter?.supportedScopes).not.toContain('project');
    });

    it('Codex should support both project and user scopes', () => {
      const adapter = getAdapter('codex');
      expect(adapter?.supportedScopes).toContain('project');
      expect(adapter?.supportedScopes).toContain('user');
    });

    it('OpenCode should support both project and user scopes', () => {
      const adapter = getAdapter('opencode');
      expect(adapter?.supportedScopes).toContain('project');
      expect(adapter?.supportedScopes).toContain('user');
    });
  });
});
