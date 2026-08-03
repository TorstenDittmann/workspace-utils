# graph

Inspect the selected workspace dependency graph without running scripts.

```bash
wsu graph [options]
```

Options:

- `--filter <selector>` — repeatable package selector
- `--affected` — packages changed relative to the detected merge base, plus dependents
- `--since <ref>` — use an explicit Git comparison ref
- `--format text|json|dot` — output format; defaults to `text`

```bash
wsu graph --filter 'app...' --format dot
wsu graph --affected --format json
```
