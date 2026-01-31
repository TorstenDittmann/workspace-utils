import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { WorkspaceParser } from "./workspace.ts";

describe("WorkspaceParser", () => {
	const testDir = join(process.cwd(), "test-temp-workspace");

	beforeEach(() => {
		// Clean up test directory if it exists
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
		mkdirSync(testDir, { recursive: true });
	});

	afterEach(() => {
		// Clean up test directory
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	describe("parseWorkspace", () => {
		it("should parse Bun workspace with package.json workspaces", async () => {
			// Create workspace root
			writeFileSync(join(testDir, "bun.lockb"), "");
			writeFileSync(
				join(testDir, "package.json"),
				JSON.stringify({
					name: "test-workspace",
					workspaces: ["packages/*"],
				}),
			);

			// Create a package
			mkdirSync(join(testDir, "packages", "test-pkg"), { recursive: true });
			writeFileSync(
				join(testDir, "packages", "test-pkg", "package.json"),
				JSON.stringify({
					name: "@test/pkg",
					version: "1.0.0",
					scripts: {
						build: "echo building",
						test: "echo testing",
					},
					dependencies: {},
				}),
			);

			const parser = new WorkspaceParser(testDir);
			const workspace = await parser.parseWorkspace();

			expect(workspace.root).toBe(testDir);
			expect(workspace.packages).toHaveLength(1);
			expect(workspace.packages[0]?.name).toBe("@test/pkg");
			expect(workspace.packages[0]?.scripts).toEqual({
				build: "echo building",
				test: "echo testing",
			});
			expect(workspace.packageManager.name).toBe("bun");
		});

		it("should parse pnpm workspace with pnpm-workspace.yaml", async () => {
			// Create workspace root
			writeFileSync(join(testDir, "pnpm-lock.yaml"), "lockfileVersion: 6.0");
			writeFileSync(
				join(testDir, "pnpm-workspace.yaml"),
				"packages:\n  - packages/*\n  - apps/*",
			);

			// Create packages
			mkdirSync(join(testDir, "packages", "utils"), { recursive: true });
			writeFileSync(
				join(testDir, "packages", "utils", "package.json"),
				JSON.stringify({
					name: "@test/utils",
					version: "1.0.0",
					scripts: {
						build: "tsc",
					},
				}),
			);

			mkdirSync(join(testDir, "apps", "web"), { recursive: true });
			writeFileSync(
				join(testDir, "apps", "web", "package.json"),
				JSON.stringify({
					name: "@test/web",
					version: "1.0.0",
					dependencies: {
						"@test/utils": "workspace:*",
					},
					scripts: {
						dev: "vite",
						build: "vite build",
					},
				}),
			);

			const parser = new WorkspaceParser(testDir);
			const workspace = await parser.parseWorkspace();

			expect(workspace.root).toBe(testDir);
			expect(workspace.packages).toHaveLength(2);
			expect(workspace.packageManager.name).toBe("pnpm");

			const utilsPkg = workspace.packages.find((p) => p.name === "@test/utils");
			const webPkg = workspace.packages.find((p) => p.name === "@test/web");

			expect(utilsPkg).toBeDefined();
			expect(webPkg).toBeDefined();
			expect(webPkg?.dependencies).toContain("@test/utils");
		});

		it("should parse npm workspace with package.json workspaces", async () => {
			// Create workspace root
			writeFileSync(join(testDir, "package-lock.json"), "{}");
			writeFileSync(
				join(testDir, "package.json"),
				JSON.stringify({
					name: "test-workspace",
					workspaces: ["libs/*"],
				}),
			);

			// Create a package
			mkdirSync(join(testDir, "libs", "shared"), { recursive: true });
			writeFileSync(
				join(testDir, "libs", "shared", "package.json"),
				JSON.stringify({
					name: "shared",
					version: "1.0.0",
					scripts: {
						test: "jest",
					},
				}),
			);

			const parser = new WorkspaceParser(testDir);
			const workspace = await parser.parseWorkspace();

			expect(workspace.root).toBe(testDir);
			expect(workspace.packages).toHaveLength(1);
			expect(workspace.packages[0]?.name).toBe("shared");
			expect(workspace.packageManager.name).toBe("npm");
		});

		it("should handle packages with dependencies and devDependencies", async () => {
			writeFileSync(join(testDir, "bun.lockb"), "");
			writeFileSync(
				join(testDir, "package.json"),
				JSON.stringify({
					name: "test-workspace",
					workspaces: ["packages/*"],
				}),
			);

			mkdirSync(join(testDir, "packages", "core"), { recursive: true });
			writeFileSync(
				join(testDir, "packages", "core", "package.json"),
				JSON.stringify({
					name: "@test/core",
					version: "1.0.0",
					dependencies: {
						lodash: "^4.0.0",
						"@test/utils": "workspace:*",
					},
					devDependencies: {
						typescript: "^5.0.0",
						"@types/lodash": "^4.0.0",
					},
					scripts: {
						build: "tsc",
						test: "vitest",
					},
				}),
			);

			mkdirSync(join(testDir, "packages", "utils"), { recursive: true });
			writeFileSync(
				join(testDir, "packages", "utils", "package.json"),
				JSON.stringify({
					name: "@test/utils",
					version: "1.0.0",
					scripts: {
						build: "tsc",
					},
				}),
			);

			const parser = new WorkspaceParser(testDir);
			const workspace = await parser.parseWorkspace();

			const corePkg = workspace.packages.find((p) => p.name === "@test/core");
			expect(corePkg).toBeDefined();
			expect(corePkg!.dependencies).toContain("@test/utils");
			expect(corePkg!.dependencies).toContain("lodash");
			expect(corePkg!.devDependencies).toContain("typescript");
			expect(corePkg!.devDependencies).toContain("@types/lodash");
		});
	});

	describe("findWorkspaceRoot", () => {
		it("should find workspace root when running from subdirectory", async () => {
			// Create nested directory structure
			writeFileSync(join(testDir, "bun.lockb"), "");
			writeFileSync(
				join(testDir, "package.json"),
				JSON.stringify({
					name: "test-workspace",
					workspaces: ["packages/*"],
				}),
			);

			mkdirSync(join(testDir, "packages", "deep", "nested"), { recursive: true });
			writeFileSync(
				join(testDir, "packages", "deep", "package.json"),
				JSON.stringify({
					name: "@test/deep",
					version: "1.0.0",
				}),
			);

			// Start parser from nested directory
			const nestedDir = join(testDir, "packages", "deep", "nested");
			const parser = new WorkspaceParser(nestedDir);
			const workspace = await parser.parseWorkspace();

			expect(workspace.root).toBe(testDir);
		});

		it("should find pnpm workspace root from subdirectory", async () => {
			writeFileSync(join(testDir, "pnpm-workspace.yaml"), "packages:\n  - packages/*");
			mkdirSync(join(testDir, "packages", "sub"), { recursive: true });

			const parser = new WorkspaceParser(join(testDir, "packages", "sub"));
			const workspace = await parser.parseWorkspace();

			expect(workspace.root).toBe(testDir);
		});
	});

	describe("filterPackages", () => {
		let parser: WorkspaceParser;
		let workspace: any;

		beforeEach(async () => {
			writeFileSync(join(testDir, "bun.lockb"), "");
			writeFileSync(
				join(testDir, "package.json"),
				JSON.stringify({
					name: "test-workspace",
					workspaces: ["packages/*", "apps/*"],
				}),
			);

			// Create multiple packages
			const packages = [
				{ dir: "packages/utils", name: "@scope/utils" },
				{ dir: "packages/core", name: "@scope/core" },
				{ dir: "apps/web", name: "@scope/web-app" },
				{ dir: "apps/mobile", name: "@scope/mobile-app" },
			];

			for (const pkg of packages) {
				mkdirSync(join(testDir, pkg.dir), { recursive: true });
				writeFileSync(
					join(testDir, pkg.dir, "package.json"),
					JSON.stringify({
						name: pkg.name,
						version: "1.0.0",
						scripts: { build: "echo building" },
					}),
				);
			}

			parser = new WorkspaceParser(testDir);
			workspace = await parser.parseWorkspace();
		});

		it("should filter packages by scope pattern", () => {
			const filtered = parser.filterPackages(workspace.packages, "@scope/*");
			expect(filtered).toHaveLength(4);
		});

		it("should filter packages by specific pattern", () => {
			const filtered = parser.filterPackages(workspace.packages, "*utils*");
			expect(filtered).toHaveLength(1);
			expect(filtered[0]?.name).toBe("@scope/utils");
		});

		it("should filter packages by app pattern", () => {
			const filtered = parser.filterPackages(workspace.packages, "*app*");
			expect(filtered).toHaveLength(2);
		});

		it("should return all packages when no pattern provided", () => {
			const filtered = parser.filterPackages(workspace.packages);
			expect(filtered).toHaveLength(4);
		});

		it("should return empty array for non-matching pattern", () => {
			const filtered = parser.filterPackages(workspace.packages, "nonexistent");
			expect(filtered).toHaveLength(0);
		});
	});

	describe("getPackagesWithScript", () => {
		let parser: WorkspaceParser;
		let workspace: any;

		beforeEach(async () => {
			writeFileSync(join(testDir, "bun.lockb"), "");
			writeFileSync(
				join(testDir, "package.json"),
				JSON.stringify({
					name: "test-workspace",
					workspaces: ["packages/*"],
				}),
			);

			// Create packages with different scripts
			mkdirSync(join(testDir, "packages", "with-test"), { recursive: true });
			writeFileSync(
				join(testDir, "packages", "with-test", "package.json"),
				JSON.stringify({
					name: "with-test",
					scripts: { test: "vitest", build: "tsc" },
				}),
			);

			mkdirSync(join(testDir, "packages", "without-test"), { recursive: true });
			writeFileSync(
				join(testDir, "packages", "without-test", "package.json"),
				JSON.stringify({
					name: "without-test",
					scripts: { build: "tsc" },
				}),
			);

			parser = new WorkspaceParser(testDir);
			workspace = await parser.parseWorkspace();
		});

		it("should return packages with specific script", () => {
			const withTest = parser.getPackagesWithScript(workspace.packages, "test");
			expect(withTest).toHaveLength(1);
			expect(withTest[0]?.name).toBe("with-test");
		});

		it("should return packages with build script", () => {
			const withBuild = parser.getPackagesWithScript(workspace.packages, "build");
			expect(withBuild).toHaveLength(2);
		});

		it("should return empty array for non-existent script", () => {
			const withLint = parser.getPackagesWithScript(workspace.packages, "lint");
			expect(withLint).toHaveLength(0);
		});
	});

	describe("error handling", () => {
		it("should throw error when no workspace configuration found", () => {
			expect(() => new WorkspaceParser(testDir)).toThrow(
				"No package manager detected. Please ensure you have a lock file (bun.lockb, pnpm-lock.yaml, or package-lock.json) or workspace configuration in your project.",
			);
		});

		it("should handle invalid package.json files gracefully", async () => {
			writeFileSync(join(testDir, "bun.lockb"), "");
			writeFileSync(
				join(testDir, "package.json"),
				JSON.stringify({
					name: "test-workspace",
					workspaces: ["packages/*"],
				}),
			);

			mkdirSync(join(testDir, "packages", "invalid"), { recursive: true });
			writeFileSync(join(testDir, "packages", "invalid", "package.json"), "invalid json");

			const parser = new WorkspaceParser(testDir);

			await expect(parser.parseWorkspace()).rejects.toThrow();
		});

		it("should handle missing package.json in package directory", async () => {
			writeFileSync(join(testDir, "bun.lockb"), "");
			writeFileSync(
				join(testDir, "package.json"),
				JSON.stringify({
					name: "test-workspace",
					workspaces: ["packages/*"],
				}),
			);

			mkdirSync(join(testDir, "packages", "no-package-json"), { recursive: true });

			const parser = new WorkspaceParser(testDir);
			const workspace = await parser.parseWorkspace();

			// Should skip directories without package.json
			expect(workspace.packages).toHaveLength(0);
		});
	});
});
