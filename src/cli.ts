#!/usr/bin/env node

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
// import type * as p from '@clack/prompts';
import pc from 'picocolors';
import { runAdd, parseAddOptions } from './add.ts';
import { runList, parseListOptions } from './list.ts';
import { runRemove, parseRemoveOptions } from './remove.ts';
import { runCheck } from './check.ts';
import { runUpdate } from './update.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

function getVersion(): string {
  try {
    const pkgPath = join(__dirname, '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return pkg.version;
  } catch {
    return '0.0.0';
  }
}

const VERSION = getVersion();

const LOGO_LINES = [
  '███╗   ███╗ ██████╗██████╗ ',
  '████╗ ████║██╔════╝██╔══██╗',
  '██╔████╔██║██║     ██████╔╝',
  '██║╚██╔╝██║██║     ██╔═══╝ ',
  '██║ ╚═╝ ██║╚██████╗██║     ',
  '╚═╝     ╚═╝ ╚═════╝╚═╝     ',
];

function showLogo(): void {
  console.log();
  LOGO_LINES.forEach(line => {
    console.log(pc.cyan(line));
  });
}

function showBanner(): void {
  showLogo();
  console.log();
  console.log(pc.dim('MCP Server Installer CLI'));
  console.log();
  console.log(
    `  ${pc.dim('$')}${pc.white(' usemcps add')} ${pc.dim('<source>')}     ${pc.dim('Add an MCP server')}`
  );
  console.log(
    `  ${pc.dim('$')}${pc.white(' usemcps list')}            ${pc.dim('List installed servers')}`
  );
  console.log(
    `  ${pc.dim('$')}${pc.white(' usemcps remove')} ${pc.dim('<name>')}     ${pc.dim('Remove a server')}`
  );
  console.log(
    `  ${pc.dim('$')}${pc.white(' usemcps check')}           ${pc.dim('Check for updates')}`
  );
  console.log(
    `  ${pc.dim('$')}${pc.white(' usemcps update')}          ${pc.dim('Update all servers')}`
  );
  console.log();
}

function showHelp(): void {
  console.log(`
${pc.bold('Usage:')} usemcps <command> [options]

${pc.bold('Commands:')}
  add [options] <name> -- <command> [args...]    Add an MCP server (stdio transport)
  add --transport http [options] <name> <url>    Add an HTTP MCP server
  add --transport sse [options] <name> <url>     Add an SSE MCP server
  list, ls                                       List installed MCP servers
  remove, rm                                     Remove installed MCP servers
  check                                          Check for available server updates
  update                                         Update all servers to latest versions

${pc.bold('Add Options:')}
  --transport <type>       Transport type: stdio|http|sse (default: stdio)
  -a, --agent <agents...>  Target specific agents (default: auto-detect)
  -s, --scope <scope>      Installation scope: project|user (default: project)
  --env <KEY=value>        Set environment variable (can be used multiple times)
  --header <KEY:value>     Set HTTP header (for http/sse transport)
  -y, --yes                Skip confirmation prompts

${pc.bold('List Options:')}
  -g, --global            List global/user-scoped servers
  -a, --agent <agents...> Filter by specific agents

${pc.bold('Remove Options:')}
  -g, --global            Remove from global scope
  -a, --agent <agents...> Remove from specific agents
  -y, --yes               Skip confirmation prompts

${pc.bold('Options:')}
  --help, -h        Show this help message
  --version, -v     Show version number

${pc.bold('Examples:')}
  ${pc.dim('$')} usemcps add playwright -- npx -y @playwright/mcp@latest
  ${pc.dim('$')} usemcps add --env API_KEY=xxx myserver -- node server.js
  ${pc.dim('$')} usemcps add --transport http notion https://mcp.notion.com/mcp
  ${pc.dim('$')} usemcps add --transport sse asana https://mcp.asana.com/sse
  ${pc.dim('$')} usemcps list
  ${pc.dim('$')} usemcps list --global
  ${pc.dim('$')} usemcps remove my-server
  ${pc.dim('$')} usemcps check
  ${pc.dim('$')} usemcps update
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    showBanner();
    return;
  }

  const command = args[0];
  const restArgs = args.slice(1);

  // Handle global flags
  if (command === '--help' || command === '-h') {
    showHelp();
    return;
  }

  if (command === '--version' || command === '-v') {
    console.log(VERSION);
    return;
  }

  try {
    switch (command) {
      case 'add':
      case 'install':
      case 'i': {
        showLogo();
        console.log();
        const { name, transport, options } = parseAddOptions(restArgs);
        await runAdd(name, transport, options);
        break;
      }

      case 'list':
      case 'ls': {
        const options = parseListOptions(restArgs);
        await runList(options);
        break;
      }

      case 'remove':
      case 'rm':
      case 'r': {
        const { servers, options } = parseRemoveOptions(restArgs);
        await runRemove(servers, options);
        break;
      }

      case 'check':
      case 'c': {
        await runCheck();
        break;
      }

      case 'update':
      case 'upgrade':
      case 'u': {
        await runUpdate();
        break;
      }

      default:
        console.log(pc.red(`Unknown command: ${command}`));
        console.log(pc.dim(`Run ${pc.bold('usemcps --help')} for usage.`));
        process.exit(1);
    }
  } catch (error) {
    console.error(pc.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
    process.exit(1);
  }
}

main();
