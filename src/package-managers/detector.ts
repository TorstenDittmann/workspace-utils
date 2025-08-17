import { existsSync } from 'fs';
import { join } from 'path';
import type { PackageManager, PackageManagerDetectionResult } from './types.ts';
import { BunPackageManager } from './bun.ts';
import { PnpmPackageManager } from './pnpm.ts';
import { NpmPackageManager } from './npm.ts';

export class PackageManagerDetector {
	private static readonly packageManagers = [
		new BunPackageManager(),
		new PnpmPackageManager(),
		new NpmPackageManager(),
	];

	/**
	 * Detect the package manager being used in the workspace
	 */
	static detect(workspaceRoot: string): PackageManagerDetectionResult {
		const results: PackageManagerDetectionResult[] = [];

		for (const pm of this.packageManagers) {
			if (pm.isActive(workspaceRoot)) {
				const confidence = this.calculateConfidence(pm, workspaceRoot);
				results.push({ packageManager: pm, confidence });
			}
		}

		// Sort by confidence and return the highest
		results.sort((a, b) => b.confidence - a.confidence);

		const [result] = results;
		if (!result) {
			throw new Error(
				'No package manager detected. Please ensure you have a lock file (bun.lockb, pnpm-lock.yaml, or package-lock.json) or workspace configuration in your project.'
			);
		}

		return result;
	}

	/**
	 * Get a specific package manager by name
	 */
	static getPackageManager(name: string): PackageManager {
		const pm = this.packageManagers.find(pm => pm.name === name);
		if (!pm) {
			throw new Error(`Unknown package manager: ${name}`);
		}
		return pm;
	}

	/**
	 * Get all supported package managers
	 */
	static getSupportedPackageManagers(): PackageManager[] {
		return [...this.packageManagers];
	}

	/**
	 * Calculate confidence score for a package manager
	 */
	private static calculateConfidence(pm: PackageManager, workspaceRoot: string): number {
		let confidence = 0;

		// Check for lock file (highest confidence)
		const lockFile = join(workspaceRoot, pm.getLockFileName());
		if (existsSync(lockFile)) {
			confidence += 100;
		}

		// Check for package manager specific files
		switch (pm.name) {
			case 'bun':
				// Check for both bun.lock (text) and bun.lockb (binary) formats
				if (existsSync(join(workspaceRoot, 'bun.lock'))) confidence += 100;
				if (existsSync(join(workspaceRoot, 'bun.lockb'))) confidence += 100;
				if (existsSync(join(workspaceRoot, 'bunfig.toml'))) confidence += 50;
				break;
			case 'pnpm':
				if (existsSync(join(workspaceRoot, 'pnpm-workspace.yaml'))) confidence += 80;
				if (existsSync(join(workspaceRoot, '.pnpmfile.cjs'))) confidence += 30;
				break;
			case 'npm':
				if (existsSync(join(workspaceRoot, '.npmrc'))) confidence += 30;
				break;
		}

		// Check for workspace configuration
		try {
			pm.parseWorkspaceConfig(workspaceRoot);
			confidence += 20;
		} catch {
			// Workspace config not found or invalid
		}

		return confidence;
	}

	/**
	 * Check if a specific package manager is available in the system
	 */
	static async isPackageManagerAvailable(name: string): Promise<boolean> {
		try {
			const { spawn } = await import('child_process');
			return new Promise(resolve => {
				const child = spawn(name, ['--version'], { stdio: 'ignore' });
				child.on('close', code => resolve(code === 0));
				child.on('error', () => resolve(false));
			});
		} catch {
			return false;
		}
	}
}
