# Repository Guidelines

## Project Structure & Module Organization

- Root CLI entry point lives in `index.ts`; compiled output is emitted to `dist/` via Bun build.
- Source is under `src/` with `commands/` (dev/run/build implementations), `core/` (workspace parsing, dependency graph, process runner), `package-managers/` (npm/pnpm/Bun detection + adapters), and `utils/` (logging, package helpers).
- Tests live alongside code as `*.test.ts` in `src/` plus workspace fixtures under `tests/` (npm/pnpm/Bun sample workspaces). Avoid editing fixture lockfiles unless the behavior changes.
- Docs are in `docs/` (mdBook). Publishing copies `package.json` into `dist/` for npm distribution.

## Build, Test, and Development Commands

- `bun run dev` — run the CLI from source (useful while iterating).
- `bun run build` — bundle `index.ts` to `dist/index.js` and copy `package.json` (used for releases).
- `bun test` / `bun test --watch` — execute unit tests; relies on Bun’s test runner.
- `bun run format` / `bun run format:check` — apply or verify Prettier formatting.
- `cd docs && mdbook build|serve` — build or locally serve docs (requires `mdbook` installed).

## Coding Style & Naming Conventions

- TypeScript with ES modules; target Node 18+ and Bun 1.0+.
- Follow Prettier defaults (tabs enabled in this repo). Keep imports sorted logically and prefer named exports for shared utilities.
- Files use kebab-case (e.g., `dependency-graph.ts`); classes in `PascalCase`, functions/variables in `camelCase`.
- Log output favors clear, prefixed messages; keep user-facing text concise and avoid emojis in code paths.

## Testing Guidelines

- Prefer colocated unit tests as `filename.test.ts`; mirror module names.
- Use Bun’s assertions; mock filesystem/process interactions minimally to keep integration behavior realistic.
- When changing workspace detection or package manager behavior, validate against the fixtures in `tests/` and add new fixtures if needed.
- Aim to keep tests deterministic; avoid network or external tool dependencies.

## Commit & Pull Request Guidelines

- Use short, imperative commit subjects (e.g., “Add pnpm lock support”). History is non-conventional, so clarity beats strict prefixes.
- Keep PRs focused; include a brief summary, screenshots only if output/UI changes, and list commands/tests run (e.g., `bun test`, `bun run build`).
- Link related issues when available and call out behavior changes or compatibility notes (Node/Bun).

## Security & Configuration Tips

- Do not commit tokens or private registry credentials. Tests should rely solely on the provided fixtures.
- Ensure local environments match the required engines (`node >= 18`, `bun >= 1.0.0`) to avoid subtle dependency resolution differences.
