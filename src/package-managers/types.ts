export interface PackageManagerConfig {
	name: string;
	lockFile: string;
	command: string;
	runArgs: string[];
}

export interface WorkspaceConfig {
	packages: string[];
}

export interface PackageManager {
	/**
	 * Name of the package manager
	 */
	readonly name: string;

	/**
	 * Check if this package manager is being used in the current directory
	 */
	isActive(workspaceRoot: string): boolean;

	/**
	 * Get the command and arguments to run a script
	 */
	getRunCommand(scriptName: string): { command: string; args: string[] };

	/**
	 * Parse workspace configuration
	 */
	parseWorkspaceConfig(workspaceRoot: string): WorkspaceConfig;

	/**
	 * Get the lock file name for this package manager
	 */
	getLockFileName(): string;
}

export interface PackageManagerDetectionResult {
	packageManager: PackageManager;
	confidence: number;
}
