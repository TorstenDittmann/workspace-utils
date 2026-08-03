import { relative } from "path";
import { WorkspaceParser } from "../core/workspace.ts";
import { selectPackages, getAllDependencies } from "../core/selection.ts";
import { findAffectedPackages } from "../core/affected.ts";
import { Output } from "../utils/output.ts";

interface GraphOptions {
	filter?: string[];
	affected?: boolean;
	since?: string;
	format?: string;
	dryRun?: boolean;
}

export async function graphCommand(options: GraphOptions): Promise<void> {
	try {
		const workspace = await new WorkspaceParser().parseWorkspace();
		let selected = selectPackages(workspace, options.filter || []).packages;
		const affected =
			options.affected || options.since
				? findAffectedPackages(workspace, { since: options.since })
				: undefined;
		if (affected) selected = selected.filter((p) => affected.has(p.name));
		const names = new Set(selected.map((p) => p.name));
		const nodes = selected.map((p) => ({
			name: p.isRoot ? "root" : p.name,
			packageName: p.name,
			path: relative(workspace.root, p.path) || ".",
			scripts: Object.keys(p.scripts),
			selected: true,
			affected: affected?.has(p.name) || false,
			root: Boolean(p.isRoot),
		}));
		const edges = selected.flatMap((p) =>
			getAllDependencies(p)
				.filter((d) => names.has(d))
				.map((dependency) => ({ from: p.name, to: dependency })),
		);
		const format = options.format || "text";
		if (format === "json") console.log(JSON.stringify({ nodes, edges }, null, 2));
		else if (format === "dot") {
			console.log("digraph workspace {");
			for (const node of nodes) console.log(`  ${JSON.stringify(node.packageName)};`);
			for (const edge of edges)
				console.log(`  ${JSON.stringify(edge.from)} -> ${JSON.stringify(edge.to)};`);
			console.log("}");
		} else if (format === "text") {
			Output.info("Workspace dependency graph");
			for (const node of nodes)
				Output.log(
					`${node.packageName}${node.root ? " (root)" : ""} -> ${
						edges
							.filter((e) => e.from === node.packageName)
							.map((e) => e.to)
							.join(", ") || "(none)"
					}`,
				);
		} else throw new Error(`Unknown graph format: ${format}`);
	} catch (error) {
		Output.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	}
}
