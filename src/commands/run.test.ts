import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { runCommand } from './run.ts';
import { spyOn } from 'bun:test';

describe('runCommand', () => {
	const testDir = join(process.cwd(), 'test-temp-run');

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
		process.chdir(process.cwd().replace('/test-temp-run', ''));

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

			// Create test packages
			mkdirSync(join(testDir, 'packages', 'pkg1'), { recursive: true });
			writeFileSync(
				join(testDir, 'packages', 'pkg1', 'package.json'),
				JSON.stringify({
					name: '@test/pkg1',
					version: '1.0.0',
					scripts: {
						test: 'echo "Testing pkg1"',
						build: 'echo "Building pkg1"',
						lint: 'echo "Linting pkg1"',
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
						test: 'echo "Testing pkg2"',
						build: 'echo "Building pkg2"',
					},
				})
			);
		});

		it('should run test script in parallel by default', async () => {
			const consoleSpy = spyOn(console, 'log');
			const processExitSpy = spyOn(process, 'exit').mockImplementation(() => {
				throw new Error('process.exit called');
			});

			const options = {};

			try {
				await runCommand('test', options);
			} catch {
				// Expected to throw due to process.exit mock
			}

			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('🔧 Package manager: bun'));
			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining('⚡ Execution mode: parallel (concurrency: 4)')
			);

			consoleSpy.mockRestore();
			processExitSpy.mockRestore();
		});

		it('should run script sequentially when --sequential flag is used', async () => {
			const consoleSpy = spyOn(console, 'log');
			const processExitSpy = spyOn(process, 'exit').mockImplementation(() => {
				throw new Error('process.exit called');
			});

			const options = { sequential: true };

			try {
				await runCommand('test', options);
			} catch {
				// Expected to throw due to process.exit mock
			}

			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining('⚡ Execution mode: sequential')
			);

			consoleSpy.mockRestore();
			processExitSpy.mockRestore();
		});

		it('should filter packages when filter option is provided', async () => {
			const consoleSpy = spyOn(console, 'log');
			const processExitSpy = spyOn(process, 'exit').mockImplementation(() => {
				throw new Error('process.exit called');
			});

			const options = { filter: '*pkg1*' };

			try {
				await runCommand('test', options);
			} catch {
				// Expected to throw due to process.exit mock
			}

			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining('🔍 Filtered to 1 packages matching "*pkg1*"')
			);
			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining('✅ Running "test" in 1 packages:')
			);

			consoleSpy.mockRestore();
			processExitSpy.mockRestore();
		});

		it('should handle packages without the specified script', async () => {
			const consoleSpy = spyOn(console, 'log');
			const processExitSpy = spyOn(process, 'exit').mockImplementation(() => {
				throw new Error('process.exit called');
			});

			const options = {};

			try {
				await runCommand('lint', options);
			} catch {
				// Expected to throw due to process.exit mock
			}

			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining('⚠️  The following packages don\'t have the "lint" script:')
			);
			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('• @test/pkg2'));

			consoleSpy.mockRestore();
			processExitSpy.mockRestore();
		});

		it('should exit with error when no packages have the script', async () => {
			const consoleSpy = spyOn(console, 'log');
			const processExitSpy = spyOn(process, 'exit').mockImplementation(() => {
				throw new Error('process.exit called');
			});

			const options = {};

			try {
				await runCommand('nonexistent', options);
			} catch (error) {
				expect((error as Error).message).toBe('process.exit called');
			}

			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining('❌ No packages found with the "nonexistent" script.')
			);
			expect(processExitSpy).toHaveBeenCalledWith(1);

			consoleSpy.mockRestore();
			processExitSpy.mockRestore();
		});

		it('should use custom concurrency when specified', async () => {
			const consoleSpy = spyOn(console, 'log');
			const processExitSpy = spyOn(process, 'exit').mockImplementation(() => {
				throw new Error('process.exit called');
			});

			const options = { concurrency: '8' };

			try {
				await runCommand('test', options);
			} catch {
				// Expected to throw due to process.exit mock
			}

			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining('⚡ Execution mode: parallel (concurrency: 8)')
			);

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
						test: 'echo "Testing utils with pnpm"',
					},
				})
			);
		});

		it('should detect pnpm as package manager', async () => {
			const consoleSpy = spyOn(console, 'log');
			const processExitSpy = spyOn(process, 'exit').mockImplementation(() => {
				throw new Error('process.exit called');
			});

			const options = {};

			try {
				await runCommand('test', options);
			} catch {
				// Expected to throw due to process.exit mock
			}

			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('🔧 Package manager: pnpm'));

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
						test: 'echo "Testing core with npm"',
					},
				})
			);
		});

		it('should detect npm as package manager', async () => {
			const consoleSpy = spyOn(console, 'log');
			const processExitSpy = spyOn(process, 'exit').mockImplementation(() => {
				throw new Error('process.exit called');
			});

			const options = {};

			try {
				await runCommand('test', options);
			} catch {
				// Expected to throw due to process.exit mock
			}

			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('🔧 Package manager: npm'));

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

			const consoleSpy = spyOn(console, 'error');
			const processExitSpy = spyOn(process, 'exit').mockImplementation(() => {
				throw new Error('process.exit called');
			});

			const options = {};

			try {
				await runCommand('test', options);
			} catch (error) {
				expect((error as Error).message).toBe('process.exit called');
			}

			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('💥 Error:'));
			expect(processExitSpy).toHaveBeenCalledWith(1);

			consoleSpy.mockRestore();
			processExitSpy.mockRestore();
		});
	});
});
