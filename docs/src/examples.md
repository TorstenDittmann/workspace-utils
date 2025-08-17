# Examples

This page provides comprehensive examples of using workspace-utils in real-world scenarios. Each example includes the monorepo structure, commands, and expected output.

## Example 1: Full-Stack JavaScript Application

### Project Structure

```
my-fullstack-app/
├── package.json (workspaces)
├── packages/
│   ├── shared-types/      # TypeScript definitions
│   ├── ui-components/     # React component library
│   ├── api-client/        # REST API client
│   └── utils/             # Shared utilities
└── apps/
    ├── web-app/           # Next.js frontend
    ├── mobile-app/        # React Native
    └── api-server/        # Express.js backend
```

### Common Workflows

#### Run All Tests

Add to your `package.json`:

```json
{
	"scripts": {
		"test": "wsu run test"
	}
}
```

Then run:

```bash
npm run test
```

**Output:**

```
🚀 Running script "test" across packages...

📦 Found 7 packages
✅ Running "test" in 6 packages:
  • packages/shared-types
  • packages/ui-components
  • packages/api-client
  • packages/utils
  • apps/web-app
  • apps/api-server

🔧 Package manager: pnpm
⚡ Execution mode: parallel (concurrency: 4)

[packages/utils] ✅ Completed in 1,200ms
[packages/shared-types] ✅ Completed in 800ms
[packages/api-client] ✅ Completed in 2,100ms
[packages/ui-components] ✅ Completed in 3,400ms
[apps/api-server] ✅ Completed in 2,800ms
[apps/web-app] ✅ Completed in 4,200ms

📊 Execution Summary:
✅ Successful: 6
⏱️  Total duration: 4,200ms
```

#### Build Everything in Dependency Order

Add to your `package.json`:

```json
{
	"scripts": {
		"build": "wsu build"
	}
}
```

Then run:

```bash
npm run build
```

**Output:**

```
🏗️  Building packages in dependency order...

📊 Building dependency graph...
✅ Build order determined: 4 batches

📋 Build Plan:
  Batch 1: packages/shared-types, packages/utils
  Batch 2: packages/ui-components, packages/api-client
  Batch 3: apps/api-server
  Batch 4: apps/web-app, apps/mobile-app

🔧 Package manager: pnpm
⚡ Batch concurrency: 4

🔄 Running batch 1/4 (2 packages)
[packages/shared-types] ✅ Completed in 1,500ms
[packages/utils] ✅ Completed in 1,200ms

🔄 Running batch 2/4 (2 packages)
[packages/ui-components] ✅ Completed in 8,900ms
[packages/api-client] ✅ Completed in 3,200ms

🔄 Running batch 3/4 (1 packages)
[apps/api-server] ✅ Completed in 4,100ms

🔄 Running batch 4/4 (2 packages)
[apps/web-app] ✅ Completed in 12,300ms
[apps/mobile-app] ✅ Completed in 8,700ms

🎉 All packages built successfully!
```

#### Start Development Environment

Add to your `package.json`:

```json
{
	"scripts": {
		"dev": "wsu dev"
	}
}
```

Then run:

```bash
npm run dev
```

**Output:**

```
🚀 Starting development servers with live log streaming...

✅ Starting dev servers for 4 packages:
  • packages/ui-components
  • apps/web-app
  • apps/mobile-app
  • apps/api-server

🔧 Package manager: pnpm
⚡ Running 4 dev servers simultaneously
💡 Tip: Use Ctrl+C to stop all development servers

[packages/ui-components] Storybook running on http://localhost:6006
[apps/api-server] Server running on http://localhost:4000
[apps/web-app] Next.js running on http://localhost:3000
[apps/mobile-app] Expo running on http://localhost:19000
[apps/web-app] Hot reload enabled
[packages/ui-components] Hot reload enabled
[apps/api-server] Watching for changes...
[apps/mobile-app] Metro bundler started
...
```

## Example 2: Design System Monorepo

### Project Structure

```
design-system/
├── packages/
│   ├── tokens/            # Design tokens
│   ├── icons/             # Icon library
│   ├── components/        # React components
│   ├── themes/            # Theme definitions
│   └── utils/             # Design utilities
├── apps/
│   ├── storybook/         # Component documentation
│   └── playground/        # Component testing
└── tools/
    └── build-tools/       # Custom build scripts
```

### Workflows

#### Build Design System

Add to your `package.json`:

```json
{
	"scripts": {
		"build": "wsu build",
		"build:tokens": "wsu build --filter 'packages/tokens'",
		"build:icons": "wsu build --filter 'packages/icons'",
		"test:visual": "wsu run test:visual --concurrency 2",
		"lint": "wsu run lint --concurrency 8"
	}
}
```

Then run:

```bash
npm run build:tokens  # Build tokens first
npm run build:icons   # Then icons
npm run build         # Then everything else
npm run test:visual   # Visual regression tests
npm run lint          # Lint all code
```

## Example 3: Microservices Architecture

### Project Structure

```
microservices/
├── shared/
│   ├── types/             # Shared TypeScript types
│   ├── configs/           # Shared configurations
│   └── middleware/        # Common middleware
├── services/
│   ├── auth-service/      # Authentication
│   ├── user-service/      # User management
│   ├── payment-service/   # Payment processing
│   ├── notification-service/ # Notifications
│   └── gateway-service/   # API Gateway
└── tools/
    ├── docker-compose/    # Container orchestration
    └── deployment/        # Deployment scripts
```

### Workflows

#### Service Workflows

Add to your `package.json`:

```json
{
	"scripts": {
		"test:services": "wsu run test --filter 'services/*'",
		"build:shared": "wsu build --filter 'shared/*'",
		"build:services": "wsu build --filter 'services/*' --sequential",
		"dev:services": "wsu dev --filter 'services/*' --concurrency 6"
	}
}
```

Then run:

```bash
npm run test:services  # Run tests for all services
npm run build:shared   # Build shared libraries first
npm run build:services # Then build all services
npm run dev:services   # Start local development
```

## Example 4: Multi-Platform Mobile App

### Project Structure

```
mobile-app/
├── packages/
│   ├── core/              # Business logic
│   ├── ui/                # Shared UI components
│   ├── api/               # API layer
│   └── utils/             # Utilities
├── apps/
│   ├── ios/               # iOS app
│   ├── android/           # Android app
│   └── web/               # Web version
└── tools/
    ├── build-scripts/     # Platform build tools
    └── testing/           # Testing utilities
```

### Platform-Specific Workflows

#### Platform-Specific Workflows

Add to your `package.json`:

```json
{
	"scripts": {
		"dev:ios": "wsu dev --filter 'apps/ios' --filter 'packages/*'",
		"dev:android": "wsu dev --filter 'apps/android' --filter 'packages/*'",
		"test:core": "wsu run test --filter 'packages/*'",
		"test:ios": "wsu run test:ios --filter 'apps/ios'",
		"test:android": "wsu run test:android --filter 'apps/android'"
	}
}
```

Then run:

```bash
npm run dev:ios       # iOS development
npm run dev:android   # Android development
npm run test:core     # Test core logic
npm run test:ios      # Test iOS specifically
npm run test:android  # Test Android specifically
```

## Example 5: Enterprise Library Collection

### Project Structure

```
enterprise-libs/
├── core/
│   ├── auth/              # Authentication library
│   ├── logging/           # Logging utilities
│   ├── validation/        # Data validation
│   └── storage/           # Storage abstractions
├── ui/
│   ├── react-components/  # React component library
│   ├── vue-components/    # Vue component library
│   └── angular-components/ # Angular component library
└── integrations/
    ├── aws-integration/   # AWS utilities
    ├── gcp-integration/   # Google Cloud utilities
    └── azure-integration/ # Azure utilities
```

### Library Publishing Workflow

#### Library Publishing Workflow

Add to your `package.json`:

```json
{
	"scripts": {
		"test": "wsu run test",
		"build": "wsu build",
		"publish": "wsu run publish --sequential",
		"test:react": "wsu run test --filter '*react*'",
		"test:vue": "wsu run test --filter '*vue*'",
		"test:angular": "wsu run test --filter '*angular*'"
	}
}
```

Then run:

```bash
npm run test          # Run all tests first
npm run build         # Build everything
npm run publish       # Publish packages
npm run test:react    # Test React components
npm run test:vue      # Test Vue components
npm run test:angular  # Test Angular components
```

## Example 6: Documentation Site

### Project Structure

```
docs-site/
├── content/
│   ├── guides/            # User guides
│   ├── api-docs/          # API documentation
│   └── examples/          # Code examples
├── tools/
│   ├── markdown-processor/ # Custom markdown tools
│   ├── code-generator/    # Generate code samples
│   └── link-checker/      # Validate links
└── sites/
    ├── main-site/         # Main documentation
    ├── blog/              # Blog site
    └── api-reference/     # API reference site
```

### Documentation Workflows

#### Documentation Workflows

Add to your `package.json`:

```json
{
	"scripts": {
		"docs:generate": "wsu run generate --filter 'tools/*'",
		"docs:build": "wsu build --filter 'sites/*'",
		"docs:dev": "wsu dev --filter 'sites/*'",
		"docs:validate": "wsu run validate --filter 'tools/link-checker'",
		"docs:spellcheck": "wsu run spellcheck --sequential"
	}
}
```

Then run:

```bash
npm run docs:generate    # Generate content first
npm run docs:build       # Then build sites
npm run docs:dev         # Development with live reload
npm run docs:validate    # Check links and content
npm run docs:spellcheck  # Spell check
```

## Filtering Patterns Reference

### Scope-Based Filtering

Add to your `package.json`:

```json
{
	"scripts": {
		"test:company": "wsu run test --filter '@company/*'",
		"build:internal": "wsu build --filter '@internal/*'"
	}
}
```

### Directory-Based Filtering

```json
{
	"scripts": {
		"dev:apps": "wsu dev --filter 'apps/*'",
		"lint:packages": "wsu run lint --filter 'packages/*'",
		"build:tools": "wsu run build --filter 'tools/*'"
	}
}
```

### Name Pattern Filtering

```json
{
	"scripts": {
		"test:backend": "wsu run test --filter '*backend*'",
		"dev:frontend": "wsu dev --filter '*frontend*'",
		"build:utils": "wsu build --filter '*utils*'",
		"lint:test": "wsu run lint --filter '*test*'"
	}
}
```

### Combined Filtering Examples

```json
{
	"scripts": {
		"test:backend-services": "wsu run test --filter 'services/*backend*'",
		"build:react": "wsu run build --filter '*react*'"
	}
}
```

## Package.json Script Patterns

### Basic Setup

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

### Advanced Patterns

```json
{
	"scripts": {
		"test": "wsu run test",
		"test:watch": "wsu run test:watch",
		"test:coverage": "wsu run test:coverage",
		"build": "wsu build",
		"build:prod": "wsu build --concurrency 2",
		"dev": "wsu dev",
		"dev:apps": "wsu dev --filter 'apps/*'",
		"lint": "wsu run lint --concurrency 8",
		"lint:fix": "wsu run lint:fix",
		"typecheck": "wsu run typecheck",
		"clean": "wsu run clean --sequential"
	}
}
```

## Performance Optimization Examples

### Resource-Constrained Environments

Add to your `package.json`:

```json
{
	"scripts": {
		"test:ci": "wsu run test --concurrency 1",
		"build:low-mem": "wsu build --concurrency 2",
		"lint:fast": "wsu run lint --concurrency 12"
	}
}
```

### High-Performance Development

```json
{
	"scripts": {
		"test:fast": "wsu run test --concurrency 8",
		"build:fast": "wsu build --concurrency 6",
		"typecheck:fast": "wsu run typecheck --concurrency 16"
	}
}
```

## Troubleshooting Common Scenarios

### Mixed Package Managers

If your monorepo accidentally has mixed lock files:

```bash
# This will fail with clear error message
npm run test

# Clean up mixed lock files first
rm -f package-lock.json yarn.lock  # Keep only pnpm-lock.yaml
npm run test  # Now works
```

### Missing Scripts

If some packages don't have the script you're trying to run:

```bash
# This automatically skips packages without 'storybook' script
npm run storybook

# Output shows which packages were skipped
# ⚠️  Skipped 3 packages without 'storybook' script
```

### Build Dependencies

If builds fail due to missing dependencies:

```bash
# Use build command instead of run for dependency-aware building
npm run build  # ✅ Builds in correct order

# Instead of this which might fail
npm run build:parallel  # ❌ Might fail due to missing dependencies
```

## Next Steps

- Explore [Command Reference](./commands/overview.md) for detailed options
- Learn about [Troubleshooting](./troubleshooting.md) common issues
- See [Advanced Usage](./advanced/patterns.md) for complex scenarios
