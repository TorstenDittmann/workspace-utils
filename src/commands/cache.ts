import pc from "picocolors";
import { WorkspaceParser } from "../core/workspace.ts";
import { BuildCache } from "../core/cache.ts";
import { Output } from "../utils/output.ts";

interface CacheCommandOptions {
	command?: string;
}

export async function cacheCommand(options: CacheCommandOptions): Promise<void> {
	try {
		// Parse workspace to find root
		const parser = new WorkspaceParser();
		const workspace = await parser.parseWorkspace();

		const cache = new BuildCache(workspace.root);
		await cache.initialize();

		const subcommand = options.command || "status";

		switch (subcommand) {
			case "clear":
				await clearCache(cache);
				break;
			case "status":
				await showCacheStatus(cache, workspace.packages);
				break;
			default:
				Output.error(`Unknown cache command: ${subcommand}`);
				Output.tip("Available commands: clear, status");
				process.exit(1);
		}
	} catch (error) {
		Output.log(
			`Cache command error: ${error instanceof Error ? error.message : String(error)}`,
			"fire",
			"red",
		);
		process.exit(1);
	}
}

async function clearCache(cache: BuildCache): Promise<void> {
	const stats = cache.getStats();

	if (stats.totalPackages === 0) {
		Output.info("Cache is already empty.");
		return;
	}

	Output.log(`Clearing build cache (${stats.totalPackages} packages)...`, "fire", "yellow");
	cache.clear();
	Output.success("Build cache cleared successfully!");
}

async function showCacheStatus(cache: BuildCache, packages: { name: string }[]): Promise<void> {
	const stats = cache.getStats();

	Output.info("Build Cache Status\n");

	Output.dim(`Workspace root: ${cache["workspaceRoot"]}`, "folder");
	Output.dim(`Total packages in workspace: ${packages.length}`, "package");
	console.log();

	if (stats.totalPackages === 0) {
		Output.warning("No cached builds found.");
		Output.tip("Run `wsu build --skip-unchanged` to populate the cache.");
		return;
	}

	Output.success(`Cached packages: ${stats.totalPackages}`);
	Output.dim(`Cache last updated: ${new Date(stats.lastUpdated).toLocaleString()}`, "clock");

	if (stats.oldestBuild && stats.newestBuild) {
		Output.dim(
			`Build date range: ${new Date(stats.oldestBuild).toLocaleDateString()} - ${new Date(stats.newestBuild).toLocaleDateString()}`,
			"clock",
		);
	}

	console.log();
	Output.dim(`Cache location: .wsu/packages/<package>/`, "folder");

	// Show which packages are cached
	console.log(pc.bold("\nCached packages:"));
	packages.forEach((pkg) => {
		const entry = cache.getEntry(pkg.name);
		if (entry) {
			console.log(
				`  ${pc.green("✓")} ${pc.cyan(pkg.name)} - ${Output.formatDuration(entry.buildDuration)}`,
			);
		} else {
			console.log(`  ${pc.gray("○")} ${pc.gray(pkg.name)} - not cached`);
		}
	});
}
