# cache Command

The `cache` command manages the build cache used by the `build` command to skip unchanged packages.

## Recommended Usage

No need to add to `package.json` - use directly when needed:

```bash
# Check cache status
wsu cache

# Clear the cache
wsu cache clear
```

## Direct Usage

```bash
wsu cache [command]
```

## Commands

| Command  | Description                                            | Default |
| -------- | ------------------------------------------------------ | ------- |
| `status` | Display cache statistics and which packages are cached | ✓       |
| `clear`  | Remove all cached build data                           |         |

## How Caching Works

The build cache automatically:

1. **Tracks package content** - Hashes source files and `package.json` for each package
2. **Monitors dependencies** - Invalidates cache when dependencies change
3. **Skips unchanged builds** - Skips packages that haven't changed since last successful build
4. **Auto-manages storage** - Stores cache in `.wsu/` directory (auto-added to `.gitignore`)

The cache contains build metadata and copies of declared build artifacts. On a cache hit,
`wsu` restores missing or changed artifacts before skipping the package build. This makes
the cache useful both between local builds and across fresh CI runners.

### Cache Location

```
.wsu/
├── manifest.json          # Cache manifest
├── artifacts/            # Restorable build outputs
└── packages/
    ├── package-a/
    │   ├── cache.json     # Build metadata
    │   └── files.json     # File hashes
    └── package-b/
        ├── cache.json
        └── files.json
```

## Get the Most From Caching

### Declare build outputs

`wsu` infers artifacts from the `files`, `main`, `module`, `types`, `typings`, `bin`, and
`exports` fields in each package's `package.json`. Declare the files your build produces
so they can be saved and restored:

```json
{
	"main": "dist/index.js",
	"types": "dist/index.d.ts",
	"files": ["dist"]
}
```

No conventional output directory is assumed. A package without an inferable output still
builds normally, but it is reported as non-cacheable and will build again on the next run.

### Keep builds deterministic

Cache hits are based on package inputs, workspace configuration and lockfiles, dependency
hashes, the build script, `NODE_ENV`, and the runtime and package-manager versions. Keep
generated outputs out of source directories and commit the relevant lockfile and build
configuration. Files ignored by Git are not treated as source inputs.

Use `wsu cache` to confirm which packages are cached. Use
`wsu build --no-skip-unchanged` when you intentionally need a clean rebuild; it bypasses
the cache for that run.

## GitHub Actions

GitHub-hosted runners start with a fresh filesystem, so persist `.wsu/` with
`actions/cache`. This is separate from caching downloaded dependencies: the package-manager
cache speeds up `bun install`, while `.wsu/` skips package builds and restores their outputs.

```yaml
name: Build

on:
    push:
        branches: [main]
    pull_request:

jobs:
    build:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v4

            - uses: oven-sh/setup-bun@v2
              with:
                  bun-version: 1.3.8

            - run: bun install --frozen-lockfile

            - name: Restore workspace-utils build cache
              uses: actions/cache@v4
              with:
                  path: .wsu
                  key: wsu-${{ runner.os }}-${{ runner.arch }}-${{ hashFiles('**/bun.lock', '**/bun.lockb', '**/pnpm-lock.yaml', '**/package-lock.json', '**/yarn.lock') }}-${{ github.sha }}
                  restore-keys: |
                      wsu-${{ runner.os }}-${{ runner.arch }}-${{ hashFiles('**/bun.lock', '**/bun.lockb', '**/pnpm-lock.yaml', '**/package-lock.json', '**/yarn.lock') }}-
                      wsu-${{ runner.os }}-${{ runner.arch }}-

            - name: Build packages
              run: bun run build # package.json script should run `wsu build`
```

The commit SHA makes every completed run eligible to save its updated cache. The restore
prefix first selects the newest cache for the same OS, architecture, and dependency
lockfile, then falls back to the newest compatible runner cache. `wsu` validates every
restored entry itself, so changed source, configuration, environment, or tool versions
produce cache misses rather than stale builds.

Adapt the install and build commands for npm or pnpm. Keep the `.wsu` path and lockfile
patterns. If jobs build different subsets or use different `NODE_ENV` values, add the job
name or environment to the key to prevent jobs from competing for the same cache lineage.

### CI considerations

- Cache `.wsu/`, not generated output directories. `wsu` owns artifact restoration and
  validates the cached copies.
- Run the cache step before `wsu build`; `actions/cache` saves the updated directory in its
  post-job step.
- Pin the runtime version for more predictable hits. Runtime and package-manager changes
  are automatically rejected by `wsu`, but pinning avoids unnecessary misses.
- Do not run `wsu cache clear` at the end of a cached job, because that removes the data the
  post-job cache step would save.
- Release or diagnostic jobs can use `wsu build --no-skip-unchanged` without changing the
  normal cached workflow.

## Examples

### View Cache Status

```bash
wsu cache
```

Output:

```
📊 Build Cache Status

Workspace root: /path/to/workspace
Total packages in workspace: 5

✅ Cached packages: 3

Cache location: .wsu/packages/<package>/

Cached packages:
  ✓ @company/utils - 2.3s
  ✓ @company/ui - 1.8s
  ○ @company/app - not cached
```

### Clear Cache

```bash
wsu cache clear
```

Output:

```
🔥 Clearing build cache (3 packages)...
✅ Build cache cleared successfully!
```

## When to Clear Cache

Clear the cache when:

- **Build issues** - Suspect stale cache is causing problems
- **Clean slate** - Want to ensure all packages rebuild from scratch
- **CI/CD** - Some pipelines clear cache periodically for consistency

## Caching Behavior

### Automatic Invalidation

The cache is automatically invalidated when:

- Source files change (monitored via git)
- `package.json` is modified
- Dependencies are rebuilt
- Build fails (cache only updated on success)

### Build Command Integration

The `build` command uses caching by default:

```bash
# Build with caching (skips unchanged packages)
wsu build

# Build all packages (disable caching)
wsu build --no-skip-unchanged
```

## Cache Statistics

The `status` command shows:

- **Total cached packages** - Number of packages with valid cache
- **Last updated** - When cache was last modified
- **Build times** - Duration of cached builds
- **Uncached packages** - Packages that need building

## Troubleshooting

### Cache not being used

Ensure packages have a `build` script and declared output in their `package.json`:

```json
{
	"scripts": {
		"build": "your-build-command"
	},
	"files": ["dist"]
}
```

### Cache files in git

The `.wsu/` directory should be in `.gitignore`. If not, run:

```bash
wsu cache clear
```

Then check your `.gitignore` was updated.

## See Also

- [build command](./build.md) - Uses caching by default
- [Configuration](../configuration.md) - Performance tuning options
