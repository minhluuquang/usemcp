import { homedir, platform } from 'os';
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

function getClaudeDesktopConfigPath(): string {
  const plat = platform();

  if (plat === 'darwin') {
    return join(homedir(), 'Library/Application Support/Claude/claude_desktop_config.json');
  } else if (plat === 'win32') {
    return join(homedir(), 'AppData/Roaming/Claude/claude_desktop_config.json');
  } else {
    // Linux - not officially supported but provide a path
    return join(homedir(), '.config/Claude/claude_desktop_config.json');
  }
}

const DESKTOP_CONFIG_PATH = getClaudeDesktopConfigPath();

// Helper functions - exported for testing
export function normalizedToDesktopConfig(server: NormalizedServer): Record<string, unknown> {
  if (server.transport.type !== 'stdio') {
    throw new Error('Claude Desktop only supports stdio transport');
  }

  const config: Record<string, unknown> = {
    command: server.transport.command,
    args: server.transport.args,
  };

  if (server.transport.env) {
    config.env = server.transport.env;
  }

  return config;
}

export function desktopConfigToNormalized(
  name: string,
  config: Record<string, unknown>
): NormalizedServer {
  return {
    id: name,
    displayName: name,
    transport: {
      type: 'stdio',
      command: (config.command as string) || '',
      args: (config.args as string[]) || [],
      env: config.env as Record<string, string> | undefined,
    },
    secrets: [],
  };
}

export const claudeDesktopAdapter: AgentAdapter = {
  id: 'claude-desktop',
  displayName: 'Claude Desktop',
  supportedScopes: ['user'], // Desktop only supports user scope

  async detectInstalled(): Promise<boolean> {
    // Check if the config directory exists
    const configDir = join(DESKTOP_CONFIG_PATH, '..');
    return existsSync(configDir);
  },

  getConfigPath(scope: Scope, _cwd: string): string {
    if (scope !== 'user') {
      throw new Error('Claude Desktop only supports user scope');
    }
    return DESKTOP_CONFIG_PATH;
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
    const dir = join(configPath, '..');

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
        const normalized = desktopConfigToNormalized(name, serverConfig as Record<string, unknown>);
        return { name, server: normalized };
      } catch {
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
    _options: AddOptions
  ): Promise<void> {
    // Claude Desktop only supports stdio transport
    if (server.transport.type !== 'stdio') {
      console.warn(`Claude Desktop only supports stdio transport. Skipping ${server.id}`);
      return;
    }

    const { servers } = await this.readConfig(scope, cwd);
    const serverName = server.id.split('/').pop() || server.id;

    const desktopConfig = normalizedToDesktopConfig(server);

    const newServers = {
      ...servers,
      [serverName]: desktopConfig,
    };

    await this.writeConfig(scope, cwd, newServers);
  },

  async removeServer(scope: Scope, cwd: string, serverKey: string): Promise<void> {
    const { servers } = await this.readConfig(scope, cwd);
    const { [serverKey]: _, ...rest } = servers;
    await this.writeConfig(scope, cwd, rest);
  },
};
