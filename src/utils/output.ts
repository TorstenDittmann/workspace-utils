import pc from 'picocolors';

interface OutputSymbols {
	rocket: string;
	folder: string;
	package: string;
	checkmark: string;
	crossmark: string;
	warning: string;
	wrench: string;
	lightning: string;
	clock: string;
	target: string;
	magnifying: string;
	chart: string;
	fire: string;
	trophy: string;
	seedling: string;
	leaf: string;
	books: string;
	gear: string;
	construction: string;
	movie: string;
	lightbulb: string;
	sparkles: string;
	party: string;
	boom: string;
	building: string;
	arrow: string;
	dot: string;
}

// Always use ASCII for maximum compatibility
function supportsUnicode(): boolean {
	// Only use Unicode if explicitly requested
	if (process.env.WSU_UNICODE === '1' || process.env.WSU_UNICODE === 'true') {
		return true;
	}

	// Default to ASCII for all environments
	return false;
}

// Create symbol sets based on Unicode support
const UNICODE_SYMBOLS: OutputSymbols = {
	rocket: '🚀',
	folder: '📁',
	package: '📦',
	checkmark: '✅',
	crossmark: '❌',
	warning: '⚠️',
	wrench: '🔧',
	lightning: '🚀',
	clock: '⏱️',
	target: '🎯',
	magnifying: '🔍',
	chart: '📊',
	fire: '💥',
	trophy: '🏆',
	seedling: '🌱',
	leaf: '🍃',
	books: '📚',
	gear: '🔧',
	construction: '🏗️',
	movie: '🎬',
	lightbulb: '💡',
	sparkles: '✨',
	party: '🎉',
	boom: '💥',
	building: '🏢',
	arrow: '🔗',
	dot: '🔸',
};

const ASCII_SYMBOLS: OutputSymbols = {
	rocket: '>',
	folder: '[DIR]',
	package: '[PKG]',
	checkmark: '[OK]',
	crossmark: '[ERR]',
	warning: '[WARN]',
	wrench: '[TOOL]',
	lightning: '[FAST]',
	clock: '[TIME]',
	target: '[TARGET]',
	magnifying: '[FIND]',
	chart: '[CHART]',
	fire: '[BOOM]',
	trophy: '[WIN]',
	seedling: '[ROOT]',
	leaf: '[LEAF]',
	books: '[DOCS]',
	gear: '[GEAR]',
	construction: '[BUILD]',
	movie: '[START]',
	lightbulb: '[TIP]',
	sparkles: '[DONE]',
	party: '[SUCCESS]',
	boom: '[ERROR]',
	building: '[CORP]',
	arrow: '->',
	dot: '*',
};

// Select appropriate symbol set
const symbols: OutputSymbols = supportsUnicode() ? UNICODE_SYMBOLS : ASCII_SYMBOLS;

/**
 * Output utility class for consistent, terminal-compatible logging
 */
export class Output {
	private static readonly symbols = symbols;

	/**
	 * Log a message with appropriate formatting and symbols
	 */
	static log(
		message: string,
		symbol?: keyof OutputSymbols,
		color?: 'blue' | 'green' | 'red' | 'yellow' | 'dim'
	): void {
		const prefix = symbol ? `${this.symbols[symbol]} ` : '';
		const formattedMessage = `${prefix}${message}`;

		if (color) {
			console.log(pc[color](formattedMessage));
		} else {
			console.log(formattedMessage);
		}
	}

	/**
	 * Log an info message (blue with rocket)
	 */
	static info(message: string): void {
		this.log(message, 'rocket', 'blue');
	}

	/**
	 * Log a success message (green with checkmark)
	 */
	static success(message: string): void {
		this.log(message, 'checkmark', 'green');
	}

	/**
	 * Log an error message (red with crossmark)
	 */
	static error(message: string): void {
		this.log(message, 'crossmark', 'red');
	}

	/**
	 * Log a warning message (yellow with warning)
	 */
	static warning(message: string): void {
		this.log(message, 'warning', 'yellow');
	}

	/**
	 * Log a dim/muted message
	 */
	static dim(message: string, symbol?: keyof OutputSymbols): void {
		this.log(message, symbol, 'dim');
	}

	/**
	 * Log a build-related message
	 */
	static build(message: string): void {
		this.log(message, 'construction', 'blue');
	}

	/**
	 * Log a development-related message
	 */
	static dev(message: string): void {
		this.log(message, 'movie', 'blue');
	}

	/**
	 * Log a package-related message
	 */
	static package(message: string): void {
		this.log(message, 'package', 'blue');
	}

	/**
	 * Log a timing message
	 */
	static timing(message: string): void {
		this.log(message, 'clock', 'blue');
	}

	/**
	 * Log a target/summary message
	 */
	static summary(message: string): void {
		this.log(message, 'target', 'blue');
	}

	/**
	 * Log a celebration message
	 */
	static celebrate(message: string): void {
		this.log(message, 'party', 'green');
	}

	/**
	 * Log a tip message
	 */
	static tip(message: string): void {
		this.log(message, 'lightbulb', 'yellow');
	}

	/**
	 * Create a formatted list item
	 */
	static listItem(item: string, indent: number = 2): void {
		const spaces = ' '.repeat(indent);
		this.log(`${spaces}${item}`, 'dot', 'dim');
	}

	/**
	 * Create a separator line
	 */
	static separator(): void {
		const line = supportsUnicode()
			? '────────────────────────────────────────────────────────'
			: '--------------------------------------------------------';
		console.log(pc.dim(line));
	}

	/**
	 * Get a symbol without logging
	 */
	static getSymbol(symbol: keyof OutputSymbols): string {
		return this.symbols[symbol];
	}

	/**
	 * Format a package name with brackets
	 */
	static formatPackageName(name: string, color?: string): string {
		const formatted = `[${name}]`;
		return color ? pc[color as keyof typeof pc](formatted) : formatted;
	}

	/**
	 * Format duration in a human-readable way
	 */
	static formatDuration(ms: number): string {
		if (ms < 1000) {
			return `${ms}ms`;
		} else if (ms < 60000) {
			return `${(ms / 1000).toFixed(1)}s`;
		} else {
			const minutes = Math.floor(ms / 60000);
			const seconds = ((ms % 60000) / 1000).toFixed(0);
			return `${minutes}m ${seconds}s`;
		}
	}

	/**
	 * Log execution summary with consistent formatting
	 */
	static executionSummary(successful: number, failed: number, totalDuration: number): void {
		console.log(pc.bold(`\n${this.symbols.chart} Execution Summary:`));
		this.success(`Successful: ${successful}`);

		if (failed > 0) {
			this.error(`Failed: ${failed}`);
		}

		this.timing(`Total duration: ${this.formatDuration(totalDuration)}`);
	}

	/**
	 * Log build summary with consistent formatting
	 */
	static buildSummary(successful: number, failed: number, totalDuration: number): void {
		console.log(pc.bold(`\n${this.symbols.target} Build Summary:`));
		this.success(`Successfully built: ${successful} packages`);

		if (failed > 0) {
			this.error(`Failed to build: ${failed} packages`);
		}

		this.timing(`Total build time: ${this.formatDuration(totalDuration)}`);
	}

	/**
	 * Check if Unicode is supported in current environment
	 */
	static get supportsUnicode(): boolean {
		return supportsUnicode();
	}
}

// Re-export symbols for direct access if needed
export { symbols };
