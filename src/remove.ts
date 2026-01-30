import * as p from '@clack/prompts';
import pc from 'picocolors';
import type { RemoveOptions, Scope, InstalledServer } from './types.ts';
import { adapterList, getAdapter } from './agents/index.ts';
import { removeLockEntry } from './lock.ts';

export function parseRemoveOptions(args: string[]): { servers: string[]; options: RemoveOptions } {
  const options: RemoveOptions = {};
  const servers: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '-g':
      case '--global':
        options.global = true;
        break;
      case '-a':
      case '--agent':
        options.agents = args[++i]?.split(',').map(a => a.trim());
        break;
      case '-y':
      case '--yes':
        options.yes = true;
        break;
      default:
        if (!arg?.startsWith('-')) {
          servers.push(arg!);
        }
        break;
    }
  }

  return { servers, options };
}

export async function runRemove(serverNames: string[], options: RemoveOptions): Promise<void> {
  const scope: Scope = options.global ? 'user' : 'project';
  const cwd = process.cwd();

  // Determine which agents to target
  let agentsToTarget = adapterList;
  if (options.agents) {
    agentsToTarget = options.agents
      .map(id => getAdapter(id))
      .filter((a): a is NonNullable<typeof a> => a !== undefined);
  }

  // Collect all installed servers from target agents
  const allInstalled: Array<{ agent: (typeof adapterList)[0]; server: InstalledServer }> = [];

  for (const agent of agentsToTarget) {
    if (!agent.supportedScopes.includes(scope)) {
      continue;
    }

    try {
      const installed = await agent.listInstalled(scope, cwd);
      for (const server of installed) {
        allInstalled.push({ agent, server });
      }
    } catch {
      // Skip agents with errors
    }
  }

  // If no servers specified, show interactive selection
  let serversToRemove: Array<{ agent: (typeof adapterList)[0]; server: InstalledServer }> = [];

  if (serverNames.length === 0) {
    if (allInstalled.length === 0) {
      console.log(pc.yellow('No MCP servers installed.'));
      return;
    }

    const choices = allInstalled.map(({ agent, server }) => ({
      value: `${agent.id}:${server.name}`,
      label: `${server.name} (${agent.displayName})`,
      hint: server.server.description,
    }));

    const selected = await p.multiselect({
      message: 'Select servers to remove:',
      options: choices,
    });

    if (p.isCancel(selected) || selected.length === 0) {
      console.log(pc.yellow('Removal cancelled'));
      return;
    }

    serversToRemove = allInstalled.filter(({ agent, server }) =>
      selected.includes(`${agent.id}:${server.name}`)
    );
  } else {
    // Find specified servers
    for (const name of serverNames) {
      const matches = allInstalled.filter(({ server }) => server.name === name);
      if (matches.length === 0) {
        console.log(pc.yellow(`Server not found: ${name}`));
      } else {
        serversToRemove.push(...matches);
      }
    }
  }

  if (serversToRemove.length === 0) {
    console.log(pc.yellow('No servers to remove.'));
    return;
  }

  // Show removal summary
  console.log(pc.bold('\nServers to remove:\n'));

  for (const { agent, server } of serversToRemove) {
    console.log(`  ${pc.red('✗')} ${pc.cyan(server.name)} ${pc.dim(`(${agent.displayName})`)}`);
  }
  console.log();

  // Confirm removal
  if (!options.yes) {
    const confirmed = await p.confirm({
      message: 'Proceed with removal?',
    });

    if (p.isCancel(confirmed) || !confirmed) {
      console.log(pc.yellow('Removal cancelled'));
      return;
    }
  }

  // Group by agent and remove
  const byAgent = new Map<(typeof adapterList)[0], string[]>();

  for (const { agent, server } of serversToRemove) {
    const list = byAgent.get(agent) || [];
    list.push(server.name);
    byAgent.set(agent, list);
  }

  for (const [agent, names] of byAgent) {
    console.log(pc.bold(`\nRemoving from ${agent.displayName}...`));

    for (const name of names) {
      try {
        await agent.removeServer(scope, cwd, name);
        console.log(`  ${pc.green('✓')} Removed ${name}`);

        // Update lock file
        removeLockEntry(name);
      } catch (error) {
        console.log(
          `  ${pc.red('✗')} Failed to remove ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  }

  console.log(pc.green('\n✓ Removal complete'));
}
