# run Command

The `run` command executes scripts across multiple packages in your workspace, with parallel execution by default.

## Recommended Usage

Add to your `package.json` scripts:

```json
{
	"scripts": {
		"test": "wsu run test",
		"lint": "wsu run lint",
		"typecheck": "wsu run typecheck"
	}
}
```

Then run:

```bash
npm run test     # Run tests across packages
npm run lint     # Run linting across packages
npm run typecheck # Run type checking across packages
```

## Direct Usage (if needed)

```bash
wsu run <script> [options]
```

## Arguments

- `<script>` - The npm script name to execute (e.g., `test`, `lint`, `build`)

## Options

| Option                   | Description                          | Default      |
| ------------------------ | ------------------------------------ | ------------ |
| `--filter <pattern>`     | Filter packages by glob pattern      | All packages |
| `--concurrency <number>` | Max concurrent processes             | `4`          |
| `--sequential`           | Run sequentially instead of parallel | `false`      |

## Examples

### Basic Usage

Add scripts to your `package.json`:

```json
{
	"scripts": {
		"test": "wsu run test",
		"test:sequential": "wsu run test --sequential",
		"lint": "wsu run lint --concurrency 8"
	}
}
```

Then run:

```bash
npm run test            # Run tests in parallel (default)
npm run test:sequential # Run tests sequentially
npm run lint            # Run linting with custom concurrency
```

### Package Filtering

Add filtered scripts to your `package.json`:

```json
{
	"scripts": {
		"test:company": "wsu run test --filter '@company/*'",
		"dev:apps": "wsu run dev --filter 'apps/*'",
		"build:backend": "wsu run build --filter '*backend*'"
	}
}
```

Then run:

```bash
npm run test:company   # Run tests for scoped packages
npm run dev:apps       # Run dev scripts for apps only
npm run build:backend  # Run builds for backend packages
```

### Example Output

```
🚀 Running script "test" across packages...

📦 Found 3 packages
✅ Running "test" in 3 packages:
  • @company/utils
  • @company/ui-components
  • apps/web-app

🔧 Package manager: pnpm
⚡ Execution mode: parallel (concurrency: 4)

[@company/utils] Starting: pnpm run test
[@company/ui-components] Starting: pnpm run test
[apps/web-app] Starting: pnpm run test
[@company/utils] ✅ Completed in 1,234ms
[@company/ui-components] ✅ Completed in 2,456ms
[apps/web-app] ✅ Completed in 3,789ms

📊 Execution Summary:
✅ Successful: 3
⏱️  Total duration: 3,789ms
```

## Execution Modes

### Parallel (Default)

- Runs all packages simultaneously
- Faster for I/O bound tasks like tests and linting
- Other packages continue if one fails

### Sequential

- Runs packages one at a time
- Stops on first failure
- Better for resource-intensive tasks

## When to Use

- **Tests** - Parallel execution for fast feedback
- **Linting** - High concurrency for quick checks
- **Type checking** - Parallel across packages
- **Custom scripts** - Any script that exists in package.json

## Package.json Integration

Add common patterns to your root `package.json`:

```json
{
	"scripts": {
		"test": "wsu run test",
		"test:watch": "wsu run test:watch",
		"lint": "wsu run lint --concurrency 8",
		"lint:fix": "wsu run lint:fix",
		"typecheck": "wsu run typecheck",
		"clean": "wsu run clean --sequential"
	}
}
```
