import pc from 'picocolors';
import { WorkspaceParser } from '../core/workspace.ts';
import {
	buildDependencyGraph,
	validatePackagesHaveScript,
	prepareCommandExecution,
} from '../utils/package-utils.ts';
import { ProcessRunner } from '../core/process-runner.ts';
import { Output } from '../utils/output.ts';

interface BuildCommandOptions {
	filter?: string;
	concurrency?: string;
	skipUnchanged?: boolean;
}

export async function buildCommand(options: BuildCommandOptions): Promise<void> {
	try {
		Output.build('Building packages in dependency order...\n');

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

		// Validate packages have the build script
		const { valid: packagesWithBuild, invalid: packagesWithoutBuild } = validatePackagesHaveScript(
			targetPackages,
			'build'
		);

		if (packagesWithoutBuild.length > 0) {
			Output.warning(`The following packages don't have a "build" script:`);
			packagesWithoutBuild.forEach(pkg => {
				Output.listItem(pkg.name);
			});
			console.log();
		}

		if (packagesWithBuild.length === 0) {
			Output.error('No packages found with a "build" script.');
			process.exit(1);
		}

		// Build dependency graph
		Output.log('Building dependency graph...', 'chart', 'blue');
		const dependencyGraph = buildDependencyGraph(packagesWithBuild);

		// Filter graph to only include packages that need to be built
		const packageNames = packagesWithBuild.map(pkg => pkg.name);
		const filteredGraph = dependencyGraph.filterGraph(packageNames);

		// Get build batches (topological order)
		let buildBatches;
		try {
			buildBatches = filteredGraph.getBuildBatches();
		} catch (error) {
			Output.error(
				`Dependency cycle detected: ${error instanceof Error ? error.message : String(error)}`
			);
			Output.tip('Check for circular dependencies between packages.');
			process.exit(1);
		}

		Output.success(`Build order determined: ${buildBatches.length} batches`);

		// Display build plan
		console.log(pc.blue(`\n${Output.getSymbol('books')} Build Plan:`));
		buildBatches.forEach((batch, index) => {
			Output.listItem(`Batch ${index + 1}: ${batch.join(', ')}`);
		});
		console.log();

		const concurrency = parseInt(options.concurrency || '4', 10);

		Output.log(`Package manager: ${workspace.packageManager.name}`, 'wrench', 'blue');
		Output.log(`Batch concurrency: ${concurrency}`, 'lightning', 'blue');
		console.log();

		// Prepare commands organized by batches
		const packageMap = new Map(packagesWithBuild.map(pkg => [pkg.name, pkg]));
		const commandBatches = buildBatches.map(batch => {
			return batch
				.map(packageName => packageMap.get(packageName))
				.filter((pkg): pkg is NonNullable<typeof pkg> => pkg !== undefined)
				.map(pkg => {
					const commands = prepareCommandExecution([pkg], 'build', workspace.packageManager);
					return commands[0];
				})
				.filter((cmd): cmd is NonNullable<typeof cmd> => cmd !== undefined);
		});

		// Execute builds in batches
		const startTime = Date.now();
		const allResults = await ProcessRunner.runBatches(commandBatches, concurrency);
		const totalDuration = Date.now() - startTime;

		// Print final summary
		const successful = allResults.filter(r => r.success);
		const failed = allResults.filter(r => !r.success);

		Output.buildSummary(successful.length, failed.length, totalDuration);

		if (failed.length > 0) {
			console.log(pc.red('\nFailed packages:'));
			failed.forEach(f => {
				Output.listItem(`${f.packageName} (exit code ${f.exitCode})`);
			});
		}

		if (successful.length > 0) {
			const avgDuration = Math.round(
				successful.reduce((sum, r) => sum + r.duration, 0) / successful.length
			);
			Output.dim(`Average package build time: ${Output.formatDuration(avgDuration)}`, 'chart');
		}

		// Show dependency chain info
		const rootPackages = filteredGraph.getRootPackages();
		const leafPackages = filteredGraph.getLeafPackages();

		if (rootPackages.length > 0) {
			Output.dim(`Root packages (no dependencies): ${rootPackages.join(', ')}`, 'seedling');
		}

		if (leafPackages.length > 0) {
			Output.dim(`Leaf packages (no dependents): ${leafPackages.join(', ')}`, 'leaf');
		}

		// Exit with error code if any builds failed
		if (failed.length > 0) {
			Output.log('\nBuild failed due to package failures.', 'fire', 'red');
			process.exit(1);
		} else {
			Output.celebrate('\nAll packages built successfully!');
		}
	} catch (error) {
		Output.log(
			`Build error: ${error instanceof Error ? error.message : String(error)}`,
			'fire',
			'red'
		);
		process.exit(1);
	}
}
