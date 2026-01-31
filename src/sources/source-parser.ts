import type { SourceInfo, NormalizedServer } from '../types.ts';
import { parseServerJson } from '../manifests/server-json.ts';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

export function readFromLocalPath(localPath: string): NormalizedServer[] {
  const resolvedPath = localPath.startsWith('/') ? localPath : join(process.cwd(), localPath);

  if (!existsSync(resolvedPath)) {
    throw new Error(`Path does not exist: ${resolvedPath}`);
  }

  // Try to read server.json directly
  if (resolvedPath.endsWith('server.json')) {
    const content = readFileSync(resolvedPath, 'utf-8');
    return [parseServerJson(content)];
  }

  // Try to find server.json in the directory
  const serverJsonPath = join(resolvedPath, 'server.json');
  if (existsSync(serverJsonPath)) {
    const content = readFileSync(serverJsonPath, 'utf-8');
    return [parseServerJson(content)];
  }

  // Try to discover server.json files in subdirectories
  const servers: NormalizedServer[] = [];
  const patterns = ['servers', '.mcp'];

  for (const pattern of patterns) {
    const patternPath = join(resolvedPath, pattern);
    if (existsSync(patternPath)) {
      // Recursively look for server.json files
      const found = discoverServerJsonFiles(patternPath);
      servers.push(...found);
    }
  }

  if (servers.length === 0) {
    throw new Error(`No server.json found in ${resolvedPath}`);
  }

  return servers;
}

function discoverServerJsonFiles(dir: string): NormalizedServer[] {
  const servers: NormalizedServer[] = [];

  try {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        // Recurse into subdirectory
        const found = discoverServerJsonFiles(fullPath);
        servers.push(...found);
      } else if (entry === 'server.json') {
        const content = readFileSync(fullPath, 'utf-8');
        servers.push(parseServerJson(content));
      }
    }
  } catch {
    // Directory might not be readable
  }

  return servers;
}

export async function parseSource(source: string): Promise<{
  sourceInfo: SourceInfo;
  servers: NormalizedServer[];
}> {
  // Only support local paths
  if (source.startsWith('.') || source.startsWith('/') || source.includes('/server.json')) {
    const servers = readFromLocalPath(source);
    return {
      sourceInfo: { type: 'local', url: source },
      servers,
    };
  }

  // Unknown source type
  throw new Error(
    `Unknown source type: ${source}. Only local paths to server.json files or directories containing server.json are supported.`
  );
}
