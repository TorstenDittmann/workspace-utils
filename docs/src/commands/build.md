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
2. **Creates build batches** - Groups packages that can be built in parallel
3. **Executes in order** - Runs builds batch by batch, respecting dependencies

## Options

| Option                   | Description                     | Default      |
| ------------------------ | ------------------------------- | ------------ |
| `--filter <pattern>`     | Filter packages by glob pattern | All packages |
| `--concurrency <number>` | Max concurrent builds per batch | `4`          |

## Examples

### Basic Usage

Add scripts to your `package.json`:

```json
{
	"scripts": {
		"build": "wsu build",
		"build:apps": "wsu build --filter 'apps/*'",
		"build:limited": "wsu build --concurrency 2"
	}
}
```

Then run:

```bash
npm run build         # Build all packages in dependency order
npm run build:apps    # Build only apps
npm run build:limited # Build with limited concurrency
```

### Example Output

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

## When to Use

- **Production builds** - When dependency order matters
- **CI/CD pipelines** - Reliable, predictable builds
- **Publishing** - Ensure dependencies are built first
- **Clean builds** - Start from scratch with proper ordering

## Error Handling

- If a package fails, the current batch stops
- Subsequent batches are skipped
- Exit code is non-zero if any builds fail
