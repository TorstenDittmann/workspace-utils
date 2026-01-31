import { rm } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { WorkspaceParser } from "../core/workspace.ts";
import { Output } from "../utils/output.ts";

interface CleanCommandOptions {
	filter?: string;
}

export async function cleanCommand(options: CleanCommandOptions): Promise<void> {
	try {
		Output.info("Cleaning node_modules across packages...\n");

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

		const startTime = Date.now();
		let cleaned = 0;
		let skipped = 0;

		// Clean root node_modules first (only if no filter)
		if (!options.filter) {
			const rootNodeModules = join(workspace.root, "node_modules");
			if (existsSync(rootNodeModules)) {
				Output.log(`Removing ${rootNodeModules}`, "fire", "yellow");
				await rm(rootNodeModules, { recursive: true, force: true });
				cleaned++;
			}
		}

		// Clean each package's node_modules
		for (const pkg of targetPackages) {
			const nodeModulesPath = join(pkg.path, "node_modules");

			if (existsSync(nodeModulesPath)) {
				Output.log(`Removing ${pkg.name}/node_modules`, "fire", "yellow");
				await rm(nodeModulesPath, { recursive: true, force: true });
				cleaned++;
			} else {
				skipped++;
			}
		}

		const totalDuration = Date.now() - startTime;

		// Print summary
		console.log();
		Output.executionSummary(cleaned, 0, totalDuration);
		Output.dim(`Cleaned: ${cleaned} directories`, "checkmark");
		Output.dim(`Skipped: ${skipped} (no node_modules found)`, "magnifying");
	} catch (error) {
		Output.log(
			`Error: ${error instanceof Error ? error.message : String(error)}`,
			"fire",
			"red",
		);
		process.exit(1);
	}
}
