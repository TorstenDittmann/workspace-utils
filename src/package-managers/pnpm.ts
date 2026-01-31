import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { parse as parseYaml } from "yaml";
import type { PackageManager, WorkspaceConfig } from "./types.ts";

export class PnpmPackageManager implements PackageManager {
	readonly name = "pnpm";

	isActive(workspaceRoot: string): boolean {
		// Check for pnpm-lock.yaml file
		const lockFile = join(workspaceRoot, "pnpm-lock.yaml");
		if (existsSync(lockFile)) {
			return true;
		}

		// Check for pnpm-workspace.yaml
		const workspaceFile = join(workspaceRoot, "pnpm-workspace.yaml");
		if (existsSync(workspaceFile)) {
			return true;
		}

		// Check for .pnpmfile.cjs or pnpm configuration in package.json
		const pnpmFile = join(workspaceRoot, ".pnpmfile.cjs");
		if (existsSync(pnpmFile)) {
			return true;
		}

		const packageJsonPath = join(workspaceRoot, "package.json");
		if (existsSync(packageJsonPath)) {
			try {
				const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as Record<
					string,
					unknown
				>;
				// Check for pnpm-specific fields
				const publishConfig = packageJson.publishConfig as
					| Record<string, unknown>
					| undefined;
				if (packageJson.pnpm || publishConfig?.registry) {
					return true;
				}
			} catch {
				// Ignore JSON parse errors
			}
		}

		return false;
	}

	getRunCommand(scriptName: string): { command: string; args: string[] } {
		return {
			command: "pnpm",
			args: ["run", scriptName],
		};
	}

	parseWorkspaceConfig(workspaceRoot: string): WorkspaceConfig {
		// First try pnpm-workspace.yaml
		const workspaceFile = join(workspaceRoot, "pnpm-workspace.yaml");
		if (existsSync(workspaceFile)) {
			const content = readFileSync(workspaceFile, "utf8");
			const config = parseYaml(content) as { packages?: string[] };

			if (!config.packages || !Array.isArray(config.packages)) {
				throw new Error("Invalid pnpm-workspace.yaml: packages must be an array");
			}

			return { packages: config.packages };
		}

		// Fallback to package.json workspaces
		const packageJsonPath = join(workspaceRoot, "package.json");
		if (!existsSync(packageJsonPath)) {
			throw new Error("No pnpm-workspace.yaml or package.json found in workspace root");
		}

		const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as Record<
			string,
			unknown
		>;

		if (!packageJson.workspaces) {
			throw new Error(
				"No pnpm-workspace.yaml found and no workspaces configuration in package.json",
			);
		}

		const workspaces = packageJson.workspaces as string[] | { packages: string[] };
		const packages = Array.isArray(workspaces) ? workspaces : workspaces.packages;

		if (!Array.isArray(packages)) {
			throw new Error(
				"Invalid workspaces configuration: must be an array or object with packages array",
			);
		}

		return { packages };
	}

	getLockFileName(): string {
		return "pnpm-lock.yaml";
	}
}
