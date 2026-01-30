import type { NormalizedServer, Transport } from '../types.ts';

// ============================================
// Server.json Manifest Types
// ============================================

export interface ServerJsonManifest {
  name: string;
  description?: string;
  version?: string;
  transport: 'stdio' | 'http' | 'sse';
  // stdio transport
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  // http/sse transport
  url?: string;
  headers?: Record<string, string>;
  // secrets
  secrets?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

// ============================================
// Validation
// ============================================

export function validateServerJson(manifest: unknown): manifest is ServerJsonManifest {
  if (typeof manifest !== 'object' || manifest === null) {
    return false;
  }

  const m = manifest as Record<string, unknown>;

  // Required fields
  if (typeof m.name !== 'string' || m.name.length === 0) {
    return false;
  }

  if (typeof m.transport !== 'string' || !['stdio', 'http', 'sse'].includes(m.transport)) {
    return false;
  }

  // Transport-specific validation
  if (m.transport === 'stdio') {
    if (typeof m.command !== 'string' || m.command.length === 0) {
      return false;
    }
    if (m.args !== undefined && !Array.isArray(m.args)) {
      return false;
    }
  } else {
    // http or sse
    if (typeof m.url !== 'string' || m.url.length === 0) {
      return false;
    }
  }

  return true;
}

// ============================================
// Normalization
// ============================================

export function normalizeServerJson(manifest: ServerJsonManifest): NormalizedServer {
  let transport: Transport;

  switch (manifest.transport) {
    case 'stdio':
      transport = {
        type: 'stdio',
        command: manifest.command!,
        args: manifest.args ?? [],
        env: manifest.env,
        cwd: manifest.cwd,
      };
      break;
    case 'http':
      transport = {
        type: 'http',
        url: manifest.url!,
        headers: manifest.headers,
      };
      break;
    case 'sse':
      transport = {
        type: 'sse',
        url: manifest.url!,
        headers: manifest.headers,
      };
      break;
    default:
      throw new Error(`Unknown transport type: ${manifest.transport}`);
  }

  return {
    id: manifest.name,
    displayName: manifest.name,
    description: manifest.description,
    transport,
    secrets:
      manifest.secrets?.map(s => ({
        name: s.name,
        description: s.description,
        required: s.required ?? true,
      })) ?? [],
  };
}

export function parseServerJson(jsonContent: string): NormalizedServer {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonContent);
  } catch (error) {
    throw new Error(`Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  if (!validateServerJson(parsed)) {
    throw new Error('Invalid server.json manifest');
  }

  return normalizeServerJson(parsed);
}
