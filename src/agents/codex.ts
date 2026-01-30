import { homedir } from 'os';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import * as TOML from '@iarna/toml';
import type {
  AgentAdapter,
  Scope,
  ParsedConfig,
  InstalledServer,
  NormalizedServer,
  AddOptions,
} from '../types.ts';

const CODEX_HOME = process.env.CODEX_HOME?.trim() || join(homedir(), '.codex');

interface CodexConfig {
  mcp_servers?: Record<string, CodexServerConfig>;
  [key: string]: unknown;
}

interface CodexServerConfig {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  url?: string;
  auth?: {
    type: string;
    token?: string;
    token_env?: string;
  };
}

// Helper functions
function normalizedToCodexConfig(server: NormalizedServer): CodexServerConfig {
  const config: CodexServerConfig = {};

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
    // http or sse
    config.url = server.transport.url;

    // Handle authentication
    if (server.transport.headers) {
      const authHeader = server.transport.headers['Authorization'];
      if (authHeader) {
        if (authHeader.startsWith('Bearer ')) {
          config.auth = {
            type: 'bearer',
            token_env: 'MCP_TOKEN', // Use env var by default
          };
        } else {
          config.auth = {
            type: 'custom',
            token_env: 'MCP_TOKEN',
          };
        }
      }
    }
  }

  return config;
}

function codexConfigToNormalized(name: string, config: CodexServerConfig): NormalizedServer {
  let transport;

  if (config.url) {
    // HTTP/SSE transport
    const headers: Record<string, string> = {};
    if (config.auth?.token) {
      headers['Authorization'] = `Bearer ${config.auth.token}`;
    }

    transport = {
      type: 'http' as const,
      url: config.url,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    };
  } else {
    // stdio transport
    transport = {
      type: 'stdio' as const,
      command: config.command || '',
      args: config.args || [],
      env: config.env,
      cwd: config.cwd,
    };
  }

  return {
    id: name,
    displayName: name,
    transport,
    secrets: [],
  };
}

export const codexAdapter: AgentAdapter = {
  id: 'codex',
  displayName: 'Codex',
  supportedScopes: ['project', 'user'],

  async detectInstalled(): Promise<boolean> {
    return existsSync(CODEX_HOME) || existsSync('/etc/codex');
  },

  getConfigPath(scope: Scope, cwd: string): string {
    if (scope === 'project') {
      return join(cwd, '.codex/config.toml');
    }
    return join(CODEX_HOME, 'config.toml');
  },

  async readConfig(scope: Scope, cwd: string): Promise<ParsedConfig> {
    const configPath = this.getConfigPath(scope, cwd);

    if (!existsSync(configPath)) {
      return { servers: {}, raw: '' };
    }

    const content = readFileSync(configPath, 'utf-8');
    let parsed: CodexConfig;

    try {
      parsed = TOML.parse(content) as CodexConfig;
    } catch {
      throw new Error(`Invalid TOML in ${configPath}`);
    }

    const mcpServers = parsed.mcp_servers || {};

    return { servers: mcpServers, raw: content };
  },

  async writeConfig(scope: Scope, cwd: string, servers: Record<string, unknown>): Promise<void> {
    const configPath = this.getConfigPath(scope, cwd);
    const dir = scope === 'project' ? join(cwd, '.codex') : CODEX_HOME;

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    let config: CodexConfig = {};

    if (existsSync(configPath)) {
      try {
        const content = readFileSync(configPath, 'utf-8');
        config = TOML.parse(content) as CodexConfig;
      } catch {
        // If existing config is invalid, start fresh
      }
    }

    config.mcp_servers = servers as Record<string, CodexServerConfig>;

    writeFileSync(configPath, TOML.stringify(config as unknown as TOML.JsonMap), 'utf-8');
  },

  async listInstalled(scope: Scope, cwd: string): Promise<InstalledServer[]> {
    const { servers } = await this.readConfig(scope, cwd);

    return Object.entries(servers).map(([name, serverConfig]) => {
      try {
        const normalized = codexConfigToNormalized(name, serverConfig as CodexServerConfig);
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
    const { servers } = await this.readConfig(scope, cwd);
    const serverName = server.id.split('/').pop() || server.id;

    const codexConfig = normalizedToCodexConfig(server);

    const newServers = {
      ...servers,
      [serverName]: codexConfig,
    };

    await this.writeConfig(scope, cwd, newServers);
  },

  async removeServer(scope: Scope, cwd: string, serverKey: string): Promise<void> {
    const { servers } = await this.readConfig(scope, cwd);
    const { [serverKey]: _, ...rest } = servers;
    await this.writeConfig(scope, cwd, rest);
  },
};
