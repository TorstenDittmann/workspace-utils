import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { NpmPackageManager } from "./npm.ts";

describe("NpmPackageManager", () => {
	const testDir = join(process.cwd(), "test-temp-npm");
	let npmManager: NpmPackageManager;

	beforeEach(() => {
		// Clean up test directory if it exists
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
		mkdirSync(testDir, { recursive: true });
		npmManager = new NpmPackageManager();
	});

	afterEach(() => {
		// Clean up test directory
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	describe("name", () => {
		it('should return "npm"', () => {
			expect(npmManager.name).toBe("npm");
		});
	});

	describe("isActive", () => {
		it("should return true when package-lock.json exists", () => {
			writeFileSync(join(testDir, "package-lock.json"), "{}");
			expect(npmManager.isActive(testDir)).toBe(true);
		});

		it("should return true when .npmrc exists", () => {
			writeFileSync(join(testDir, ".npmrc"), "registry=https://registry.npmjs.org/");
			expect(npmManager.isActive(testDir)).toBe(true);
		});

		it("should return true when package.json has workspaces field", () => {
			writeFileSync(
				join(testDir, "package.json"),
				JSON.stringify({
					name: "test",
					workspaces: ["packages/*"],
				}),
			);
			expect(npmManager.isActive(testDir)).toBe(true);
		});

		it("should return true when package.json has publishConfig field", () => {
			writeFileSync(
				join(testDir, "package.json"),
				JSON.stringify({
					name: "test",
					publishConfig: {
						access: "public",
					},
				}),
			);
			expect(npmManager.isActive(testDir)).toBe(true);
		});

		it("should return false when no npm indicators exist", () => {
			writeFileSync(
				join(testDir, "package.json"),
				JSON.stringify({
					name: "test",
					dependencies: {},
				}),
			);
			expect(npmManager.isActive(testDir)).toBe(false);
		});

		it("should return false when package.json is invalid", () => {
			writeFileSync(join(testDir, "package.json"), "invalid json");
			expect(npmManager.isActive(testDir)).toBe(false);
		});

		it("should return false when no files exist", () => {
			expect(npmManager.isActive(testDir)).toBe(false);
		});
	});

	describe("getRunCommand", () => {
		it("should return correct npm run command", () => {
			const result = npmManager.getRunCommand("test");
			expect(result).toEqual({
				command: "npm",
				args: ["run", "test"],
			});
		});

		it("should work with different script names", () => {
			expect(npmManager.getRunCommand("build")).toEqual({
				command: "npm",
				args: ["run", "build"],
			});

			expect(npmManager.getRunCommand("dev")).toEqual({
				command: "npm",
				args: ["run", "dev"],
			});
		});
	});

	describe("parseWorkspaceConfig", () => {
		it("should parse workspaces array from package.json", () => {
			writeFileSync(
				join(testDir, "package.json"),
				JSON.stringify({
					name: "test-workspace",
					workspaces: ["packages/*", "apps/*"],
				}),
			);

			const result = npmManager.parseWorkspaceConfig(testDir);
			expect(result.packages).toEqual(["packages/*", "apps/*"]);
		});

		it("should parse workspaces object from package.json", () => {
			writeFileSync(
				join(testDir, "package.json"),
				JSON.stringify({
					name: "test-workspace",
					workspaces: {
						packages: ["packages/*", "tools/*"],
					},
				}),
			);

			const result = npmManager.parseWorkspaceConfig(testDir);
			expect(result.packages).toEqual(["packages/*", "tools/*"]);
		});

		it("should throw error when package.json does not exist", () => {
			expect(() => npmManager.parseWorkspaceConfig(testDir)).toThrow(
				"No package.json found in workspace root",
			);
		});

		it("should throw error when no workspaces field exists", () => {
			writeFileSync(
				join(testDir, "package.json"),
				JSON.stringify({
					name: "test-workspace",
					dependencies: {},
				}),
			);

			expect(() => npmManager.parseWorkspaceConfig(testDir)).toThrow(
				"No workspaces configuration found in package.json",
			);
		});

		it("should throw error when workspaces is not an array or valid object", () => {
			writeFileSync(
				join(testDir, "package.json"),
				JSON.stringify({
					name: "test-workspace",
					workspaces: "invalid",
				}),
			);

			expect(() => npmManager.parseWorkspaceConfig(testDir)).toThrow(
				"Invalid workspaces configuration: must be an array or object with packages array",
			);
		});

		it("should throw error when workspaces object lacks packages field", () => {
			writeFileSync(
				join(testDir, "package.json"),
				JSON.stringify({
					name: "test-workspace",
					workspaces: {
						notPackages: ["packages/*"],
					},
				}),
			);

			expect(() => npmManager.parseWorkspaceConfig(testDir)).toThrow(
				"Invalid workspaces configuration: must be an array or object with packages array",
			);
		});
	});

	describe("getLockFileName", () => {
		it('should return "package-lock.json"', () => {
			expect(npmManager.getLockFileName()).toBe("package-lock.json");
		});
	});
});
