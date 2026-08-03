import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "fs";
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
		const receivedPackages: string[] = [];
		const runCommandSpy = spyOn(ProcessRunner, "runCommand").mockImplementation(
			async (command, args, _options, logOptions) => {
				receivedPackages.push(logOptions.prefix);
				return {
					success: true,
					exitCode: 0,
					packageName: logOptions.prefix,
					command: [command, ...args].join(" "),
					duration: 10,
				};
			},
		);

		const processExitSpy = spyOn(process, "exit").mockImplementation(() => {
			throw new Error("process.exit called");
		});

		try {
			await buildCommand({ filter: "*app*" });
			expect(receivedPackages).toEqual(["@test/lib", "@test/app"]);
			expect(runCommandSpy).toHaveBeenCalled();
		} finally {
			runCommandSpy.mockRestore();
			processExitSpy.mockRestore();
		}
	});

	it("restores deleted artifacts without rerunning the build", async () => {
		const libPath = join(testDir, "packages", "lib");
		writeFileSync(
			join(libPath, "package.json"),
			JSON.stringify({
				name: "@test/lib",
				version: "1.0.0",
				files: ["dist"],
				scripts: {
					build: "mkdir -p dist && echo run >> build-count && echo artifact > dist/index.js",
				},
			}),
		);
		await buildCommand({ filter: "@test/lib" });
		rmSync(join(libPath, "dist"), { recursive: true, force: true });
		await buildCommand({ filter: "@test/lib" });
		expect(readFileSync(join(libPath, "build-count"), "utf8").trim()).toBe("run");
		expect(readFileSync(join(libPath, "dist", "index.js"), "utf8").trim()).toBe("artifact");
	});
});
