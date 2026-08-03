import { afterEach, describe, expect, it } from "bun:test";
import { execFileSync } from "child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { findAffectedPackages } from "./affected.ts";
import type { PackageInfo, WorkspaceInfo } from "./workspace.ts";

const root = join(process.cwd(), "test-temp-affected");
const run = (args: string[]) => execFileSync("git", args, { cwd: root, stdio: "ignore" });

describe("affected packages", () => {
	afterEach(() => {
		if (existsSync(root)) rmSync(root, { recursive: true, force: true });
	});
	it("includes changed packages and transitive dependents", () => {
		mkdirSync(join(root, "packages", "core"), { recursive: true });
		mkdirSync(join(root, "packages", "app"), { recursive: true });
		writeFileSync(join(root, "packages", "core", "index.ts"), "one");
		writeFileSync(join(root, "packages", "app", "index.ts"), "app");
		run(["init", "-b", "main"]);
		run(["config", "user.email", "test@example.com"]);
		run(["config", "user.name", "Test"]);
		run(["add", "."]);
		run(["commit", "-m", "initial"]);
		const base = execFileSync("git", ["rev-parse", "HEAD"], {
			cwd: root,
			encoding: "utf8",
		}).trim();
		writeFileSync(join(root, "packages", "core", "index.ts"), "two");
		const core: PackageInfo = {
			name: "core",
			path: join(root, "packages", "core"),
			packageJson: { name: "core" },
			dependencies: [],
			devDependencies: [],
			scripts: {},
		};
		const app: PackageInfo = {
			name: "app",
			path: join(root, "packages", "app"),
			packageJson: { name: "app" },
			dependencies: ["core"],
			devDependencies: [],
			scripts: {},
		};
		const workspace: WorkspaceInfo = {
			root,
			packages: [core, app],
			packageMap: new Map([
				["core", core],
				["app", app],
			]),
			packageManager: {} as WorkspaceInfo["packageManager"],
		};
		expect(findAffectedPackages(workspace, { since: base })).toEqual(new Set(["core", "app"]));
	});
});
