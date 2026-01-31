import { describe, it, expect, spyOn } from "bun:test";
import { DependencyGraph } from "./dependency-graph.ts";

describe("DependencyGraph", () => {
	describe("addPackage", () => {
		it("should add a package to the graph", () => {
			const graph = new DependencyGraph();
			graph.addPackage("pkg1");
			expect(graph.getPackages()).toContain("pkg1");
		});

		it("should not duplicate packages", () => {
			const graph = new DependencyGraph();
			graph.addPackage("pkg1");
			graph.addPackage("pkg1");
			expect(graph.getPackages()).toHaveLength(1);
		});
	});

	describe("addDependency", () => {
		it("should add a dependency relationship", () => {
			const graph = new DependencyGraph();
			graph.addDependency("app", "lib");
			expect(graph.getDependencies("app")).toContain("lib");
			expect(graph.getDependents("lib")).toContain("app");
		});

		it("should automatically add packages if they do not exist", () => {
			const graph = new DependencyGraph();
			graph.addDependency("app", "lib");
			expect(graph.getPackages()).toEqual(["app", "lib"]);
		});
	});

	describe("getPackages", () => {
		it("should return all packages in the graph", () => {
			const graph = new DependencyGraph();
			graph.addPackage("pkg1");
			graph.addPackage("pkg2");
			graph.addPackage("pkg3");
			const packages = graph.getPackages();
			expect(packages).toHaveLength(3);
			expect(packages).toContain("pkg1");
			expect(packages).toContain("pkg2");
			expect(packages).toContain("pkg3");
		});

		it("should return empty array for empty graph", () => {
			const graph = new DependencyGraph();
			expect(graph.getPackages()).toEqual([]);
		});
	});

	describe("getDependencies", () => {
		it("should return dependencies of a package", () => {
			const graph = new DependencyGraph();
			graph.addDependency("app", "lib1");
			graph.addDependency("app", "lib2");
			const deps = graph.getDependencies("app");
			expect(deps).toHaveLength(2);
			expect(deps).toContain("lib1");
			expect(deps).toContain("lib2");
		});

		it("should return empty array for packages with no dependencies", () => {
			const graph = new DependencyGraph();
			graph.addPackage("standalone");
			expect(graph.getDependencies("standalone")).toEqual([]);
		});

		it("should return empty array for non-existent package", () => {
			const graph = new DependencyGraph();
			expect(graph.getDependencies("nonexistent")).toEqual([]);
		});
	});

	describe("getDependents", () => {
		it("should return dependents of a package", () => {
			const graph = new DependencyGraph();
			graph.addDependency("app1", "lib");
			graph.addDependency("app2", "lib");
			const dependents = graph.getDependents("lib");
			expect(dependents).toHaveLength(2);
			expect(dependents).toContain("app1");
			expect(dependents).toContain("app2");
		});

		it("should return empty array for packages with no dependents", () => {
			const graph = new DependencyGraph();
			graph.addPackage("standalone");
			expect(graph.getDependents("standalone")).toEqual([]);
		});

		it("should return empty array for non-existent package", () => {
			const graph = new DependencyGraph();
			expect(graph.getDependents("nonexistent")).toEqual([]);
		});
	});

	describe("topologicalSort", () => {
		it("should sort packages in dependency order", () => {
			const graph = new DependencyGraph();
			graph.addDependency("app", "lib");
			graph.addDependency("lib", "core");
			const result = graph.topologicalSort();
			expect(result.order).toEqual(["core", "lib", "app"]);
			expect(result.cycles).toEqual([]);
		});

		it("should handle independent packages", () => {
			const graph = new DependencyGraph();
			graph.addPackage("pkg1");
			graph.addPackage("pkg2");
			graph.addPackage("pkg3");
			const result = graph.topologicalSort();
			expect(result.order).toHaveLength(3);
			expect(result.cycles).toEqual([]);
		});

		it("should detect simple circular dependency", () => {
			const graph = new DependencyGraph();
			graph.addDependency("a", "b");
			graph.addDependency("b", "a");
			const result = graph.topologicalSort();
			expect(result.cycles.length).toBeGreaterThan(0);
		});

		it("should detect complex circular dependency", () => {
			const graph = new DependencyGraph();
			graph.addDependency("a", "b");
			graph.addDependency("b", "c");
			graph.addDependency("c", "a");
			const result = graph.topologicalSort();
			expect(result.cycles.length).toBeGreaterThan(0);
		});
	});

	describe("getBuildBatches", () => {
		it("should create correct build batches", () => {
			const graph = new DependencyGraph();
			graph.addDependency("app", "lib");
			graph.addDependency("lib", "core");
			const batches = graph.getBuildBatches();
			expect(batches).toEqual([["core"], ["lib"], ["app"]]);
		});

		it("should group independent packages in same batch", () => {
			const graph = new DependencyGraph();
			graph.addPackage("pkg1");
			graph.addPackage("pkg2");
			graph.addPackage("pkg3");
			const batches = graph.getBuildBatches();
			expect(batches).toHaveLength(1);
			expect(batches[0]).toHaveLength(3);
		});

		it("should throw error on circular dependency", () => {
			const graph = new DependencyGraph();
			graph.addDependency("a", "b");
			graph.addDependency("b", "a");
			expect(() => graph.getBuildBatches()).toThrow(/Circular dependencies detected/);
		});

		it("should handle diamond dependency pattern", () => {
			//     core
			//    /    \
			//  lib1   lib2
			//    \    /
			//     app
			const graph = new DependencyGraph();
			graph.addDependency("lib1", "core");
			graph.addDependency("lib2", "core");
			graph.addDependency("app", "lib1");
			graph.addDependency("app", "lib2");
			const batches = graph.getBuildBatches();
			expect(batches[0]).toContain("core");
			expect(batches[1]).toContain("lib1");
			expect(batches[1]).toContain("lib2");
			expect(batches[2]).toContain("app");
		});
	});

	describe("filterGraph", () => {
		it("should filter graph to include only specified packages", () => {
			const graph = new DependencyGraph();
			graph.addDependency("app", "lib");
			graph.addPackage("other");
			const filtered = graph.filterGraph(["app", "lib"]);
			expect(filtered.getPackages()).toHaveLength(2);
			expect(filtered.getPackages()).toContain("app");
			expect(filtered.getPackages()).toContain("lib");
			expect(filtered.getPackages()).not.toContain("other");
		});

		it("should preserve dependency relationships in filtered graph", () => {
			const graph = new DependencyGraph();
			graph.addDependency("app", "lib");
			graph.addDependency("app", "other");
			const filtered = graph.filterGraph(["app", "lib"]);
			expect(filtered.getDependencies("app")).toContain("lib");
			expect(filtered.getDependencies("app")).not.toContain("other");
		});
	});

	describe("getRootPackages", () => {
		it("should return packages with no dependencies", () => {
			const graph = new DependencyGraph();
			graph.addDependency("app", "lib");
			graph.addPackage("standalone");
			const roots = graph.getRootPackages();
			expect(roots).toContain("lib");
			expect(roots).toContain("standalone");
			expect(roots).not.toContain("app");
		});
	});

	describe("getLeafPackages", () => {
		it("should return packages with no dependents", () => {
			const graph = new DependencyGraph();
			graph.addDependency("app", "lib");
			graph.addPackage("standalone");
			const leaves = graph.getLeafPackages();
			expect(leaves).toContain("app");
			expect(leaves).toContain("standalone");
			expect(leaves).not.toContain("lib");
		});
	});

	describe("printGraph", () => {
		it("should print the dependency graph", () => {
			const graph = new DependencyGraph();
			graph.addDependency("app", "lib");
			const consoleSpy = spyOn(console, "log");
			graph.printGraph();
			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});
	});
});
