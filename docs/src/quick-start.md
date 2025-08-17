# Quick Start

Get up and running with workspace-utils in minutes. This guide assumes you have a monorepo with workspaces already set up.

## Prerequisites

- A monorepo with Bun, pnpm, or npm workspaces
- Node.js 18+ installed
- workspace-utils installed as a dev dependency ([Installation Guide](./installation.md))

## Setup Your Scripts

First, add workspace-utils scripts to your root `package.json`:

```json
{
	"scripts": {
		"test": "wsu run test",
		"build": "wsu build",
		"dev": "wsu dev",
		"lint": "wsu run lint"
	}
}
```

## Your First Command

Navigate to your monorepo root and run:

```bash
npm run test
```

This will:

1. 🔍 **Auto-detect** your package manager (Bun, pnpm, or npm)
2. 📦 **Discover** all packages in your workspace
3. ✅ **Filter** to packages that have a `test` script
4. 🚀 **Run tests** in parallel across all packages
5. 📊 **Display** a summary of results

## Core Commands

### Run Scripts Across Packages

Add these scripts to your `package.json`:

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
npm run test           # Run tests in parallel (default)
npm run test:sequential # Run builds sequentially
npm run lint           # Run linting with custom concurrency
```

### Build with Dependency Awareness

Add build scripts:

```json
{
	"scripts": {
		"build": "wsu build",
		"build:backend": "wsu build --filter '@myorg/backend-*'"
	}
}
```

Then run:

```bash
npm run build         # Build all packages in dependency order
npm run build:backend # Build only backend packages
```

### Start Development Servers

Add dev scripts:

```json
{
	"scripts": {
		"dev": "wsu dev",
		"dev:apps": "wsu dev --filter 'apps/*'"
	}
}
```

Then run:

```bash
npm run dev      # Start all dev servers
npm run dev:apps # Start only frontend packages
```

## Example Walkthrough

Let's say you have this monorepo structure:

```
my-project/
├── package.json
├── packages/
│   ├── utils/
│   │   └── package.json (scripts: test, build, lint)
│   └── ui-components/
│       └── package.json (scripts: test, build, dev, storybook)
└── apps/
    └── web-app/
        └── package.json (scripts: test, build, dev, start)
```

### Step 1: Run Tests

```bash
npm run test
```

**Output:**

```
🚀 Running script "test" across packages...

📁 Workspace root: /Users/you/my-project
📦 Found 3 packages

✅ Running "test" in 3 packages:
  • utils
  • ui-components
  • web-app

🔧 Package manager: npm
⚡ Execution mode: parallel (concurrency: 4)

[utils] Starting: npm run test
[ui-components] Starting: npm run test
[web-app] Starting: npm run test
[utils] ✅ Completed in 1,234ms
[ui-components] ✅ Completed in 2,456ms
[web-app] ✅ Completed in 3,789ms

📊 Execution Summary:
✅ Successful: 3
⏱️  Total duration: 3,789ms
```

### Step 2: Build Everything

```bash
npm run build
```

**Output:**

```
🏗️  Building packages in dependency order...

📊 Building dependency graph...
✅ Build order determined: 2 batches

📋 Build Plan:
  Batch 1: utils
  Batch 2: ui-components, web-app

🔧 Package manager: npm
⚡ Batch concurrency: 4

🔄 Running batch 1/2 (1 packages)
[utils] Starting: npm run build
[utils] ✅ Completed in 2,000ms
✅ Batch 1 completed successfully

🔄 Running batch 2/2 (2 packages)
[ui-components] Starting: npm run build
[web-app] Starting: npm run build
[ui-components] ✅ Completed in 3,000ms
[web-app] ✅ Completed in 4,000ms
✅ Batch 2 completed successfully

🎉 All packages built successfully!
```

### Step 3: Start Development

```bash
npm run dev
```

**Output:**

```
🚀 Starting development servers with live log streaming...

✅ Starting dev servers for 2 packages:
  • ui-components
  • web-app

🔧 Package manager: npm
⚡ Running 2 dev servers simultaneously

🎬 Starting development servers...

────────────────────────────────────────────────────────
[ui-components] Starting: npm run dev
[web-app] Starting: npm run dev
[ui-components] Server running on http://localhost:6006
[web-app] Server running on http://localhost:3000
[ui-components] Hot reload enabled
[web-app] Hot reload enabled
...
```

## Filtering Examples

Use filtering options in your package.json scripts:

```json
{
	"scripts": {
		"test:scope": "wsu run test --filter '@myorg/*'",
		"build:apps": "wsu build --filter 'apps/*'",
		"dev:frontend": "wsu dev --filter '*frontend*'",
		"lint:utils": "wsu run lint --filter '*utils*'"
	}
}
```

Then run:

```bash
npm run test:scope     # Run tests only for scoped packages
npm run build:apps     # Build only apps
npm run dev:frontend   # Start dev servers for frontend packages
npm run lint:utils     # Run linting for utility packages
```

## Common Patterns

### Package.json Scripts

Add these to your root `package.json` for convenient shortcuts:

```json
{
	"scripts": {
		"test": "wsu run test",
		"test:sequential": "wsu run test --sequential",
		"build": "wsu build",
		"build:frontend": "wsu build --filter 'apps/*'",
		"dev": "wsu dev",
		"lint": "wsu run lint",
		"lint:fix": "wsu run lint:fix"
	}
}
```

## What's Next?

- 📚 Learn about [Configuration](./configuration.md) options
- 🔧 Explore all [Commands](./commands/overview.md) in detail
- 🎯 Check out [Common Patterns](./examples/common-patterns.md)
- 🐛 See [Troubleshooting](./troubleshooting/common-issues.md) if you run into issues

## Need Help?

- View all available options: `npx wsu --help`
- Get help for specific commands: `npx wsu run --help`
- Check out the [CLI Reference](./reference/cli.md) for complete documentation
