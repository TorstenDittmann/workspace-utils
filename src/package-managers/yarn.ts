import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { PackageManager, WorkspaceConfig } from "./types.ts";

export class YarnPackageManager implements PackageManager {
	readonly name = "yarn";
	isActive(root: string): boolean {
		if (existsSync(join(root, ".yarnrc.yml"))) return true;
		try {
			const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
			const match =
				typeof pkg.packageManager === "string" && pkg.packageManager.match(/^yarn@(\d+)/);
			return Boolean(match && Number(match[1]) >= 2);
		} catch {
			return false;
		}
	}
	getRunCommand(scriptName: string) {
		return { command: "yarn", args: ["run", scriptName] };
	}
	parseWorkspaceConfig(root: string): WorkspaceConfig {
		const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
		const workspaces = pkg.workspaces;
		if (Array.isArray(workspaces)) return { packages: workspaces };
		if (workspaces && Array.isArray(workspaces.packages))
			return { packages: workspaces.packages };
		throw new Error("No workspaces configuration found in package.json");
	}
	getLockFileName(): string {
		return "yarn.lock";
	}
}
