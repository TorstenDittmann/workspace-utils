import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { readFileSync, existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { PnpmPackageManager } from './pnpm.ts';

describe('PnpmPackageManager', () => {
	const testDir = join(process.cwd(), 'test-temp-pnpm');
	let pnpmManager: PnpmPackageManager;

	beforeEach(() => {
		// Clean up test directory if it exists
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
		mkdirSync(testDir, { recursive: true });
		pnpmManager = new PnpmPackageManager();
	});

	afterEach(() => {
		// Clean up test directory
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	describe('name', () => {
		it('should return "pnpm"', () => {
			expect(pnpmManager.name).toBe('pnpm');
		});
	});

	describe('isActive', () => {
		it('should return true when pnpm-lock.yaml exists', () => {
			writeFileSync(join(testDir, 'pnpm-lock.yaml'), 'lockfileVersion: 6.0');
			expect(pnpmManager.isActive(testDir)).toBe(true);
		});

		it('should return true when pnpm-workspace.yaml exists', () => {
			writeFileSync(join(testDir, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*');
			expect(pnpmManager.isActive(testDir)).toBe(true);
		});

		it('should return true when .pnpmfile.cjs exists', () => {
			writeFileSync(join(testDir, '.pnpmfile.cjs'), 'module.exports = {};');
			expect(pnpmManager.isActive(testDir)).toBe(true);
		});

		it('should return true when package.json has pnpm field', () => {
			writeFileSync(
				join(testDir, 'package.json'),
				JSON.stringify({
					name: 'test',
					pnpm: {
						overrides: {},
					},
				})
			);
			expect(pnpmManager.isActive(testDir)).toBe(true);
		});

		it('should return true when package.json has publishConfig with registry', () => {
			writeFileSync(
				join(testDir, 'package.json'),
				JSON.stringify({
					name: 'test',
					publishConfig: {
						registry: 'https://registry.npmjs.org/',
					},
				})
			);
			expect(pnpmManager.isActive(testDir)).toBe(true);
		});

		it('should return false when no pnpm indicators exist', () => {
			writeFileSync(
				join(testDir, 'package.json'),
				JSON.stringify({
					name: 'test',
					dependencies: {},
				})
			);
			expect(pnpmManager.isActive(testDir)).toBe(false);
		});

		it('should return false when package.json is invalid', () => {
			writeFileSync(join(testDir, 'package.json'), 'invalid json');
			expect(pnpmManager.isActive(testDir)).toBe(false);
		});

		it('should return false when no files exist', () => {
			expect(pnpmManager.isActive(testDir)).toBe(false);
		});
	});

	describe('getRunCommand', () => {
		it('should return correct pnpm run command', () => {
			const result = pnpmManager.getRunCommand('test');
			expect(result).toEqual({
				command: 'pnpm',
				args: ['run', 'test'],
			});
		});

		it('should work with different script names', () => {
			expect(pnpmManager.getRunCommand('build')).toEqual({
				command: 'pnpm',
				args: ['run', 'build'],
			});

			expect(pnpmManager.getRunCommand('dev')).toEqual({
				command: 'pnpm',
				args: ['run', 'dev'],
			});
		});
	});

	describe('parseWorkspaceConfig', () => {
		it('should parse pnpm-workspace.yaml when it exists', () => {
			writeFileSync(join(testDir, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n  - apps/*');

			const result = pnpmManager.parseWorkspaceConfig(testDir);
			expect(result.packages).toEqual(['packages/*', 'apps/*']);
		});

		it('should throw error when pnpm-workspace.yaml has invalid packages', () => {
			writeFileSync(join(testDir, 'pnpm-workspace.yaml'), 'packages: invalid');

			expect(() => pnpmManager.parseWorkspaceConfig(testDir)).toThrow(
				'Invalid pnpm-workspace.yaml: packages must be an array'
			);
		});

		it('should fallback to package.json workspaces when pnpm-workspace.yaml does not exist', () => {
			writeFileSync(
				join(testDir, 'package.json'),
				JSON.stringify({
					name: 'test-workspace',
					workspaces: ['packages/*', 'apps/*'],
				})
			);

			const result = pnpmManager.parseWorkspaceConfig(testDir);
			expect(result.packages).toEqual(['packages/*', 'apps/*']);
		});

		it('should throw error when no pnpm-workspace.yaml or package.json exists', () => {
			expect(() => pnpmManager.parseWorkspaceConfig(testDir)).toThrow(
				'No pnpm-workspace.yaml or package.json found in workspace root'
			);
		});

		it('should throw error when no workspaces configuration exists', () => {
			writeFileSync(
				join(testDir, 'package.json'),
				JSON.stringify({
					name: 'test-workspace',
					dependencies: {},
				})
			);

			expect(() => pnpmManager.parseWorkspaceConfig(testDir)).toThrow(
				'No pnpm-workspace.yaml found and no workspaces configuration in package.json'
			);
		});

		it('should parse workspaces array from package.json', () => {
			writeFileSync(
				join(testDir, 'package.json'),
				JSON.stringify({
					name: 'test-workspace',
					workspaces: ['packages/*'],
				})
			);

			const result = pnpmManager.parseWorkspaceConfig(testDir);
			expect(result.packages).toEqual(['packages/*']);
		});

		it('should parse workspaces object from package.json', () => {
			writeFileSync(
				join(testDir, 'package.json'),
				JSON.stringify({
					name: 'test-workspace',
					workspaces: {
						packages: ['packages/*'],
					},
				})
			);

			const result = pnpmManager.parseWorkspaceConfig(testDir);
			expect(result.packages).toEqual(['packages/*']);
		});

		it('should throw error when workspaces is not an array or valid object', () => {
			writeFileSync(
				join(testDir, 'package.json'),
				JSON.stringify({
					name: 'test-workspace',
					workspaces: 'invalid',
				})
			);

			expect(() => pnpmManager.parseWorkspaceConfig(testDir)).toThrow(
				'Invalid workspaces configuration: must be an array or object with packages array'
			);
		});
	});

	describe('getLockFileName', () => {
		it('should return "pnpm-lock.yaml"', () => {
			expect(pnpmManager.getLockFileName()).toBe('pnpm-lock.yaml');
		});
	});
});
