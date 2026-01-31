/**
 * UI Components Library
 */

import { formatDate, slugify } from "@test/shared-utils";

export interface ButtonProps {
	label: string;
	onClick?: () => void;
	variant?: "primary" | "secondary";
}

export function Button({ label, onClick, variant = "primary" }: ButtonProps) {
	return {
		type: "button",
		label,
		className: `btn btn-${variant}`,
		onClick,
	};
}

export function formatTimestamp(date: Date): string {
	return `Timestamp: ${formatDate(date)}`;
}

export function createSlug(text: string): string {
	return slugify(text);
}
