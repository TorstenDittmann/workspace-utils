import pc from "picocolors";
import { WorkspaceParser } from "../core/workspace.ts";
import {
	buildDependencyGraph,
	validatePackagesHaveScript,
	prepareCommandExecution,
} from "../utils/package-utils.ts";
import { BuildCache } from "../core/cache.ts";
import { Output } from "../utils/output.ts";
import type { PackageInfo } from "../core/workspace.ts";
import {
	resolveTargets,
	parsePositiveInteger,
	parseDuration,
	type CommonCommandOptions,
} from "../utils/command-options.ts";
import { runTopological } from "../core/scheduler.ts";
import { emitEvent, isJsonReporter } from "../core/reporter.ts";

interface BuildCommandOptions extends CommonCommandOptions {
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

		const dependencies = [
			...pkg.dependencies,
			...pkg.devDependencies,
			...(pkg.optionalDependencies || []),
			...(pkg.peerDependencies || []),
		];
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
		if (isJsonReporter())
			emitEvent("workspace", {
				root: workspace.root,
				packageManager: workspace.packageManager.name,
				packageCount: workspace.packages.length,
			});

		Output.dim(`Workspace root: ${workspace.root}`, "folder");
		Output.dim(`Found ${workspace.packages.length} packages\n`, "package");

		// Initialize cache if skipUnchanged is enabled
		let cache: BuildCache | undefined;
		const skippedPackages: PackageInfo[] = [];
		const packagesToBuild: PackageInfo[] = [];

		if (options.skipUnchanged !== false) {
			cache = new BuildCache(workspace.root);
			await cache.initialize(Boolean(options.dryRun));
			Output.log("Build cache enabled - checking for unchanged packages...", "chart", "blue");
		}

		// Filter packages if pattern provided
		let targetPackages = resolveTargets(workspace, options);
		if (isJsonReporter())
			emitEvent("selection", { packages: targetPackages.map((pkg) => pkg.name) });
		if (options.filter?.length || options.affected || options.since) {
			Output.log(`Selected ${targetPackages.length} packages`, "magnifying", "yellow");
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
			for (const pkg of packagesWithBuild) {
				const decision = await cache.getDecision(pkg);
				if (isJsonReporter())
					emitEvent(decision.status === "hit" ? "cache_hit" : "cache_miss", {
						packageName: pkg.name,
						status: decision.status,
					});
				if (decision.status === "non-cacheable")
					Output.warning(
						`${pkg.name} has no inferable package artifacts and will not be cached`,
					);
				else if (decision.status === "corrupt")
					Output.warning(`${pkg.name} has a corrupt artifact entry and will be rebuilt`);
				const restored =
					decision.status === "hit" && !options.dryRun
						? await cache.restore(pkg, decision)
						: decision.status === "hit";
				if (restored && isJsonReporter())
					emitEvent("artifact_restore", {
						packageName: pkg.name,
						inputHash: decision.inputHash,
						dryRun: Boolean(options.dryRun),
					});
				if (restored) {
					skippedPackages.push(pkg);
				} else {
					packagesToBuild.push(pkg);
				}
			}
			// A rebuilt dependency always forces its cached dependents to rebuild.
			const changed = new Set(packagesToBuild.map((pkg) => pkg.name));
			let expanded = true;
			while (expanded) {
				expanded = false;
				for (const pkg of Array.from(skippedPackages)) {
					const deps = [
						...pkg.dependencies,
						...pkg.devDependencies,
						...(pkg.optionalDependencies || []),
						...(pkg.peerDependencies || []),
					];
					if (deps.some((dep) => changed.has(dep))) {
						skippedPackages.splice(skippedPackages.indexOf(pkg), 1);
						packagesToBuild.push(pkg);
						changed.add(pkg.name);
						expanded = true;
					}
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
				if (options.dryRun && isJsonReporter())
					emitEvent("plan", {
						dryRun: true,
						batches: [],
						restores: skippedPackages.map((pkg) => pkg.name),
						concurrency: parsePositiveInteger(options.concurrency, "concurrency", 4),
					});
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

		const concurrency = parsePositiveInteger(options.concurrency, "concurrency", 4);
		const retries = parsePositiveInteger(options.retry, "retry", 0, true);
		const timeoutMs = parseDuration(options.timeout);

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
				.filter((cmd): cmd is NonNullable<typeof cmd> => cmd !== undefined)
				.map((cmd) => ({ ...cmd, options: { ...cmd.options, retries, timeoutMs } }));
		});
		if (options.dryRun) {
			Output.info("Dry run build plan:");
			if (isJsonReporter())
				emitEvent("plan", { dryRun: true, batches: buildBatches, concurrency });
			commandBatches
				.flat()
				.forEach((c) =>
					Output.listItem(`${c.logOptions.prefix}: ${c.command} ${c.args.join(" ")}`),
				);
			return;
		}

		// Execute builds in batches
		const startTime = Date.now();
		const scheduled = await runTopological(
			commandBatches.flat(),
			filteredGraph,
			concurrency,
			options,
		);
		const allResults = scheduled.results;
		scheduled.cancelled.forEach((name) => Output.warning(`Cancelled after failure: ${name}`));
		const totalDuration = Date.now() - startTime;

		// Update cache for successful builds
		if (cache && options.skipUnchanged !== false) {
			const successfulBuilds = allResults.filter((r) => r.success);
			for (const result of successfulBuilds) {
				const pkg = packageMap.get(result.packageName);
				if (pkg) {
					const stored = await cache.storeArtifacts(pkg, result.duration);
					if (stored && isJsonReporter())
						emitEvent("artifact_store", { packageName: pkg.name });
				}
			}

			Output.log(`Updated cache for ${successfulBuilds.length} packages`, "chart", "blue");
		}

		// Print final summary
		const successful = allResults.filter((r) => r.success);
		const failed = allResults.filter((r) => !r.success);
		const totalPackages = successful.length + skippedPackages.length;

		Output.buildSummary(totalPackages, failed.length, totalDuration);
		if (isJsonReporter())
			emitEvent("summary", {
				successful: totalPackages,
				failed: failed.length,
				blocked: scheduled.blocked.length,
				duration: totalDuration,
			});

		if (skippedPackages.length > 0) {
			Output.dim(`Skipped (cached): ${skippedPackages.length} packages`, "checkmark");
		}

		if (failed.length > 0 || scheduled.blocked.length > 0) {
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
		if (failed.length > 0 || scheduled.blocked.length > 0) {
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
