import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { cleanCommand } from "./clean.ts";

describe("cleanCommand", () => {
	const testDir = join(process.cwd(), "test-temp-clean");

	beforeEach(() => {
		// Clean up test directory if it exists
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
		mkdirSync(testDir, { recursive: true });

		// Change to test directory
		process.chdir(testDir);
	});

	afterEach(() => {
		// Change back to original directory
		process.chdir(process.cwd().replace("/test-temp-clean", ""));

		// Clean up test directory
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	describe("Bun workspace", () => {
		beforeEach(() => {
			// Create Bun workspace
			writeFileSync(join(testDir, "bun.lockb"), "");
			writeFileSync(
				join(testDir, "package.json"),
				JSON.stringify({
					name: "test-workspace",
					workspaces: ["packages/*"],
				}),
			);

			// Create test packages with node_modules
			mkdirSync(join(testDir, "packages", "pkg1", "node_modules"), { recursive: true });
			writeFileSync(
				join(testDir, "packages", "pkg1", "package.json"),
				JSON.stringify({
					name: "@test/pkg1",
					version: "1.0.0",
				}),
			);
			writeFileSync(
				join(testDir, "packages", "pkg1", "node_modules", ".package-lock.json"),
				"{}",
			);

			mkdirSync(join(testDir, "packages", "pkg2", "node_modules"), { recursive: true });
			writeFileSync(
				join(testDir, "packages", "pkg2", "package.json"),
				JSON.stringify({
					name: "@test/pkg2",
					version: "1.0.0",
				}),
			);
			writeFileSync(
				join(testDir, "packages", "pkg2", "node_modules", ".package-lock.json"),
				"{}",
			);

			// Package without node_modules
			mkdirSync(join(testDir, "packages", "pkg3"), { recursive: true });
			writeFileSync(
				join(testDir, "packages", "pkg3", "package.json"),
				JSON.stringify({
					name: "@test/pkg3",
					version: "1.0.0",
				}),
			);
		});

		it("should clean node_modules from all packages", async () => {
			const consoleSpy = spyOn(console, "log");

			await cleanCommand({});

			// Check that node_modules were removed
			expect(existsSync(join(testDir, "packages", "pkg1", "node_modules"))).toBe(false);
			expect(existsSync(join(testDir, "packages", "pkg2", "node_modules"))).toBe(false);
			// pkg3 never had node_modules
			expect(existsSync(join(testDir, "packages", "pkg3", "node_modules"))).toBe(false);

			consoleSpy.mockRestore();
		});

		it("should filter packages when filter option is provided", async () => {
			const consoleSpy = spyOn(console, "log");

			await cleanCommand({ filter: "*pkg1*" });

			// Only pkg1 should be cleaned
			expect(existsSync(join(testDir, "packages", "pkg1", "node_modules"))).toBe(false);
			expect(existsSync(join(testDir, "packages", "pkg2", "node_modules"))).toBe(true);

			consoleSpy.mockRestore();
		});

		it("should skip packages without node_modules", async () => {
			const consoleSpy = spyOn(console, "log");

			await cleanCommand({});

			// Should show summary with skipped count
			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining("Skipped: 1 (no node_modules found)"),
			);

			consoleSpy.mockRestore();
		});
	});

	describe("pnpm workspace", () => {
		beforeEach(() => {
			// Create pnpm workspace
			writeFileSync(join(testDir, "pnpm-lock.yaml"), "lockfileVersion: 6.0");
			writeFileSync(join(testDir, "pnpm-workspace.yaml"), "packages:\n  - packages/*");

			// Create test package
			mkdirSync(join(testDir, "packages", "utils", "node_modules"), { recursive: true });
			writeFileSync(
				join(testDir, "packages", "utils", "package.json"),
				JSON.stringify({
					name: "@test/utils",
					version: "1.0.0",
				}),
			);
			writeFileSync(
				join(testDir, "packages", "utils", "node_modules", ".package-lock.json"),
				"{}",
			);
		});

		it("should clean node_modules from pnpm workspace", async () => {
			const consoleSpy = spyOn(console, "log");

			await cleanCommand({});

			expect(existsSync(join(testDir, "packages", "utils", "node_modules"))).toBe(false);

			consoleSpy.mockRestore();
		});
	});

	describe("npm workspace", () => {
		beforeEach(() => {
			// Create npm workspace
			writeFileSync(join(testDir, "package-lock.json"), "{}");
			writeFileSync(
				join(testDir, "package.json"),
				JSON.stringify({
					name: "test-workspace",
					workspaces: ["libs/*"],
				}),
			);

			// Create test package
			mkdirSync(join(testDir, "libs", "core", "node_modules"), { recursive: true });
			writeFileSync(
				join(testDir, "libs", "core", "package.json"),
				JSON.stringify({
					name: "core",
					version: "1.0.0",
				}),
			);
			writeFileSync(
				join(testDir, "libs", "core", "node_modules", ".package-lock.json"),
				"{}",
			);
		});

		it("should clean node_modules from npm workspace", async () => {
			const consoleSpy = spyOn(console, "log");

			await cleanCommand({});

			expect(existsSync(join(testDir, "libs", "core", "node_modules"))).toBe(false);

			consoleSpy.mockRestore();
		});
	});

	describe("error handling", () => {
		it("should handle workspace parsing errors gracefully", async () => {
			// Create invalid workspace (no workspaces config)
			writeFileSync(
				join(testDir, "package.json"),
				JSON.stringify({
					name: "invalid-workspace",
				}),
			);

			const consoleSpy = spyOn(console, "log");
			const processExitSpy = spyOn(process, "exit").mockImplementation(() => {
				throw new Error("process.exit called");
			});

			try {
				await cleanCommand({});
			} catch (error) {
				expect((error as Error).message).toBe("process.exit called");
			}

			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("[BOOM] Error:"));
			expect(processExitSpy).toHaveBeenCalledWith(1);

			consoleSpy.mockRestore();
			processExitSpy.mockRestore();
		});
	});
});
