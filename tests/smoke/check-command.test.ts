import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir, homedir } from 'os';
import { addLockEntry, readLockFile, writeLockFile } from '../../src/lock.ts';
import { runCheck } from '../../src/check.ts';
import type { NormalizedServer } from '../../src/types.ts';

describe('Smoke Tests - Check Command', () => {
  let tempDir: string;

  const testServer: NormalizedServer = {
    id: 'test/server',
    displayName: 'Test Server',
    transport: {
      type: 'stdio',
      command: 'node',
      args: ['server.js'],
    },
    secrets: [],
  };

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'mcp-check-test-'));
    // Clear lock file
    const lockPath = join(homedir(), '.agents', '.mcp-lock.json');
    if (existsSync(lockPath)) {
      unlinkSync(lockPath);
    }
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    // Clean up lock file
    const lockPath = join(homedir(), '.agents', '.mcp-lock.json');
    if (existsSync(lockPath)) {
      unlinkSync(lockPath);
    }
  });

  it('should show message when no servers tracked', async () => {
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));

    await runCheck();

    console.log = originalLog;

    const output = logs.join('\n');
    // The spinner message isn't captured, but the follow-up message should be
    expect(output).toContain('Install servers with mcp add');
  });

  it('should list tracked servers', async () => {
    // Add some lock entries
    addLockEntry(
      'server1',
      { type: 'registry', url: 'https://registry.mcp.io/server1' },
      testServer,
      [{ agent: 'claude-code', scope: 'project', installedName: 'server1' }]
    );

    const server2: NormalizedServer = {
      ...testServer,
      id: 'server2',
    };

    addLockEntry(
      'server2',
      { type: 'git', url: 'https://github.com/user/repo' },
      server2,
      [
        { agent: 'claude-code', scope: 'project', installedName: 'server2' },
        { agent: 'codex', scope: 'project', installedName: 'server2' },
      ]
    );

    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));

    await runCheck();

    console.log = originalLog;

    const output = logs.join('\n');
    expect(output).toContain('server1');
    expect(output).toContain('server2');
    expect(output).toContain('registry');
    expect(output).toContain('git');
    expect(output).toContain('claude-code');
    expect(output).toContain('codex');
  });
});
