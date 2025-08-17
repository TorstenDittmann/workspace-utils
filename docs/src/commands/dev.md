# dev Command

The `dev` command starts development servers across multiple packages with live log streaming and graceful shutdown.

## Recommended Usage

Add to your `package.json` scripts:

```json
{
	"scripts": {
		"dev": "wsu dev",
		"dev:apps": "wsu dev --filter 'apps/*'",
		"dev:limited": "wsu dev --concurrency 2"
	}
}
```

Then run:

```bash
npm run dev         # Start all dev servers
npm run dev:apps    # Start only frontend packages
npm run dev:limited # Limit concurrent servers
```

## Direct Usage (if needed)

```bash
wsu dev [options]
```

## How it Works

1. **Finds packages** with `dev` scripts
2. **Starts servers** in parallel with live log streaming
3. **Color-codes output** for easy identification
4. **Handles shutdown** gracefully when you press Ctrl+C

## Options

| Option                   | Description                     | Default      |
| ------------------------ | ------------------------------- | ------------ |
| `--filter <pattern>`     | Filter packages by glob pattern | All packages |
| `--concurrency <number>` | Max concurrent dev servers      | `4`          |

## Examples

### Basic Usage

Add scripts to your `package.json`:

```json
{
	"scripts": {
		"dev": "wsu dev",
		"dev:frontend": "wsu dev --filter 'apps/*'",
		"dev:limited": "wsu dev --concurrency 2"
	}
}
```

Then run:

```bash
npm run dev          # Start all dev servers
npm run dev:frontend # Start only frontend packages
npm run dev:limited  # Limit concurrent servers
```

### Example Output

```
🚀 Starting development servers with live log streaming...

✅ Starting dev servers for 3 packages:
  • @company/ui-components
  • apps/web-app
  • apps/mobile-app

🔧 Package manager: npm
⚡ Running 3 dev servers simultaneously
💡 Tip: Use Ctrl+C to stop all development servers

🎬 Starting development servers...

────────────────────────────────────────────────────────
[@company/ui-components] Starting: npm run dev
[apps/web-app] Starting: npm run dev
[apps/mobile-app] Starting: npm run dev
[@company/ui-components] Server running on http://localhost:6006
[apps/web-app] Server running on http://localhost:3000
[apps/mobile-app] Expo running on http://localhost:19000
[@company/ui-components] Hot reload enabled
[apps/web-app] Hot reload enabled
...
```

## Features

- **Live log streaming** - See real-time output from all servers
- **Color-coded prefixes** - Each package has its own color
- **Graceful shutdown** - Ctrl+C stops all servers cleanly
- **No timestamps** - Clean output focused on development

## When to Use

- **Local development** - Start all services at once
- **Full-stack development** - Frontend, backend, and services together
- **Debugging** - See logs from multiple packages simultaneously
- **Team development** - Consistent development environment

## Tips

- Use filtering to start only the packages you're working on
- Keep concurrency reasonable to avoid overwhelming your system
- Each package gets a unique color for easy log identification
- Press Ctrl+C once to gracefully stop all servers
