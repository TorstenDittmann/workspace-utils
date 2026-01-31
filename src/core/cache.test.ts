import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { BuildCache } from "./cache.ts";
import type { PackageInfo } from "./workspace.ts";

describe("BuildCache", () => {
	const testDir = join(process.cwd(), "test-temp-cache");
	let cache: BuildCache;

	beforeEach(async () => {
		// Clean up test directory if it exists
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
		mkdirSync(testDir, { recursive: true });

		// Create .gitignore
		writeFileSync(join(testDir, ".gitignore"), "node_modules/\n", "utf8");

		// Initialize git repo
		const { execSync } = require("child_process");
		execSync("git init", { cwd: testDir, stdio: "ignore" });
		execSync('git config user.email "test@test.com"', { cwd: testDir, stdio: "ignore" });
		execSync('git config user.name "Test"', { cwd: testDir, stdio: "ignore" });

		cache = new BuildCache(testDir);
		await cache.initialize();
	});

	afterEach(() => {
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	describe("initialize", () => {
		it("should create .wsu directory", async () => {
			const wsuDir = join(testDir, ".wsu");
			expect(existsSync(wsuDir)).toBe(true);
		});

		it("should add .wsu/ to .gitignore", async () => {
			const gitignorePath = join(testDir, ".gitignore");
			const content = readFileSync(gitignorePath, "utf8");
			expect(content).toContain(".wsu/");
		});

		it("should not duplicate .wsu/ entry in .gitignore", async () => {
			// Initialize again
			await cache.initialize();

			const gitignorePath = join(testDir, ".gitignore");
			const content = readFileSync(gitignorePath, "utf8");
			const matches = content.match(/\.wsu\//g);
			expect(matches).toHaveLength(1);
		});
	});

	describe("calculatePackageHash", () => {
		it("should calculate different hashes for different package.json", async () => {
			const pkg1: PackageInfo = {
				name: "pkg1",
				path: join(testDir, "pkg1"),
				packageJson: { name: "pkg1", version: "1.0.0" },
				scripts: {},
				dependencies: [],
				devDependencies: [],
			};

			const pkg2: PackageInfo = {
				name: "pkg2",
				path: join(testDir, "pkg2"),
				packageJson: { name: "pkg2", version: "1.0.0" },
				scripts: {},
				dependencies: [],
				devDependencies: [],
			};

			// Create directories with different package.json
			mkdirSync(pkg1.path, { recursive: true });
			writeFileSync(join(pkg1.path, "package.json"), JSON.stringify(pkg1.packageJson));

			mkdirSync(pkg2.path, { recursive: true });
			writeFileSync(join(pkg2.path, "package.json"), JSON.stringify(pkg2.packageJson));

			const packageMap = new Map<string, PackageInfo>();
			const hash1 = await cache.calculatePackageHash(pkg1, packageMap);
			const hash2 = await cache.calculatePackageHash(pkg2, packageMap);

			expect(hash1).not.toBe(hash2);
		});

		it("should respect .gitignore when calculating hash", async () => {
			const pkgPath = join(testDir, "pkg");
			mkdirSync(pkgPath, { recursive: true });
			writeFileSync(
				join(pkgPath, "package.json"),
				JSON.stringify({ name: "pkg", version: "1.0.0" }),
			);

			// Add a file to gitignore
			mkdirSync(join(pkgPath, "dist"), { recursive: true });
			writeFileSync(join(pkgPath, "dist", "output.js"), 'console.log("ignored")');
			writeFileSync(join(pkgPath, ".gitignore"), "dist/\n", "utf8");

			const pkg: PackageInfo = {
				name: "pkg",
				path: pkgPath,
				packageJson: { name: "pkg", version: "1.0.0" },
				scripts: {},
				dependencies: [],
				devDependencies: [],
			};

			const packageMap = new Map<string, PackageInfo>();

			// Calculate hash twice - once with gitignored file, once without
			const hash1 = await cache.calculatePackageHash(pkg, packageMap);

			// Modify the gitignored file
			writeFileSync(join(pkgPath, "dist", "output.js"), 'console.log("modified")');

			const hash2 = await cache.calculatePackageHash(pkg, packageMap);

			// Hashes should be the same (ignored file doesn't affect hash)
			expect(hash1).toBe(hash2);
		});
	});

	describe("isValid", () => {
		it("should return false for uncached package", async () => {
			const pkg: PackageInfo = {
				name: "uncached",
				path: join(testDir, "uncached"),
				packageJson: { name: "uncached", version: "1.0.0" },
				scripts: {},
				dependencies: [],
				devDependencies: [],
			};

			mkdirSync(pkg.path, { recursive: true });
			writeFileSync(join(pkg.path, "package.json"), JSON.stringify(pkg.packageJson));

			const packageMap = new Map<string, PackageInfo>();
			const isValid = await cache.isValid(pkg, packageMap);

			expect(isValid).toBe(false);
		});

		it("should return true for valid cached package", async () => {
			const pkg: PackageInfo = {
				name: "cached",
				path: join(testDir, "cached"),
				packageJson: { name: "cached", version: "1.0.0" },
				scripts: {},
				dependencies: [],
				devDependencies: [],
			};

			mkdirSync(pkg.path, { recursive: true });
			writeFileSync(join(pkg.path, "package.json"), JSON.stringify(pkg.packageJson));

			const packageMap = new Map<string, PackageInfo>();

			// Update cache
			await cache.update(pkg, packageMap, 1000);

			// Should be valid immediately after
			const isValid = await cache.isValid(pkg, packageMap);
			expect(isValid).toBe(true);
		});

		it("should return false when package changes", async () => {
			const pkg: PackageInfo = {
				name: "changed",
				path: join(testDir, "changed"),
				packageJson: { name: "changed", version: "1.0.0" },
				scripts: {},
				dependencies: [],
				devDependencies: [],
			};

			mkdirSync(pkg.path, { recursive: true });
			writeFileSync(join(pkg.path, "package.json"), JSON.stringify(pkg.packageJson));
			writeFileSync(join(pkg.path, "src.ts"), "original");

			const packageMap = new Map<string, PackageInfo>();

			// Update cache
			await cache.update(pkg, packageMap, 1000);

			// Modify a file
			writeFileSync(join(pkg.path, "src.ts"), "modified");

			// Should no longer be valid
			const isValid = await cache.isValid(pkg, packageMap);
			expect(isValid).toBe(false);
		});
	});

	describe("update", () => {
		it("should create cache entry", async () => {
			const pkg: PackageInfo = {
				name: "newpkg",
				path: join(testDir, "newpkg"),
				packageJson: { name: "newpkg", version: "1.0.0" },
				scripts: {},
				dependencies: [],
				devDependencies: [],
			};

			mkdirSync(pkg.path, { recursive: true });
			writeFileSync(join(pkg.path, "package.json"), JSON.stringify(pkg.packageJson));

			const packageMap = new Map<string, PackageInfo>();

			await cache.update(pkg, packageMap, 1500);

			const entry = cache.getEntry("newpkg");
			expect(entry).toBeDefined();
			expect(entry!.buildDuration).toBe(1500);
			expect(entry!.inputHash).toBeDefined();
		});
	});

	describe("invalidatePackage", () => {
		it("should remove package from cache", async () => {
			const pkg: PackageInfo = {
				name: "to-remove",
				path: join(testDir, "to-remove"),
				packageJson: { name: "to-remove", version: "1.0.0" },
				scripts: {},
				dependencies: [],
				devDependencies: [],
			};

			mkdirSync(pkg.path, { recursive: true });
			writeFileSync(join(pkg.path, "package.json"), JSON.stringify(pkg.packageJson));

			const packageMap = new Map<string, PackageInfo>();
			await cache.update(pkg, packageMap, 1000);

			// Should exist
			expect(cache.getEntry("to-remove")).toBeDefined();

			// Invalidate
			cache.invalidatePackage("to-remove");

			// Should be gone
			expect(cache.getEntry("to-remove")).toBeUndefined();
		});
	});

	describe("invalidateDependents", () => {
		it("should invalidate dependents recursively", async () => {
			const lib: PackageInfo = {
				name: "lib",
				path: join(testDir, "lib"),
				packageJson: { name: "lib", version: "1.0.0" },
				scripts: {},
				dependencies: [],
				devDependencies: [],
			};

			const app: PackageInfo = {
				name: "app",
				path: join(testDir, "app"),
				packageJson: { name: "app", version: "1.0.0" },
				scripts: {},
				dependencies: ["lib"],
				devDependencies: [],
			};

			mkdirSync(lib.path, { recursive: true });
			writeFileSync(join(lib.path, "package.json"), JSON.stringify(lib.packageJson));
			mkdirSync(app.path, { recursive: true });
			writeFileSync(join(app.path, "package.json"), JSON.stringify(app.packageJson));

			const packages = [lib, app];
			const packageMap = new Map(packages.map((p) => [p.name, p]));

			// Cache both
			await cache.update(lib, packageMap, 1000);
			await cache.update(app, packageMap, 1000);

			// Both should be cached
			expect(cache.getEntry("lib")).toBeDefined();
			expect(cache.getEntry("app")).toBeDefined();

			// Invalidate lib's dependents
			cache.invalidateDependents("lib", packages);

			// App should be invalidated (depends on lib)
			expect(cache.getEntry("lib")).toBeDefined(); // Lib still cached
			expect(cache.getEntry("app")).toBeUndefined(); // App invalidated
		});
	});

	describe("clear", () => {
		it("should remove all cache entries", async () => {
			const pkg: PackageInfo = {
				name: "pkg",
				path: join(testDir, "pkg"),
				packageJson: { name: "pkg", version: "1.0.0" },
				scripts: {},
				dependencies: [],
				devDependencies: [],
			};

			mkdirSync(pkg.path, { recursive: true });
			writeFileSync(join(pkg.path, "package.json"), JSON.stringify(pkg.packageJson));

			const packageMap = new Map<string, PackageInfo>();
			await cache.update(pkg, packageMap, 1000);

			expect(cache.getStats().totalPackages).toBe(1);

			cache.clear();

			expect(cache.getStats().totalPackages).toBe(0);
		});
	});

	describe("getStats", () => {
		it("should return correct statistics", async () => {
			const pkg: PackageInfo = {
				name: "stats-pkg",
				path: join(testDir, "stats-pkg"),
				packageJson: { name: "stats-pkg", version: "1.0.0" },
				scripts: {},
				dependencies: [],
				devDependencies: [],
			};

			mkdirSync(pkg.path, { recursive: true });
			writeFileSync(join(pkg.path, "package.json"), JSON.stringify(pkg.packageJson));

			const packageMap = new Map<string, PackageInfo>();
			await cache.update(pkg, packageMap, 1000);

			const stats = cache.getStats();
			expect(stats.totalPackages).toBe(1);
			expect(stats.lastUpdated).toBeDefined();
			expect(stats.oldestBuild).toBeDefined();
			expect(stats.newestBuild).toBeDefined();
		});
	});
});

import { readFileSync } from "fs";
