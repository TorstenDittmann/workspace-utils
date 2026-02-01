import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { buildCommand } from "./build.ts";
import { ProcessRunner } from "../core/process-runner.ts";

describe("buildCommand", () => {
	const testDir = join(process.cwd(), "test-temp-build");
	let originalCwd: string;

	beforeEach(() => {
		originalCwd = process.cwd();

		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
		mkdirSync(testDir, { recursive: true });
		process.chdir(testDir);

		// Create Bun workspace
		writeFileSync(join(testDir, "bun.lockb"), "");
		writeFileSync(
			join(testDir, "package.json"),
			JSON.stringify({
				name: "test-workspace",
				workspaces: ["packages/*"],
			}),
		);

		// Dependency package
		mkdirSync(join(testDir, "packages", "lib"), { recursive: true });
		writeFileSync(
			join(testDir, "packages", "lib", "package.json"),
			JSON.stringify({
				name: "@test/lib",
				version: "1.0.0",
				scripts: {
					build: 'echo "Building lib"',
				},
			}),
		);

		// App package depending on lib
		mkdirSync(join(testDir, "packages", "app"), { recursive: true });
		writeFileSync(
			join(testDir, "packages", "app", "package.json"),
			JSON.stringify({
				name: "@test/app",
				version: "1.0.0",
				dependencies: {
					"@test/lib": "1.0.0",
				},
				scripts: {
					build: 'echo "Building app"',
				},
			}),
		);
	});

	afterEach(() => {
		process.chdir(originalCwd);

		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	it("includes dependencies when a filter is provided", async () => {
		const receivedBatches: string[][] = [];
		const runBatchesSpy = spyOn(ProcessRunner, "runBatches").mockImplementation(
			async (batches) => {
				for (const batch of batches) {
					receivedBatches.push(
						batch
							.filter((cmd) => Boolean(cmd))
							.map((cmd) => cmd?.logOptions.prefix ?? ""),
					);
				}

				return batches
					.flat()
					.filter((cmd) => Boolean(cmd))
					.map((cmd) => ({
						success: true,
						exitCode: 0,
						packageName: cmd?.logOptions.prefix ?? "",
						command: [cmd?.command, ...(cmd?.args || [])].join(" "),
						duration: 10,
					}));
			},
		);

		const processExitSpy = spyOn(process, "exit").mockImplementation(() => {
			throw new Error("process.exit called");
		});

		try {
			await buildCommand({ filter: "*app*" });
			expect(receivedBatches).toEqual([["@test/lib"], ["@test/app"]]);
			expect(runBatchesSpy).toHaveBeenCalled();
		} finally {
			runBatchesSpy.mockRestore();
			processExitSpy.mockRestore();
		}
	});
});
