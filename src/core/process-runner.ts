import { spawn, type ChildProcess } from 'child_process';
import pc from 'picocolors';

export interface ProcessOptions {
	cwd: string;
	env?: Record<string, string>;
	stdio?: 'inherit' | 'pipe';
}

export interface LogOptions {
	prefix: string;
	color: string;
	showTimestamp?: boolean;
}

export interface ProcessResult {
	success: boolean;
	exitCode: number;
	packageName: string;
	command: string;
	duration: number;
}

export class ProcessRunner {
	private static colorPalette: string[] = [
		'red',
		'green',
		'yellow',
		'blue',
		'magenta',
		'cyan',
		'gray',
		'redBright',
		'greenBright',
		'yellowBright',
		'blueBright',
		'magentaBright',
		'cyanBright',
	];

	private static assignedColors = new Map<string, string>();
	private static colorIndex = 0;

	// Track active child processes to enable graceful shutdown (e.g., for `dev`)
	private static activeChildren: Set<ChildProcess> = new Set();

	/**
	 * Get a consistent color for a package
	 */
	static getPackageColor(packageName: string): string {
		if (!this.assignedColors.has(packageName)) {
			const colorIndex = this.colorIndex % this.colorPalette.length;
			const color = this.colorPalette[colorIndex] || 'white';
			this.assignedColors.set(packageName, color);
			this.colorIndex++;
		}
		const color = this.assignedColors.get(packageName);
		return color || 'white';
	}

	/**
	 * Get color function from picocolors
	 */
	private static getColorFn(color: string) {
		switch (color) {
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
	}

	/**
	 * Run a single command with real-time log streaming
	 */
	static async runCommand(
		command: string,
		args: string[],
		options: ProcessOptions,
		logOptions: LogOptions
	): Promise<ProcessResult> {
		const startTime = Date.now();
		const fullCommand = [command, ...args].join(' ');

		const colorFn = this.getColorFn(logOptions.color);
		console.log(`[${colorFn(logOptions.prefix)}] ` + pc.gray(`Starting: ${fullCommand}`));

		return new Promise(resolve => {
			const childProcess = spawn(command, args, {
				cwd: options.cwd,
				env: { ...process.env, ...options.env },
				stdio: ['inherit', 'pipe', 'pipe'],
			});

			// Register child for potential global shutdown
			ProcessRunner.activeChildren.add(childProcess);

			// Stream stdout with prefix and color
			if (childProcess.stdout) {
				childProcess.stdout.on('data', data => {
					const lines = data.toString().split('\n');
					lines.forEach((line: string) => {
						if (line.trim()) {
							this.logLine(line, logOptions, false);
						}
					});
				});
			}

			// Stream stderr with prefix and color
			if (childProcess.stderr) {
				childProcess.stderr.on('data', data => {
					const lines = data.toString().split('\n');
					lines.forEach((line: string) => {
						if (line.trim()) {
							this.logLine(line, logOptions, true);
						}
					});
				});
			}

			childProcess.on('close', exitCode => {
				// Deregister on close
				ProcessRunner.activeChildren.delete(childProcess);
				const duration = Date.now() - startTime;
				const code = exitCode || 0;

				const result: ProcessResult = {
					success: code === 0,
					exitCode: code,
					packageName: logOptions.prefix,
					command: fullCommand,
					duration,
				};

				const colorFn = this.getColorFn(logOptions.color);
				if (code === 0) {
					console.log(
						`[${colorFn(logOptions.prefix)}] ` + pc.green(`✅ Completed in ${duration}ms`)
					);
				} else {
					console.log(
						`[${colorFn(logOptions.prefix)}] ` +
							pc.red(`❌ Failed with exit code ${code} (${duration}ms)`)
					);
				}

				resolve(result);
			});

			childProcess.on('error', error => {
				// Deregister on error
				ProcessRunner.activeChildren.delete(childProcess);
				const duration = Date.now() - startTime;
				const colorFn = this.getColorFn(logOptions.color);
				console.error(`[${colorFn(logOptions.prefix)}] ` + pc.red(`💥 Error: ${error.message}`));

				resolve({
					success: false,
					exitCode: 1,
					packageName: logOptions.prefix,
					command: fullCommand,
					duration,
				});
			});
		});
	}

	/**
	 * Terminate all active child processes gracefully.
	 * Sends the provided signal and waits up to graceMs, then force-kills.
	 */
	static async terminateAll(signal: NodeJS.Signals = 'SIGTERM', graceMs = 5000): Promise<void> {
		const children = Array.from(this.activeChildren);
		if (children.length === 0) return;

		// Send initial signal
		for (const child of children) {
			try {
				child.kill(signal);
			} catch {
				// ignore
			}
		}

		// Await close for each with timeout
		await Promise.all(
			children.map(child => {
				return new Promise<void>(resolve => {
					let settled = false;
					const onClose = () => {
						if (settled) return;
						settled = true;
						resolve();
					};
					child.once('close', onClose);

					const timer = setTimeout(() => {
						if (settled) return;
						// Force kill if still alive
						try {
							child.kill('SIGKILL');
						} catch {
							// ignore
						}
						settled = true;
						resolve();
					}, graceMs);

					// If the process has already exited, resolve quickly
					// Note: There's no portable way to check if it's already dead without race conditions,
					// the 'close' handler above will handle it if it fires immediately.
				});
			})
		);
	}

	/**
	 * Log a single line with prefix and color
	 */
	private static logLine(line: string, logOptions: LogOptions, isError = false): void {
		const timestamp = logOptions.showTimestamp ? pc.dim(`[${new Date().toISOString()}] `) : '';

		// Only color the package name in brackets, not the entire line
		const colorFn = this.getColorFn(logOptions.color);
		const coloredPrefix = `[${colorFn(logOptions.prefix)}] `;

		// Apply error color only to the actual log content if it's an error
		const logContent = isError ? pc.red(line) : line;

		console.log(timestamp + coloredPrefix + logContent);
	}

	/**
	 * Run multiple commands in parallel with concurrency limit
	 */
	static async runParallel(
		commands: Array<{
			command: string;
			args: string[];
			options: ProcessOptions;
			logOptions: LogOptions;
		}>,
		concurrency = 4
	): Promise<ProcessResult[]> {
		const results: ProcessResult[] = [];
		const executing: Promise<ProcessResult>[] = [];

		for (let i = 0; i < commands.length; i++) {
			const cmd = commands[i];
			if (!cmd) continue;

			// Start the command
			const promise = this.runCommand(cmd.command, cmd.args, cmd.options, cmd.logOptions);

			executing.push(promise);

			// If we've reached the concurrency limit or this is the last command
			if (executing.length >= concurrency || i === commands.length - 1) {
				// Wait for at least one to complete
				const completedIndex = await this.waitForAny(executing);
				const completedPromise = executing[completedIndex];
				if (completedPromise) {
					const completed = await completedPromise;
					results.push(completed);
				}

				// Remove completed promise from executing array
				executing.splice(completedIndex, 1);
			}
		}

		// Wait for all remaining commands to complete
		const remainingResults = await Promise.all(executing);
		results.push(...remainingResults);

		return results;
	}

	/**
	 * Wait for any promise to complete and return its index
	 */
	private static async waitForAny(promises: Promise<ProcessResult>[]): Promise<number> {
		return new Promise(resolve => {
			promises.forEach((promise, index) => {
				promise.then(() => resolve(index));
			});
		});
	}

	/**
	 * Run commands sequentially (one after another)
	 */
	static async runSequential(
		commands: Array<{
			command: string;
			args: string[];
			options: ProcessOptions;
			logOptions: LogOptions;
		}>
	): Promise<ProcessResult[]> {
		const results: ProcessResult[] = [];

		for (const cmd of commands) {
			const result = await this.runCommand(cmd.command, cmd.args, cmd.options, cmd.logOptions);

			results.push(result);

			// Stop on first failure unless explicitly configured to continue
			if (!result.success) {
				console.log(pc.red(`\n❌ Stopping execution due to failure in ${result.packageName}`));
				break;
			}
		}

		return results;
	}

	/**
	 * Run commands in batches (for dependency-aware execution)
	 */
	static async runBatches(
		batches: Array<
			Array<{
				command: string;
				args: string[];
				options: ProcessOptions;
				logOptions: LogOptions;
			}>
		>,
		concurrency = 4
	): Promise<ProcessResult[]> {
		const allResults: ProcessResult[] = [];

		for (let i = 0; i < batches.length; i++) {
			const batch = batches[i];
			if (!batch) continue;

			console.log(
				pc.blue(`\n🔄 Running batch ${i + 1}/${batches.length} (${batch.length} packages)`)
			);

			// Run all commands in this batch in parallel
			const batchResults = await this.runParallel(batch, concurrency);
			allResults.push(...batchResults);

			// Check if any command in this batch failed
			const failures = batchResults.filter(r => !r.success);
			if (failures.length > 0) {
				console.log(pc.red(`\n❌ Batch ${i + 1} failed. The following packages failed:`));
				failures.forEach(f => {
					console.log(pc.red(`  • ${f.packageName}: ${f.command}`));
				});
				console.log(pc.red(`\nStopping execution due to batch failure.`));
				break;
			}

			console.log(pc.green(`✅ Batch ${i + 1} completed successfully`));
		}

		return allResults;
	}

	/**
	 * Print execution summary
	 */
	static printSummary(results: ProcessResult[]): void {
		const successful = results.filter(r => r.success);
		const failed = results.filter(r => !r.success);
		const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

		console.log(pc.bold('\n📊 Execution Summary:'));
		console.log(pc.green(`✅ Successful: ${successful.length}`));

		if (failed.length > 0) {
			console.log(pc.red(`❌ Failed: ${failed.length}`));
			console.log(pc.red('\nFailed packages:'));
			failed.forEach(f => {
				console.log(pc.red(`  • ${f.packageName} (exit code ${f.exitCode})`));
			});
		}

		console.log(pc.blue(`⏱️  Total duration: ${totalDuration}ms`));

		if (successful.length > 0) {
			const avgDuration = Math.round(totalDuration / successful.length);
			console.log(pc.dim(`📈 Average duration: ${avgDuration}ms`));
		}
	}
}
