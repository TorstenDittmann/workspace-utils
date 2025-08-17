# 📦 bunmono

A **Bun-powered CLI tool** for orchestrating scripts across **Bun workspaces** with parallel execution, dependency-aware builds, and real-time log streaming.

## ✨ Features

- 🚀 **Parallel script execution** across multiple packages
- 📊 **Dependency-aware builds** with topological sorting
- 🎨 **Color-coded, prefixed logs** for easy identification
- 🔍 **Package filtering** with glob patterns
- ⚡ **Configurable concurrency** limits
- 🏗️ **Smart build ordering** respecting package dependencies
- 📺 **Real-time log streaming** with timestamps
- 🎯 **Zero configuration** - works with any Bun workspace
- 🟡 **Bun native** - designed specifically for Bun workspaces

## 🛠️ Installation

```bash
# Install globally
bun install -g bunmono

# Or use with bunx
bunx bunmono
```

## 🚀 Quick Start

```bash
# Run tests across all packages (parallel by default)
bunmono run test

# Build packages in dependency order
bunmono build

# Start all dev servers with live logs
bunmono dev

# Run linting on specific packages
bunmono run lint --filter "@myorg/*"
```

## 📖 Commands

### `run <script>`

Run a script across multiple packages with support for parallel or sequential execution.

```bash
bunmono run <script> [options]
```

**Options:**

- `-c, --concurrency <number>` - Maximum concurrent processes (default: 4)
- `-f, --filter <pattern>` - Filter packages by glob pattern
- `--sequential` - Run scripts sequentially (default is parallel)

**Examples:**

```bash
# Run tests across all packages (parallel by default)
bunmono run test

# Run build sequentially
bunmono run build --sequential

# Run dev only for frontend packages (parallel by default)
bunmono run dev --filter "@myorg/frontend-*"

# Run with custom concurrency
bunmono run lint --concurrency 8
```

### `build`

Build packages in dependency order, ensuring dependencies are built before dependents.

```bash
bunmono build [options]
```

**Options:**

- `-f, --filter <pattern>` - Filter packages by pattern
- `-c, --concurrency <number>` - Max concurrent builds per batch (default: 4)
- `--skip-unchanged` - Skip unchanged packages (future feature)

**Examples:**

```bash
# Build all packages in dependency order
bunmono build

# Build only specific scope
bunmono build --filter "@myorg/backend-*"

# Build with higher concurrency per batch
bunmono build --concurrency 8
```

### `dev`

Start development servers with live log streaming and graceful shutdown.

```bash
bunmono dev [options]
```

**Options:**

- `-f, --filter <pattern>` - Filter packages by pattern
- `-c, --concurrency <number>` - Max concurrent dev servers (default: 4)

**Examples:**

```bash
# Start all dev servers
bunmono dev

# Start only frontend dev servers
bunmono dev --filter "apps/*"

# Limit concurrent dev servers
bunmono dev --concurrency 2
```

## 🔍 Package Filtering

Use glob patterns to target specific packages:

```bash
# Scope-based filtering (runs in parallel by default)
bunmono run test --filter "@myorg/*"
bunmono run build --filter "@myorg/backend-*"

# Path-based filtering
bunmono run dev --filter "apps/*"
bunmono run lint --filter "packages/*"

# Name-based filtering with sequential execution
bunmono run test --filter "*-utils" --sequential
bunmono run build --filter "*frontend*"
```

## 📊 Dependency Management

The tool automatically:

1. **Parses your workspace** from `package.json` workspaces
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
[shared-utils] Building shared utilities with Bun...
[ui-components] Starting component library build...
[web-app] Compiling application...
[shared-utils] ✅ Completed in 1,234ms
[ui-components] ✅ Completed in 2,456ms
[web-app] ✅ Completed in 3,789ms
```

## 📁 Workspace Requirements

Your project must have a `package.json` with `workspaces` field at the root.

### Example workspace `package.json`:

```json
{
	"name": "my-monorepo",
	"private": true,
	"workspaces": ["packages/*", "apps/*"],
	"scripts": {
		"build": "bunmono build",
		"dev": "bunmono dev",
		"test": "bunmono run test"
	}
}
```

## 🟡 Why Bun?

This tool is specifically designed for **Bun workspaces** because:

- **Native performance** - Built with Bun for maximum speed
- **Simple workspace config** - Uses standard `package.json` workspaces
- **Modern tooling** - Leverages Bun's fast package manager and runtime
- **Developer experience** - Seamless integration with Bun's ecosystem

## ⚡ Performance Tips

1. **Use filtering** to target only the packages you need
2. **Adjust concurrency** based on your system resources (default: 4)
3. **Parallel by default** - most scripts benefit from parallel execution
4. **Use --sequential** only when order matters or for resource-intensive tasks
5. **For builds**, dependency ordering ensures correct execution even in parallel batches
6. **For dev servers**, use reasonable concurrency limits to avoid resource exhaustion

## 🐛 Troubleshooting

### "No workspaces configuration found"

Ensure your root `package.json` has a `workspaces` field with package patterns.

### "Circular dependencies detected"

Check your package dependencies for circular references:

```bash
# This will show the circular dependency chain
bunmono build
```

### "No packages found with script"

Verify your packages have the required script in their `package.json`:

```bash
# Check which packages have the script
bunmono run nonexistent-script
```

## 🛣️ Roadmap

- [ ] **Caching** - Skip builds for unchanged packages
- [ ] **Watch mode** - Restart processes on file changes
- [ ] **Interactive mode** - Focus on specific package logs
- [ ] **Custom log formatters** - Configurable output styles
- [ ] **Dry run mode** - Preview execution plan
- [ ] **Bun-specific optimizations** - Leverage Bun features for better performance

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Bun](https://bun.sh) for blazing fast performance
- Inspired by the need for better Bun workspace tooling
- Thanks to the Bun team for creating an excellent runtime and package manager

---

**Made with ❤️ for the Bun community**
