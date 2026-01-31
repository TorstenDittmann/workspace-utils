# Installation

workspace-utils is designed to be installed as a development dependency in your project and used through package.json scripts.

## Installation

Install workspace-utils as a development dependency in your monorepo root:

```bash
# npm
npm install --save-dev workspace-utils

# pnpm
pnpm add -D workspace-utils

# bun
bun add -d workspace-utils

# yarn
yarn add --dev workspace-utils
```

## Setup Package Scripts

Add scripts to your root `package.json` using the `wsu` short command:

```json
{
	"scripts": {
		"test": "wsu run test",
		"build": "wsu build",
		"dev": "wsu dev",
		"lint": "wsu run lint",
		"typecheck": "wsu run typecheck",
		"clean": "wsu run clean --sequential"
	}
}
```

Now you can run commands like:

```bash
npm run test     # Run tests across all packages
npm run build    # Build packages in dependency order
npm run dev      # Start all dev servers
npm run lint     # Run linting across packages
```

## System Requirements

- **Node.js**: Version 18 or higher
- **Package Manager**: Any of the following:
    - npm (comes with Node.js)
    - pnpm (install with `npm install -g pnpm`)
    - Bun (install from [bun.sh](https://bun.sh))
    - Yarn (install with `npm install -g yarn`)

## Verification

After installation, verify that workspace-utils is working by running a script:

```bash
npm run build
```

You should see workspace-utils detect your workspace and execute the build process.

## Workspace Requirements

workspace-utils works with any monorepo that has one of the following configurations:

### Bun Workspaces

- Root `package.json` with `workspaces` field
- `bun.lockb` file (or `bunfig.toml`)

```json
{
	"name": "my-monorepo",
	"workspaces": ["packages/*", "apps/*"]
}
```

### pnpm Workspaces

- `pnpm-workspace.yaml` file
- `pnpm-lock.yaml` file

```yaml
# pnpm-workspace.yaml
packages:
    - "packages/*"
    - "apps/*"
```

### npm Workspaces

- Root `package.json` with `workspaces` field
- `package-lock.json` file

```json
{
	"name": "my-monorepo",
	"workspaces": ["packages/*", "apps/*"]
}
```

## Next Steps

Once installed, check out the [Quick Start](./quick-start.md) guide to begin using workspace-utils in your monorepo.

## Troubleshooting Installation

### Installation Issues

If you encounter issues during installation:

**Clear package manager cache:**

```bash
# npm
npm cache clean --force

# pnpm
pnpm store prune

# bun
bun pm cache rm

# yarn
yarn cache clean
```

**Reinstall dependencies:**

```bash
rm -rf node_modules package-lock.json
npm install
```

### Script Not Working

If scripts in package.json don't work:

1. Ensure workspace-utils is installed as a dev dependency
2. Check that your package.json scripts use `wsu` correctly
3. Run `npm ls workspace-utils` to verify installation
4. Try running the command directly: `npx wsu --version`
