import { describe, it, expect, beforeEach, spyOn } from "bun:test";
import { ProcessRunner } from "./process-runner.ts";

describe("ProcessRunner", () => {
	describe("getPackageColor", () => {
		beforeEach(() => {
			// Reset the assigned colors before each test
			// @ts-expect-error - accessing private static field for testing
			ProcessRunner.assignedColors = new Map();
			// @ts-expect-error - accessing private static field for testing
			ProcessRunner.colorIndex = 0;
		});

		it("should return consistent color for same package", () => {
			const color1 = ProcessRunner.getPackageColor("pkg1");
			const color2 = ProcessRunner.getPackageColor("pkg1");
			expect(color1).toBe(color2);
		});

		it("should return different colors for different packages", () => {
			const color1 = ProcessRunner.getPackageColor("pkg1");
			const color2 = ProcessRunner.getPackageColor("pkg2");
			expect(color1).not.toBe(color2);
		});

		it("should cycle through available colors", () => {
			// Get colors for many packages to trigger cycling
			const colors: string[] = [];
			for (let i = 0; i < 20; i++) {
				colors.push(ProcessRunner.getPackageColor(`pkg${i}`));
			}
			expect(colors.length).toBe(20);
			// Should have cycled through the palette
			expect(new Set(colors).size).toBeGreaterThan(1);
		});
	});

	describe("runCommand", () => {
		it("should run a simple command successfully", async () => {
			const result = await ProcessRunner.runCommand(
				"echo",
				["hello"],
				{ cwd: process.cwd() },
				{ prefix: "test", color: "blue" },
			);

			expect(result.success).toBe(true);
			expect(result.exitCode).toBe(0);
			expect(result.packageName).toBe("test");
			expect(result.command).toBe("echo hello");
		});

		it("should handle command failure", async () => {
			const result = await ProcessRunner.runCommand(
				"false",
				[],
				{ cwd: process.cwd() },
				{ prefix: "test", color: "red" },
			);

			expect(result.success).toBe(false);
			expect(result.exitCode).toBe(1);
		});

		it("should handle non-existent command", async () => {
			const result = await ProcessRunner.runCommand(
				"nonexistent-command-12345",
				[],
				{ cwd: process.cwd() },
				{ prefix: "test", color: "red" },
			);

			expect(result.success).toBe(false);
			expect(result.exitCode).toBe(1);
		});
	});

	describe("runParallel", () => {
		it("should run multiple commands in parallel", async () => {
			const commands = [
				{
					command: "echo",
					args: ["first"],
					options: { cwd: process.cwd() },
					logOptions: { prefix: "cmd1", color: "blue" },
				},
				{
					command: "echo",
					args: ["second"],
					options: { cwd: process.cwd() },
					logOptions: { prefix: "cmd2", color: "green" },
				},
			];

			const results = await ProcessRunner.runParallel(commands, 4);

			expect(results).toHaveLength(2);
			expect(results.every((r) => r.success)).toBe(true);
		});

		it("should respect concurrency limit", async () => {
			const commands = [
				{
					command: "sleep",
					args: ["0.01"],
					options: { cwd: process.cwd() },
					logOptions: { prefix: "cmd1", color: "blue" },
				},
				{
					command: "sleep",
					args: ["0.01"],
					options: { cwd: process.cwd() },
					logOptions: { prefix: "cmd2", color: "green" },
				},
				{
					command: "sleep",
					args: ["0.01"],
					options: { cwd: process.cwd() },
					logOptions: { prefix: "cmd3", color: "yellow" },
				},
			];

			const startTime = Date.now();
			const results = await ProcessRunner.runParallel(commands, 2);
			const endTime = Date.now();

			expect(results).toHaveLength(3);
			expect(results.every((r) => r.success)).toBe(true);
			// Should take longer with concurrency limit of 2
			expect(endTime - startTime).toBeGreaterThanOrEqual(10);
		});
	});

	describe("runSequential", () => {
		it("should run commands sequentially", async () => {
			const commands = [
				{
					command: "echo",
					args: ["first"],
					options: { cwd: process.cwd() },
					logOptions: { prefix: "cmd1", color: "blue" },
				},
				{
					command: "echo",
					args: ["second"],
					options: { cwd: process.cwd() },
					logOptions: { prefix: "cmd2", color: "green" },
				},
			];

			const results = await ProcessRunner.runSequential(commands);

			expect(results).toHaveLength(2);
			expect(results.every((r) => r.success)).toBe(true);
		});

		it("should stop on first failure", async () => {
			const consoleSpy = spyOn(console, "log");
			const commands = [
				{
					command: "false",
					args: [],
					options: { cwd: process.cwd() },
					logOptions: { prefix: "cmd1", color: "blue" },
				},
				{
					command: "echo",
					args: ["should not run"],
					options: { cwd: process.cwd() },
					logOptions: { prefix: "cmd2", color: "green" },
				},
			];

			const results = await ProcessRunner.runSequential(commands);

			expect(results).toHaveLength(1);
			expect(results[0]!.success).toBe(false);

			consoleSpy.mockRestore();
		});
	});

	describe("runBatches", () => {
		it("should run commands in batches", async () => {
			const batches = [
				[
					{
						command: "echo",
						args: ["batch1-cmd1"],
						options: { cwd: process.cwd() },
						logOptions: { prefix: "b1c1", color: "blue" },
					},
				],
				[
					{
						command: "echo",
						args: ["batch2-cmd1"],
						options: { cwd: process.cwd() },
						logOptions: { prefix: "b2c1", color: "green" },
					},
				],
			];

			const results = await ProcessRunner.runBatches(batches, 4);

			expect(results).toHaveLength(2);
			expect(results.every((r) => r.success)).toBe(true);
		});

		it("should stop when a batch fails", async () => {
			const consoleSpy = spyOn(console, "log");
			const batches = [
				[
					{
						command: "false",
						args: [],
						options: { cwd: process.cwd() },
						logOptions: { prefix: "fail", color: "red" },
					},
				],
				[
					{
						command: "echo",
						args: ["should not run"],
						options: { cwd: process.cwd() },
						logOptions: { prefix: "skip", color: "blue" },
					},
				],
			];

			const results = await ProcessRunner.runBatches(batches, 4);

			expect(results).toHaveLength(1);
			expect(results[0]!.success).toBe(false);

			consoleSpy.mockRestore();
		});
	});

	describe("terminateAll", () => {
		it("should handle no active processes", async () => {
			// @ts-expect-error - accessing private static field for testing
			ProcessRunner.activeChildren = new Set();

			await ProcessRunner.terminateAll("SIGTERM", 100);
			// Should not throw
		});
	});

	describe("printSummary", () => {
		it("should print summary with successful results", () => {
			const consoleSpy = spyOn(console, "log");
			const results = [
				{ success: true, exitCode: 0, packageName: "pkg1", command: "test", duration: 100 },
				{ success: true, exitCode: 0, packageName: "pkg2", command: "test", duration: 200 },
			];

			ProcessRunner.printSummary(results);

			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});

		it("should print summary with failed results", () => {
			const consoleSpy = spyOn(console, "log");
			const results = [
				{ success: true, exitCode: 0, packageName: "pkg1", command: "test", duration: 100 },
				{ success: false, exitCode: 1, packageName: "pkg2", command: "test", duration: 50 },
			];

			ProcessRunner.printSummary(results);

			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});
	});
});
