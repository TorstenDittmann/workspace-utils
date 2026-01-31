/**
 * Web Application Entry Point
 */

import { Button, formatTimestamp } from '@test/ui-components';
import { generateId } from '@test/shared-utils';

export interface AppConfig {
	name: string;
	version: string;
	environment: 'development' | 'production';
}

export class WebApp {
	private config: AppConfig;
	private id: string;

	constructor(config: AppConfig) {
		this.config = config;
		this.id = generateId();
	}

	start(): void {
		console.log(`Starting ${this.config.name} v${this.config.version}`);
		console.log(`App ID: ${this.id}`);
		console.log(`Environment: ${this.config.environment}`);
		console.log(`Timestamp: ${formatTimestamp(new Date())}`);
	}

	renderButton(label: string): ReturnType<typeof Button> {
		return Button({ label, variant: 'primary' });
	}
}

export function createApp(config: AppConfig): WebApp {
	return new WebApp(config);
}
