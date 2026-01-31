# 📦 workspace-utils

A **universal CLI tool** for orchestrating scripts across **monorepo workspaces** (Bun, pnpm, npm) with parallel execution, dependency-aware builds, and real-time log streaming.

## ✨ Features

- 🚀 **Parallel script execution** across multiple packages
- 📊 **Dependency-aware builds** with topological sorting
- 🎨 **Color-coded, prefixed logs** for easy identification
- 🔍 **Package filtering** with glob patterns
- ⚡ **Configurable concurrency** limits
- 🏗️ **Smart build ordering** respecting package dependencies
- 📺 **Real-time log streaming** with timestamps
- 🎯 **Zero configuration** - works with any workspace setup
- 🌐 **Universal support** - works with Bun, pnpm, and npm workspaces

## 🛠️ Installation

```bash
# Install as dev dependency with npm
npm install --save-dev workspace-utils

# Install as dev dependency with pnpm
pnpm add -D workspace-utils

# Install as dev dependency with bun
bun add -d workspace-utils
```

## 🚀 Quick Start

First, add workspace-utils scripts to your root `package.json`:

```json
{
	"scripts": {
		"dev": "wsu dev",
		"build": "wsu build",
		"test": "wsu run test",
		"lint": "wsu run lint --filter '@myorg/*'"
	}
}
```

Then run them:

```bash
# Run tests across all packages (parallel by default)
npm run test

# Build packages in dependency order
npm run build

# Start all dev servers with live logs
npm run dev

# Run linting on specific packages
npm run lint
```

## 📖 Commands

### `run <script>`

Run a script across multiple packages with support for parallel or sequential execution.

```bash
wsu run <script> [options]
```

Add to your `package.json` scripts and run with your package manager:

```json
{
	"scripts": {
		"test": "wsu run test",
		"test:sequential": "wsu run test --sequential"
	}
}
```

**Options:**

- `-c, --concurrency <number>` - Maximum concurrent processes (default: 4)
- `-f, --filter <pattern>` - Filter packages by glob pattern
- `--sequential` - Run scripts sequentially (default is parallel)

**Examples:**

```bash
# Run tests across all packages (parallel by default)
npm run test

# Run build sequentially
npm run test:sequential

# Run dev only for frontend packages (parallel by default)
npm run dev:frontend

# Run with custom concurrency
npm run lint
```

Example `package.json` scripts:

```json
{
	"scripts": {
		"test": "wsu run test",
		"test:sequential": "wsu run test --sequential",
		"dev:frontend": "wsu run dev --filter '@myorg/frontend-*'",
		"lint": "wsu run lint --concurrency 8"
	}
}
```

### `build`

Build packages in dependency order, ensuring dependencies are built before dependents.

```bash
wsu build [options]
```

**Options:**

- `-f, --filter <pattern>` - Filter packages by pattern
- `-c, --concurrency <number>` - Max concurrent builds per batch (default: 4)
- `--skip-unchanged` - Skip unchanged packages (future feature)

**Examples:**

```bash
# Build all packages in dependency order
npm run build

# Build only specific scope
npm run build:backend

# Build with higher concurrency per batch
npm run build:fast
```

Example `package.json` scripts:

```json
{
	"scripts": {
		"build": "wsu build",
		"build:backend": "wsu build --filter '@myorg/backend-*'",
		"build:fast": "wsu build --concurrency 8"
	}
}
```

### `dev`

Start development servers with live log streaming and graceful shutdown.

```bash
wsu dev [options]
```

**Options:**

- `-f, --filter <pattern>` - Filter packages by pattern
- `-c, --concurrency <number>` - Max concurrent dev servers (default: 4)

**Examples:**

```bash
# Start all dev servers
npm run dev

# Start only frontend dev servers
npm run dev:apps

# Limit concurrent dev servers
npm run dev:limited
```

Example `package.json` scripts:

```json
{
	"scripts": {
		"dev": "wsu dev",
		"dev:apps": "wsu dev --filter 'apps/*'",
		"dev:limited": "wsu dev --concurrency 2"
	}
}
```

## 🔍 Package Filtering

Use glob patterns to target specific packages:

```json
{
	"scripts": {
		"test:scope": "wsu run test --filter '@myorg/*'",
		"build:backend": "wsu build --filter '@myorg/backend-*'",
		"dev:apps": "wsu dev --filter 'apps/*'",
		"lint:packages": "wsu run lint --filter 'packages/*'",
		"test:utils": "wsu run test --filter '*-utils' --sequential",
		"build:frontend": "wsu run build --filter '*frontend*'"
	}
}
```

Then run with:

```bash
npm run test:scope     # Scope-based filtering
npm run build:backend  # Build backend packages
npm run dev:apps       # Start app dev servers
npm run lint:packages  # Lint package directories
npm run test:utils     # Test utilities sequentially
npm run build:frontend # Build frontend packages
```

## 📊 Dependency Management

The tool automatically:

1. **Parses your workspace** from `package.json` workspaces or `pnpm-workspace.yaml`
2. **Builds a dependency graph** from `package.json` files
3. **Calculates build order** using topological sorting
4. **Detects circular dependencies** and reports them
5. **Executes in batches** where each batch can run in parallel

### Example Dependency Resolution

Given this structure:

```
├── packages/
│   ├── shared-utils/     (no dependencies)
│   ├── ui-components/    (depends on shared-utils)
│   └── api-client/       (depends on shared-utils)
└── apps/
    └── web-app/          (depends on ui-components, api-client)
```

Build order will be:

1. **Batch 1:** `shared-utils` (parallel with others in batch)
2. **Batch 2:** `ui-components`, `api-client` (parallel with each other)
3. **Batch 3:** `web-app`

## 🎨 Log Output

Logs are color-coded and prefixed for easy identification:

```
[shared-utils] Building shared utilities...
[ui-components] Starting component library build...
[web-app] Compiling application...
[shared-utils] ✅ Completed in 1,234ms
[ui-components] ✅ Completed in 2,456ms
[web-app] ✅ Completed in 3,789ms
```

## 📁 Workspace Requirements

Your project must have one of the following workspace configurations:

### npm/Bun workspaces (`package.json`):

```json
{
	"name": "my-monorepo",
	"private": true,
	"workspaces": ["packages/*", "apps/*"],
	"scripts": {
		"build": "wsu build",
		"dev": "wsu dev",
		"test": "wsu run test"
	}
}
```

### pnpm workspaces (`pnpm-workspace.yaml`):

```yaml
packages:
    - "packages/*"
    - "apps/*"
```

## 🌐 Package Manager Support

This tool works seamlessly with:

- **npm workspaces** - Uses standard `package.json` workspaces
- **pnpm workspaces** - Supports `pnpm-workspace.yaml` configuration
- **Bun workspaces** - Works with Bun's workspace implementation
- **Auto-detection** - Automatically detects your package manager and workspace setup

## ⚡ Performance Tips

1. **Use filtering** to target only the packages you need
2. **Adjust concurrency** based on your system resources (default: 4)
3. **Parallel by default** - most scripts benefit from parallel execution
4. **Use --sequential** only when order matters or for resource-intensive tasks
5. **For builds**, dependency ordering ensures correct execution even in parallel batches
6. **For dev servers**, use reasonable concurrency limits to avoid resource exhaustion

## 🐛 Troubleshooting

### "No workspaces configuration found"

Ensure your project has one of the following:

- Root `package.json` with a `workspaces` field
- `pnpm-workspace.yaml` file with package patterns

### "Circular dependencies detected"

Check your package dependencies for circular references:

```bash
# This will show the circular dependency chain
npm run build
```

### "No packages found with script"

Verify your packages have the required script in their `package.json`:

```bash
# Check which packages have the script
npx wsu run nonexistent-script
```

## 🛣️ Roadmap

- [ ] **Caching** - Skip builds for unchanged packages
- [ ] **Watch mode** - Restart processes on file changes
- [ ] **Interactive mode** - Focus on specific package logs
- [ ] **Custom log formatters** - Configurable output styles
- [ ] **Dry run mode** - Preview execution plan
- [ ] **Yarn workspaces support** - Add support for Yarn workspaces
- [ ] **Lerna integration** - Better compatibility with Lerna projects

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built for the modern JavaScript ecosystem
- Inspired by the need for universal monorepo tooling
- Thanks to the communities behind npm, pnpm, and Bun for creating excellent package managers

---

**Made with ❤️ for the JavaScript monorepo community**
