import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { PackageManager, WorkspaceConfig } from './types.ts';

export class NpmPackageManager implements PackageManager {
	readonly name = 'npm';

	isActive(workspaceRoot: string): boolean {
		// Check for package-lock.json file
		const lockFile = join(workspaceRoot, 'package-lock.json');
		if (existsSync(lockFile)) {
			return true;
		}

		// Check for .npmrc file
		const npmrcFile = join(workspaceRoot, '.npmrc');
		if (existsSync(npmrcFile)) {
			return true;
		}

		// Check if package.json has npm-specific fields or workspaces
		const packageJsonPath = join(workspaceRoot, 'package.json');
		if (existsSync(packageJsonPath)) {
			try {
				const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as Record<
					string,
					unknown
				>;
				// Check for npm-specific fields or workspaces
				if (packageJson.workspaces || packageJson.publishConfig) {
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
			command: 'npm',
			args: ['run', scriptName],
		};
	}

	parseWorkspaceConfig(workspaceRoot: string): WorkspaceConfig {
		const packageJsonPath = join(workspaceRoot, 'package.json');

		if (!existsSync(packageJsonPath)) {
			throw new Error('No package.json found in workspace root');
		}

		const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as Record<
			string,
			unknown
		>;

		if (!packageJson.workspaces) {
			throw new Error('No workspaces configuration found in package.json');
		}

		const workspaces = packageJson.workspaces as string[] | { packages: string[] };
		const packages = Array.isArray(workspaces) ? workspaces : workspaces.packages;

		if (!Array.isArray(packages)) {
			throw new Error(
				'Invalid workspaces configuration: must be an array or object with packages array'
			);
		}

		return { packages };
	}

	getLockFileName(): string {
		return 'package-lock.json';
	}
}
