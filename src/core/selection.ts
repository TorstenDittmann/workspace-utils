import { relative, sep } from "path";
import type { PackageInfo, WorkspaceInfo } from "./workspace.ts";

export interface PackageSelector {
	raw: string;
	exclude: boolean;
	dependencies: boolean;
	dependents: boolean;
	pattern: string;
}
export interface SelectionReason {
	packageName: string;
	reasons: string[];
}
export interface SelectionResult {
	packages: PackageInfo[];
	reasons: SelectionReason[];
}

function allDeps(pkg: PackageInfo): string[] {
	return [
		...new Set([
			...pkg.dependencies,
			...pkg.devDependencies,
			...(pkg.optionalDependencies || []),
			...(pkg.peerDependencies || []),
		]),
	];
}

export function parseSelector(raw: string): PackageSelector {
	if (!raw || raw === "!" || raw === "..." || raw === "!..." || raw.includes("......"))
		throw new Error(`Malformed package selector: ${raw}`);
	let value = raw;
	const exclude = value.startsWith("!");
	if (exclude) value = value.slice(1);
	const dependents = value.startsWith("...");
	const dependencies = value.endsWith("...");
	if (dependents) value = value.slice(3);
	if (dependencies) value = value.slice(0, -3);
	if (!value) throw new Error(`Malformed package selector: ${raw}`);
	return { raw, exclude, dependencies, dependents, pattern: value };
}

function globRegex(pattern: string): RegExp {
	return new RegExp(
		`^${pattern
			.replace(/[.+^${}()|\\]/g, "\\$&")
			.replace(/\*/g, ".*")
			.replace(/\?/g, ".")}$`,
	);
}

export function selectPackages(
	workspace: WorkspaceInfo,
	rawSelectors: string[] = [],
): SelectionResult {
	const selectors = rawSelectors.map(parseSelector);
	const children = workspace.packages;
	const candidates = workspace.rootPackage ? [...children, workspace.rootPackage] : children;
	const byName = new Map(candidates.map((p) => [p.name, p]));
	const root = workspace.rootPackage;
	const dependents = new Map<string, string[]>();
	for (const pkg of candidates)
		for (const dep of allDeps(pkg))
			dependents.set(dep, [...(dependents.get(dep) || []), pkg.name]);

	const match = (selector: PackageSelector): Set<string> => {
		const found = new Set<string>();
		if (selector.pattern === "root" && root) found.add(root.name);
		else if (selector.pattern.startsWith("./")) {
			const pattern = selector.pattern.slice(2);
			const regex = globRegex(pattern);
			for (const pkg of children)
				if (regex.test(relative(workspace.root, pkg.path).split(sep).join("/")))
					found.add(pkg.name);
		} else {
			const regex = globRegex(selector.pattern);
			for (const pkg of children) if (regex.test(pkg.name)) found.add(pkg.name);
		}
		const expand = (direction: "deps" | "dependents") => {
			const queue = [...found];
			while (queue.length) {
				const name = queue.shift()!;
				const next =
					direction === "deps" ? allDeps(byName.get(name)!) : dependents.get(name) || [];
				for (const item of next)
					if (byName.has(item) && !found.has(item)) {
						found.add(item);
						queue.push(item);
					}
			}
		};
		if (selector.dependencies) expand("deps");
		if (selector.dependents) expand("dependents");
		return found;
	};

	let selected = new Set<string>();
	const positive = selectors.filter((s) => !s.exclude);
	if (selectors.length === 0 || positive.length === 0)
		children.forEach((p) => selected.add(p.name));
	for (const selector of positive) for (const name of match(selector)) selected.add(name);
	for (const selector of selectors.filter((s) => s.exclude))
		for (const name of match(selector)) selected.delete(name);
	if (selectors.length && selected.size === 0)
		throw new Error("No packages matched the supplied filters");
	return {
		packages: candidates.filter((p) => selected.has(p.name)),
		reasons: [...selected].map((packageName) => ({ packageName, reasons: ["filter"] })),
	};
}

export function getAllDependencies(pkg: PackageInfo): string[] {
	return allDeps(pkg);
}
