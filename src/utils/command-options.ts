import type { PackageInfo, WorkspaceInfo } from "../core/workspace.ts";
import { selectPackages } from "../core/selection.ts";
import { findAffectedPackages } from "../core/affected.ts";

export interface CommonCommandOptions {
	filter?: string[] | string;
	affected?: boolean;
	since?: string;
	dryRun?: boolean;
	concurrency?: string;
	retry?: string;
	timeout?: string;
	failFast?: boolean;
	continueOnError?: boolean;
}

export function parsePositiveInteger(
	value: string | undefined,
	name: string,
	fallback: number,
	allowZero = false,
): number {
	if (value === undefined) return fallback;
	const number = Number(value);
	if (!Number.isInteger(number) || (allowZero ? number < 0 : number <= 0))
		throw new Error(`${name} must be ${allowZero ? "a non-negative" : "a positive"} integer`);
	return number;
}

export function parseDuration(value?: string): number | undefined {
	if (!value) return undefined;
	const match = value.match(/^(\d+)(ms|s|m)?$/);
	if (!match || Number(match[1]) <= 0)
		throw new Error("timeout must be a positive duration such as 500ms, 30s, or 5m");
	return Number(match[1]) * (match[2] === "m" ? 60000 : match[2] === "s" ? 1000 : 1);
}

export function resolveTargets(
	workspace: WorkspaceInfo,
	options: CommonCommandOptions,
): PackageInfo[] {
	if (options.failFast && options.continueOnError)
		throw new Error("--fail-fast and --continue-on-error are mutually exclusive");
	const filters = typeof options.filter === "string" ? [options.filter] : options.filter || [];
	let packages = selectPackages(workspace, filters).packages;
	if (options.affected || options.since) {
		const affected = findAffectedPackages(workspace, { since: options.since });
		packages = packages.filter((pkg) => affected.has(pkg.name));
	}
	return packages;
}
