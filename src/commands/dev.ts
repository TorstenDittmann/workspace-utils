import pc from 'picocolors';
import { WorkspaceParser } from '../core/workspace.ts';
import { validatePackagesHaveScript, prepareCommandExecution } from '../utils/package-utils.ts';
import { ProcessRunner } from '../core/process-runner.ts';
import { Output } from '../utils/output.ts';

interface DevCommandOptions {
	filter?: string;
	concurrency?: string;
}

export async function devCommand(options: DevCommandOptions): Promise<void> {
	try {
		Output.dev('Starting development servers with live log streaming...\n');

		// Parse workspace
		const parser = new WorkspaceParser();
		const workspace = await parser.parseWorkspace();

		Output.dim(`Workspace root: ${workspace.root}`, 'folder');
		Output.dim(`Found ${workspace.packages.length} packages\n`, 'package');

		// Filter packages if pattern provided
		let targetPackages = workspace.packages;
		if (options.filter) {
			targetPackages = parser.filterPackages(workspace.packages, options.filter);
			Output.log(
				`Filtered to ${targetPackages.length} packages matching "${options.filter}"`,
				'magnifying',
				'yellow'
			);
		}

		// Validate packages have the dev script
		const { valid: packagesWithDev, invalid: packagesWithoutDev } = validatePackagesHaveScript(
			targetPackages,
			'dev'
		);

		if (packagesWithoutDev.length > 0) {
			Output.warning(`The following packages don't have a "dev" script:`);
			packagesWithoutDev.forEach(pkg => {
				Output.listItem(pkg.name);
			});
			console.log();
		}

		if (packagesWithDev.length === 0) {
			Output.error('No packages found with a "dev" script.');
			process.exit(1);
		}

		Output.success(`Starting dev servers for ${packagesWithDev.length} packages:`);
		packagesWithDev.forEach(pkg => {
			const color = ProcessRunner.getPackageColor(pkg.name);
			const getColorFn = (colorName: string) => {
				switch (colorName) {
					case 'red':
						return pc.red;
					case 'green':
						return pc.green;
					case 'yellow':
						return pc.yellow;
					case 'blue':
						return pc.blue;
					case 'magenta':
						return pc.magenta;
					case 'cyan':
						return pc.cyan;
					case 'gray':
						return pc.gray;
					case 'redBright':
						return pc.redBright;
					case 'greenBright':
						return pc.greenBright;
					case 'yellowBright':
						return pc.yellowBright;
					case 'blueBright':
						return pc.blueBright;
					case 'magentaBright':
						return pc.magentaBright;
					case 'cyanBright':
						return pc.cyanBright;
					default:
						return pc.white;
				}
			};
			const colorFn = getColorFn(color);
			console.log(`  • ${colorFn(pkg.name)}`);
		});
		console.log();

		const concurrency = parseInt(options.concurrency || '4', 10);

		Output.log(`Package manager: ${workspace.packageManager.name}`, 'wrench', 'blue');
		Output.log(
			`Running ${Math.min(packagesWithDev.length, concurrency)} dev servers simultaneously`,
			'lightning',
			'blue'
		);
		Output.tip('Use Ctrl+C to stop all development servers\n');

		// Prepare command execution with enhanced logging for dev mode
		const commands = prepareCommandExecution(packagesWithDev, 'dev', workspace.packageManager).map(
			cmd => ({
				...cmd,
				logOptions: {
					...cmd.logOptions,
					showTimestamp: false, // Disable timestamps for dev mode
				},
			})
		);

		// Set up graceful shutdown
		let isShuttingDown = false;
		const shutdown = () => {
			if (isShuttingDown) return;
			isShuttingDown = true;

			Output.log('\n\nShutting down development servers...', 'warning', 'yellow');
			Output.dim('This may take a moment to gracefully stop all processes.\n');

			// Begin graceful termination of all active child processes
			ProcessRunner.terminateAll('SIGTERM', 5000)
				.then(() => {
					process.exit(0);
				})
				.catch(() => {
					process.exit(0);
				});

			// Force exit as a final fallback
			setTimeout(() => {
				Output.log('Timeout reached, forcing exit...', 'clock', 'red');
				process.exit(0);
			}, 6000);
		};

		process.on('SIGINT', shutdown);
		process.on('SIGTERM', shutdown);

		Output.log('Starting development servers...\n', 'movie', 'green');
		Output.separator();

		// Execute all dev commands in parallel (they're meant to run indefinitely)
		const startTime = Date.now();

		try {
			// For dev mode, we don't wait for completion since these are long-running processes
			const promises = commands.map(cmd =>
				ProcessRunner.runCommand(cmd.command, cmd.args, cmd.options, cmd.logOptions).catch(
					error => {
						Output.log(`Error in ${cmd.logOptions.prefix}: ${error}`, 'fire', 'red');
						return {
							success: false,
							exitCode: 1,
							packageName: cmd.logOptions.prefix,
							command: `${cmd.command} ${cmd.args.join(' ')}`,
							duration: Date.now() - startTime,
						};
					}
				)
			);

			// Wait for all processes to start
			await Promise.allSettled(promises.slice(0, Math.min(concurrency, promises.length)));

			// If we reach here, some processes may have exited unexpectedly
			if (!isShuttingDown) {
				Output.warning('\nSome development servers may have stopped unexpectedly.');
				Output.dim('Check the logs above for any error messages.\n');
			}
		} catch (error) {
			if (!isShuttingDown) {
				Output.log(
					`Development server error: ${error instanceof Error ? error.message : String(error)}`,
					'fire',
					'red'
				);
			}
		}

		const totalDuration = Date.now() - startTime;

		if (!isShuttingDown) {
			Output.log(
				`\nDevelopment session lasted: ${Output.formatDuration(totalDuration)}`,
				'chart',
				'blue'
			);
			Output.success('All development servers have stopped.');
		}
	} catch (error) {
		Output.log(
			`Dev command error: ${error instanceof Error ? error.message : String(error)}`,
			'fire',
			'red'
		);
		process.exit(1);
	}
}
