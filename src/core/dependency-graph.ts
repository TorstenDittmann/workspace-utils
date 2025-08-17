export interface DependencyNode {
	name: string;
	dependencies: Set<string>;
	dependents: Set<string>;
}

export interface TopologicalResult {
	order: string[];
	cycles: string[][];
}

export class DependencyGraph {
	private nodes: Map<string, DependencyNode> = new Map();

	/**
	 * Add a package to the dependency graph
	 */
	addPackage(packageName: string): void {
		if (!this.nodes.has(packageName)) {
			this.nodes.set(packageName, {
				name: packageName,
				dependencies: new Set(),
				dependents: new Set(),
			});
		}
	}

	/**
	 * Add a dependency relationship between two packages
	 */
	addDependency(packageName: string, dependencyName: string): void {
		this.addPackage(packageName);
		this.addPackage(dependencyName);

		const packageNode = this.nodes.get(packageName)!;
		const dependencyNode = this.nodes.get(dependencyName)!;

		packageNode.dependencies.add(dependencyName);
		dependencyNode.dependents.add(packageName);
	}

	/**
	 * Get all packages in the graph
	 */
	getPackages(): string[] {
		return Array.from(this.nodes.keys());
	}

	/**
	 * Get direct dependencies of a package
	 */
	getDependencies(packageName: string): string[] {
		const node = this.nodes.get(packageName);
		return node ? Array.from(node.dependencies) : [];
	}

	/**
	 * Get direct dependents of a package
	 */
	getDependents(packageName: string): string[] {
		const node = this.nodes.get(packageName);
		return node ? Array.from(node.dependents) : [];
	}

	/**
	 * Perform topological sort using Kahn's algorithm
	 * Returns the build order and any detected cycles
	 */
	topologicalSort(): TopologicalResult {
		const result: string[] = [];
		const inDegree: Map<string, number> = new Map();
		const queue: string[] = [];

		// Initialize in-degree count for all nodes
		for (const [packageName, node] of this.nodes) {
			inDegree.set(packageName, node.dependencies.size);

			// Add nodes with no dependencies to the queue
			if (node.dependencies.size === 0) {
				queue.push(packageName);
			}
		}

		// Process nodes with no incoming edges
		while (queue.length > 0) {
			const currentPackage = queue.shift()!;
			result.push(currentPackage);

			// Reduce in-degree for all dependents
			const dependents = this.getDependents(currentPackage);
			for (const dependent of dependents) {
				const currentInDegree = inDegree.get(dependent)! - 1;
				inDegree.set(dependent, currentInDegree);

				// If no more dependencies, add to queue
				if (currentInDegree === 0) {
					queue.push(dependent);
				}
			}
		}

		// Detect cycles
		const cycles: string[][] = [];
		if (result.length !== this.nodes.size) {
			const remainingNodes = this.getPackages().filter(pkg => !result.includes(pkg));
			const detectedCycles = this.detectCycles(remainingNodes);
			cycles.push(...detectedCycles);
		}

		return { order: result, cycles };
	}

	/**
	 * Detect cycles in the remaining nodes using DFS
	 */
	private detectCycles(remainingNodes: string[]): string[][] {
		const cycles: string[][] = [];
		const visited = new Set<string>();
		const recStack = new Set<string>();

		const dfs = (node: string, path: string[]): void => {
			if (recStack.has(node)) {
				// Found a cycle
				const cycleStart = path.indexOf(node);
				if (cycleStart !== -1) {
					cycles.push(path.slice(cycleStart).concat([node]));
				}
				return;
			}

			if (visited.has(node)) {
				return;
			}

			visited.add(node);
			recStack.add(node);

			const dependencies = this.getDependencies(node);
			for (const dep of dependencies) {
				if (remainingNodes.includes(dep)) {
					dfs(dep, [...path, node]);
				}
			}

			recStack.delete(node);
		};

		for (const node of remainingNodes) {
			if (!visited.has(node)) {
				dfs(node, []);
			}
		}

		return cycles;
	}

	/**
	 * Get build batches - packages that can be built in parallel
	 */
	getBuildBatches(): string[][] {
		const { order, cycles } = this.topologicalSort();

		if (cycles.length > 0) {
			throw new Error(
				`Circular dependencies detected: ${cycles.map(cycle => cycle.join(' -> ')).join(', ')}`
			);
		}

		const batches: string[][] = [];
		const processed = new Set<string>();

		while (processed.size < order.length) {
			const currentBatch: string[] = [];

			for (const packageName of order) {
				if (processed.has(packageName)) {
					continue;
				}

				// Check if all dependencies are already processed
				const dependencies = this.getDependencies(packageName);
				const allDepsProcessed = dependencies.every(dep => processed.has(dep));

				if (allDepsProcessed) {
					currentBatch.push(packageName);
				}
			}

			if (currentBatch.length === 0) {
				// This shouldn't happen if topological sort worked correctly
				throw new Error('Unable to determine build order - possible circular dependency');
			}

			batches.push(currentBatch);
			currentBatch.forEach(pkg => processed.add(pkg));
		}

		return batches;
	}

	/**
	 * Filter the graph to only include specified packages
	 */
	filterGraph(packageNames: string[]): DependencyGraph {
		const filteredGraph = new DependencyGraph();
		const packageSet = new Set(packageNames);

		// Add all specified packages
		for (const packageName of packageNames) {
			if (this.nodes.has(packageName)) {
				filteredGraph.addPackage(packageName);
			}
		}

		// Add dependencies between filtered packages
		for (const packageName of packageNames) {
			if (this.nodes.has(packageName)) {
				const dependencies = this.getDependencies(packageName);
				for (const dep of dependencies) {
					if (packageSet.has(dep)) {
						filteredGraph.addDependency(packageName, dep);
					}
				}
			}
		}

		return filteredGraph;
	}

	/**
	 * Get packages that have no dependencies (root packages)
	 */
	getRootPackages(): string[] {
		return this.getPackages().filter(pkg => this.getDependencies(pkg).length === 0);
	}

	/**
	 * Get packages that have no dependents (leaf packages)
	 */
	getLeafPackages(): string[] {
		return this.getPackages().filter(pkg => this.getDependents(pkg).length === 0);
	}

	/**
	 * Print the dependency graph for debugging
	 */
	printGraph(): void {
		console.log('\n📊 Dependency Graph:');
		for (const [packageName, node] of this.nodes) {
			const deps = Array.from(node.dependencies);
			const dependents = Array.from(node.dependents);

			console.log(`\n📦 ${packageName}`);
			if (deps.length > 0) {
				console.log(`  ⬇️  Dependencies: ${deps.join(', ')}`);
			}
			if (dependents.length > 0) {
				console.log(`  ⬆️  Dependents: ${dependents.join(', ')}`);
			}
		}
	}
}
