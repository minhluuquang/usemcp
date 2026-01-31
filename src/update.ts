import * as p from '@clack/prompts';
import pc from 'picocolors';
import { listLockEntries } from './lock.ts';

export async function runUpdate(): Promise<void> {
  const s = p.spinner();
  s.start('Checking for updates...');

  const entries = listLockEntries();

  if (entries.length === 0) {
    s.stop(pc.yellow('No servers tracked in lock file'));
    console.log(pc.dim('Install servers with usemcps add <source>'));
    return;
  }

  s.stop(`Found ${entries.length} tracked server(s)`);

  console.log(pc.bold('\nUpdate check not yet implemented'));
  console.log();
  console.log(pc.dim('To update a server, remove and re-add it:'));
  console.log(pc.dim('  usemcps remove <server>'));
  console.log(pc.dim('  usemcps add <source>'));
}
