import type { SourceInfo, NormalizedServer } from '../types.ts';
import { parseServerJson } from '../manifests/server-json.ts';

// ============================================
// Registry Source
// ============================================

const REGISTRY_BASE_URL = 'https://registry.mcp.io';

export async function fetchFromRegistry(serverId: string): Promise<NormalizedServer> {
  const url = `${REGISTRY_BASE_URL}/servers/${serverId}/server.json`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Registry returned ${response.status}: ${response.statusText}`);
    }

    const content = await response.text();
    return parseServerJson(content);
  } catch (error) {
    if (error instanceof Error && error.message.includes('fetch')) {
      throw new Error(`Failed to fetch from registry: ${error.message}`);
    }
    throw error;
  }
}

// ============================================
// Git Source
// ============================================

export function parseGitUrl(url: string): { owner: string; repo: string; path?: string } | null {
  // Handle GitHub URLs
  const githubMatch = url.match(/github\.com[/:]([^/]+)\/([^/]+)(?:\/(.+))?/);
  if (githubMatch) {
    return {
      owner: githubMatch[1]!,
      repo: githubMatch[2]!.replace(/\.git$/, ''),
      path: githubMatch[3],
    };
  }

  // Handle shorthand like owner/repo
  const shorthandMatch = url.match(/^([\w-]+)\/([\w-]+)$/);
  if (shorthandMatch) {
    return {
      owner: shorthandMatch[1]!,
      repo: shorthandMatch[2]!,
    };
  }

  return null;
}

export async function fetchFromGit(url: string): Promise<NormalizedServer[]> {
  const gitInfo = parseGitUrl(url);

  if (!gitInfo) {
    throw new Error(`Invalid Git URL: ${url}`);
  }

  const { owner, repo, path } = gitInfo;
  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${path || 'server.json'}`;

  try {
    const response = await fetch(rawUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch from GitHub: ${response.status}`);
    }

    const content = await response.text();
    const server = parseServerJson(content);
    return [server];
  } catch (error) {
    if (error instanceof Error && error.message.includes('fetch')) {
      throw new Error(`Failed to fetch from GitHub: ${error.message}`);
    }
    throw error;
  }
}

// ============================================
// Local Source
// ============================================

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

// ============================================
// Source Parser Main
// ============================================

export async function parseSource(source: string): Promise<{
  sourceInfo: SourceInfo;
  servers: NormalizedServer[];
}> {
  // Check if it's a local path
  if (source.startsWith('.') || source.startsWith('/') || source.includes('/server.json')) {
    const servers = readFromLocalPath(source);
    return {
      sourceInfo: { type: 'local', url: source },
      servers,
    };
  }

  // Check if it's a GitHub URL or shorthand
  if (source.includes('github.com') || /^[\w-]+\/[\w-]+$/.test(source)) {
    const servers = await fetchFromGit(source);
    return {
      sourceInfo: { type: 'git', url: source },
      servers,
    };
  }

  // Assume it's a registry ID
  const server = await fetchFromRegistry(source);
  return {
    sourceInfo: { type: 'registry', url: `${REGISTRY_BASE_URL}/servers/${source}` },
    servers: [server],
  };
}
