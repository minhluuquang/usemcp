// ============================================
// Canonical Model - NormalizedServer
// ============================================

export type TransportType = 'stdio' | 'http' | 'sse';

export interface StdioTransport {
  type: 'stdio';
  command: string;
  args: string[];
  env?: Record<string, string>;
  cwd?: string;
}

export interface HttpTransport {
  type: 'http';
  url: string;
  headers?: Record<string, string>;
}

export interface SseTransport {
  type: 'sse';
  url: string;
  headers?: Record<string, string>;
}

export type Transport = StdioTransport | HttpTransport | SseTransport;

export interface SecretField {
  name: string;
  description?: string;
  required: boolean;
}

export interface NormalizedServer {
  id: string;
  displayName: string;
  description?: string;
  transport: Transport;
  secrets: SecretField[];
}

// ============================================
// Agent Adapter Interface
// ============================================

export type Scope = 'project' | 'user';

export interface InstalledServer {
  name: string;
  server: NormalizedServer;
}

export interface ParsedConfig {
  servers: Record<string, unknown>;
  raw: string;
}

export interface AgentAdapter {
  id: string;
  displayName: string;
  supportedScopes: Scope[];
  detectInstalled(): Promise<boolean>;
  getConfigPath(scope: Scope, cwd: string): string;
  readConfig(scope: Scope, cwd: string): Promise<ParsedConfig>;
  writeConfig(scope: Scope, cwd: string, servers: Record<string, unknown>): Promise<void>;
  listInstalled(scope: Scope, cwd: string): Promise<InstalledServer[]>;
  addServer(
    scope: Scope,
    cwd: string,
    server: NormalizedServer,
    options: AddOptions
  ): Promise<void>;
  removeServer(scope: Scope, cwd: string, serverKey: string): Promise<void>;
}

// ============================================
// CLI Options
// ============================================

export interface AddOptions {
  agents?: string[];
  scope?: Scope;
  list?: boolean;
  servers?: string[];
  all?: boolean;
  yes?: boolean;
}

export interface ListOptions {
  global?: boolean;
  agents?: string[];
}

export interface RemoveOptions {
  global?: boolean;
  agents?: string[];
  yes?: boolean;
}

// ============================================
// Source Types
// ============================================

export type SourceType = 'registry' | 'git' | 'local';

export interface SourceInfo {
  type: SourceType;
  url: string;
  path?: string;
}

// ============================================
// Lock File
// ============================================

export interface LockEntry {
  serverId: string;
  source: SourceInfo;
  version?: string;
  metadataHash: string;
  targets: Array<{
    agent: string;
    scope: Scope;
    installedName: string;
  }>;
  installedAt: string;
  updatedAt: string;
}

export interface LockFile {
  version: number;
  servers: Record<string, LockEntry>;
}
