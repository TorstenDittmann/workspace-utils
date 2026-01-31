import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import {
	buildDependencyGraph,
	filterPackagesByScript,
	buildScriptCommand,
	validatePackagesHaveScript,
	prepareCommandExecution,
	formatPackageName,
	groupPackagesByScope,
	calculateExecutionStats,
	isValidPackagePath,
	extractPackageNameFromPath,
} from "./package-utils.ts";
import type { PackageInfo } from "../core/workspace.ts";
import { NpmPackageManager } from "../package-managers/npm.ts";

describe("package-utils", () => {
	describe("buildDependencyGraph", () => {
		it("should build a dependency graph from packages", () => {
			const packages: PackageInfo[] = [
				{
					name: "app",
					path: "/app",
					packageJson: {},
					scripts: {},
					dependencies: ["lib"],
					devDependencies: [],
				},
				{
					name: "lib",
					path: "/lib",
					packageJson: {},
					scripts: {},
					dependencies: [],
					devDependencies: [],
				},
			];

			const graph = buildDependencyGraph(packages);
			expect(graph.getPackages()).toContain("app");
			expect(graph.getPackages()).toContain("lib");
			expect(graph.getDependencies("app")).toContain("lib");
		});

		it("should include devDependencies in graph", () => {
			const packages: PackageInfo[] = [
				{
					name: "app",
					path: "/app",
					packageJson: {},
					scripts: {},
					dependencies: [],
					devDependencies: ["test-utils"],
				},
				{
					name: "test-utils",
					path: "/test-utils",
					packageJson: {},
					scripts: {},
					dependencies: [],
					devDependencies: [],
				},
			];

			const graph = buildDependencyGraph(packages);
			expect(graph.getDependencies("app")).toContain("test-utils");
		});

		it("should ignore external dependencies not in workspace", () => {
			const packages: PackageInfo[] = [
				{
					name: "app",
					path: "/app",
					packageJson: {},
					scripts: {},
					dependencies: ["external-lib"],
					devDependencies: [],
				},
			];

			const graph = buildDependencyGraph(packages);
			expect(graph.getPackages()).toEqual(["app"]);
			expect(graph.getDependencies("app")).toEqual([]);
		});
	});

	describe("filterPackagesByScript", () => {
		it("should filter packages by script availability", () => {
			const packages: PackageInfo[] = [
				{
					name: "pkg1",
					path: "/pkg1",
					packageJson: {},
					scripts: { test: "jest" },
					dependencies: [],
					devDependencies: [],
				},
				{
					name: "pkg2",
					path: "/pkg2",
					packageJson: {},
					scripts: { build: "tsc" },
					dependencies: [],
					devDependencies: [],
				},
			];

			const filtered = filterPackagesByScript(packages, "test");
			expect(filtered).toHaveLength(1);
			expect(filtered[0]!.name).toBe("pkg1");
		});

		it("should return empty array when no packages have script", () => {
			const packages: PackageInfo[] = [
				{
					name: "pkg1",
					path: "/pkg1",
					packageJson: {},
					scripts: {},
					dependencies: [],
					devDependencies: [],
				},
			];

			const filtered = filterPackagesByScript(packages, "test");
			expect(filtered).toHaveLength(0);
		});
	});

	describe("buildScriptCommand", () => {
		it("should build script command for npm package manager", () => {
			const npmManager = new NpmPackageManager();
			const command = buildScriptCommand("test", npmManager);
			expect(command).toEqual({
				command: "npm",
				args: ["run", "test"],
			});
		});
	});

	describe("validatePackagesHaveScript", () => {
		it("should separate valid and invalid packages", () => {
			const packages: PackageInfo[] = [
				{
					name: "pkg1",
					path: "/pkg1",
					packageJson: {},
					scripts: { test: "jest" },
					dependencies: [],
					devDependencies: [],
				},
				{
					name: "pkg2",
					path: "/pkg2",
					packageJson: {},
					scripts: {},
					dependencies: [],
					devDependencies: [],
				},
			];

			const result = validatePackagesHaveScript(packages, "test");
			expect(result.valid).toHaveLength(1);
			expect(result.valid[0]!.name).toBe("pkg1");
			expect(result.invalid).toHaveLength(1);
			expect(result.invalid[0]!.name).toBe("pkg2");
		});

		it("should handle packages with no scripts field", () => {
			const packages: PackageInfo[] = [
				{
					name: "pkg1",
					path: "/pkg1",
					packageJson: {},
					scripts: undefined as unknown as Record<string, string>,
					dependencies: [],
					devDependencies: [],
				},
			];

			const result = validatePackagesHaveScript(packages, "test");
			expect(result.valid).toHaveLength(0);
			expect(result.invalid).toHaveLength(1);
		});

		it("should handle empty packages array", () => {
			const result = validatePackagesHaveScript([], "test");
			expect(result.valid).toHaveLength(0);
			expect(result.invalid).toHaveLength(0);
		});
	});

	describe("prepareCommandExecution", () => {
		const testDir = join(process.cwd(), "test-temp-utils");
		let npmManager: NpmPackageManager;

		beforeEach(() => {
			if (existsSync(testDir)) {
				rmSync(testDir, { recursive: true, force: true });
			}
			mkdirSync(testDir, { recursive: true });
			npmManager = new NpmPackageManager();
		});

		afterEach(() => {
			if (existsSync(testDir)) {
				rmSync(testDir, { recursive: true, force: true });
			}
		});

		it("should prepare commands for execution", () => {
			const pkgPath = join(testDir, "pkg1");
			mkdirSync(pkgPath, { recursive: true });
			writeFileSync(
				join(pkgPath, "package.json"),
				JSON.stringify({ name: "pkg1", version: "1.0.0" }),
			);

			const packages: PackageInfo[] = [
				{
					name: "pkg1",
					path: pkgPath,
					packageJson: { name: "pkg1", version: "1.0.0" },
					scripts: { test: "jest" },
					dependencies: [],
					devDependencies: [],
				},
			];

			const commands = prepareCommandExecution(packages, "test", npmManager);
			expect(commands).toHaveLength(1);
			expect(commands[0]!.command).toBe("npm");
			expect(commands[0]!.args).toEqual(["run", "test"]);
			expect(commands[0]!.options.cwd).toBe(pkgPath);
			expect(commands[0]!.logOptions.prefix).toBe("pkg1");
		});

		it("should throw error for invalid package path", () => {
			const packages: PackageInfo[] = [
				{
					name: "pkg1",
					path: "/nonexistent/path",
					packageJson: {},
					scripts: { test: "jest" },
					dependencies: [],
					devDependencies: [],
				},
			];

			expect(() => prepareCommandExecution(packages, "test", npmManager)).toThrow(
				"Invalid package path: /nonexistent/path",
			);
		});
	});

	describe("formatPackageName", () => {
		it("should format short package name", () => {
			expect(formatPackageName("test")).toBe("test                ");
		});

		it("should truncate long package name", () => {
			const longName = "very-long-package-name-that-exceeds-limit";
			expect(formatPackageName(longName, 20)).toBe("very-long-package...");
		});

		it("should use custom max length", () => {
			expect(formatPackageName("test", 10)).toBe("test      ");
		});
	});

	describe("groupPackagesByScope", () => {
		it("should group scoped packages", () => {
			const packages: PackageInfo[] = [
				{
					name: "@scope/pkg1",
					path: "/scope/pkg1",
					packageJson: {},
					scripts: {},
					dependencies: [],
					devDependencies: [],
				},
				{
					name: "@scope/pkg2",
					path: "/scope/pkg2",
					packageJson: {},
					scripts: {},
					dependencies: [],
					devDependencies: [],
				},
				{
					name: "unscoped-pkg",
					path: "/unscoped-pkg",
					packageJson: {},
					scripts: {},
					dependencies: [],
					devDependencies: [],
				},
			];

			const groups = groupPackagesByScope(packages);
			expect(groups.get("@scope")).toHaveLength(2);
			expect(groups.get("unscoped")).toHaveLength(1);
		});

		it("should handle all unscoped packages", () => {
			const packages: PackageInfo[] = [
				{
					name: "pkg1",
					path: "/pkg1",
					packageJson: {},
					scripts: {},
					dependencies: [],
					devDependencies: [],
				},
			];

			const groups = groupPackagesByScope(packages);
			expect(groups.get("unscoped")).toHaveLength(1);
		});
	});

	describe("calculateExecutionStats", () => {
		it("should calculate execution statistics", () => {
			const results = [
				{ success: true, exitCode: 0, packageName: "pkg1", command: "test", duration: 100 },
				{ success: true, exitCode: 0, packageName: "pkg2", command: "test", duration: 200 },
				{ success: false, exitCode: 1, packageName: "pkg3", command: "test", duration: 50 },
			];

			const stats = calculateExecutionStats(results);
			expect(stats.totalPackages).toBe(3);
			expect(stats.successfulPackages).toBe(2);
			expect(stats.failedPackages).toBe(1);
			expect(stats.totalDuration).toBe(350);
			expect(stats.averageDuration).toBe(117);
			expect(stats.longestDuration).toBe(200);
			expect(stats.shortestDuration).toBe(50);
		});

		it("should handle empty results", () => {
			const stats = calculateExecutionStats([]);
			expect(stats.totalPackages).toBe(0);
			expect(stats.successfulPackages).toBe(0);
			expect(stats.failedPackages).toBe(0);
			expect(stats.totalDuration).toBe(0);
			expect(stats.averageDuration).toBe(0);
			expect(stats.longestDuration).toBe(0);
			expect(stats.shortestDuration).toBe(0);
		});

		it("should handle all successful results", () => {
			const results = [
				{ success: true, exitCode: 0, packageName: "pkg1", command: "test", duration: 100 },
			];

			const stats = calculateExecutionStats(results);
			expect(stats.failedPackages).toBe(0);
		});
	});

	describe("isValidPackagePath", () => {
		const testDir = join(process.cwd(), "test-temp-valid");

		beforeEach(() => {
			if (existsSync(testDir)) {
				rmSync(testDir, { recursive: true, force: true });
			}
			mkdirSync(testDir, { recursive: true });
		});

		afterEach(() => {
			if (existsSync(testDir)) {
				rmSync(testDir, { recursive: true, force: true });
			}
		});

		it("should return true for valid package path", () => {
			const pkgPath = join(testDir, "valid-pkg");
			mkdirSync(pkgPath, { recursive: true });
			writeFileSync(
				join(pkgPath, "package.json"),
				JSON.stringify({ name: "valid-pkg", version: "1.0.0" }),
			);

			expect(isValidPackagePath(pkgPath)).toBe(true);
		});

		it("should return false for non-existent path", () => {
			expect(isValidPackagePath("/nonexistent/path")).toBe(false);
		});

		it("should return false for path without package.json", () => {
			const pkgPath = join(testDir, "no-package");
			mkdirSync(pkgPath, { recursive: true });
			expect(isValidPackagePath(pkgPath)).toBe(false);
		});

		it("should return false for invalid package.json", () => {
			const pkgPath = join(testDir, "invalid-pkg");
			mkdirSync(pkgPath, { recursive: true });
			writeFileSync(join(pkgPath, "package.json"), "invalid json");
			expect(isValidPackagePath(pkgPath)).toBe(false);
		});

		it("should return false for package.json without name", () => {
			const pkgPath = join(testDir, "no-name-pkg");
			mkdirSync(pkgPath, { recursive: true });
			writeFileSync(join(pkgPath, "package.json"), JSON.stringify({ version: "1.0.0" }));
			expect(isValidPackagePath(pkgPath)).toBe(false);
		});
	});

	describe("extractPackageNameFromPath", () => {
		it("should extract package name from path", () => {
			expect(extractPackageNameFromPath("/path/to/my-pkg")).toBe("my-pkg");
		});

		it("should handle path without separators", () => {
			expect(extractPackageNameFromPath("my-pkg")).toBe("my-pkg");
		});

		it("should handle empty path", () => {
			expect(extractPackageNameFromPath("")).toBe("");
		});
	});
});
