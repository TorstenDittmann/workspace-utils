# clean Command

The `clean` command removes `node_modules` directories across all packages in your workspace.

## Recommended Usage

Add to your `package.json` scripts:

```json
{
	"scripts": {
		"clean": "wsu clean",
		"clean:apps": "wsu clean --filter 'apps/*'"
	}
}
```

Then run:

```bash
npm run clean       # Remove all node_modules
npm run clean:apps  # Clean only app packages
```

## Direct Usage (if needed)

```bash
wsu clean [options]
```

## How it Works

1. **Parses workspace** to find all packages
2. **Removes root node_modules** (unless filtering)
3. **Removes node_modules** from each package directory
4. **Reports summary** with count of cleaned directories

## Options

| Option               | Description                     | Default      |
| -------------------- | ------------------------------- | ------------ |
| `--filter <pattern>` | Filter packages by glob pattern | All packages |

## Examples

### Basic Usage

Add scripts to your `package.json`:

```json
{
	"scripts": {
		"clean": "wsu clean",
		"clean:libs": "wsu clean --filter 'packages/*'",
		"clean:apps": "wsu clean --filter 'apps/*'"
	}
}
```

Then run:

```bash
npm run clean       # Clean everything
npm run clean:libs  # Clean only library packages
npm run clean:apps  # Clean only application packages
```

### Example Output

```
> Cleaning node_modules across packages...

[DIR] Workspace root: /path/to/workspace
[PKG] Found 5 packages

[BOOM] Removing /path/to/workspace/node_modules
[BOOM] Removing @company/ui-components/node_modules
[BOOM] Removing @company/utils/node_modules
[BOOM] Removing apps/web-app/node_modules
[BOOM] Removing apps/mobile-app/node_modules

[CHART] Execution Summary:
[OK] Successful: 5
[TIME] Total duration: 1.2s
[OK] Cleaned: 5 directories
[FIND] Skipped: 0 (no node_modules found)
```

## When to Use

- **Fresh install** - Start with a clean slate before `npm install`
- **Dependency issues** - Fix corrupted or conflicting dependencies
- **Disk space** - Free up space by removing unused dependencies
- **CI/CD** - Ensure clean builds in continuous integration
- **Switching branches** - Clean up after switching between branches with different dependencies

## Tips

- Use filtering to clean specific packages without affecting others
- When filtering, the root `node_modules` is not removed
- Run your package manager's install command after cleaning
- Combine with other commands in scripts:

```json
{
	"scripts": {
		"reinstall": "wsu clean && npm install",
		"fresh-build": "wsu clean && npm install && wsu build"
	}
}
```
