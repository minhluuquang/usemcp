import * as p from '@clack/prompts';
import pc from 'picocolors';
import type { ListOptions, InstalledServer, Scope } from './types.ts';
import { adapterList, getAdapter } from './agents/index.ts';

export function parseListOptions(args: string[]): ListOptions {
  const options: ListOptions = {};

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
    }
  }

  return options;
}

export async function runList(options: ListOptions): Promise<void> {
  const scope: Scope = options.global ? 'user' : 'project';
  const cwd = process.cwd();

  // Determine which agents to query
  let agentsToQuery = adapterList;
  if (options.agents) {
    agentsToQuery = options.agents
      .map(id => getAdapter(id))
      .filter((a): a is NonNullable<typeof a> => a !== undefined);
  }

  let totalServers = 0;
  let hasOutput = false;

  for (const agent of agentsToQuery) {
    // Check if scope is supported
    if (!agent.supportedScopes.includes(scope)) {
      continue;
    }

    try {
      const isInstalled = await agent.detectInstalled();
      const installed = await agent.listInstalled(scope, cwd);

      if (hasOutput) {
        console.log();
      }
      hasOutput = true;

      const configPath = agent.getConfigPath(scope, cwd);

      if (isInstalled) {
        console.log(pc.bold(`${agent.displayName}`));
        console.log(pc.dim(`  ${configPath}`));

        if (installed.length === 0) {
          console.log();
          console.log(pc.dim('  No MCP servers installed'));
        } else {
          console.log();
          for (const { name, server } of installed) {
            console.log(`  ${pc.cyan(name)}`);
            if (server.description) {
              console.log(`    ${pc.dim(server.description)}`);
            }
            console.log(`    ${pc.dim('Transport:')} ${server.transport.type}`);

            if (server.transport.type === 'stdio') {
              const cmd = `${server.transport.command} ${server.transport.args.join(' ')}`;
              console.log(
                `    ${pc.dim('Command:')} ${cmd.slice(0, 60)}${cmd.length > 60 ? '...' : ''}`
              );
            } else {
              console.log(`    ${pc.dim('URL:')} ${server.transport.url}`);
            }

            totalServers++;
          }
        }
      }
    } catch (error) {
      // Silently skip agents with errors (e.g., config doesn't exist yet)
    }
  }

  if (!hasOutput) {
    console.log(pc.dim('No MCP servers installed.'));
    console.log(pc.dim(`Run ${pc.white('usemcps add <source>')} to install a server.`));
  } else {
    console.log();
    console.log(pc.dim(`Total: ${totalServers} server(s)`));
  }
}
