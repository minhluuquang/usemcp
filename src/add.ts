import * as p from '@clack/prompts';
import pc from 'picocolors';
import type { AddOptions, NormalizedServer, Scope, Transport } from './types.ts';
import { adapterList, detectInstalledAdapters, getAdapter } from './agents/index.ts';
import { addLockEntry } from './lock.ts';

export interface ParsedAddArgs {
  name: string;
  transport: Transport;
  env: Record<string, string>;
  options: AddOptions;
}

export function parseAddOptions(args: string[]): ParsedAddArgs {
  const options: AddOptions = {};
  const env: Record<string, string> = {};
  let transportType: 'stdio' | 'http' | 'sse' = 'stdio';
  let transportUrl: string | undefined;
  let _transportCommand: string | undefined;
  const _transportArgs: string[] = [];
  let transportHeaders: Record<string, string> | undefined;

  const preDash: string[] = [];
  const postDash: string[] = [];

  // Find the -- separator
  const dashIndex = args.indexOf('--');

  if (dashIndex !== -1) {
    preDash.push(...args.slice(0, dashIndex));
    postDash.push(...args.slice(dashIndex + 1));
  } else {
    preDash.push(...args);
  }

  // Parse options before --
  for (let i = 0; i < preDash.length; i++) {
    const arg = preDash[i];

    switch (arg) {
      case '-a':
      case '--agent':
        options.agents = preDash[++i]?.split(',').map(a => a.trim());
        break;
      case '-s':
      case '--scope':
        options.scope = preDash[++i] as Scope;
        break;
      case '-y':
      case '--yes':
        options.yes = true;
        break;
      case '--transport': {
        const t = preDash[++i];
        if (t === 'stdio' || t === 'http' || t === 'sse') {
          transportType = t;
        }
        break;
      }
      case '--env': {
        const envArg = preDash[++i];
        if (envArg) {
          const [key, ...valueParts] = envArg.split('=');
          if (key && valueParts.length > 0) {
            env[key] = valueParts.join('=');
          }
        }
        break;
      }
      case '--header': {
        const headerArg = preDash[++i];
        if (headerArg) {
          const [key, ...valueParts] = headerArg.split(':');
          if (key && valueParts.length > 0) {
            if (!transportHeaders) transportHeaders = {};
            transportHeaders[key.trim()] = valueParts.join(':').trim();
          }
        }
        break;
      }
      default: {
        if (!arg?.startsWith('-')) {
          // This should be the server name
          if (!(options as { name?: string }).name) {
            (options as { name?: string }).name = arg;
          } else if (transportType !== 'stdio' && !transportUrl) {
            // For http/sse, the next positional arg is the URL
            transportUrl = arg;
          }
        }
        break;
      }
    }
  }

  // The server name is required
  const name = (options as { name?: string }).name;
  if (!name) {
    throw new Error(
      'Server name is required. Usage: usemcps add [options] <name> -- <command> [args...]'
    );
  }

  // Build transport based on type
  let transport: Transport;

  if (transportType === 'stdio') {
    // For stdio, everything after -- is the command and args
    if (postDash.length === 0) {
      throw new Error(
        'Command is required for stdio transport. Usage: usemcps add [options] <name> -- <command> [args...]'
      );
    }
    transport = {
      type: 'stdio',
      command: postDash[0]!,
      args: postDash.slice(1),
      env: Object.keys(env).length > 0 ? env : undefined,
    };
  } else if (transportType === 'http') {
    if (!transportUrl) {
      throw new Error(
        'URL is required for http transport. Usage: usemcps add --transport http [options] <name> <url>'
      );
    }
    transport = {
      type: 'http',
      url: transportUrl,
      headers: transportHeaders,
    };
  } else {
    // sse
    if (!transportUrl) {
      throw new Error(
        'URL is required for sse transport. Usage: usemcps add --transport sse [options] <name> <url>'
      );
    }
    transport = {
      type: 'sse',
      url: transportUrl,
    };
  }

  return { name, transport, env, options };
}

export async function runAdd(
  name: string,
  transport: Transport,
  options: AddOptions
): Promise<void> {
  const _spinner = p.spinner();

  // Create server configuration
  const server: NormalizedServer = {
    id: name,
    displayName: name,
    transport,
    secrets: [],
  };

  // Detect target agents
  let targetAgents = adapterList;
  if (options.agents) {
    targetAgents = options.agents
      .map(id => getAdapter(id))
      .filter((a): a is NonNullable<typeof a> => a !== undefined);
  } else {
    const installed = await detectInstalledAdapters();
    if (installed.length > 0) {
      targetAgents = installed;
    }
  }

  if (targetAgents.length === 0) {
    // Prompt user to select agents
    const choices = adapterList.map(a => ({
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
      .map(id => getAdapter(id))
      .filter((a): a is NonNullable<typeof a> => a !== undefined);
  }

  // Determine scope
  const scope: Scope = options.scope || 'project';

  // Show installation summary
  console.log(pc.bold('\nInstallation Summary:\n'));
  console.log(`${pc.dim('Name:')} ${name}`);
  console.log(`${pc.dim('Transport:')} ${transport.type}`);
  if (transport.type === 'stdio') {
    console.log(`${pc.dim('Command:')} ${transport.command} ${transport.args.join(' ')}`);
    if (transport.env && Object.keys(transport.env).length > 0) {
      console.log(`${pc.dim('Environment:')} ${Object.keys(transport.env).join(', ')}`);
    }
  } else {
    console.log(`${pc.dim('URL:')} ${transport.url}`);
  }
  console.log(`${pc.dim('Scope:')} ${scope}`);
  console.log(`${pc.dim('Agents:')} ${targetAgents.map(a => a.displayName).join(', ')}`);
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
  const sourceInfo = {
    type: 'local' as const,
    url: `${transport.type}:${transport.type === 'stdio' ? transport.command : transport.url}`,
  };

  for (const agent of targetAgents) {
    // Check if scope is supported
    if (!agent.supportedScopes.includes(scope)) {
      console.log(pc.yellow(`Skipping ${agent.displayName} - ${scope} scope not supported`));
      continue;
    }

    console.log(pc.bold(`\nInstalling to ${agent.displayName}...`));

    try {
      await agent.addServer(scope, cwd, server, options);
      console.log(`  ${pc.green('✓')} ${name}`);
    } catch (error) {
      console.log(
        `  ${pc.red('✗')} ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    // Update lock file
    addLockEntry(name, sourceInfo, server, [{ agent: agent.id, scope, installedName: name }]);
  }

  console.log(pc.green('\n✓ Installation complete'));
}
