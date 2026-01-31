/**
 * Shared utility functions
 */

export function formatDate(date: Date): string {
	return date.toISOString();
}

export function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '');
}

export function generateId(): string {
	return Math.random().toString(36).substring(2, 15);
}
