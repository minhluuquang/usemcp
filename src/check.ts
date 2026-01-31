import * as p from '@clack/prompts';
import pc from 'picocolors';
import { listLockEntries } from './lock.ts';

export async function runCheck(): Promise<void> {
  const s = p.spinner();
  s.start('Checking for updates...');

  const entries = listLockEntries();

  if (entries.length === 0) {
    s.stop(pc.yellow('No servers tracked in lock file'));
    console.log(pc.dim('Install servers with usemcps add <source>'));
    return;
  }

  s.stop(`Found ${entries.length} tracked server(s)`);

  console.log(pc.bold('\nTracked servers:\n'));

  for (const entry of entries) {
    console.log(`  ${pc.cyan(entry.serverId)}`);
    console.log(`    ${pc.dim('Source:')} ${entry.source.type} - ${entry.source.url}`);
    console.log(`    ${pc.dim('Installed:')} ${new Date(entry.installedAt).toLocaleDateString()}`);
    console.log(
      `    ${pc.dim('Targets:')} ${entry.targets.map(t => `${t.agent} (${t.scope})`).join(', ')}`
    );
    console.log();
  }
}
