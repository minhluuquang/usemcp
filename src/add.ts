import * as p from '@clack/prompts';
import pc from 'picocolors';
import type { AddOptions, NormalizedServer, Scope } from './types.ts';
import { adapterList, detectInstalledAdapters, getAdapter } from './agents/index.ts';
import { parseSource } from './sources/source-parser.ts';
import { addLockEntry } from './lock.ts';

export function parseAddOptions(args: string[]): { source: string; options: AddOptions } {
  const options: AddOptions = {};
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '-a':
      case '--agent':
        options.agents = args[++i]?.split(',').map((a) => a.trim());
        break;
      case '-s':
      case '--scope':
        options.scope = args[++i] as Scope;
        break;
      case '-l':
      case '--list':
        options.list = true;
        break;
      case '--server':
        options.servers = args[++i]?.split(',').map((s) => s.trim());
        break;
      case '--all':
        options.all = true;
        break;
      case '-y':
      case '--yes':
        options.yes = true;
        break;
      default:
        if (!arg?.startsWith('-')) {
          positional.push(arg!);
        }
        break;
    }
  }

  if (positional.length === 0) {
    throw new Error('Source is required. Usage: mcp add <source>');
  }

  return { source: positional[0]!, options };
}

export async function runAdd(source: string, options: AddOptions): Promise<void> {
  const s = p.spinner();
  
  // Parse source and fetch server(s)
  s.start('Fetching server configuration...');
  let servers: NormalizedServer[];
  let sourceInfo: { type: 'registry' | 'git' | 'local'; url: string };
  
  try {
    const result = await parseSource(source);
    servers = result.servers;
    sourceInfo = result.sourceInfo;
  } catch (error) {
    s.stop(pc.red(`Failed to fetch server: ${error instanceof Error ? error.message : 'Unknown error'}`));
    throw error;
  }
  s.stop('Server configuration fetched');

  // Filter servers if specific ones requested
  if (options.servers && options.servers.length > 0) {
    servers = servers.filter((s) => options.servers?.includes(s.id));
    if (servers.length === 0) {
      throw new Error('No matching servers found');
    }
  }

  // List mode - just show available servers
  if (options.list) {
    console.log(pc.bold('\nAvailable servers:\n'));
    for (const server of servers) {
      console.log(`  ${pc.cyan(server.id)}`);
      if (server.description) {
        console.log(`    ${pc.dim(server.description)}`);
      }
      console.log(`    ${pc.dim('Transport:')} ${server.transport.type}`);
      if (server.secrets.length > 0) {
        console.log(`    ${pc.dim('Secrets:')} ${server.secrets.map((s) => s.name).join(', ')}`);
      }
      console.log();
    }
    return;
  }

  // Select servers interactively if not using --all and multiple found
  let selectedServers = servers;
  if (!options.all && servers.length > 1) {
    const choices = servers.map((s) => ({
      value: s.id,
      label: s.id,
      hint: s.description,
    }));

    const selected = await p.multiselect({
      message: 'Select servers to install:',
      options: choices,
    });

    if (p.isCancel(selected) || selected.length === 0) {
      console.log(pc.yellow('Installation cancelled'));
      return;
    }

    selectedServers = servers.filter((s) => selected.includes(s.id));
  }

  // Detect target agents
  let targetAgents = adapterList;
  if (options.agents) {
    targetAgents = options.agents
      .map((id) => getAdapter(id))
      .filter((a): a is NonNullable<typeof a> => a !== undefined);
  } else {
    const installed = await detectInstalledAdapters();
    if (installed.length > 0) {
      targetAgents = installed;
    }
  }

  if (targetAgents.length === 0) {
    // Prompt user to select agents
    const choices = adapterList.map((a) => ({
      value: a.id,
      label: a.displayName,
    }));

    const selected = await p.multiselect({
      message: 'Select target agents:',
      options: choices,
    });

    if (p.isCancel(selected) || selected.length === 0) {
      console.log(pc.yellow('Installation cancelled'));
      return;
    }

    targetAgents = selected
      .map((id) => getAdapter(id))
      .filter((a): a is NonNullable<typeof a> => a !== undefined);
  }

  // Determine scope
  const scope: Scope = options.scope || 'project';

  // Show installation summary
  console.log(pc.bold('\nInstallation Summary:\n'));
  console.log(`${pc.dim('Source:')} ${source}`);
  console.log(`${pc.dim('Scope:')} ${scope}`);
  console.log(`${pc.dim('Agents:')} ${targetAgents.map((a) => a.displayName).join(', ')}`);
  console.log(`${pc.dim('Servers:')}`);
  
  for (const server of selectedServers) {
    console.log(`  ${pc.cyan(server.id)}`);
    console.log(`    ${pc.dim('Transport:')} ${server.transport.type}`);
    if (server.transport.type === 'stdio') {
      console.log(`    ${pc.dim('Command:')} ${server.transport.command} ${server.transport.args.join(' ')}`);
    } else {
      console.log(`    ${pc.dim('URL:')} ${server.transport.url}`);
    }
  }
  console.log();

  // Confirm installation
  if (!options.yes) {
    const confirmed = await p.confirm({
      message: 'Proceed with installation?',
    });

    if (p.isCancel(confirmed) || !confirmed) {
      console.log(pc.yellow('Installation cancelled'));
      return;
    }
  }

  // Install to each agent
  const cwd = process.cwd();
  
  for (const agent of targetAgents) {
    // Check if scope is supported
    if (!agent.supportedScopes.includes(scope)) {
      console.log(pc.yellow(`Skipping ${agent.displayName} - ${scope} scope not supported`));
      continue;
    }

    console.log(pc.bold(`\nInstalling to ${agent.displayName}...`));

    for (const server of selectedServers) {
      try {
        await agent.addServer(scope, cwd, server, options);
        console.log(`  ${pc.green('✓')} ${server.id}`);
      } catch (error) {
        console.log(`  ${pc.red('✗')} ${server.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Update lock file
    for (const server of selectedServers) {
      const installedName = server.id.split('/').pop() || server.id;
      addLockEntry(server.id, sourceInfo, server, [
        { agent: agent.id, scope, installedName },
      ]);
    }
  }

  console.log(pc.green('\n✓ Installation complete'));
}
