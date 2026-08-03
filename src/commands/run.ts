import pc from "picocolors";
import { WorkspaceParser } from "../core/workspace.ts";
import { validatePackagesHaveScript, prepareCommandExecution } from "../utils/package-utils.ts";
import { ProcessRunner } from "../core/process-runner.ts";
import { Output } from "../utils/output.ts";
import {
	resolveTargets,
	parsePositiveInteger,
	parseDuration,
	type CommonCommandOptions,
} from "../utils/command-options.ts";
import { buildDependencyGraph } from "../utils/package-utils.ts";
import { runTopological } from "../core/scheduler.ts";
import { emitEvent, isJsonReporter } from "../core/reporter.ts";

interface RunCommandOptions extends CommonCommandOptions {
	parallel?: boolean;
	concurrency?: string;
	sequential?: boolean;
	topological?: boolean;
}

export async function runCommand(scriptName: string, options: RunCommandOptions): Promise<void> {
	try {
		Output.info(`Running script "${scriptName}" across packages...\n`);

		// Parse workspace
		const parser = new WorkspaceParser();
		const workspace = await parser.parseWorkspace();
		if (isJsonReporter())
			emitEvent("workspace", {
				root: workspace.root,
				packageManager: workspace.packageManager.name,
				packageCount: workspace.packages.length,
			});

		Output.dim(`Workspace root: ${workspace.root}`, "folder");
		Output.dim(`Found ${workspace.packages.length} packages\n`, "package");

		// Filter packages if pattern provided
		let targetPackages = resolveTargets(workspace, options);
		if (options.topological && options.sequential)
			throw new Error("--topological and --sequential are mutually exclusive");
		if (options.filter?.length || options.affected || options.since) {
			Output.log(
				options.filter && !Array.isArray(options.filter)
					? `Filtered to ${targetPackages.length} packages matching "${options.filter}"`
					: `Selected ${targetPackages.length} packages`,
				"magnifying",
				"yellow",
			);
		}

		// Validate packages have the script
		const { valid: packagesWithScript, invalid: packagesWithoutScript } =
			validatePackagesHaveScript(targetPackages, scriptName);
		if (packagesWithoutScript.length > 0) {
			Output.warning(`Skipping packages without the "${scriptName}" script:`);
			packagesWithoutScript.forEach((pkg) => Output.listItem(pkg.name));
		}

		if (packagesWithScript.length === 0) {
			Output.error(`No packages found with the "${scriptName}" script.`);
			process.exit(1);
		}
		if (isJsonReporter())
			emitEvent("selection", { packages: packagesWithScript.map((pkg) => pkg.name) });

		Output.success(`Running "${scriptName}" in ${packagesWithScript.length} packages:`);
		packagesWithScript.forEach((pkg) => {
			Output.listItem(pkg.name);
		});
		console.log();

		// Determine execution mode (parallel by default unless explicitly sequential)
		const isParallel = !options.sequential;
		const concurrency = parsePositiveInteger(options.concurrency, "concurrency", 4);
		const retries = parsePositiveInteger(options.retry, "retry", 0, true);
		const timeoutMs = parseDuration(options.timeout);

		Output.log(`Package manager: ${workspace.packageManager.name}`, "wrench", "blue");
		Output.log(
			`Execution mode: ${isParallel ? `parallel (concurrency: ${concurrency})` : "sequential"}`,
			"lightning",
			"blue",
		);
		console.log();

		// Prepare command execution
		const commands = prepareCommandExecution(
			packagesWithScript,
			scriptName,
			workspace.packageManager,
		).map((command) => ({ ...command, options: { ...command.options, retries, timeoutMs } }));
		if (options.dryRun) {
			Output.info("Dry run execution plan:");
			const batches = options.topological
				? buildDependencyGraph(packagesWithScript).getBuildBatches()
				: [packagesWithScript.map((pkg) => pkg.name)];
			if (isJsonReporter())
				emitEvent("plan", {
					dryRun: true,
					batches,
					concurrency,
					failurePolicy: options.failFast
						? "fail-fast"
						: options.continueOnError
							? "continue"
							: "block-downstream",
				});
			else
				batches.forEach((batch, index) =>
					Output.listItem(`Batch ${index + 1}: ${batch.join(", ")}`),
				);
			commands.forEach((c) =>
				Output.listItem(`${c.logOptions.prefix}: ${c.command} ${c.args.join(" ")}`),
			);
			return;
		}

		// Execute commands
		const startTime = Date.now();
		let results;

		let blocked: string[] = [];
		if (options.topological) {
			const scheduled = await runTopological(
				commands,
				buildDependencyGraph(packagesWithScript),
				concurrency,
				options,
			);
			results = scheduled.results;
			blocked = scheduled.blocked;
			scheduled.cancelled.forEach((name) =>
				Output.warning(`Cancelled after failure: ${name}`),
			);
		} else if (isParallel) {
			results = await ProcessRunner.runParallel(commands, concurrency, options.failFast);
		} else {
			results = await ProcessRunner.runSequential(commands, options.continueOnError);
		}

		const totalDuration = Date.now() - startTime;

		// Print summary
		const successful = results.filter((r) => r.success);
		const failed = results.filter((r) => !r.success);
		blocked.forEach((name) => Output.warning(`Blocked by failed dependency: ${name}`));

		Output.executionSummary(successful.length, failed.length, totalDuration);
		if (isJsonReporter())
			emitEvent("summary", {
				successful: successful.length,
				failed: failed.length,
				blocked: blocked.length,
				duration: totalDuration,
			});

		if (failed.length > 0 || blocked.length > 0) {
			console.log(pc.red("\nFailed packages:"));
			failed.forEach((f) => {
				Output.listItem(`${f.packageName} (exit code ${f.exitCode})`);
			});
		}

		if (successful.length > 0) {
			const avgDuration = Math.round(
				successful.reduce((sum, r) => sum + r.duration, 0) / successful.length,
			);
			Output.dim(`Average package duration: ${Output.formatDuration(avgDuration)}`, "chart");
		}

		// Exit with error code if any commands failed
		if (failed.length > 0 || blocked.length > 0) {
			process.exit(1);
		}
	} catch (error) {
		Output.log(
			`Error: ${error instanceof Error ? error.message : String(error)}`,
			"fire",
			"red",
		);
		process.exit(1);
	}
}
