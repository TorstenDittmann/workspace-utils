# build Command

The `build` command builds packages in dependency order, ensuring that dependencies are built before their dependents.

## Recommended Usage

Add to your `package.json` scripts:

```json
{
	"scripts": {
		"build": "wsu build",
		"build:apps": "wsu build --filter 'apps/*'",
		"build:slow": "wsu build --concurrency 2"
	}
}
```

Then run:

```bash
npm run build      # Build all packages in dependency order
npm run build:apps # Build only apps
npm run build:slow # Build with limited concurrency
```

## Direct Usage (if needed)

```bash
wsu build [options]
```

## How it Works

1. **Analyzes dependencies** - Reads `package.json` files to understand package relationships
2. **Checks cache** - Skips packages that haven't changed since last successful build
3. **Creates build batches** - Groups packages that can be built in parallel
4. **Executes in order** - Runs builds batch by batch, respecting dependencies
5. **Updates cache** - Stores successful build metadata for future runs

## Options

| Option                   | Description                          | Default           |
| ------------------------ | ------------------------------------ | ----------------- |
| `--filter <pattern>`     | Filter packages by glob pattern      | All packages      |
| `--concurrency <number>` | Max concurrent builds per batch      | `4`               |
| `--no-skip-unchanged`    | Build all packages (disable caching) | (caching enabled) |

## Build Caching

By default, the build command uses intelligent caching to skip unchanged packages:

### How Caching Works

- **Content hashing** - Tracks changes to source files and `package.json`
- **Dependency tracking** - Rebuilds packages when their dependencies change
- **Automatic invalidation** - Cache is invalidated when source files or dependencies change
- **Git-aware** - Only tracks files not ignored by git

### Cache Location

Cache is stored in `.wsu/` directory (automatically added to `.gitignore`):

```
.wsu/
├── manifest.json
└── packages/
    └── <package-name>/
        ├── cache.json
        └── files.json
```

### Disabling Cache

To build all packages regardless of cache:

```bash
wsu build --no-skip-unchanged
```

### Managing Cache

Use the `cache` command to manage cached builds:

```bash
# View cache status
wsu cache

# Clear all cached builds
wsu cache clear
```

To reuse build metadata and artifacts on fresh CI runners, persist `.wsu/`. See
[GitHub Actions caching](./cache.md#github-actions) for a complete workflow.

## Examples

### Basic Usage

Add scripts to your `package.json`:

```json
{
	"scripts": {
		"build": "wsu build",
		"build:apps": "wsu build --filter 'apps/*'",
		"build:limited": "wsu build --concurrency 2",
		"build:all": "wsu build --no-skip-unchanged"
	}
}
```

Then run:

```bash
npm run build         # Build all packages (uses cache)
npm run build:apps    # Build only apps
npm run build:limited # Build with limited concurrency
npm run build:all     # Force build all packages
```

### With Caching

First build (all packages):

```
🏗️  Building packages in dependency order...
📊 Building dependency graph...
✅ Build order determined: 3 batches

📋 Build Plan:
  Batch 1: @company/utils
  Batch 2: @company/ui-components, @company/api-client
  Batch 3: apps/web-app

🔧 Package manager: pnpm
⚡ Batch concurrency: 4

🔄 Running batch 1/3 (1 packages)
[@company/utils] ✅ Completed in 2,000ms

🔄 Running batch 2/3 (2 packages)
[@company/ui-components] ✅ Completed in 3,000ms
[@company/api-client] ✅ Completed in 2,500ms

🔄 Running batch 3/3 (1 packages)
[apps/web-app] ✅ Completed in 4,000ms

🎉 All packages built successfully!
```

Second build (unchanged packages skipped):

```
🏗️  Building packages in dependency order...
📊 Build dependency graph...
✅ 3 packages unchanged (cached) - skipping build
  - @company/utils
  - @company/ui-components
  - @company/api-client

📊 Building 1 packages:
  - apps/web-app

🔄 Running batch 1/1 (1 packages)
[apps/web-app] ✅ Completed in 4,000ms

🎉 All packages built successfully!
```

## When to Use

- **Production builds** - When dependency order matters
- **CI/CD pipelines** - Reliable, predictable builds
- **Publishing** - Ensure dependencies are built first
- **Development** - Fast incremental builds with caching

## Error Handling

- If a package fails, the current batch stops
- Subsequent batches are skipped
- Cache is only updated for successful builds
- Exit code is non-zero if any builds fail

## See Also

- [cache command](./cache.md) - Manage build cache
- [run command](./run.md) - Run arbitrary scripts
