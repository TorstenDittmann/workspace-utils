import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { BunPackageManager } from './bun.ts';

describe('BunPackageManager', () => {
	const testDir = join(process.cwd(), 'test-temp-bun');
	let bunManager: BunPackageManager;

	beforeEach(() => {
		// Clean up test directory if it exists
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
		mkdirSync(testDir, { recursive: true });
		bunManager = new BunPackageManager();
	});

	afterEach(() => {
		// Clean up test directory
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	describe('name', () => {
		it('should return "bun"', () => {
			expect(bunManager.name).toBe('bun');
		});
	});

	describe('isActive', () => {
		it('should return true when bun.lockb exists', () => {
			writeFileSync(join(testDir, 'bun.lockb'), '');

			expect(bunManager.isActive(testDir)).toBe(true);
		});

		it('should return true when bunfig.toml exists', () => {
			writeFileSync(
				join(testDir, 'bunfig.toml'),
				'[install]\nregistry = "https://registry.npmjs.org/"'
			);

			expect(bunManager.isActive(testDir)).toBe(true);
		});

		it('should return true when package.json has bun field', () => {
			writeFileSync(
				join(testDir, 'package.json'),
				JSON.stringify({
					name: 'test',
					bun: {
						install: {
							dev: true,
						},
					},
				})
			);

			expect(bunManager.isActive(testDir)).toBe(true);
		});

		it('should return true when package.json has trustedDependencies field', () => {
			writeFileSync(
				join(testDir, 'package.json'),
				JSON.stringify({
					name: 'test',
					trustedDependencies: ['some-package'],
				})
			);

			expect(bunManager.isActive(testDir)).toBe(true);
		});

		it('should return false when no bun indicators exist', () => {
			writeFileSync(
				join(testDir, 'package.json'),
				JSON.stringify({
					name: 'test',
					dependencies: {},
				})
			);

			expect(bunManager.isActive(testDir)).toBe(false);
		});

		it('should return false when package.json is invalid', () => {
			writeFileSync(join(testDir, 'package.json'), 'invalid json');

			expect(bunManager.isActive(testDir)).toBe(false);
		});

		it('should return false when no files exist', () => {
			expect(bunManager.isActive(testDir)).toBe(false);
		});
	});

	describe('getRunCommand', () => {
		it('should return correct bun run command', () => {
			const result = bunManager.getRunCommand('test');

			expect(result).toEqual({
				command: 'bun',
				args: ['run', 'test'],
			});
		});

		it('should work with different script names', () => {
			expect(bunManager.getRunCommand('build')).toEqual({
				command: 'bun',
				args: ['run', 'build'],
			});

			expect(bunManager.getRunCommand('dev')).toEqual({
				command: 'bun',
				args: ['run', 'dev'],
			});
		});
	});

	describe('parseWorkspaceConfig', () => {
		it('should parse workspaces array from package.json', () => {
			writeFileSync(
				join(testDir, 'package.json'),
				JSON.stringify({
					name: 'test-workspace',
					workspaces: ['packages/*', 'apps/*'],
				})
			);

			const result = bunManager.parseWorkspaceConfig(testDir);

			expect(result.packages).toEqual(['packages/*', 'apps/*']);
		});

		it('should parse workspaces object from package.json', () => {
			writeFileSync(
				join(testDir, 'package.json'),
				JSON.stringify({
					name: 'test-workspace',
					workspaces: {
						packages: ['packages/*', 'tools/*'],
					},
				})
			);

			const result = bunManager.parseWorkspaceConfig(testDir);

			expect(result.packages).toEqual(['packages/*', 'tools/*']);
		});

		it('should throw error when package.json does not exist', () => {
			expect(() => bunManager.parseWorkspaceConfig(testDir)).toThrow(
				'No package.json found in workspace root'
			);
		});

		it('should throw error when no workspaces field exists', () => {
			writeFileSync(
				join(testDir, 'package.json'),
				JSON.stringify({
					name: 'test-workspace',
					dependencies: {},
				})
			);

			expect(() => bunManager.parseWorkspaceConfig(testDir)).toThrow(
				'No workspaces configuration found in package.json'
			);
		});

		it('should throw error when workspaces is not an array or valid object', () => {
			writeFileSync(
				join(testDir, 'package.json'),
				JSON.stringify({
					name: 'test-workspace',
					workspaces: 'invalid',
				})
			);

			expect(() => bunManager.parseWorkspaceConfig(testDir)).toThrow(
				'Invalid workspaces configuration: must be an array or object with packages array'
			);
		});

		it('should throw error when workspaces object lacks packages field', () => {
			writeFileSync(
				join(testDir, 'package.json'),
				JSON.stringify({
					name: 'test-workspace',
					workspaces: {
						notPackages: ['packages/*'],
					},
				})
			);

			expect(() => bunManager.parseWorkspaceConfig(testDir)).toThrow(
				'Invalid workspaces configuration: must be an array or object with packages array'
			);
		});
	});

	describe('getLockFileName', () => {
		it('should return "bun.lock"', () => {
			expect(bunManager.getLockFileName()).toBe('bun.lock');
		});
	});
});
