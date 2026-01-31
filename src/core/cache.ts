import { createHash } from 'crypto';
import {
	readFileSync,
	writeFileSync,
	existsSync,
	mkdirSync,
	appendFileSync,
	statSync,
	rmSync,
} from 'fs';
import { join, relative, dirname } from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';
import fg from 'fast-glob';
import type { PackageInfo } from './workspace.ts';
import { Output } from '../utils/output.ts';

const execAsync = promisify(exec);

const CACHE_VERSION = 2; // Bumped for new structure
const CACHE_DIR_NAME = '.wsu';
const PACKAGES_DIR = 'packages';
const CACHE_FILE = 'cache.json';
const FILES_FILE = 'files.json';
const MANIFEST_FILE = 'manifest.json';

// Per-package file metadata
interface FileMetadata {
	mtime: number;
	size: number;
	hash: string;
}

interface PackageFileIndex {
	version: number;
	files: Record<string, FileMetadata>; // relative path -> metadata
}

export interface CacheEntry {
	inputHash: string;
	dependencyHashes: Record<string, string | undefined>;
	lastBuild: string;
	buildDuration: number;
	builtBy: string;
}

// Manifest tracks all cached packages (for quick lookups)
interface CacheManifest {
	version: number;
	packages: string[]; // list of package names with cache
}

export class BuildCache {
	private workspaceRoot: string;
	private baseCacheDir: string;
	private manifestPath: string;
	private manifest: CacheManifest;
	private packageCaches: Map<string, CacheEntry>;
	private packageFileIndexes: Map<string, PackageFileIndex>;
	private initialized: boolean = false;

	constructor(workspaceRoot: string) {
		this.workspaceRoot = workspaceRoot;
		this.baseCacheDir = join(workspaceRoot, CACHE_DIR_NAME);
		this.manifestPath = join(this.baseCacheDir, MANIFEST_FILE);
		this.manifest = {
			version: CACHE_VERSION,
			packages: [],
		};
		this.packageCaches = new Map();
		this.packageFileIndexes = new Map();
	}

	/**
	 * Initialize cache - create directory structure and ensure .gitignore
	 */
	async initialize(): Promise<void> {
		if (this.initialized) return;

		// Create .wsu directory
		if (!existsSync(this.baseCacheDir)) {
			mkdirSync(this.baseCacheDir, { recursive: true });
			Output.dim(`Created ${CACHE_DIR_NAME}/ directory`, 'folder');
		}

		// Ensure .wsu is in .gitignore
		await this.ensureGitignore();

		// Load manifest
		this.loadManifest();

		this.initialized = true;
	}

	/**
	 * Get cache directory for a specific package
	 */
	private getPackageCacheDir(packageName: string): string {
		return join(this.baseCacheDir, PACKAGES_DIR, packageName);
	}

	/**
	 * Get cache file path for a specific package
	 */
	private getPackageCachePath(packageName: string): string {
		return join(this.getPackageCacheDir(packageName), CACHE_FILE);
	}

	/**
	 * Get files index path for a specific package
	 */
	private getPackageFilesPath(packageName: string): string {
		return join(this.getPackageCacheDir(packageName), FILES_FILE);
	}

	/**
	 * Add .wsu/ to .gitignore if not already present
	 */
	private async ensureGitignore(): Promise<void> {
		const gitignorePath = join(this.workspaceRoot, '.gitignore');

		if (!existsSync(gitignorePath)) {
			writeFileSync(gitignorePath, `# Workspace utils cache\n${CACHE_DIR_NAME}/\n`, 'utf8');
			Output.dim(`Created .gitignore with ${CACHE_DIR_NAME}/ entry`, 'checkmark');
			return;
		}

		const content = readFileSync(gitignorePath, 'utf8');
		const lines = content.split('\n');

		const isIgnored = lines.some(
			line =>
				line.trim() === `${CACHE_DIR_NAME}/` ||
				line.trim() === CACHE_DIR_NAME ||
				line.trim().startsWith(`${CACHE_DIR_NAME}/`)
		);

		if (!isIgnored) {
			const newEntry = `\n# Workspace utils cache\n${CACHE_DIR_NAME}/\n`;
			appendFileSync(gitignorePath, newEntry, 'utf8');
			Output.dim(`Added ${CACHE_DIR_NAME}/ to .gitignore`, 'checkmark');
		}
	}

	/**
	 * Load manifest from disk
	 */
	private loadManifest(): void {
		if (!existsSync(this.manifestPath)) return;

		try {
			const content = readFileSync(this.manifestPath, 'utf8');
			const data = JSON.parse(content) as CacheManifest;

			if (data.version === CACHE_VERSION) {
				this.manifest = data;
				// Pre-load all package caches
				for (const pkgName of data.packages) {
					this.loadPackageCache(pkgName);
					this.loadPackageFileIndex(pkgName);
				}
			}
		} catch {
			// Invalid manifest, reset
			this.manifest = { version: CACHE_VERSION, packages: [] };
		}
	}

	/**
	 * Save manifest to disk
	 */
	private saveManifest(): void {
		writeFileSync(this.manifestPath, JSON.stringify(this.manifest, null, 2), 'utf8');
	}

	/**
	 * Load cache for a specific package
	 */
	private loadPackageCache(packageName: string): CacheEntry | undefined {
		const cachePath = this.getPackageCachePath(packageName);
		if (!existsSync(cachePath)) return undefined;

		try {
			const content = readFileSync(cachePath, 'utf8');
			const entry = JSON.parse(content) as CacheEntry;
			this.packageCaches.set(packageName, entry);
			return entry;
		} catch {
			return undefined;
		}
	}

	/**
	 * Save cache for a specific package
	 */
	private savePackageCache(packageName: string, entry: CacheEntry): void {
		const cacheDir = this.getPackageCacheDir(packageName);
		if (!existsSync(cacheDir)) {
			mkdirSync(cacheDir, { recursive: true });
		}

		const cachePath = this.getPackageCachePath(packageName);
		writeFileSync(cachePath, JSON.stringify(entry, null, 2), 'utf8');
		this.packageCaches.set(packageName, entry);

		// Update manifest
		if (!this.manifest.packages.includes(packageName)) {
			this.manifest.packages.push(packageName);
			this.saveManifest();
		}
	}

	/**
	 * Load file index for a specific package
	 */
	private loadPackageFileIndex(packageName: string): PackageFileIndex {
		const filesPath = this.getPackageFilesPath(packageName);

		if (existsSync(filesPath)) {
			try {
				const content = readFileSync(filesPath, 'utf8');
				const index = JSON.parse(content) as PackageFileIndex;
				if (index.version === CACHE_VERSION) {
					this.packageFileIndexes.set(packageName, index);
					return index;
				}
			} catch {
				// Invalid file index
			}
		}

		// Create new file index
		const newIndex: PackageFileIndex = {
			version: CACHE_VERSION,
			files: {},
		};
		this.packageFileIndexes.set(packageName, newIndex);
		return newIndex;
	}

	/**
	 * Save file index for a specific package
	 */
	private savePackageFileIndex(packageName: string): void {
		const index = this.packageFileIndexes.get(packageName);
		if (!index) return;

		const cacheDir = this.getPackageCacheDir(packageName);
		if (!existsSync(cacheDir)) {
			mkdirSync(cacheDir, { recursive: true });
		}

		const filesPath = this.getPackageFilesPath(packageName);
		writeFileSync(filesPath, JSON.stringify(index, null, 2), 'utf8');
	}

	/**
	 * Calculate SHA256 hash
	 */
	private hashString(input: string): string {
		return createHash('sha256').update(input).digest('hex');
	}

	/**
	 * Hash a file with caching (uses mtime/size for speed)
	 */
	private hashFile(filePath: string, fileIndex: PackageFileIndex, relativePath: string): string {
		try {
			const stats = statSync(filePath);
			const cached = fileIndex.files[relativePath];

			// Check if file is unchanged
			if (cached && cached.mtime === stats.mtimeMs && cached.size === stats.size) {
				return cached.hash;
			}

			// Compute new hash
			const content = readFileSync(filePath);
			const hash = createHash('sha256').update(content).digest('hex');

			// Update index
			fileIndex.files[relativePath] = {
				mtime: stats.mtimeMs,
				size: stats.size,
				hash,
			};

			return hash;
		} catch {
			return '';
		}
	}

	/**
	 * Filter gitignored files in batches
	 */
	private async filterGitIgnored(files: string[], packagePath: string): Promise<string[]> {
		const nonIgnored: string[] = [];
		const batchSize = 50;

		for (let i = 0; i < files.length; i += batchSize) {
			const batch = files.slice(i, i + batchSize);
			const relativePaths = batch.map(f => relative(this.workspaceRoot, f));

			try {
				const { stdout } = await execAsync(
					`git check-ignore ${relativePaths.map(p => `"${p}"`).join(' ')}`,
					{ cwd: this.workspaceRoot }
				);

				const ignoredSet = new Set(stdout.trim().split('\n').filter(Boolean));

				for (let j = 0; j < batch.length; j++) {
					const relativePath = relativePaths[j];
					const fullPath = batch[j];
					if (relativePath && fullPath && !ignoredSet.has(relativePath)) {
						nonIgnored.push(fullPath);
					}
				}
			} catch {
				nonIgnored.push(...batch.filter((f): f is string => f !== undefined));
			}
		}

		return nonIgnored;
	}

	/**
	 * Get source files for a package
	 */
	private async getSourceFiles(
		packagePath: string,
		packageName: string
	): Promise<{ path: string; relative: string }[]> {
		const allFiles = await fg(['**/*'], {
			cwd: packagePath,
			absolute: true,
			onlyFiles: true,
			ignore: ['node_modules/**', '.git/**', CACHE_DIR_NAME + '/**'],
		});

		const nonIgnored = await this.filterGitIgnored(allFiles, packagePath);

		return nonIgnored.map(f => ({
			path: f,
			relative: relative(packagePath, f),
		}));
	}

	/**
	 * Calculate hash for a package
	 */
	async calculatePackageHash(
		pkg: PackageInfo,
		packageMap: Map<string, PackageInfo>
	): Promise<string> {
		const fileIndex = this.loadPackageFileIndex(pkg.name);

		// Hash package.json
		const packageJsonPath = join(pkg.path, 'package.json');
		const packageJsonHash = this.hashFile(packageJsonPath, fileIndex, 'package.json');

		// Hash source files
		const sourceFiles = await this.getSourceFiles(pkg.path, pkg.name);
		const fileHashes: string[] = [];

		for (const { path, relative: relPath } of sourceFiles) {
			const hash = this.hashFile(path, fileIndex, relPath);
			if (hash) {
				fileHashes.push(`${relPath}:${hash}`);
			}
		}

		// Sort for consistent ordering
		fileHashes.sort();

		// Get dependency hashes
		const depHashes: string[] = [];
		for (const depName of [...pkg.dependencies, ...pkg.devDependencies]) {
			const depEntry = this.packageCaches.get(depName);
			if (depEntry) {
				depHashes.push(`${depName}:${depEntry.inputHash}`);
			} else {
				depHashes.push(`${depName}:MISSING`);
			}
		}

		// Combine all hashes
		const combined = [
			`packageJson:${packageJsonHash}`,
			`sources:${fileHashes.join(',')}`,
			`deps:${depHashes.sort().join(',')}`,
		].join('\n');

		return this.hashString(combined);
	}

	/**
	 * Check if a package is valid (cached and unchanged)
	 */
	async isValid(pkg: PackageInfo, packageMap: Map<string, PackageInfo>): Promise<boolean> {
		const entry = this.packageCaches.get(pkg.name);
		if (!entry) {
			return false;
		}

		const currentHash = await this.calculatePackageHash(pkg, packageMap);
		return entry.inputHash === currentHash;
	}

	/**
	 * Update cache for a package
	 */
	async update(
		pkg: PackageInfo,
		packageMap: Map<string, PackageInfo>,
		buildDuration: number
	): Promise<void> {
		const inputHash = await this.calculatePackageHash(pkg, packageMap);

		// Collect dependency hashes
		const dependencyHashes: Record<string, string | undefined> = {};
		for (const depName of [...pkg.dependencies, ...pkg.devDependencies]) {
			const depEntry = this.packageCaches.get(depName);
			dependencyHashes[depName] = depEntry?.inputHash;
		}

		const entry: CacheEntry = {
			inputHash,
			dependencyHashes,
			lastBuild: new Date().toISOString(),
			buildDuration,
			builtBy: 'wsu',
		};

		// Save package cache
		this.savePackageCache(pkg.name, entry);

		// Save file index
		this.savePackageFileIndex(pkg.name);
	}

	/**
	 * Invalidate a specific package
	 */
	invalidatePackage(packageName: string): void {
		this.packageCaches.delete(packageName);

		const cachePath = this.getPackageCachePath(packageName);
		if (existsSync(cachePath)) {
			rmSync(cachePath, { force: true });
		}

		// Update manifest
		const idx = this.manifest.packages.indexOf(packageName);
		if (idx > -1) {
			this.manifest.packages.splice(idx, 1);
			this.saveManifest();
		}
	}

	/**
	 * Invalidate a package and its dependents (conservative)
	 */
	invalidateDependents(packageName: string, packages: PackageInfo[]): void {
		const dependents = packages.filter(
			p => p.dependencies.includes(packageName) || p.devDependencies.includes(packageName)
		);

		for (const dependent of dependents) {
			if (this.packageCaches.has(dependent.name)) {
				this.invalidatePackage(dependent.name);
				// Recursively invalidate their dependents
				this.invalidateDependents(dependent.name, packages);
			}
		}
	}

	/**
	 * Clear all cache
	 */
	clear(): void {
		this.packageCaches.clear();
		this.packageFileIndexes.clear();
		this.manifest.packages = [];
		this.saveManifest();

		// Remove all package cache directories
		const packagesDir = join(this.baseCacheDir, PACKAGES_DIR);
		if (existsSync(packagesDir)) {
			rmSync(packagesDir, { recursive: true, force: true });
		}
	}

	/**
	 * Get cache statistics
	 */
	getStats(): {
		totalPackages: number;
		lastUpdated: string;
		oldestBuild: string | null;
		newestBuild: string | null;
	} {
		const entries = Array.from(this.packageCaches.values());
		const timestamps = entries.map(e => new Date(e.lastBuild).getTime()).sort();

		return {
			totalPackages: entries.length,
			lastUpdated: new Date().toISOString(),
			oldestBuild: timestamps.length > 0 ? new Date(timestamps[0]!).toISOString() : null,
			newestBuild:
				timestamps.length > 0 ? new Date(timestamps[timestamps.length - 1]!).toISOString() : null,
		};
	}

	/**
	 * Get a specific cache entry
	 */
	getEntry(packageName: string): CacheEntry | undefined {
		return this.packageCaches.get(packageName);
	}

	/**
	 * Get all cached package names
	 */
	getCachedPackages(): string[] {
		return [...this.manifest.packages];
	}
}
