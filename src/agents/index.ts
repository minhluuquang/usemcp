import type { AgentAdapter } from '../types.ts';
import { claudeCodeAdapter } from './claude-code.ts';
import { claudeDesktopAdapter } from './claude-desktop.ts';
import { codexAdapter } from './codex.ts';
import { opencodeAdapter } from './opencode.ts';

export const adapters: Record<string, AgentAdapter> = {
  'claude-code': claudeCodeAdapter,
  'claude-desktop': claudeDesktopAdapter,
  codex: codexAdapter,
  opencode: opencodeAdapter,
};

export const adapterList = Object.values(adapters);

export async function detectInstalledAdapters(): Promise<AgentAdapter[]> {
  const results = await Promise.all(
    adapterList.map(async (adapter) => ({
      adapter,
      installed: await adapter.detectInstalled(),
    }))
  );
  return results.filter((r) => r.installed).map((r) => r.adapter);
}

export function getAdapter(id: string): AgentAdapter | undefined {
  return adapters[id];
}

export { claudeCodeAdapter, claudeDesktopAdapter, codexAdapter, opencodeAdapter };
