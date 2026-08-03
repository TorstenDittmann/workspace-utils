import { randomUUID } from "crypto";

export type ExecutionEventType =
	| "workspace"
	| "selection"
	| "plan"
	| "task_start"
	| "task_stdout"
	| "task_stderr"
	| "task_retry"
	| "task_complete"
	| "task_blocked"
	| "cache_hit"
	| "cache_miss"
	| "artifact_restore"
	| "artifact_store"
	| "warning"
	| "summary"
	| "error";
export interface ExecutionEvent {
	schemaVersion: 1;
	timestamp: string;
	type: ExecutionEventType;
	invocationId: string;
	[key: string]: unknown;
}
export interface Reporter {
	emit(event: ExecutionEvent): void;
}

const invocationId = randomUUID();
let installed = false;
const rawWrite = process.stdout.write.bind(process.stdout);

export function emitEvent(type: ExecutionEventType, data: Record<string, unknown> = {}): void {
	const event: ExecutionEvent = {
		schemaVersion: 1,
		timestamp: new Date().toISOString(),
		type,
		invocationId,
		...data,
	};
	rawWrite(`${JSON.stringify(event)}\n`);
}

export function installJsonReporter(): void {
	if (installed) return;
	installed = true;
	process.env.WSU_OUTPUT = "json";
	console.log = (...args: unknown[]) =>
		emitEvent("warning", { message: args.map(String).join(" ") });
	console.error = (...args: unknown[]) =>
		emitEvent("error", { message: args.map(String).join(" ") });
}

export function isJsonReporter(): boolean {
	return process.env.WSU_OUTPUT === "json";
}
