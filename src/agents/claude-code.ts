import { homedir } from 'os';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import type {
  AgentAdapter,
  Scope,
  ParsedConfig,
  InstalledServer,
  NormalizedServer,
  AddOptions,
} from '../types.ts';

const CLAUDE_CONFIG_DIR = process.env.CLAUDE_CONFIG_DIR?.trim() || join(homedir(), '.claude');

// Helper functions
function normalizedToClaudeConfig(server: NormalizedServer): Record<string, unknown> {
  const config: Record<string, unknown> = {
    type: server.transport.type,
  };

  if (server.transport.type === 'stdio') {
    config.command = server.transport.command;
    config.args = server.transport.args;
    if (server.transport.env) {
      config.env = server.transport.env;
    }
    if (server.transport.cwd) {
      config.cwd = server.transport.cwd;
    }
  } else {
    config.url = server.transport.url;
    if (server.transport.headers) {
      config.headers = server.transport.headers;
    }
  }

  return config;
}

function claudeConfigToNormalized(name: string, config: Record<string, unknown>): NormalizedServer {
  const transportType = config.type as 'stdio' | 'http' | 'sse';

  let transport;
  if (transportType === 'stdio') {
    transport = {
      type: 'stdio' as const,
      command: (config.command as string) || '',
      args: (config.args as string[]) || [],
      env: config.env as Record<string, string> | undefined,
      cwd: config.cwd as string | undefined,
    };
  } else if (transportType === 'http') {
    transport = {
      type: 'http' as const,
      url: (config.url as string) || '',
      headers: config.headers as Record<string, string> | undefined,
    };
  } else {
    transport = {
      type: 'sse' as const,
      url: (config.url as string) || '',
      headers: config.headers as Record<string, string> | undefined,
    };
  }

  return {
    id: name,
    displayName: name,
    transport,
    secrets: [],
  };
}

export const claudeCodeAdapter: AgentAdapter = {
  id: 'claude-code',
  displayName: 'Claude Code',
  supportedScopes: ['project', 'user'],

  async detectInstalled(): Promise<boolean> {
    return existsSync(CLAUDE_CONFIG_DIR);
  },

  getConfigPath(scope: Scope, cwd: string): string {
    if (scope === 'project') {
      return join(cwd, '.mcp.json');
    }
    return join(CLAUDE_CONFIG_DIR, 'config.json');
  },

  async readConfig(scope: Scope, cwd: string): Promise<ParsedConfig> {
    const configPath = this.getConfigPath(scope, cwd);

    if (!existsSync(configPath)) {
      return { servers: {}, raw: '{}' };
    }

    const content = readFileSync(configPath, 'utf-8');
    let parsed: Record<string, unknown>;

    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error(`Invalid JSON in ${configPath}`);
    }

    const mcpServers = (parsed.mcpServers as Record<string, unknown>) || {};

    return { servers: mcpServers, raw: content };
  },

  async writeConfig(scope: Scope, cwd: string, servers: Record<string, unknown>): Promise<void> {
    const configPath = this.getConfigPath(scope, cwd);
    const dir = scope === 'project' ? cwd : CLAUDE_CONFIG_DIR;

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    let config: Record<string, unknown> = {};

    if (existsSync(configPath)) {
      try {
        const content = readFileSync(configPath, 'utf-8');
        config = JSON.parse(content);
      } catch {
        // If existing config is invalid, start fresh
      }
    }

    config.mcpServers = servers;

    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  },

  async listInstalled(scope: Scope, cwd: string): Promise<InstalledServer[]> {
    const { servers } = await this.readConfig(scope, cwd);

    return Object.entries(servers).map(([name, serverConfig]) => {
      try {
        // Convert Claude Code config format back to normalized server
        const normalized = claudeConfigToNormalized(name, serverConfig as Record<string, unknown>);
        return { name, server: normalized };
      } catch {
        // If we can't parse it, return a minimal server
        return {
          name,
          server: {
            id: name,
            displayName: name,
            transport: { type: 'stdio', command: 'unknown', args: [] },
            secrets: [],
          },
        };
      }
    });
  },

  async addServer(
    scope: Scope,
    cwd: string,
    server: NormalizedServer,
    options: AddOptions
  ): Promise<void> {
    const { servers } = await this.readConfig(scope, cwd);
    const serverName = server.id.split('/').pop() || server.id;

    // Convert normalized server to Claude Code format
    const claudeConfig = normalizedToClaudeConfig(server);

    const newServers = {
      ...servers,
      [serverName]: claudeConfig,
    };

    await this.writeConfig(scope, cwd, newServers);
  },

  async removeServer(scope: Scope, cwd: string, serverKey: string): Promise<void> {
    const { servers } = await this.readConfig(scope, cwd);
    const { [serverKey]: _, ...rest } = servers;
    await this.writeConfig(scope, cwd, rest);
  },
};
