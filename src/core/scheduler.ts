import {
	ProcessRunner,
	type ProcessResult,
	type ProcessOptions,
	type LogOptions,
} from "./process-runner.ts";
import { DependencyGraph } from "./dependency-graph.ts";
import { emitEvent, isJsonReporter } from "./reporter.ts";

export interface TaskCommand {
	command: string;
	args: string[];
	options: ProcessOptions;
	logOptions: LogOptions;
}
export type TaskState = "pending" | "running" | "success" | "failed" | "blocked" | "cancelled";
export interface TaskNode {
	packageName: string;
	taskName: string;
	dependencies: string[];
	state: TaskState;
}
export interface ExecutionPlan {
	tasks: TaskNode[];
	batches: string[][];
	concurrency: number;
	failurePolicy: FailurePolicy;
}
export interface FailurePolicy {
	failFast?: boolean;
	continueOnError?: boolean;
}
export interface ScheduledResult {
	results: ProcessResult[];
	blocked: string[];
	cancelled: string[];
}

export async function runTopological(
	commands: TaskCommand[],
	graph: DependencyGraph,
	concurrency: number,
	policy: FailurePolicy = {},
): Promise<ScheduledResult> {
	const byName = new Map(commands.map((c) => [c.logOptions.prefix, c]));
	const pending = new Set(byName.keys());
	const states = new Map<string, "success" | "failed" | "blocked">();
	const results: ProcessResult[] = [];
	const blocked: string[] = [];
	const cancelled: string[] = [];
	graph.getBuildBatches(); // validates cycles before execution
	while (pending.size) {
		let progressed = false;
		for (const name of Array.from(pending)) {
			const deps = graph.getDependencies(name).filter((d) => byName.has(d));
			if (
				deps.some((d) => states.get(d) === "failed" || states.get(d) === "blocked") &&
				!policy.continueOnError
			) {
				states.set(name, "blocked");
				pending.delete(name);
				blocked.push(name);
				if (isJsonReporter())
					emitEvent("task_blocked", { packageName: name, reason: "dependency_failed" });
				progressed = true;
			}
		}
		const ready = [...pending]
			.filter((name) =>
				graph
					.getDependencies(name)
					.filter((d) => byName.has(d))
					.every((d) => states.has(d)),
			)
			.map((n) => byName.get(n)!);
		if (!ready.length) {
			if (!progressed) throw new Error("Unable to schedule tasks");
			continue;
		}
		const batchResults = await ProcessRunner.runParallel(ready, concurrency, policy.failFast);
		for (const result of batchResults) {
			results.push(result);
			pending.delete(result.packageName);
			states.set(result.packageName, result.success ? "success" : "failed");
		}
		if (policy.failFast && batchResults.some((r) => !r.success)) {
			cancelled.push(...pending);
			if (isJsonReporter())
				for (const packageName of pending)
					emitEvent("task_blocked", { packageName, reason: "fail_fast_cancelled" });
			await ProcessRunner.terminateAll();
			break;
		}
	}
	return { results, blocked, cancelled };
}
