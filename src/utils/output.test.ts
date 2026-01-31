import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Output, symbols } from "./output.ts";

describe("Output", () => {
	describe("basic logging", () => {
		it("should log a message", () => {
			const consoleSpy = spyOn(console, "log");
			Output.log("Test message");
			expect(consoleSpy).toHaveBeenCalledWith("Test message");
			consoleSpy.mockRestore();
		});

		it("should log with symbol", () => {
			const consoleSpy = spyOn(console, "log");
			Output.log("Test message", "rocket");
			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Test message"));
			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining(symbols.rocket));
			consoleSpy.mockRestore();
		});

		it("should log with color", () => {
			const consoleSpy = spyOn(console, "log");
			Output.log("Test message", "checkmark", "green");
			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});
	});

	describe("convenience methods", () => {
		it("should log info message", () => {
			const consoleSpy = spyOn(console, "log");
			Output.info("Info message");
			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});

		it("should log success message", () => {
			const consoleSpy = spyOn(console, "log");
			Output.success("Success message");
			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});

		it("should log error message", () => {
			const consoleSpy = spyOn(console, "log");
			Output.error("Error message");
			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});

		it("should log warning message", () => {
			const consoleSpy = spyOn(console, "log");
			Output.warning("Warning message");
			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});

		it("should log build message", () => {
			const consoleSpy = spyOn(console, "log");
			Output.build("Build message");
			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});

		it("should log dev message", () => {
			const consoleSpy = spyOn(console, "log");
			Output.dev("Dev message");
			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});

		it("should log package message", () => {
			const consoleSpy = spyOn(console, "log");
			Output.package("Package message");
			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});

		it("should log timing message", () => {
			const consoleSpy = spyOn(console, "log");
			Output.timing("Timing message");
			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});

		it("should log summary message", () => {
			const consoleSpy = spyOn(console, "log");
			Output.summary("Summary message");
			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});

		it("should log celebration message", () => {
			const consoleSpy = spyOn(console, "log");
			Output.celebrate("Celebrate message");
			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});

		it("should log tip message", () => {
			const consoleSpy = spyOn(console, "log");
			Output.tip("Tip message");
			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});

		it("should log dim message", () => {
			const consoleSpy = spyOn(console, "log");
			Output.dim("Dim message");
			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});

		it("should log dim message with symbol", () => {
			const consoleSpy = spyOn(console, "log");
			Output.dim("Dim message", "folder");
			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});
	});

	describe("utility methods", () => {
		it("should print separator line", () => {
			const consoleSpy = spyOn(console, "log");
			Output.separator();
			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});

		it("should format list item", () => {
			const consoleSpy = spyOn(console, "log");
			Output.listItem("List item");
			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});

		it("should format list item with custom indent", () => {
			const consoleSpy = spyOn(console, "log");
			Output.listItem("List item", 4);
			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});

		it("should return symbol without logging", () => {
			const symbol = Output.getSymbol("rocket");
			expect(symbol).toBe(symbols.rocket);
		});

		it("should format package name", () => {
			const formatted = Output.formatPackageName("test-package");
			expect(formatted).toBe("[test-package]");
		});

		it("should format package name with color", () => {
			const formatted = Output.formatPackageName("test-package", "blue");
			expect(formatted).toContain("test-package");
		});
	});

	describe("formatDuration", () => {
		it("should format milliseconds", () => {
			expect(Output.formatDuration(500)).toBe("500ms");
			expect(Output.formatDuration(999)).toBe("999ms");
		});

		it("should format seconds", () => {
			expect(Output.formatDuration(1000)).toBe("1.0s");
			expect(Output.formatDuration(1500)).toBe("1.5s");
			expect(Output.formatDuration(59000)).toBe("59.0s");
		});

		it("should format minutes and seconds", () => {
			expect(Output.formatDuration(60000)).toBe("1m 0s");
			expect(Output.formatDuration(90000)).toBe("1m 30s");
			expect(Output.formatDuration(125000)).toBe("2m 5s");
		});
	});

	describe("executionSummary", () => {
		it("should print execution summary with no failures", () => {
			const consoleSpy = spyOn(console, "log");
			Output.executionSummary(5, 0, 1000);
			expect(consoleSpy).toHaveBeenCalledTimes(3); // header, success, timing
			consoleSpy.mockRestore();
		});

		it("should print execution summary with failures", () => {
			const consoleSpy = spyOn(console, "log");
			Output.executionSummary(3, 2, 1000);
			expect(consoleSpy).toHaveBeenCalledTimes(4); // header, success, error, timing
			consoleSpy.mockRestore();
		});
	});

	describe("buildSummary", () => {
		it("should print build summary with no failures", () => {
			const consoleSpy = spyOn(console, "log");
			Output.buildSummary(5, 0, 1000);
			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});

		it("should print build summary with failures", () => {
			const consoleSpy = spyOn(console, "log");
			Output.buildSummary(3, 2, 1000);
			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});
	});

	describe("Unicode support", () => {
		it("should indicate Unicode support", () => {
			const supportsUnicode = Output.supportsUnicode;
			expect(typeof supportsUnicode).toBe("boolean");
		});
	});
});

import { spyOn } from "bun:test";
