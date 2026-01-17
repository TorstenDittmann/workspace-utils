# Commands Overview

workspace-utils provides four main commands designed to handle different aspects of monorepo workflow management. Each command is optimized for specific use cases while sharing common functionality like package filtering and concurrency control.

## Command Summary

| Command               | Purpose                                | Default Mode         | Use Case                       |
| --------------------- | -------------------------------------- | -------------------- | ------------------------------ |
| [`run`](./run.md)     | Execute scripts across packages        | **Parallel**         | Tests, linting, custom scripts |
| [`build`](./build.md) | Build packages respecting dependencies | **Dependency order** | Production builds, CI/CD       |
| [`dev`](./dev.md)     | Start development servers              | **Parallel**         | Local development              |
| [`clean`](./clean.md) | Remove node_modules directories        | **Sequential**       | Fresh installs, disk cleanup   |

## Quick Reference

### wsu run

```bash
wsu run <script> [options]
```

Execute any script across multiple packages in parallel (by default) or sequentially.

**Package.json setup:**

```json
{
	"scripts": {
		"test": "wsu run test",
		"lint": "wsu run lint --sequential",
		"typecheck": "wsu run typecheck --concurrency 8"
	}
}
```

**Usage:**

```bash
npm run test       # Run tests in parallel
npm run lint       # Run linting sequentially
npm run typecheck  # Custom concurrency
```

### wsu build

```bash
wsu build [options]
```

Build packages in dependency order using topological sorting. Packages are built in batches where each batch can run in parallel.

**Package.json setup:**

```json
{
	"scripts": {
		"build": "wsu build",
		"build:apps": "wsu build --filter 'apps/*'",
		"build:slow": "wsu build --concurrency 2"
	}
}
```

**Usage:**

```bash
npm run build       # Build all packages
npm run build:apps  # Build only apps
npm run build:slow  # Limit batch concurrency
```

### wsu dev

```bash
wsu dev [options]
```

Start development servers with live log streaming. Designed for long-running processes with real-time output.

**Package.json setup:**

```json
{
	"scripts": {
		"dev": "wsu dev",
		"dev:scope": "wsu dev --filter '@scope/*'",
		"dev:limited": "wsu dev --concurrency 3"
	}
}
```

**Usage:**

```bash
npm run dev         # Start all dev servers
npm run dev:scope   # Start scoped packages
npm run dev:limited # Limit concurrent servers
```

### wsu clean

```bash
wsu clean [options]
```

Remove `node_modules` directories from the workspace root and all packages.

**Package.json setup:**

```json
{
	"scripts": {
		"clean": "wsu clean",
		"clean:apps": "wsu clean --filter 'apps/*'",
		"reinstall": "wsu clean && npm install"
	}
}
```

**Usage:**

```bash
npm run clean       # Remove all node_modules
npm run clean:apps  # Clean only app packages
npm run reinstall   # Clean and reinstall
```

## Global Options

All commands support these common options:

### Filtering

- `--filter <pattern>` - Filter packages using glob patterns
- Examples: `"@scope/*"`, `"apps/*"`, `"*-utils"`, `"*frontend*"`

### Concurrency

- `--concurrency <number>` - Maximum concurrent processes (default: 4)
- Applies to parallel execution and batch processing

### Help

- `--help` - Show command-specific help and options

## Execution Modes

### Parallel Execution

**Used by:** `run` (default), `dev`
**Behavior:** All matching packages execute simultaneously
**Best for:** Tests, linting, development servers

```bash
npm run test  # with "test": "wsu run test" in package.json
# ✅ Runs tests in all packages at the same time
```

### Sequential Execution

**Used by:** `run` (with --sequential flag)
**Behavior:** Packages execute one after another
**Best for:** Resource-intensive tasks, ordered operations

```bash
npm run build:sequential  # with "build:sequential": "wsu run build --sequential"
# ✅ Runs builds one package at a time
```

### Dependency-Aware Execution

**Used by:** `build`
**Behavior:** Packages are grouped into batches based on dependencies
**Best for:** Building, publishing, dependency-critical operations

```bash
npm run build  # with "build": "wsu build" in package.json
# ✅ Builds dependencies first, then dependents
```

## Package Manager Detection

workspace-utils automatically detects your package manager:

| Package Manager | Detection Criteria                                                |
| --------------- | ----------------------------------------------------------------- |
| **Bun**         | `bun.lockb`, `bunfig.toml`, or bun-specific `package.json` fields |
| **pnpm**        | `pnpm-lock.yaml`, `pnpm-workspace.yaml`                           |
| **npm**         | `package-lock.json`, `.npmrc`                                     |

The detected package manager is used for all script execution (e.g., `bun run test`, `pnpm run test`, `npm run test`).

## Error Handling

### Exit Behavior

- **Single failure in parallel mode:** Other packages continue running
- **Single failure in sequential mode:** Execution stops immediately
- **Single failure in build mode:** Current batch fails, subsequent batches are skipped

### Exit Codes

- `0` - All packages executed successfully
- `1` - One or more packages failed
- `2` - Configuration or setup error

## Output Format

All commands provide consistent, color-coded output:

```
🚀 Starting operation...
📁 Workspace root: /path/to/workspace
📦 Found X packages
✅ Running "script" in Y packages
🔧 Package manager: detected-pm
⚡ Execution mode: parallel/sequential/dependency-order

[package-1] Starting: pm run script
[package-2] Starting: pm run script
[package-1] ✅ Completed in 1,234ms
[package-2] ❌ Failed with exit code 1

📊 Execution Summary:
✅ Successful: 1
❌ Failed: 1
⏱️  Total duration: 2,345ms
```

## Best Practices

### Choose the Right Command

- **`run`** for most script execution (tests, linting, utilities)
- **`build`** when package dependencies matter
- **`dev`** for long-running development processes
- **`clean`** to remove node_modules for fresh installs

### Use Filtering Effectively

```json
{
	"scripts": {
		"test:packages": "wsu run test --filter 'packages/*'",
		"dev:apps": "wsu dev --filter 'apps/*'",
		"build:company": "wsu build --filter '@company/*'"
	}
}
```

### Optimize Concurrency

```json
{
	"scripts": {
		"build:slow": "wsu run build --concurrency 2",
		"test:fast": "wsu run test --concurrency 8",
		"dev": "wsu dev --concurrency 4"
	}
}
```

## Next Steps

Dive deeper into each command:

- [**run command**](./run.md) - Detailed script execution options
- [**build command**](./build.md) - Dependency-aware building
- [**dev command**](./dev.md) - Development server management
- [**clean command**](./clean.md) - Remove node_modules directories
