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

### Cache Location

```
.wsu/
├── manifest.json          # Cache manifest
└── packages/
    ├── package-a/
    │   ├── cache.json     # Build metadata
    │   └── files.json     # File hashes
    └── package-b/
        ├── cache.json
        └── files.json
```

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

Ensure packages have a `build` script in their `package.json`:

```json
{
	"scripts": {
		"build": "your-build-command"
	}
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
