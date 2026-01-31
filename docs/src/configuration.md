# Configuration

workspace-utils is designed to work with **zero configuration** by default. It automatically detects your workspace setup and package manager, then runs with sensible defaults. However, you can customize behavior through command-line options.

## No Configuration Files

Unlike many other tools, workspace-utils **does not use configuration files**. All behavior is controlled through:

1. **Command-line flags** (primary method)
2. **Workspace structure** (automatic detection)
3. **Package manager detection** (automatic)

This approach keeps things simple and ensures your commands are explicit and reproducible.

## Command-Line Configuration

All configuration is done through command-line options. Here are the most commonly used options:

### Global Options

Available for all commands:

| Option                   | Description                     | Default      | Example               |
| ------------------------ | ------------------------------- | ------------ | --------------------- |
| `--filter <pattern>`     | Filter packages by glob pattern | All packages | `--filter "@scope/*"` |
| `--concurrency <number>` | Max concurrent processes        | `4`          | `--concurrency 8`     |
| `--help`                 | Show command help               | -            | `--help`              |

### Command-Specific Options

#### run command

```bash
workspace-utils run <script> [options]
```

| Option         | Description                          | Default |
| -------------- | ------------------------------------ | ------- |
| `--sequential` | Run sequentially instead of parallel | `false` |

#### build command

```bash
workspace-utils build [options]
```

| Option             | Description                      | Default |
| ------------------ | -------------------------------- | ------- |
| `--skip-unchanged` | Skip unchanged packages (future) | `false` |

#### dev command

```bash
workspace-utils dev [options]
```

No additional options - uses global options only.

## Environment Variables

workspace-utils respects these environment variables:

| Variable      | Description          | Default       |
| ------------- | -------------------- | ------------- |
| `NODE_ENV`    | Node environment     | `development` |
| `FORCE_COLOR` | Force colored output | `1` (enabled) |

## Package Manager Detection

workspace-utils automatically detects your package manager based on lock files and configuration:

### Detection Priority

1. **Bun** - if `bun.lockb` exists or bun-specific fields in `package.json`
2. **pnpm** - if `pnpm-lock.yaml` or `pnpm-workspace.yaml` exists
3. **npm** - if `package-lock.json` exists

### Workspace Configuration

The tool reads workspace configuration from:

| Package Manager | Configuration Source                     |
| --------------- | ---------------------------------------- |
| **Bun**         | `package.json` → `workspaces` field      |
| **pnpm**        | `pnpm-workspace.yaml` → `packages` field |
| **npm**         | `package.json` → `workspaces` field      |

## Workspace Structure Requirements

### Supported Workspace Formats

#### Bun Workspaces

```json
{
	"name": "my-monorepo",
	"workspaces": ["packages/*", "apps/*"]
}
```

#### pnpm Workspaces

```yaml
# pnpm-workspace.yaml
packages:
    - "packages/*"
    - "apps/*"
    - "!**/test/**"
```

#### npm Workspaces

```json
{
	"name": "my-monorepo",
	"workspaces": {
		"packages": ["packages/*", "apps/*"]
	}
}
```

## Common Configuration Patterns

### Package.json Scripts

Add workspace-utils commands to your root `package.json`:

```json
{
	"scripts": {
		"test": "workspace-utils run test",
		"test:sequential": "workspace-utils run test --sequential",
		"build": "workspace-utils build",
		"build:apps": "workspace-utils build --filter 'apps/*'",
		"dev": "workspace-utils dev",
		"lint": "workspace-utils run lint --concurrency 8",
		"typecheck": "workspace-utils run typecheck --parallel"
	}
}
```

### CI/CD Configuration

Optimize for continuous integration:

```bash
# Lower concurrency for CI resources
workspace-utils run test --concurrency 2

# Sequential builds for predictable resource usage
workspace-utils build --concurrency 1

# Parallel linting for speed
workspace-utils run lint --concurrency 4
```

### Development Workflow

Optimize for local development:

```bash
# Start all dev servers
workspace-utils dev

# Run tests with higher concurrency on powerful dev machines
workspace-utils run test --concurrency 8

# Filter to work on specific features
workspace-utils dev --filter "*frontend*"
```

## Performance Tuning

### Concurrency Guidelines

| Task Type       | Recommended Concurrency | Reasoning                        |
| --------------- | ----------------------- | -------------------------------- |
| **Tests**       | 4-8                     | Usually I/O bound, can run many  |
| **Builds**      | 2-4                     | CPU intensive, fewer parallel    |
| **Linting**     | 6-12                    | Fast, lightweight processes      |
| **Dev servers** | 2-6                     | Resource intensive, long-running |

### System Resources

Consider your system when setting concurrency:

```bash
# For 4-core machines
workspace-utils run build --concurrency 2

# For 8+ core machines
workspace-utils run test --concurrency 8

# For CI with limited resources
workspace-utils run lint --concurrency 2
```

## Filtering Patterns

### Glob Patterns

workspace-utils supports standard glob patterns:

| Pattern      | Matches                        | Example                             |
| ------------ | ------------------------------ | ----------------------------------- |
| `@scope/*`   | All packages in scope          | `@company/utils`, `@company/ui`     |
| `apps/*`     | All packages in apps directory | `apps/web`, `apps/mobile`           |
| `*-utils`    | Packages ending with -utils    | `date-utils`, `string-utils`        |
| `*frontend*` | Packages containing frontend   | `my-frontend-app`, `frontend-utils` |

### Multiple Filters

Use multiple invocations for complex filtering:

```bash
# Run tests on backend packages only
workspace-utils run test --filter "@company/backend-*"

# Build all apps and shared libraries
workspace-utils build --filter "apps/*"
workspace-utils build --filter "@company/shared-*"
```

## Error Handling Configuration

### Exit Behavior

workspace-utils has different exit behaviors by command:

| Command            | Failure Behavior                              |
| ------------------ | --------------------------------------------- |
| `run` (parallel)   | Continue other packages, exit 1 if any failed |
| `run` (sequential) | Stop on first failure, exit with that code    |
| `build`            | Stop current batch on failure, skip remaining |
| `dev`              | Stop all servers on any failure               |

### Error Codes

| Exit Code | Meaning                                    |
| --------- | ------------------------------------------ |
| `0`       | All operations successful                  |
| `1`       | One or more package operations failed      |
| `2`       | Configuration or workspace detection error |

## Next Steps

- Learn about [Workspace Detection](./concepts/workspace-detection.md)
- Explore [Package Manager Support](./concepts/package-managers.md)
- See [Performance Tuning](./advanced/performance.md) for optimization tips
