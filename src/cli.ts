#!/usr/bin/env node

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as p from '@clack/prompts';
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
  add <source>      Add an MCP server from registry, git, or local path
  list, ls          List installed MCP servers
  remove, rm        Remove installed MCP servers
  check             Check for available server updates
  update            Update all servers to latest versions

${pc.bold('Add Options:')}
  -a, --agent <agents...>  Target specific agents (default: auto-detect)
  -s, --scope <scope>      Installation scope: project|user (default: project)
  -l, --list              List available servers without installing
  --server <ids...>       Install specific servers from source
  --all                   Install all servers found in source
  -y, --yes               Skip confirmation prompts

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
  ${pc.dim('$')} usemcps add io.github.user/server
  ${pc.dim('$')} usemcps add github.com/user/repo
  ${pc.dim('$')} usemcps add ./local-server
  ${pc.dim('$')} usemcps add user/repo --agent claude-code --scope project
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
        const { source, options } = parseAddOptions(restArgs);
        await runAdd(source, options);
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
