import { homedir } from 'os';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { createHash } from 'crypto';
import type { LockFile, LockEntry, SourceInfo, NormalizedServer, Scope } from './types.ts';

const AGENTS_DIR = '.agents';
const LOCK_FILE = '.mcp-lock.json';
const CURRENT_LOCK_VERSION = 1;

function getLockPath(): string {
  return join(homedir(), AGENTS_DIR, LOCK_FILE);
}

export function readLockFile(): LockFile {
  const lockPath = getLockPath();

  try {
    const content = readFileSync(lockPath, 'utf-8');
    const parsed = JSON.parse(content) as LockFile;

    if (typeof parsed.version !== 'number' || !parsed.servers) {
      return { version: CURRENT_LOCK_VERSION, servers: {} };
    }

    // Handle version migrations here if needed
    if (parsed.version < CURRENT_LOCK_VERSION) {
      // Migrate old lock file format
      return { version: CURRENT_LOCK_VERSION, servers: parsed.servers };
    }

    return parsed;
  } catch {
    return { version: CURRENT_LOCK_VERSION, servers: {} };
  }
}

export function writeLockFile(lock: LockFile): void {
  const lockPath = getLockPath();
  const dir = join(homedir(), AGENTS_DIR);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(lockPath, JSON.stringify(lock, null, 2), 'utf-8');
}

export function generateMetadataHash(server: NormalizedServer): string {
  const data = JSON.stringify({
    id: server.id,
    transport: server.transport,
    secrets: server.secrets.map(s => s.name).sort(),
  });

  return createHash('sha256').update(data).digest('hex').slice(0, 16);
}

export function addLockEntry(
  serverId: string,
  source: SourceInfo,
  server: NormalizedServer,
  targets: Array<{ agent: string; scope: Scope; installedName: string }>
): void {
  const lock = readLockFile();

  const entry: LockEntry = {
    serverId,
    source,
    metadataHash: generateMetadataHash(server),
    targets,
    installedAt: lock.servers[serverId]?.installedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (source.type === 'registry') {
    entry.version = 'latest'; // Could be updated to actual version
  }

  lock.servers[serverId] = entry;
  writeLockFile(lock);
}

export function removeLockEntry(serverId: string): void {
  const lock = readLockFile();
  delete lock.servers[serverId];
  writeLockFile(lock);
}

export function getLockEntry(serverId: string): LockEntry | undefined {
  const lock = readLockFile();
  return lock.servers[serverId];
}

export function listLockEntries(): LockEntry[] {
  const lock = readLockFile();
  return Object.values(lock.servers);
}

export function updateLockEntryTargets(
  serverId: string,
  targets: Array<{ agent: string; scope: Scope; installedName: string }>
): void {
  const lock = readLockFile();
  const entry = lock.servers[serverId];

  if (entry) {
    entry.targets = targets;
    entry.updatedAt = new Date().toISOString();
    writeLockFile(lock);
  }
}
