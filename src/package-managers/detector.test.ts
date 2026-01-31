import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { PackageManagerDetector } from "./detector.ts";
import { BunPackageManager } from "./bun.ts";
import { PnpmPackageManager } from "./pnpm.ts";
import { NpmPackageManager } from "./npm.ts";

describe("PackageManagerDetector", () => {
	const testDir = join(process.cwd(), "test-temp");

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

	describe("detect", () => {
		it("should detect Bun when bun.lockb exists", () => {
			// Create bun.lockb file
			writeFileSync(join(testDir, "bun.lockb"), "");
			writeFileSync(
				join(testDir, "package.json"),
				JSON.stringify({
					name: "test",
					workspaces: ["packages/*"],
				}),
			);

			const result = PackageManagerDetector.detect(testDir);

			expect(result.packageManager).toBeInstanceOf(BunPackageManager);
			expect(result.confidence).toBeGreaterThan(100);
		});

		it("should detect pnpm when pnpm-lock.yaml exists", () => {
			// Create pnpm-lock.yaml file
			writeFileSync(join(testDir, "pnpm-lock.yaml"), "lockfileVersion: 6.0");
			writeFileSync(
				join(testDir, "package.json"),
				JSON.stringify({
					name: "test",
					workspaces: ["packages/*"],
				}),
			);

			const result = PackageManagerDetector.detect(testDir);

			expect(result.packageManager).toBeInstanceOf(PnpmPackageManager);
			expect(result.confidence).toBeGreaterThan(100);
		});

		it("should detect npm when package-lock.json exists", () => {
			// Create package-lock.json file
			writeFileSync(
				join(testDir, "package-lock.json"),
				JSON.stringify({
					name: "test",
					lockfileVersion: 2,
				}),
			);
			writeFileSync(
				join(testDir, "package.json"),
				JSON.stringify({
					name: "test",
					workspaces: ["packages/*"],
				}),
			);

			const result = PackageManagerDetector.detect(testDir);

			expect(result.packageManager).toBeInstanceOf(NpmPackageManager);
			expect(result.confidence).toBeGreaterThan(100);
		});

		it("should prefer pnpm when pnpm-workspace.yaml exists", () => {
			// Create both pnpm and npm indicators
			writeFileSync(join(testDir, "pnpm-lock.yaml"), "lockfileVersion: 6.0");
			writeFileSync(join(testDir, "package-lock.json"), "{}");
			writeFileSync(join(testDir, "pnpm-workspace.yaml"), "packages:\n  - packages/*");

			const result = PackageManagerDetector.detect(testDir);

			expect(result.packageManager).toBeInstanceOf(PnpmPackageManager);
			expect(result.confidence).toBeGreaterThan(150); // Lock file + workspace file
		});

		it("should detect Bun with bunfig.toml", () => {
			writeFileSync(
				join(testDir, "bunfig.toml"),
				'[install]\nregistry = "https://registry.npmjs.org/"',
			);
			writeFileSync(
				join(testDir, "package.json"),
				JSON.stringify({
					name: "test",
					workspaces: ["packages/*"],
				}),
			);

			const result = PackageManagerDetector.detect(testDir);

			expect(result.packageManager).toBeInstanceOf(BunPackageManager);
			expect(result.confidence).toBeGreaterThan(50);
		});

		it("should detect Bun with bun-specific package.json fields", () => {
			writeFileSync(
				join(testDir, "package.json"),
				JSON.stringify({
					name: "test",
					workspaces: ["packages/*"],
					bun: {
						install: {
							dev: true,
						},
					},
				}),
			);

			const result = PackageManagerDetector.detect(testDir);

			expect(result.packageManager).toBeInstanceOf(BunPackageManager);
			expect(result.confidence).toBeGreaterThanOrEqual(20);
		});

		it("should throw error when no package manager is detected", () => {
			expect(() => PackageManagerDetector.detect(testDir)).toThrow(
				"No package manager detected. Please ensure you have a lock file (bun.lockb, pnpm-lock.yaml, or package-lock.json) or workspace configuration in your project.",
			);
		});

		it("should handle multiple package managers and choose highest confidence", () => {
			// Create indicators for multiple package managers
			writeFileSync(join(testDir, "package-lock.json"), "{}"); // npm - confidence 100
			writeFileSync(join(testDir, "pnpm-lock.yaml"), "lockfileVersion: 6.0"); // pnpm - confidence 100
			writeFileSync(join(testDir, "pnpm-workspace.yaml"), "packages:\n  - packages/*"); // pnpm +80
			writeFileSync(
				join(testDir, "package.json"),
				JSON.stringify({
					name: "test",
					workspaces: ["packages/*"],
				}),
			);

			const result = PackageManagerDetector.detect(testDir);

			// pnpm should win with 200 confidence (100 + 80 + 20)
			expect(result.packageManager).toBeInstanceOf(PnpmPackageManager);
			expect(result.confidence).toBe(200);
		});
	});

	describe("getPackageManager", () => {
		it("should return correct package manager by name", () => {
			expect(PackageManagerDetector.getPackageManager("bun")).toBeInstanceOf(
				BunPackageManager,
			);
			expect(PackageManagerDetector.getPackageManager("pnpm")).toBeInstanceOf(
				PnpmPackageManager,
			);
			expect(PackageManagerDetector.getPackageManager("npm")).toBeInstanceOf(
				NpmPackageManager,
			);
		});

		it("should throw error for unknown package manager", () => {
			expect(() => PackageManagerDetector.getPackageManager("unknown")).toThrow(
				"Unknown package manager: unknown",
			);
		});
	});

	describe("getSupportedPackageManagers", () => {
		it("should return all supported package managers", () => {
			const managers = PackageManagerDetector.getSupportedPackageManagers();

			expect(managers).toHaveLength(3);
			expect(managers[0]).toBeInstanceOf(BunPackageManager);
			expect(managers[1]).toBeInstanceOf(PnpmPackageManager);
			expect(managers[2]).toBeInstanceOf(NpmPackageManager);
		});
	});

	describe("isPackageManagerAvailable", () => {
		it("should check if bun is available", async () => {
			const isAvailable = await PackageManagerDetector.isPackageManagerAvailable("bun");
			expect(typeof isAvailable).toBe("boolean");
		});

		it("should return false for non-existent package manager", async () => {
			const isAvailable =
				await PackageManagerDetector.isPackageManagerAvailable("nonexistent-pm");
			expect(isAvailable).toBe(false);
		});
	});
});
