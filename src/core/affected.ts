import { execFileSync } from "child_process";
import { relative, sep } from "path";
import type { PackageInfo, WorkspaceInfo } from "./workspace.ts";
import { getAllDependencies } from "./selection.ts";

export interface AffectedOptions {
	since?: string;
}

function git(root: string, args: string[]): string {
	return execFileSync("git", args, {
		cwd: root,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "ignore"],
	}).trim();
}

export function findAffectedPackages(
	workspace: WorkspaceInfo,
	options: AffectedOptions = {},
): Set<string> {
	let base = options.since;
	if (!base) {
		const candidates: string[] = [];
		try {
			candidates.push(
				git(workspace.root, [
					"symbolic-ref",
					"--quiet",
					"--short",
					"refs/remotes/origin/HEAD",
				]),
			);
		} catch {}
		candidates.push("origin/main", "origin/master");
		for (const candidate of candidates) {
			try {
				base = git(workspace.root, ["merge-base", "HEAD", candidate]);
				if (base) break;
			} catch {}
		}
		if (!base) throw new Error("Unable to determine a Git merge base; pass --since <ref>");
	} else {
		try {
			base = git(workspace.root, ["merge-base", "HEAD", base]);
		} catch {
			throw new Error(`Unable to resolve Git ref: ${options.since}`);
		}
	}
	const files = new Set<string>();
	for (const args of [
		["diff", "--name-only", `${base}..HEAD`],
		["diff", "--name-only"],
		["diff", "--cached", "--name-only"],
		["ls-files", "--others", "--exclude-standard"],
	]) {
		try {
			for (const file of git(workspace.root, args).split("\n").filter(Boolean))
				files.add(file);
		} catch {}
	}
	const global =
		/^(package\.json|(?:bun\.lockb?|pnpm-lock\.yaml|pnpm-workspace\.yaml|package-lock\.json|yarn\.lock|\.yarnrc\.yml|\.npmrc|bunfig\.toml)|tsconfig[^/]*\.json|[^/]+\.config\.[^/]+)$/;
	if ([...files].some((f) => global.test(f)))
		return new Set([
			...workspace.packages.map((p) => p.name),
			...(workspace.rootPackage ? [workspace.rootPackage.name] : []),
		]);
	const affected = new Set<string>();
	for (const file of files) {
		let best: PackageInfo | undefined;
		for (const pkg of workspace.packages) {
			const rel = relative(workspace.root, pkg.path).split(sep).join("/");
			if (
				(file === rel || file.startsWith(`${rel}/`)) &&
				(!best || pkg.path.length > best.path.length)
			)
				best = pkg;
		}
		if (best) affected.add(best.name);
	}
	const reverse = new Map<string, string[]>();
	for (const pkg of workspace.packages)
		for (const dep of getAllDependencies(pkg))
			reverse.set(dep, [...(reverse.get(dep) || []), pkg.name]);
	const queue = [...affected];
	while (queue.length)
		for (const dep of reverse.get(queue.shift()!) || [])
			if (!affected.has(dep)) {
				affected.add(dep);
				queue.push(dep);
			}
	return affected;
}
