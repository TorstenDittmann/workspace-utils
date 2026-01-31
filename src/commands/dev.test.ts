import { describe, it, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { devCommand } from './dev.ts';

describe('devCommand', () => {
	const testDir = join(process.cwd(), 'test-temp-dev');

	beforeEach(() => {
		// Clean up test directory if it exists
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
		mkdirSync(testDir, { recursive: true });

		// Change to test directory
		process.chdir(testDir);
	});

	afterEach(() => {
		// Change back to original directory
		process.chdir(process.cwd().replace('/test-temp-dev', ''));

		// Clean up test directory
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	describe('Bun workspace', () => {
		beforeEach(() => {
			// Create Bun workspace
			writeFileSync(join(testDir, 'bun.lockb'), '');
			writeFileSync(
				join(testDir, 'package.json'),
				JSON.stringify({
					name: 'test-workspace',
					workspaces: ['packages/*'],
				})
			);

			// Create test packages with dev script
			mkdirSync(join(testDir, 'packages', 'pkg1'), { recursive: true });
			writeFileSync(
				join(testDir, 'packages', 'pkg1', 'package.json'),
				JSON.stringify({
					name: '@test/pkg1',
					version: '1.0.0',
					scripts: {
						dev: 'echo "Starting dev server for pkg1"',
					},
				})
			);

			mkdirSync(join(testDir, 'packages', 'pkg2'), { recursive: true });
			writeFileSync(
				join(testDir, 'packages', 'pkg2', 'package.json'),
				JSON.stringify({
					name: '@test/pkg2',
					version: '1.0.0',
					scripts: {
						dev: 'echo "Starting dev server for pkg2"',
					},
				})
			);
		});

		it('should find packages with dev script', async () => {
			const consoleSpy = spyOn(console, 'log');
			const processExitSpy = spyOn(process, 'exit').mockImplementation(() => {
				throw new Error('process.exit called');
			});

			try {
				await devCommand({});
			} catch {
				// Expected
			}

			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining('[OK] Starting dev servers for 2 packages')
			);

			consoleSpy.mockRestore();
			processExitSpy.mockRestore();
		});

		it('should filter packages when filter option is provided', async () => {
			const consoleSpy = spyOn(console, 'log');
			const processExitSpy = spyOn(process, 'exit').mockImplementation(() => {
				throw new Error('process.exit called');
			});

			try {
				await devCommand({ filter: '*pkg1*' });
			} catch {
				// Expected
			}

			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining('[FIND] Filtered to 1 packages matching "*pkg1*"')
			);

			consoleSpy.mockRestore();
			processExitSpy.mockRestore();
		});

		it('should handle packages without dev script', async () => {
			// Add a package without dev script
			mkdirSync(join(testDir, 'packages', 'pkg3'), { recursive: true });
			writeFileSync(
				join(testDir, 'packages', 'pkg3', 'package.json'),
				JSON.stringify({
					name: '@test/pkg3',
					version: '1.0.0',
					scripts: {
						build: 'echo "Building pkg3"',
					},
				})
			);

			const consoleSpy = spyOn(console, 'log');
			const processExitSpy = spyOn(process, 'exit').mockImplementation(() => {
				throw new Error('process.exit called');
			});

			try {
				await devCommand({});
			} catch {
				// Expected
			}

			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining('[WARN] The following packages don\'t have a "dev" script:')
			);
			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('@test/pkg3'));

			consoleSpy.mockRestore();
			processExitSpy.mockRestore();
		});

		it('should exit when no packages have dev script', async () => {
			// Remove packages and create ones without dev script
			rmSync(join(testDir, 'packages'), { recursive: true, force: true });
			mkdirSync(join(testDir, 'packages', 'pkg-no-dev'), { recursive: true });
			writeFileSync(
				join(testDir, 'packages', 'pkg-no-dev', 'package.json'),
				JSON.stringify({
					name: '@test/no-dev',
					version: '1.0.0',
					scripts: {
						build: 'echo "Building"',
					},
				})
			);

			const consoleSpy = spyOn(console, 'log');
			const processExitSpy = spyOn(process, 'exit').mockImplementation(() => {
				throw new Error('process.exit called');
			});

			try {
				await devCommand({});
			} catch (error) {
				expect((error as Error).message).toBe('process.exit called');
			}

			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining('[ERR] No packages found with a "dev" script')
			);
			expect(processExitSpy).toHaveBeenCalledWith(1);

			consoleSpy.mockRestore();
			processExitSpy.mockRestore();
		});
	});

	describe('pnpm workspace', () => {
		beforeEach(() => {
			// Create pnpm workspace
			writeFileSync(join(testDir, 'pnpm-lock.yaml'), 'lockfileVersion: 6.0');
			writeFileSync(join(testDir, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*');

			// Create test package
			mkdirSync(join(testDir, 'packages', 'utils'), { recursive: true });
			writeFileSync(
				join(testDir, 'packages', 'utils', 'package.json'),
				JSON.stringify({
					name: '@test/utils',
					version: '1.0.0',
					scripts: {
						dev: 'echo "Starting dev server for utils"',
					},
				})
			);
		});

		it('should detect pnpm and run dev', async () => {
			const consoleSpy = spyOn(console, 'log');
			const processExitSpy = spyOn(process, 'exit').mockImplementation(() => {
				throw new Error('process.exit called');
			});

			try {
				await devCommand({});
			} catch {
				// Expected
			}

			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining('[TOOL] Package manager: pnpm')
			);

			consoleSpy.mockRestore();
			processExitSpy.mockRestore();
		});
	});

	describe('npm workspace', () => {
		beforeEach(() => {
			// Create npm workspace
			writeFileSync(join(testDir, 'package-lock.json'), '{}');
			writeFileSync(
				join(testDir, 'package.json'),
				JSON.stringify({
					name: 'test-workspace',
					workspaces: ['libs/*'],
				})
			);

			// Create test package
			mkdirSync(join(testDir, 'libs', 'core'), { recursive: true });
			writeFileSync(
				join(testDir, 'libs', 'core', 'package.json'),
				JSON.stringify({
					name: 'core',
					version: '1.0.0',
					scripts: {
						dev: 'echo "Starting dev server for core"',
					},
				})
			);
		});

		it('should detect npm and run dev', async () => {
			const consoleSpy = spyOn(console, 'log');
			const processExitSpy = spyOn(process, 'exit').mockImplementation(() => {
				throw new Error('process.exit called');
			});

			try {
				await devCommand({});
			} catch {
				// Expected
			}

			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining('[TOOL] Package manager: npm')
			);

			consoleSpy.mockRestore();
			processExitSpy.mockRestore();
		});
	});

	describe('error handling', () => {
		it('should handle workspace parsing errors gracefully', async () => {
			// Create invalid workspace (no workspaces config)
			writeFileSync(
				join(testDir, 'package.json'),
				JSON.stringify({
					name: 'invalid-workspace',
				})
			);

			const consoleSpy = spyOn(console, 'log');
			const processExitSpy = spyOn(process, 'exit').mockImplementation(() => {
				throw new Error('process.exit called');
			});

			try {
				await devCommand({});
			} catch (error) {
				expect((error as Error).message).toBe('process.exit called');
			}

			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[BOOM] Dev command error:'));
			expect(processExitSpy).toHaveBeenCalledWith(1);

			consoleSpy.mockRestore();
			processExitSpy.mockRestore();
		});
	});
});
