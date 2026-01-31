import pc from "picocolors";
import { WorkspaceParser } from "../core/workspace.ts";
import {
	buildDependencyGraph,
	validatePackagesHaveScript,
	prepareCommandExecution,
} from "../utils/package-utils.ts";
import { ProcessRunner } from "../core/process-runner.ts";
import { BuildCache } from "../core/cache.ts";
import { Output } from "../utils/output.ts";
import type { PackageInfo } from "../core/workspace.ts";

interface BuildCommandOptions {
	filter?: string;
	concurrency?: string;
	skipUnchanged?: boolean;
}

function collectPackagesWithDependencies(
	packages: PackageInfo[],
	packageMap: Map<string, PackageInfo>,
): PackageInfo[] {
	const queue = [...packages];
	const collected = new Map<string, PackageInfo>();

	while (queue.length > 0) {
		const pkg = queue.shift();
		if (!pkg || collected.has(pkg.name)) continue;

		collected.set(pkg.name, pkg);

		const dependencies = [...pkg.dependencies, ...pkg.devDependencies];
		for (const depName of dependencies) {
			const depPackage = packageMap.get(depName);
			if (depPackage && !collected.has(depName)) {
				queue.push(depPackage);
			}
		}
	}

	return Array.from(collected.values());
}

export async function buildCommand(options: BuildCommandOptions): Promise<void> {
	try {
		Output.build("Building packages in dependency order...\n");

		// Parse workspace
		const parser = new WorkspaceParser();
		const workspace = await parser.parseWorkspace();

		Output.dim(`Workspace root: ${workspace.root}`, "folder");
		Output.dim(`Found ${workspace.packages.length} packages\n`, "package");

		// Initialize cache if skipUnchanged is enabled
		let cache: BuildCache | undefined;
		const skippedPackages: PackageInfo[] = [];
		const packagesToBuild: PackageInfo[] = [];

		if (options.skipUnchanged !== false) {
			cache = new BuildCache(workspace.root);
			await cache.initialize();
			Output.log("Build cache enabled - checking for unchanged packages...", "chart", "blue");
		}

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

		// Validate filtered packages have the build script
		const { valid: buildableTargets, invalid: targetPackagesWithoutBuild } =
			validatePackagesHaveScript(targetPackages, "build");

		if (buildableTargets.length === 0) {
			Output.error('No packages found with a "build" script.');
			process.exit(1);
		}

		// Include dependencies of the filtered packages in the build set
		const packagesWithDependencies = collectPackagesWithDependencies(
			buildableTargets,
			workspace.packageMap,
		);

		const { valid: packagesWithBuild, invalid: packagesWithoutBuild } =
			validatePackagesHaveScript(packagesWithDependencies, "build");

		const missingBuildScriptPackages = new Map<string, PackageInfo>();
		[...targetPackagesWithoutBuild, ...packagesWithoutBuild].forEach((pkg) => {
			missingBuildScriptPackages.set(pkg.name, pkg);
		});

		if (missingBuildScriptPackages.size > 0) {
			Output.warning(`The following packages don't have a "build" script:`);
			Array.from(missingBuildScriptPackages.values()).forEach((pkg) => {
				Output.listItem(pkg.name);
			});
			console.log();
		}

		// Check cache for each package (if enabled)
		if (cache && options.skipUnchanged !== false) {
			const packageMap = new Map(packagesWithBuild.map((pkg) => [pkg.name, pkg]));

			for (const pkg of packagesWithBuild) {
				const isCached = await cache.isValid(pkg, packageMap);
				if (isCached) {
					skippedPackages.push(pkg);
				} else {
					packagesToBuild.push(pkg);
				}
			}

			// Show cache status
			if (skippedPackages.length > 0) {
				Output.success(
					`${skippedPackages.length} packages unchanged (cached) - skipping build`,
				);
				skippedPackages.forEach((pkg) => {
					Output.listItem(pkg.name);
				});
				console.log();
			}

			if (packagesToBuild.length === 0) {
				Output.celebrate("All packages are up to date!");
				return;
			}

			Output.log(`Building ${packagesToBuild.length} packages:`, "construction", "blue");
			packagesToBuild.forEach((pkg) => {
				Output.listItem(pkg.name);
			});
			console.log();
		} else {
			// No caching, build all
			packagesToBuild.push(...packagesWithBuild);
		}

		// Build dependency graph for packages that need building
		Output.log("Building dependency graph...", "chart", "blue");
		const dependencyGraph = buildDependencyGraph(packagesToBuild);

		// Filter graph to only include packages that need to be built
		const packageNames = packagesToBuild.map((pkg) => pkg.name);
		const filteredGraph = dependencyGraph.filterGraph(packageNames);

		// Get build batches (topological order)
		let buildBatches;
		try {
			buildBatches = filteredGraph.getBuildBatches();
		} catch (error) {
			Output.error(
				`Dependency cycle detected: ${error instanceof Error ? error.message : String(error)}`,
			);
			Output.tip("Check for circular dependencies between packages.");
			process.exit(1);
		}

		Output.success(`Build order determined: ${buildBatches.length} batches`);

		// Display build plan
		console.log(pc.blue(`\n${Output.getSymbol("books")} Build Plan:`));
		buildBatches.forEach((batch, index) => {
			Output.listItem(`Batch ${index + 1}: ${batch.join(", ")}`);
		});
		console.log();

		const concurrency = parseInt(options.concurrency || "4", 10);

		Output.log(`Package manager: ${workspace.packageManager.name}`, "wrench", "blue");
		Output.log(`Batch concurrency: ${concurrency}`, "lightning", "blue");
		console.log();

		// Prepare commands organized by batches
		const packageMap = new Map(packagesToBuild.map((pkg) => [pkg.name, pkg]));
		const commandBatches = buildBatches.map((batch) => {
			return batch
				.map((packageName) => packageMap.get(packageName))
				.filter((pkg): pkg is NonNullable<typeof pkg> => pkg !== undefined)
				.map((pkg) => {
					const commands = prepareCommandExecution(
						[pkg],
						"build",
						workspace.packageManager,
					);
					return commands[0];
				})
				.filter((cmd): cmd is NonNullable<typeof cmd> => cmd !== undefined);
		});

		// Execute builds in batches
		const startTime = Date.now();
		const allResults = await ProcessRunner.runBatches(commandBatches, concurrency);
		const totalDuration = Date.now() - startTime;

		// Update cache for successful builds
		if (cache && options.skipUnchanged !== false) {
			const successfulBuilds = allResults.filter((r) => r.success);
			const allPackagesMap = new Map(workspace.packages.map((pkg) => [pkg.name, pkg]));

			for (const result of successfulBuilds) {
				const pkg = packageMap.get(result.packageName);
				if (pkg) {
					await cache.update(pkg, allPackagesMap, result.duration);
				}
			}

			// Invalidate dependents of rebuilt packages (conservative approach)
			for (const result of successfulBuilds) {
				cache.invalidateDependents(result.packageName, workspace.packages);
			}

			Output.log(`Updated cache for ${successfulBuilds.length} packages`, "chart", "blue");
		}

		// Print final summary
		const successful = allResults.filter((r) => r.success);
		const failed = allResults.filter((r) => !r.success);
		const totalPackages = successful.length + skippedPackages.length;

		Output.buildSummary(totalPackages, failed.length, totalDuration);

		if (skippedPackages.length > 0) {
			Output.dim(`Skipped (cached): ${skippedPackages.length} packages`, "checkmark");
		}

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
			Output.dim(
				`Average package build time: ${Output.formatDuration(avgDuration)}`,
				"chart",
			);
		}

		// Show dependency chain info
		const rootPackages = filteredGraph.getRootPackages();
		const leafPackages = filteredGraph.getLeafPackages();

		if (rootPackages.length > 0) {
			Output.dim(`Root packages (no dependencies): ${rootPackages.join(", ")}`, "seedling");
		}

		if (leafPackages.length > 0) {
			Output.dim(`Leaf packages (no dependents): ${leafPackages.join(", ")}`, "leaf");
		}

		// Exit with error code if any builds failed
		if (failed.length > 0) {
			Output.log("\nBuild failed due to package failures.", "fire", "red");
			process.exit(1);
		} else {
			Output.celebrate("\nAll packages built successfully!");
		}
	} catch (error) {
		Output.log(
			`Build error: ${error instanceof Error ? error.message : String(error)}`,
			"fire",
			"red",
		);
		process.exit(1);
	}
}
