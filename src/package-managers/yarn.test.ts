import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { YarnPackageManager } from "./yarn.ts";

const root = join(process.cwd(), "test-temp-yarn");
describe("YarnPackageManager", () => {
	afterEach(() => {
		if (existsSync(root)) rmSync(root, { recursive: true, force: true });
	});
	it("detects and parses Yarn Berry workspaces", () => {
		mkdirSync(root, { recursive: true });
		writeFileSync(join(root, ".yarnrc.yml"), "nodeLinker: node-modules\n");
		writeFileSync(
			join(root, "package.json"),
			JSON.stringify({ packageManager: "yarn@4.5.0", workspaces: ["packages/*"] }),
		);
		const yarn = new YarnPackageManager();
		expect(yarn.isActive(root)).toBe(true);
		expect(yarn.parseWorkspaceConfig(root)).toEqual({ packages: ["packages/*"] });
		expect(yarn.getRunCommand("test")).toEqual({ command: "yarn", args: ["run", "test"] });
	});
});
