import { readFileSync, existsSync } from 'fs';
import { join, resolve, dirname } from 'path';
import fg from 'fast-glob';
import { PackageManagerDetector } from '../package-managers/index.ts';
import type { PackageManager } from '../package-managers/index.ts';

export interface PackageInfo {
	name: string;
	path: string;
	packageJson: Record<string, unknown>;
	dependencies: string[];
	devDependencies: string[];
	scripts: Record<string, string>;
}

export interface WorkspaceInfo {
	root: string;
	packages: PackageInfo[];
	packageMap: Map<string, PackageInfo>;
	packageManager: PackageManager;
}

export class WorkspaceParser {
	private workspaceRoot: string;
	private packageManager: PackageManager;

	constructor(workspaceRoot: string = process.cwd()) {
		this.workspaceRoot = this.findWorkspaceRoot(resolve(workspaceRoot));
		// Detect package manager
		const detection = PackageManagerDetector.detect(this.workspaceRoot);
		this.packageManager = detection.packageManager;
	}

	/**
	 * Parse the workspace and discover all packages
	 */
	async parseWorkspace(): Promise<WorkspaceInfo> {
		const workspaceConfig = this.readWorkspaceConfig();
		const packagePaths = await this.resolvePackagePaths(workspaceConfig.packages || []);
		const packages = await Promise.all(packagePaths.map(path => this.loadPackageInfo(path)));

		const packageMap = new Map<string, PackageInfo>();
		packages.forEach(pkg => {
			packageMap.set(pkg.name, pkg);
		});

		return {
			root: this.workspaceRoot,
			packages,
			packageMap,
			packageManager: this.packageManager,
		};
	}

	/**
	 * Find the workspace root by traversing up directories
	 */
	private findWorkspaceRoot(startDir: string): string {
		let currentDir = startDir;
		while (currentDir !== dirname(currentDir)) {
			const packageJsonPath = join(currentDir, 'package.json');

			if (existsSync(packageJsonPath)) {
				const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as Record<
					string,
					unknown
				>;
				if (packageJson.workspaces) {
					return currentDir;
				}
			}

			// Check for package manager specific workspace files
			const pnpmWorkspace = join(currentDir, 'pnpm-workspace.yaml');
			if (existsSync(pnpmWorkspace)) {
				return currentDir;
			}

			currentDir = dirname(currentDir);
		}

		// If no workspace found, return the original directory
		return startDir;
	}

	/**
	 * Read and parse workspace configuration using the detected package manager
	 */
	private readWorkspaceConfig(): { packages: string[] } {
		try {
			const config = this.packageManager.parseWorkspaceConfig(this.workspaceRoot);
			return config;
		} catch (error) {
			throw new Error(
				`Failed to parse workspace configuration with ${this.packageManager.name}: ${
					error instanceof Error ? error.message : String(error)
				}`
			);
		}
	}

	/**
	 * Resolve package paths from glob patterns
	 */
	private async resolvePackagePaths(patterns: string[]): Promise<string[]> {
		const packagePaths: string[] = [];

		for (const pattern of patterns) {
			// Handle negation patterns
			if (pattern.startsWith('!')) {
				continue; // Skip for now, we'll handle exclusions later
			}

			const paths = await fg(pattern, {
				cwd: this.workspaceRoot,
				onlyDirectories: true,
				absolute: false,
			});

			for (const path of paths) {
				const packageJsonPath = join(this.workspaceRoot, path, 'package.json');
				if (existsSync(packageJsonPath)) {
					packagePaths.push(resolve(this.workspaceRoot, path));
				}
			}
		}

		// Handle exclusion patterns
		const exclusionPatterns = patterns.filter(p => p.startsWith('!'));
		if (exclusionPatterns.length > 0) {
			const excludedPaths = new Set<string>();

			for (const pattern of exclusionPatterns) {
				const cleanPattern = pattern.slice(1); // Remove '!'
				const paths = await fg(cleanPattern, {
					cwd: this.workspaceRoot,
					onlyDirectories: true,
					absolute: false,
				});

				paths.forEach(path => {
					excludedPaths.add(resolve(this.workspaceRoot, path));
				});
			}

			return packagePaths.filter(path => !excludedPaths.has(path));
		}

		return Array.from(new Set(packagePaths)); // Remove duplicates
	}

	/**
	 * Load package.json and extract relevant information
	 */
	private async loadPackageInfo(packagePath: string): Promise<PackageInfo> {
		const packageJsonPath = join(packagePath, 'package.json');

		if (!existsSync(packageJsonPath)) {
			throw new Error(`package.json not found in ${packagePath}`);
		}

		const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as Record<
			string,
			unknown
		>;

		if (!packageJson.name || typeof packageJson.name !== 'string') {
			throw new Error(`Package name not found in ${packageJsonPath}`);
		}

		const dependenciesObj = packageJson.dependencies as Record<string, string> | undefined;
		const devDependenciesObj = packageJson.devDependencies as Record<string, string> | undefined;
		const scriptsObj = packageJson.scripts as Record<string, string> | undefined;

		const dependencies = Object.keys(dependenciesObj || {});
		const devDependencies = Object.keys(devDependenciesObj || {});
		const scripts = scriptsObj || {};

		return {
			name: packageJson.name,
			path: packagePath,
			packageJson,
			dependencies,
			devDependencies,
			scripts,
		};
	}

	/**
	 * Filter packages by pattern (e.g., @scope/*, package-*)
	 */
	filterPackages(packages: PackageInfo[], pattern?: string): PackageInfo[] {
		if (!pattern) {
			return packages;
		}

		// Convert glob pattern to regex
		const regexPattern = pattern
			.replace(/\*/g, '.*')
			.replace(/\?/g, '.')
			.replace(/\[([^\]]+)\]/g, '[$1]');

		const regex = new RegExp(`^${regexPattern}$`);

		return packages.filter(pkg => regex.test(pkg.name));
	}

	/**
	 * Check if a package has a specific script
	 */
	hasScript(packageInfo: PackageInfo, scriptName: string): boolean {
		return scriptName in packageInfo.scripts;
	}

	/**
	 * Get packages that have a specific script
	 */
	getPackagesWithScript(packages: PackageInfo[], scriptName: string): PackageInfo[] {
		return packages.filter(pkg => this.hasScript(pkg, scriptName));
	}

	/**
	 * Get the detected package manager
	 */
	getPackageManager(): PackageManager {
		return this.packageManager;
	}
}
