import pc from "picocolors";
import { WorkspaceParser } from "../core/workspace.ts";
import { validatePackagesHaveScript, prepareCommandExecution } from "../utils/package-utils.ts";
import { ProcessRunner } from "../core/process-runner.ts";
import { Output } from "../utils/output.ts";

interface RunCommandOptions {
	parallel?: boolean;
	concurrency?: string;
	filter?: string;
	sequential?: boolean;
}

export async function runCommand(scriptName: string, options: RunCommandOptions): Promise<void> {
	try {
		Output.info(`Running script "${scriptName}" across packages...\n`);

		// Parse workspace
		const parser = new WorkspaceParser();
		const workspace = await parser.parseWorkspace();

		Output.dim(`Workspace root: ${workspace.root}`, "folder");
		Output.dim(`Found ${workspace.packages.length} packages\n`, "package");

		// Filter packages if pattern provided
		let targetPackages = workspace.packages;
		if (options.filter) {
			targetPackages = parser.filterPackages(workspace.packages, options.filter);
			Output.log(
				`Filtered to ${targetPackages.length} packages matching "${options.filter}"`,
				"magnifying",
				"yellow",
			);
		}

		// Validate packages have the script
		const { valid: packagesWithScript, invalid: packagesWithoutScript } =
			validatePackagesHaveScript(targetPackages, scriptName);

		if (packagesWithScript.length === 0) {
			Output.error(`No packages found with the "${scriptName}" script.`);
			process.exit(1);
		}

		Output.success(`Running "${scriptName}" in ${packagesWithScript.length} packages:`);
		packagesWithScript.forEach((pkg) => {
			Output.listItem(pkg.name);
		});
		console.log();

		// Determine execution mode (parallel by default unless explicitly sequential)
		const isParallel = !options.sequential;
		const concurrency = parseInt(options.concurrency || "4", 10);

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
		);

		// Execute commands
		const startTime = Date.now();
		let results;

		if (isParallel) {
			results = await ProcessRunner.runParallel(commands, concurrency);
		} else {
			results = await ProcessRunner.runSequential(commands);
		}

		const totalDuration = Date.now() - startTime;

		// Print summary
		const successful = results.filter((r) => r.success);
		const failed = results.filter((r) => !r.success);

		Output.executionSummary(successful.length, failed.length, totalDuration);

		if (failed.length > 0) {
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
		if (failed.length > 0) {
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
