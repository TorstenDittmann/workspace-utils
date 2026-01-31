# Troubleshooting

This page covers common issues you might encounter when using workspace-utils and how to resolve them.

## Installation Issues

### Package Not Found

If you get errors about workspace-utils not being found:

```bash
# Check if it's installed
npm ls workspace-utils

# If not installed, add it as a dev dependency
npm install --save-dev workspace-utils

# Verify it's in your package.json
cat package.json | grep workspace-utils
```

### Permission Errors

If you encounter permission errors:

```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Version Conflicts

If you have conflicting versions:

```bash
# Check installed version
npm ls workspace-utils

# Update to latest version
npm install --save-dev workspace-utils@latest
```

## Workspace Detection Issues

### No Workspace Found

If workspace-utils can't detect your workspace:

**Error:** `No workspace configuration found`

**Solution:** Ensure you have one of these files in your root:

- `pnpm-workspace.yaml` (for pnpm)
- `package.json` with `workspaces` field (for npm/Bun)

**Example for pnpm:**

```yaml
# pnpm-workspace.yaml
packages:
    - "packages/*"
    - "apps/*"
```

**Example for npm/Bun:**

```json
{
	"workspaces": ["packages/*", "apps/*"]
}
```

### Mixed Package Managers

If you have multiple lock files:

**Error:** `Multiple package managers detected`

**Solution:** Remove conflicting lock files:

```bash
# Keep only one lock file type
rm package-lock.json yarn.lock  # Keep pnpm-lock.yaml
# OR
rm pnpm-lock.yaml yarn.lock      # Keep package-lock.json
# OR
rm pnpm-lock.yaml package-lock.json  # Keep yarn.lock
```

### Wrong Package Manager Detected

If the wrong package manager is detected:

**Check detection logic:**

1. Bun: `bun.lockb` exists
2. pnpm: `pnpm-lock.yaml` or `pnpm-workspace.yaml` exists
3. npm: `package-lock.json` exists

**Solution:** Remove unwanted lock files or use the correct package manager for your setup.

## Script Execution Issues

### No Packages Found with Script

If you get `No packages found with the "script-name" script`:

**Check which packages have the script:**

```bash
# Manually check package.json files
find . -name "package.json" -not -path "./node_modules/*" -exec grep -l "script-name" {} \;
```

**Solution:** Add the script to package.json files where needed:

```json
{
	"scripts": {
		"test": "jest",
		"build": "tsc",
		"dev": "vite dev"
	}
}
```

### Scripts Failing

If individual package scripts fail:

**Debug a specific package:**

```bash
# Navigate to the failing package
cd packages/failing-package

# Run the script directly
npm run script-name
```

**Common issues:**

- Missing dependencies: `npm install`
- TypeScript errors: Check `tsconfig.json`
- Build output conflicts: `npm run clean` first

### Permission Denied Errors

If you get permission errors running scripts:

```bash
# On macOS/Linux, ensure scripts are executable
find . -name "*.sh" -exec chmod +x {} \;

# Check if using the right Node.js version
node --version
npm --version
```

## Build Issues

### Dependency Cycle Detected

If you get circular dependency errors:

**Error:** `Dependency cycle detected: package-a -> package-b -> package-a`

**Solution:** Review and break circular dependencies:

1. Check `dependencies` and `devDependencies` in package.json files
2. Consider extracting shared code to a separate package
3. Use `peerDependencies` where appropriate

**Debug dependency graph:**

```bash
# Create a simple script to visualize dependencies
# deps.js
const fs = require('fs');
const path = require('path');

// Find all package.json files and show dependencies
// ... (custom script to analyze dependencies)
```

### Build Order Issues

If builds fail due to missing dependencies:

**Use `wsu build` instead of `wsu run build`:**

```json
{
	"scripts": {
		"build": "wsu build", // ✅ Dependency-aware
		"build:parallel": "wsu run build" // ❌ May fail
	}
}
```

### Memory Issues During Build

If builds run out of memory:

```json
{
	"scripts": {
		"build": "wsu build --concurrency 1",
		"build:heavy": "NODE_OPTIONS='--max-old-space-size=4096' wsu build --concurrency 2"
	}
}
```

## Development Server Issues

### Ports Already in Use

If dev servers can't start due to port conflicts:

**Check what's using ports:**

```bash
# On macOS/Linux
lsof -i :3000
lsof -i :4000

# On Windows
netstat -ano | findstr :3000
```

**Solution:** Kill conflicting processes or change ports in package.json:

```json
{
	"scripts": {
		"dev": "vite dev --port 3001"
	}
}
```

### Dev Servers Not Starting

If development servers fail to start:

**Check individual packages:**

```bash
cd packages/problematic-package
npm run dev
```

**Common issues:**

- Missing dev dependencies
- Incorrect script configuration
- Environment variable issues

### Hot Reload Not Working

If hot reload isn't working across packages:

**Ensure proper file watching:**

- Check if files are being watched correctly
- Verify symlinks are set up properly
- Check if your bundler supports monorepo setups

## Performance Issues

### Slow Execution

If commands are running slowly:

**Reduce concurrency:**

```json
{
	"scripts": {
		"test:slow": "wsu run test --concurrency 2",
		"build:slow": "wsu build --concurrency 1"
	}
}
```

**Use filtering to run fewer packages:**

```json
{
	"scripts": {
		"test:changed": "wsu run test --filter 'packages/changed-*'",
		"dev:minimal": "wsu dev --filter 'apps/main-app'"
	}
}
```

### High Memory Usage

If workspace-utils uses too much memory:

```bash
# Monitor memory usage
top -p $(pgrep -f workspace-utils)

# Reduce concurrency
# Add to package.json scripts
"build:low-mem": "wsu build --concurrency 1"
```

## Character Encoding Issues

### Garbled Characters in Output

If you see strange characters instead of emojis:

**Examples of issues:**

```
â Completed in 54428ms    # Should be ✅ or [OK]
â±ï¸  Total build time    # Should be ⏱️ or [TIME]
â ï¸ Warning message      # Should be ⚠️ or [WARN]
```

**Quick Solutions:**

**Option 1: Force ASCII mode (recommended)**

```json
{
	"scripts": {
		"build": "wsu build --ascii",
		"test": "wsu run test --ascii",
		"dev": "wsu dev --ascii"
	}
}
```

**Option 2: Set environment variable**

```bash
# In your shell
export WSU_ASCII=1

# Or in package.json
"build": "WSU_ASCII=1 wsu build"
```

**Option 3: Terminal fixes**
If you prefer Unicode characters:

1. Update your terminal to a modern version
2. Set proper environment variables:
    ```bash
    export LANG=en_US.UTF-8
    export LC_ALL=en_US.UTF-8
    ```
3. Force Unicode mode:
    ```bash
    export WSU_UNICODE=1
    ```

**Debug what's being detected:**

```bash
# Check your environment
node -e "console.log(process.platform, process.env.TERM, process.env.TERM_PROGRAM)"
```

## Filtering Issues

### Filter Not Matching Packages

If `--filter` doesn't match expected packages:

**Debug filtering:**

```bash
# List all packages first
find . -name "package.json" -not -path "./node_modules/*" | head -10

# Check package names in workspace
```

**Common filter patterns:**

```json
{
	"scripts": {
		"test:scope": "wsu run test --filter '@company/*'",
		"test:apps": "wsu run test --filter 'apps/*'",
		"test:utils": "wsu run test --filter '*-utils'",
		"test:frontend": "wsu run test --filter '*frontend*'"
	}
}
```

### Case Sensitivity

Filters are case-sensitive. Use exact casing:

```json
{
	"scripts": {
		"test:React": "wsu run test --filter '*React*'", // Correct
		"test:react": "wsu run test --filter '*react*'" // Different results
	}
}
```

## Environment Issues

### Node.js Version

workspace-utils requires Node.js 18+:

```bash
# Check version
node --version

# If too old, update Node.js
# Use nvm, fnm, or download from nodejs.org
```

### Environment Variables

If environment variables aren't being passed:

**In your package scripts:**

```json
{
	"scripts": {
		"test:env": "NODE_ENV=test wsu run test",
		"build:prod": "NODE_ENV=production wsu build"
	}
}
```

**For complex environments, use .env files in individual packages.**

## Getting Help

### Enable Debug Mode

If you need more information about what's happening:

```json
{
	"scripts": {
		"debug:build": "DEBUG=workspace-utils wsu build",
		"debug:test": "DEBUG=* wsu run test"
	}
}
```

### Verbose Output

For more detailed logging:

```bash
# Run with verbose npm logging
npm run build --verbose

# Check the exact commands being run
```

### Common Command Issues

**Command not found:**

```bash
# Make sure workspace-utils is installed
npm ls workspace-utils

# Try running directly
npx wsu --version
```

**Script syntax errors:**

```json
{
	"scripts": {
		// ❌ Wrong quotes
		"test": "wsu run test",

		// ✅ Correct quotes
		"test": "wsu run test"
	}
}
```

## Reporting Issues

If you encounter a bug or need help:

1. **Check this troubleshooting guide first**
2. **Search existing issues** in the repository
3. **Provide minimal reproduction** when reporting:
    - Your `package.json` scripts
    - Workspace structure
    - Full error message
    - Node.js and package manager versions

**Useful info to include:**

```bash
# System information
node --version
npm --version  # or pnpm --version, bun --version
npx wsu --version

# Workspace structure
tree -I node_modules -L 3
```

## Quick Fixes Checklist

When things go wrong, try these in order:

1. **Check installation:** `npm ls workspace-utils`
2. **Verify workspace setup:** Ensure workspace config files exist
3. **Clean and reinstall:** `rm -rf node_modules && npm install`
4. **Check package.json syntax:** Ensure scripts are properly quoted
5. **Test individual packages:** `cd package && npm run script-name`
6. **Reduce concurrency:** Add `--concurrency 1` to scripts
7. **Check Node.js version:** `node --version` (should be 18+)
8. **Clear caches:** `npm cache clean --force`

Most issues are resolved by steps 1-4!
