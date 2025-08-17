# workspace-utils

A powerful **CLI tool** designed to orchestrate scripts across monorepo workspaces with **parallel execution**, **dependency-aware builds**, and **real-time log streaming**.

## What is workspace-utils?

`workspace-utils` simplifies working with monorepos by providing intelligent script orchestration across multiple packages. Whether you're using **Bun**, **pnpm**, or **npm** workspaces, this tool automatically detects your setup and provides a unified interface for running scripts efficiently.

## Key Features

### 🚀 **Parallel Execution by Default**

Run scripts across multiple packages simultaneously with configurable concurrency limits. Perfect for tests, linting, and development workflows.

### 🏗️ **Dependency-Aware Builds**

Automatically builds packages in the correct order using topological sorting. Dependencies are always built before their dependents.

### 🎨 **Real-time Log Streaming**

Color-coded, prefixed output makes it easy to track which package is doing what. Each package gets its own color for instant identification.

### 🔍 **Smart Package Filtering**

Use glob patterns to target specific packages:

- `--filter "@scope/*"` - All packages in a scope
- `--filter "apps/*"` - All apps
- `--filter "*-utils"` - All utility packages

### 📦 **Multi Package Manager Support**

Works seamlessly with:

- **Bun workspaces** (`package.json` + `bun.lockb`)
- **pnpm workspaces** (`pnpm-workspace.yaml` + `pnpm-lock.yaml`)
- **npm workspaces** (`package.json` + `package-lock.json`)

### 🎯 **Zero Configuration**

No config files needed. Just run it in any workspace and it automatically detects your setup.

## Why workspace-utils?

### Before workspace-utils

```bash
# Run tests manually in each package
cd packages/utils && npm test
cd ../ui-components && npm test
cd ../api-client && npm test
cd ../../apps/web-app && npm test

# Build in correct order manually
cd packages/utils && npm run build
cd ../ui-components && npm run build  # depends on utils
cd ../api-client && npm run build     # depends on utils
cd ../../apps/web-app && npm run build # depends on ui-components & api-client
```

### After workspace-utils

```json
{
	"scripts": {
		"test": "wsu run test",
		"build": "wsu build",
		"dev": "wsu dev"
	}
}
```

```bash
# Run all tests in parallel
npm run test

# Build everything in correct dependency order
npm run build

# Start all dev servers with live logs
npm run dev
```

## At a Glance

| Package.json Script      | Purpose                   | Execution                      |
| ------------------------ | ------------------------- | ------------------------------ |
| `"test": "wsu run test"` | Run tests across packages | **Parallel** by default        |
| `"build": "wsu build"`   | Build packages            | **Dependency order** (batched) |
| `"dev": "wsu dev"`       | Start dev servers         | **Parallel** with live logs    |

## Quick Example

Given this monorepo structure:

```
my-project/
├── package.json (workspaces: ["packages/*", "apps/*"])
├── packages/
│   ├── utils/           # no dependencies
│   ├── ui-components/   # depends on utils
│   └── api-client/      # depends on utils
└── apps/
    └── web-app/         # depends on ui-components, api-client
```

Running `npm run build` (with `"build": "wsu build"` in package.json) will:

1. **Batch 1:** Build `utils`
2. **Batch 2:** Build `ui-components` and `api-client` in parallel
3. **Batch 3:** Build `web-app`

Running `npm run test` (with `"test": "wsu run test"` in package.json) will run all tests in parallel across all packages simultaneously.

## Ready to Get Started?

Continue to [Installation](./installation.md) to set up workspace-utils in your project.
