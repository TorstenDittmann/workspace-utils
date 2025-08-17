#!/usr/bin/env bun
import { Command } from 'commander';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { runCommand } from './src/commands/run.ts';
import { buildCommand } from './src/commands/build.ts';
import { devCommand } from './src/commands/dev.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json for version by traversing up directories
function findPackageJson(startDir: string): Record<string, unknown> {
	let currentDir = startDir;
	while (currentDir !== dirname(currentDir)) {
		try {
			const packageJsonPath = join(currentDir, 'package.json');
			const content = readFileSync(packageJsonPath, 'utf8');
			return JSON.parse(content) as Record<string, unknown>;
		} catch {
			currentDir = dirname(currentDir);
		}
	}
	throw new Error('package.json not found in any parent directory');
}

const packageJson = findPackageJson(__dirname);

const program = new Command();

program
	.name('workspace-utils')
	.description('CLI tool to orchestrate scripts across monorepo workspaces (Bun, pnpm, npm)')
	.version(packageJson.version as string)
	.option('--ascii', 'Force ASCII output (no Unicode/emoji characters)', false);

// Run command - execute a script across packages
program
	.command('run <script>')
	.description('Run a script across multiple packages')
	.option('-c, --concurrency <number>', 'Maximum number of concurrent processes', '4')
	.option('-f, --filter <pattern>', 'Filter packages by pattern (e.g., @scope/*)')
	.option('--sequential', 'Run scripts sequentially (default is parallel)', false)
	.action((script, options) => {
		if (program.opts().ascii) {
			process.env.WSU_ASCII = '1';
		}
		return runCommand(script, options);
	});

// Build command - build packages in dependency order
program
	.command('build')
	.description('Build packages in dependency order')
	.option('-f, --filter <pattern>', 'Filter packages by pattern')
	.option('-c, --concurrency <number>', 'Maximum number of concurrent builds', '4')
	.option('--skip-unchanged', "Skip packages that haven't changed (future feature)", false)
	.action(options => {
		if (program.opts().ascii) {
			process.env.WSU_ASCII = '1';
		}
		return buildCommand(options);
	});

// Dev command - run dev scripts in parallel with live logs
program
	.command('dev')
	.description('Run dev scripts across packages with live log streaming')
	.option('-f, --filter <pattern>', 'Filter packages by pattern')
	.option('-c, --concurrency <number>', 'Maximum number of concurrent processes', '4')
	.action(options => {
		if (program.opts().ascii) {
			process.env.WSU_ASCII = '1';
		}
		return devCommand(options);
	});

// Default to help if no command provided
if (process.argv.length <= 2) {
	program.help();
}

program.parse();
