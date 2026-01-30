import { homedir } from 'os';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { xdgConfig } from 'xdg-basedir';
import * as commentJson from 'comment-json';
import type {
  AgentAdapter,
  Scope,
  ParsedConfig,
  InstalledServer,
  NormalizedServer,
  AddOptions,
} from '../types.ts';

const home = homedir();
const configHome = xdgConfig ?? join(home, '.config');
const OPENCODE_CONFIG_DIR = join(configHome, 'opencode');

interface OpencodeConfig {
  mcp?: {
    servers?: Record<string, OpencodeServerConfig>;
  };
  [key: string]: unknown;
}

interface OpencodeServerConfig {
  type: 'local' | 'remote';
  command?: string[];
  environment?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  oauth?: Record<string, unknown>;
  enabled?: boolean;
}

// Helper functions
function normalizedToOpencodeConfig(server: NormalizedServer): OpencodeServerConfig {
  if (server.transport.type === 'stdio') {
    const config: OpencodeServerConfig = {
      type: 'local',
      command: [server.transport.command, ...server.transport.args],
      enabled: true,
    };

    if (server.transport.env) {
      config.environment = server.transport.env;
    }

    return config;
  } else {
    // http or sse
    const config: OpencodeServerConfig = {
      type: 'remote',
      url: server.transport.url,
      enabled: true,
    };

    if (server.transport.headers) {
      config.headers = server.transport.headers;
    }

    return config;
  }
}

function opencodeConfigToNormalized(name: string, config: OpencodeServerConfig): NormalizedServer {
  let transport;

  if (config.type === 'local') {
    const command = config.command?.[0] || '';
    const args = config.command?.slice(1) || [];

    transport = {
      type: 'stdio' as const,
      command,
      args,
      env: config.environment,
    };
  } else {
    // remote
    transport = {
      type: 'http' as const,
      url: config.url || '',
      headers: config.headers,
    };
  }

  return {
    id: name,
    displayName: name,
    transport,
    secrets: [],
  };
}

export const opencodeAdapter: AgentAdapter = {
  id: 'opencode',
  displayName: 'OpenCode',
  supportedScopes: ['project', 'user'],

  async detectInstalled(): Promise<boolean> {
    return existsSync(OPENCODE_CONFIG_DIR) || existsSync(join(home, '.claude'));
  },

  getConfigPath(scope: Scope, cwd: string): string {
    if (scope === 'project') {
      // Check for both .json and .jsonc
      const jsonPath = join(cwd, 'opencode.json');
      const jsoncPath = join(cwd, 'opencode.jsonc');

      if (existsSync(jsoncPath)) {
        return jsoncPath;
      }
      return jsonPath;
    }
    return join(OPENCODE_CONFIG_DIR, 'opencode.json');
  },

  async readConfig(scope: Scope, cwd: string): Promise<ParsedConfig> {
    const configPath = this.getConfigPath(scope, cwd);

    if (!existsSync(configPath)) {
      return { servers: {}, raw: '{}' };
    }

    const content = readFileSync(configPath, 'utf-8');
    let parsed: OpencodeConfig;

    try {
      parsed = commentJson.parse(content) as OpencodeConfig;
    } catch {
      throw new Error(`Invalid JSON in ${configPath}`);
    }

    const mcpServers = parsed.mcp?.servers || {};

    return { servers: mcpServers, raw: content };
  },

  async writeConfig(scope: Scope, cwd: string, servers: Record<string, unknown>): Promise<void> {
    const configPath = this.getConfigPath(scope, cwd);
    const dir = scope === 'project' ? cwd : OPENCODE_CONFIG_DIR;

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    let config: OpencodeConfig = {};

    if (existsSync(configPath)) {
      try {
        const content = readFileSync(configPath, 'utf-8');
        config = commentJson.parse(content) as OpencodeConfig;
      } catch {
        // If existing config is invalid, start fresh
      }
    }

    if (!config.mcp) {
      config.mcp = {};
    }
    config.mcp.servers = servers as Record<string, OpencodeServerConfig>;

    writeFileSync(configPath, commentJson.stringify(config, null, 2), 'utf-8');
  },

  async listInstalled(scope: Scope, cwd: string): Promise<InstalledServer[]> {
    const { servers } = await this.readConfig(scope, cwd);

    return Object.entries(servers).map(([name, serverConfig]) => {
      try {
        const normalized = opencodeConfigToNormalized(name, serverConfig as OpencodeServerConfig);
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

    const opencodeConfig = normalizedToOpencodeConfig(server);

    const newServers = {
      ...servers,
      [serverName]: opencodeConfig,
    };

    await this.writeConfig(scope, cwd, newServers);
  },

  async removeServer(scope: Scope, cwd: string, serverKey: string): Promise<void> {
    const { servers } = await this.readConfig(scope, cwd);
    const { [serverKey]: _, ...rest } = servers;
    await this.writeConfig(scope, cwd, rest);
  },
};
