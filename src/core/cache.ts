import { createHash } from "crypto";
import {
	readFileSync,
	writeFileSync,
	existsSync,
	mkdirSync,
	appendFileSync,
	statSync,
	rmSync,
	cpSync,
	renameSync,
	lstatSync,
	chmodSync,
} from "fs";
import { join, relative, resolve, dirname, isAbsolute, normalize } from "path";
import { promisify } from "util";
import { execFile } from "child_process";
import fg from "fast-glob";
import type { PackageInfo } from "./workspace.ts";
import { Output } from "../utils/output.ts";
import { PackageManagerDetector } from "../package-managers/detector.ts";

const execFileAsync = promisify(execFile);

const CACHE_VERSION = 3;
const CACHE_DIR_NAME = ".wsu";
const PACKAGES_DIR = "packages";
const CACHE_FILE = "cache.json";
const FILES_FILE = "files.json";
const MANIFEST_FILE = "manifest.json";
const ARTIFACTS_DIR = "artifacts";

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
	artifactHash?: string;
	artifactFiles?: ArtifactFile[];
}

export interface ArtifactDeclaration {
	pattern: string;
	kind: "file" | "glob";
	exclude?: boolean;
}
export interface ArtifactFile {
	path: string;
	hash: string;
	mode: number;
}
export interface ArtifactManifest {
	version: number;
	packageName: string;
	taskName: string;
	inputHash: string;
	artifactHash: string;
	files: ArtifactFile[];
	createdAt: string;
	buildDuration: number;
}
export interface ArtifactCacheEntry extends CacheEntry {
	artifactHash: string;
	artifactFiles: ArtifactFile[];
}
export interface CacheDecision {
	status: "hit" | "miss" | "non-cacheable" | "corrupt";
	inputHash: string;
	declarations: ArtifactDeclaration[];
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
	async initialize(readOnly = false): Promise<void> {
		if (this.initialized) return;

		// Create .wsu directory
		if (!readOnly && !existsSync(this.baseCacheDir)) {
			mkdirSync(this.baseCacheDir, { recursive: true });
			Output.dim(`Created ${CACHE_DIR_NAME}/ directory`, "folder");
		}

		// Ensure .wsu is in .gitignore
		if (!readOnly) await this.ensureGitignore();

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

	private safePackageKey(packageName: string): string {
		return Buffer.from(packageName).toString("base64url");
	}

	private getArtifactDir(packageName: string, inputHash: string): string {
		return join(this.baseCacheDir, ARTIFACTS_DIR, this.safePackageKey(packageName), inputHash);
	}

	inferArtifactDeclarations(pkg: PackageInfo): ArtifactDeclaration[] {
		const values: string[] = [];
		const json = pkg.packageJson;
		if (Array.isArray(json.files))
			values.push(...json.files.filter((v): v is string => typeof v === "string"));
		for (const key of ["main", "module", "types", "typings"] as const)
			if (typeof json[key] === "string") values.push(json[key] as string);
		if (typeof json.bin === "string") values.push(json.bin);
		else if (json.bin && typeof json.bin === "object")
			values.push(
				...Object.values(json.bin as Record<string, unknown>).filter(
					(v): v is string => typeof v === "string",
				),
			);
		const visit = (value: unknown): void => {
			if (typeof value === "string") values.push(value);
			else if (value && typeof value === "object")
				Object.values(value as Record<string, unknown>).forEach(visit);
		};
		visit(json.exports);
		const declarations = new Map<string, ArtifactDeclaration>();
		for (let value of values) {
			const exclude = value.startsWith("!");
			if (exclude) value = value.slice(1);
			if (/^[a-z]+:/i.test(value) || value.startsWith("#")) continue;
			value = value.replace(/^\.\//, "").replace(/\\/g, "/");
			if (
				!value ||
				isAbsolute(value) ||
				normalize(value).startsWith("..") ||
				/(^|\/)(node_modules|\.git|\.wsu)(\/|$)/.test(value)
			)
				throw new Error(`Unsafe artifact path in ${pkg.name}: ${value}`);
			declarations.set(`${exclude ? "!" : ""}${value}`, {
				pattern: value,
				kind: fg.isDynamicPattern(value) ? "glob" : "file",
				exclude,
			});
		}
		return [...declarations.values()];
	}

	private async artifactFiles(
		pkg: PackageInfo,
		declarations: ArtifactDeclaration[],
	): Promise<string[]> {
		const patterns = declarations.map((d) => {
			const path = join(pkg.path, d.pattern);
			const pattern =
				d.kind === "file" && existsSync(path) && statSync(path).isDirectory()
					? `${d.pattern.replace(/\/$/, "")}/**/*`
					: d.pattern;
			return d.exclude ? `!${pattern}` : pattern;
		});
		if (!patterns.length) return [];
		return (
			await fg(patterns, {
				cwd: pkg.path,
				onlyFiles: true,
				dot: true,
				followSymbolicLinks: false,
			})
		).sort();
	}

	async getDecision(pkg: PackageInfo): Promise<CacheDecision> {
		const declarations = this.inferArtifactDeclarations(pkg);
		const inputHash = await this.calculatePackageHash(pkg, declarations);
		if (!declarations.some((declaration) => !declaration.exclude))
			return { status: "non-cacheable", inputHash, declarations };
		const entry = this.packageCaches.get(pkg.name);
		if (!entry || entry.inputHash !== inputHash || !entry.artifactFiles?.length)
			return { status: "miss", inputHash, declarations };
		const dir = this.getArtifactDir(pkg.name, inputHash);
		for (const file of entry.artifactFiles)
			if (!existsSync(join(dir, "files", file.path)))
				return { status: "corrupt", inputHash, declarations };
		return { status: "hit", inputHash, declarations };
	}

	async restore(pkg: PackageInfo, decision?: CacheDecision): Promise<boolean> {
		const resolved = decision || (await this.getDecision(pkg));
		if (resolved.status !== "hit") return false;
		const entry = this.packageCaches.get(pkg.name)!;
		for (const declaration of resolved.declarations) {
			if (declaration.exclude) continue;
			if (declaration.kind === "file")
				rmSync(join(pkg.path, declaration.pattern), { recursive: true, force: true });
			else
				for (const match of await fg(declaration.pattern, {
					cwd: pkg.path,
					onlyFiles: false,
					dot: true,
				}))
					rmSync(join(pkg.path, match), { recursive: true, force: true });
		}
		const source = join(this.getArtifactDir(pkg.name, resolved.inputHash), "files");
		for (const file of entry.artifactFiles || []) {
			const target = resolve(pkg.path, file.path);
			if (!target.startsWith(resolve(pkg.path) + "/")) return false;
			mkdirSync(dirname(target), { recursive: true });
			cpSync(join(source, file.path), target, { dereference: false });
			chmodSync(target, file.mode);
			if (
				this.hashFile(target, { version: CACHE_VERSION, files: {} }, file.path) !==
				file.hash
			)
				return false;
		}
		return true;
	}

	async storeArtifacts(pkg: PackageInfo, buildDuration: number): Promise<boolean> {
		const declarations = this.inferArtifactDeclarations(pkg);
		if (!declarations.some((declaration) => !declaration.exclude)) return false;
		const files = await this.artifactFiles(pkg, declarations);
		if (!files.length) return false;
		const inputHash = await this.calculatePackageHash(pkg, declarations);
		const finalDir = this.getArtifactDir(pkg.name, inputHash);
		const tempDir = `${finalDir}.tmp-${process.pid}-${Date.now()}`;
		mkdirSync(join(tempDir, "files"), { recursive: true });
		const artifactFiles: ArtifactFile[] = [];
		for (const file of files) {
			const source = join(pkg.path, file);
			const target = join(tempDir, "files", file);
			mkdirSync(dirname(target), { recursive: true });
			cpSync(source, target, { dereference: false });
			const stats = lstatSync(source);
			artifactFiles.push({
				path: file,
				hash: this.hashFile(source, { version: CACHE_VERSION, files: {} }, file),
				mode: stats.mode,
			});
		}
		const artifactHash = this.hashString(
			artifactFiles.map((f) => `${f.path}:${f.hash}:${f.mode}`).join("\n"),
		);
		mkdirSync(dirname(finalDir), { recursive: true });
		rmSync(finalDir, { recursive: true, force: true });
		renameSync(tempDir, finalDir);
		const dependencyHashes: Record<string, string | undefined> = {};
		for (const depName of this.packageDependencies(pkg))
			dependencyHashes[depName] = this.packageCaches.get(depName)?.inputHash;
		this.savePackageCache(pkg.name, {
			inputHash,
			dependencyHashes,
			lastBuild: new Date().toISOString(),
			buildDuration,
			builtBy: "wsu",
			artifactHash,
			artifactFiles,
		});
		return true;
	}

	private packageDependencies(pkg: PackageInfo): string[] {
		return [
			...new Set([
				...pkg.dependencies,
				...pkg.devDependencies,
				...(pkg.optionalDependencies || []),
				...(pkg.peerDependencies || []),
			]),
		];
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
		const gitignorePath = join(this.workspaceRoot, ".gitignore");

		if (!existsSync(gitignorePath)) {
			writeFileSync(gitignorePath, `# Workspace utils cache\n${CACHE_DIR_NAME}/\n`, "utf8");
			Output.dim(`Created .gitignore with ${CACHE_DIR_NAME}/ entry`, "checkmark");
			return;
		}

		const content = readFileSync(gitignorePath, "utf8");
		const lines = content.split("\n");

		const isIgnored = lines.some(
			(line) =>
				line.trim() === `${CACHE_DIR_NAME}/` ||
				line.trim() === CACHE_DIR_NAME ||
				line.trim().startsWith(`${CACHE_DIR_NAME}/`),
		);

		if (!isIgnored) {
			const newEntry = `\n# Workspace utils cache\n${CACHE_DIR_NAME}/\n`;
			appendFileSync(gitignorePath, newEntry, "utf8");
			Output.dim(`Added ${CACHE_DIR_NAME}/ to .gitignore`, "checkmark");
		}
	}

	/**
	 * Load manifest from disk
	 */
	private loadManifest(): void {
		if (!existsSync(this.manifestPath)) return;

		try {
			const content = readFileSync(this.manifestPath, "utf8");
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
		const temporary = `${this.manifestPath}.tmp-${process.pid}`;
		writeFileSync(temporary, JSON.stringify(this.manifest, null, 2), "utf8");
		renameSync(temporary, this.manifestPath);
	}

	/**
	 * Load cache for a specific package
	 */
	private loadPackageCache(packageName: string): CacheEntry | undefined {
		const cachePath = this.getPackageCachePath(packageName);
		if (!existsSync(cachePath)) return undefined;

		try {
			const content = readFileSync(cachePath, "utf8");
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
		const temporary = `${cachePath}.tmp-${process.pid}`;
		writeFileSync(temporary, JSON.stringify(entry, null, 2), "utf8");
		renameSync(temporary, cachePath);
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
				const content = readFileSync(filesPath, "utf8");
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
		writeFileSync(filesPath, JSON.stringify(index, null, 2), "utf8");
	}

	/**
	 * Calculate SHA256 hash
	 */
	private hashString(input: string): string {
		return createHash("sha256").update(input).digest("hex");
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
			const hash = createHash("sha256").update(content).digest("hex");

			// Update index
			fileIndex.files[relativePath] = {
				mtime: stats.mtimeMs,
				size: stats.size,
				hash,
			};

			return hash;
		} catch {
			return "";
		}
	}

	/**
	 * Filter gitignored files in batches
	 */
	private async filterGitIgnored(files: string[]): Promise<string[]> {
		const nonIgnored: string[] = [];
		const batchSize = 50;

		for (let i = 0; i < files.length; i += batchSize) {
			const batch = files.slice(i, i + batchSize);
			const relativePaths = batch.map((f) => relative(this.workspaceRoot, f));

			try {
				const { stdout } = await execFileAsync(
					"git",
					["check-ignore", "--", ...relativePaths],
					{ cwd: this.workspaceRoot },
				);

				const ignoredSet = new Set(stdout.trim().split("\n").filter(Boolean));

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
	): Promise<{ path: string; relative: string }[]> {
		const allFiles = await fg(["**/*"], {
			cwd: packagePath,
			absolute: true,
			onlyFiles: true,
			ignore: ["node_modules/**", ".git/**", CACHE_DIR_NAME + "/**"],
		});

		const nonIgnored = await this.filterGitIgnored(allFiles);

		return nonIgnored.map((f) => ({
			path: f,
			relative: relative(packagePath, f),
		}));
	}

	/**
	 * Calculate hash for a package
	 */
	async calculatePackageHash(
		pkg: PackageInfo,
		declarations = this.inferArtifactDeclarations(pkg),
	): Promise<string> {
		const fileIndex = this.loadPackageFileIndex(pkg.name);

		// Hash package.json
		const packageJsonPath = join(pkg.path, "package.json");
		const packageJsonHash = this.hashFile(packageJsonPath, fileIndex, "package.json");

		// Hash source files
		const sourceFiles = (await this.getSourceFiles(pkg.path)).filter(
			(file) =>
				!declarations.some((d) =>
					d.exclude
						? false
						: d.kind === "glob"
							? fg.isDynamicPattern(d.pattern) &&
								fg
									.sync(d.pattern, { cwd: pkg.path, onlyFiles: true })
									.includes(file.relative)
							: file.relative === d.pattern ||
								file.relative.startsWith(`${d.pattern}/`),
				),
		);
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
		for (const depName of this.packageDependencies(pkg)) {
			const depEntry = this.packageCaches.get(depName);
			if (depEntry) {
				depHashes.push(`${depName}:${depEntry.inputHash}`);
			} else {
				depHashes.push(`${depName}:MISSING`);
			}
		}

		// Combine all hashes
		const globalPatterns = [
			"package.json",
			"bun.lock",
			"bun.lockb",
			"pnpm-lock.yaml",
			"pnpm-workspace.yaml",
			"package-lock.json",
			"yarn.lock",
			".yarnrc.yml",
			".npmrc",
			"bunfig.toml",
			"tsconfig*.json",
			"*.config.*",
		];
		const globalHashes: string[] = [];
		for (const file of await fg(globalPatterns, { cwd: this.workspaceRoot, onlyFiles: true }))
			globalHashes.push(
				`${file}:${this.hashFile(join(this.workspaceRoot, file), fileIndex, `../${file}`)}`,
			);
		let packageManager = "unknown";
		try {
			const detected = PackageManagerDetector.detect(this.workspaceRoot).packageManager;
			let version = "unknown";
			try {
				version = (
					await execFileAsync(detected.name, ["--version"], { cwd: this.workspaceRoot })
				).stdout.trim();
			} catch {}
			packageManager = `${detected.name}@${version}`;
		} catch {}
		const combined = [
			`version:${CACHE_VERSION}`,
			`packageJson:${packageJsonHash}`,
			`sources:${fileHashes.join(",")}`,
			`deps:${depHashes.sort().join(",")}`,
			`global:${globalHashes.sort().join(",")}`,
			`environment:${process.env.NODE_ENV || "development"}`,
			`runtime:${process.versions.bun ? `bun@${process.versions.bun}` : `node@${process.version}`}`,
			`packageManager:${packageManager}`,
			`script:${pkg.scripts.build || ""}`,
		].join("\n");

		return this.hashString(combined);
	}

	/**
	 * Check if a package is valid (cached and unchanged)
	 */
	async isValid(pkg: PackageInfo): Promise<boolean> {
		const entry = this.packageCaches.get(pkg.name);
		if (!entry) {
			return false;
		}

		const currentHash = await this.calculatePackageHash(pkg);
		return entry.inputHash === currentHash;
	}

	/**
	 * Update cache for a package
	 */
	async update(
		pkg: PackageInfo,
		packageMap: Map<string, PackageInfo>,
		buildDuration: number,
	): Promise<void> {
		const inputHash = await this.calculatePackageHash(pkg);

		// Collect dependency hashes
		const dependencyHashes: Record<string, string | undefined> = {};
		for (const depName of this.packageDependencies(pkg)) {
			const depEntry = this.packageCaches.get(depName);
			dependencyHashes[depName] = depEntry?.inputHash;
		}

		const entry: CacheEntry = {
			inputHash,
			dependencyHashes,
			lastBuild: new Date().toISOString(),
			buildDuration,
			builtBy: "wsu",
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
		const dependents = packages.filter((p) =>
			this.packageDependencies(p).includes(packageName),
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
		const artifactsDir = join(this.baseCacheDir, ARTIFACTS_DIR);
		if (existsSync(artifactsDir)) rmSync(artifactsDir, { recursive: true, force: true });
	}

	/**
	 * Get cache statistics
	 */
	getStats(): {
		totalPackages: number;
		lastUpdated: string;
		oldestBuild: string | null;
		newestBuild: string | null;
		artifactCount: number;
		artifactSize: number;
		metadataOnly: number;
		corrupt: number;
	} {
		const entries = Array.from(this.packageCaches.values());
		const timestamps = entries.map((e) => new Date(e.lastBuild).getTime()).sort();

		let artifactSize = 0;
		let corrupt = 0;
		for (const [name, entry] of this.packageCaches)
			for (const file of entry.artifactFiles || []) {
				const path = join(this.getArtifactDir(name, entry.inputHash), "files", file.path);
				if (existsSync(path)) artifactSize += statSync(path).size;
				else corrupt++;
			}
		return {
			totalPackages: entries.length,
			lastUpdated: new Date().toISOString(),
			oldestBuild: timestamps.length > 0 ? new Date(timestamps[0]!).toISOString() : null,
			newestBuild:
				timestamps.length > 0
					? new Date(timestamps[timestamps.length - 1]!).toISOString()
					: null,
			artifactCount: entries.filter((e) => e.artifactFiles?.length).length,
			artifactSize,
			metadataOnly: entries.filter((e) => !e.artifactFiles?.length).length,
			corrupt,
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
