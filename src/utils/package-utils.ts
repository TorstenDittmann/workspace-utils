import type { PackageInfo, WorkspaceInfo } from "../core/workspace.ts";
import { DependencyGraph } from "../core/dependency-graph.ts";
import type { ProcessResult } from "../core/process-runner.ts";
import type { PackageManager } from "../package-managers/index.ts";

export interface BuildContext {
	workspace: WorkspaceInfo;
	packages: PackageInfo[];
	dependencyGraph: DependencyGraph;
}

/**
 * Build a dependency graph from workspace packages
 */
export function buildDependencyGraph(packages: PackageInfo[]): DependencyGraph {
	const graph = new DependencyGraph();
	const packageNames = new Set(packages.map((pkg) => pkg.name));

	// Add all packages to the graph
	packages.forEach((pkg) => {
		graph.addPackage(pkg.name);
	});

	// Add dependency relationships
	packages.forEach((pkg) => {
		// Check both dependencies and devDependencies
		const allDeps = [...pkg.dependencies, ...pkg.devDependencies];

		allDeps.forEach((depName) => {
			// Only add dependency if it's also a workspace package
			if (packageNames.has(depName)) {
				graph.addDependency(pkg.name, depName);
			}
		});
	});

	return graph;
}

/**
 * Filter packages by script availability
 */
export function filterPackagesByScript(packages: PackageInfo[], scriptName: string): PackageInfo[] {
	return packages.filter((pkg) => pkg.scripts[scriptName]);
}

/**
 * Build command arguments for running a script with the specified package manager
 */
export function buildScriptCommand(
	scriptName: string,
	packageManager: PackageManager,
): { command: string; args: string[] } {
	return packageManager.getRunCommand(scriptName);
}

/**
 * Validate that packages have the required script
 */
export function validatePackagesHaveScript(
	packages: PackageInfo[],
	scriptName: string,
): {
	valid: PackageInfo[];
	invalid: PackageInfo[];
} {
	const valid: PackageInfo[] = [];
	const invalid: PackageInfo[] = [];

	packages.forEach((pkg) => {
		if (pkg.scripts && typeof pkg.scripts === "object" && pkg.scripts[scriptName]) {
			valid.push(pkg);
		} else {
			invalid.push(pkg);
		}
	});

	return { valid, invalid };
}

/**
 * Prepare command execution data for process runner
 */
export function prepareCommandExecution(
	packages: PackageInfo[],
	scriptName: string,
	packageManager: PackageManager,
) {
	const { command, args } = buildScriptCommand(scriptName, packageManager);

	return packages.map((pkg) => {
		if (!isValidPackagePath(pkg.path)) {
			throw new Error(`Invalid package path: ${pkg.path}`);
		}

		return {
			command,
			args,
			options: {
				cwd: pkg.path,
				env: {
					// Ensure consistent environment
					FORCE_COLOR: "1",
					NODE_ENV: process.env.NODE_ENV || "development",
				},
			},
			logOptions: {
				prefix: pkg.name,
				color: getPackageColor(pkg.name),
			},
			packageInfo: pkg,
		};
	});
}

/**
 * Simple color assignment for packages
 */
const colorPalette = [
	"red",
	"green",
	"yellow",
	"blue",
	"magenta",
	"cyan",
	"gray",
	"redBright",
	"greenBright",
	"yellowBright",
	"blueBright",
	"magentaBright",
	"cyanBright",
];

const packageColors = new Map<string, string>();
let colorIndex = 0;

function getPackageColor(packageName: string): string {
	if (!packageColors.has(packageName)) {
		const color = colorPalette[colorIndex % colorPalette.length];
		if (color) {
			packageColors.set(packageName, color);
		}
		colorIndex++;
	}
	return packageColors.get(packageName) || "white";
}

/**
 * Format package names for display
 */
export function formatPackageName(packageName: string, maxLength = 20): string {
	if (packageName.length <= maxLength) {
		return packageName.padEnd(maxLength);
	}

	// Truncate and add ellipsis
	return packageName.substring(0, maxLength - 3) + "...";
}

/**
 * Group packages by their scope (for @scope/package naming)
 */
export function groupPackagesByScope(packages: PackageInfo[]): Map<string, PackageInfo[]> {
	const groups = new Map<string, PackageInfo[]>();

	packages.forEach((pkg) => {
		const scope = pkg.name.startsWith("@") ? pkg.name.split("/")[0] || "unscoped" : "unscoped";

		if (!groups.has(scope)) {
			groups.set(scope, []);
		}
		const group = groups.get(scope);
		if (group) {
			group.push(pkg);
		}
	});

	return groups;
}

/**
 * Calculate execution statistics
 */
export interface ExecutionStats {
	totalPackages: number;
	successfulPackages: number;
	failedPackages: number;
	totalDuration: number;
	averageDuration: number;
	longestDuration: number;
	shortestDuration: number;
}

export function calculateExecutionStats(results: ProcessResult[]): ExecutionStats {
	const successful = results.filter((r) => r.success);
	const failed = results.filter((r) => !r.success);
	const durations = results.map((r) => r.duration);
	const totalDuration = durations.reduce((sum, d) => sum + d, 0);
	const avgDuration = durations.length > 0 ? Math.round(totalDuration / durations.length) : 0;
	const maxDuration = durations.length > 0 ? Math.max(...durations) : 0;
	const minDuration = durations.length > 0 ? Math.min(...durations) : 0;

	return {
		totalPackages: results.length,
		successfulPackages: successful.length,
		failedPackages: failed.length,
		totalDuration,
		averageDuration: avgDuration,
		longestDuration: maxDuration,
		shortestDuration: minDuration,
	};
}

/**
 * Check if a package path exists and is valid
 */
export function isValidPackagePath(packagePath: string): boolean {
	const fs = require("fs");
	const path = require("path");

	try {
		const packageJsonPath = path.join(packagePath, "package.json");
		if (!fs.existsSync(packageJsonPath)) {
			return false;
		}

		// Try to parse the package.json to ensure it's valid
		const content = fs.readFileSync(packageJsonPath, "utf8");
		const pkg = JSON.parse(content);
		return typeof pkg === "object" && pkg !== null && typeof pkg.name === "string";
	} catch {
		return false;
	}
}

/**
 * Extract package name from path (for display purposes)
 */
export function extractPackageNameFromPath(packagePath: string): string {
	const parts = packagePath.split("/");
	return parts[parts.length - 1] || "";
}
