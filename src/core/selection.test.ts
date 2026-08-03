import { describe, expect, it } from "bun:test";
import { selectPackages } from "./selection.ts";
import type { PackageInfo, WorkspaceInfo } from "./workspace.ts";

const pkg = (name: string, dependencies: string[] = [], path = name): PackageInfo => ({
	name,
	path: `/repo/${path}`,
	packageJson: { name },
	dependencies,
	devDependencies: [],
	scripts: {},
});
const packages = [pkg("core"), pkg("ui", ["core"]), pkg("app", ["ui"], "apps/app"), pkg("docs")];
const workspace = {
	root: "/repo",
	packages,
	packageMap: new Map(packages.map((p) => [p.name, p])),
	packageManager: {} as WorkspaceInfo["packageManager"],
};

describe("package selectors", () => {
	it("expands dependencies and dependents", () => {
		expect(selectPackages(workspace, ["app..."]).packages.map((p) => p.name)).toEqual([
			"core",
			"ui",
			"app",
		]);
		expect(selectPackages(workspace, ["...core"]).packages.map((p) => p.name)).toEqual([
			"core",
			"ui",
			"app",
		]);
	});
	it("composes repeated and negative filters", () => {
		expect(selectPackages(workspace, ["*", "!docs"]).packages.map((p) => p.name)).toEqual([
			"core",
			"ui",
			"app",
		]);
	});
	it("matches package paths", () => {
		expect(selectPackages(workspace, ["./apps/*"]).packages.map((p) => p.name)).toEqual([
			"app",
		]);
	});
});
