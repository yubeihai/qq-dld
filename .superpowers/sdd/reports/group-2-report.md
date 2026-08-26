# Group 2 Report: TypeScript Configuration Hierarchy

## What was implemented

1. **tsconfig.base.json** — Root base config with `target: ES2022`, `module: CommonJS`, strict mode, declaration maps, source maps, etc.
2. **tsconfig.json** — Root solution-style config with project references to `packages/shared` and `packages/server` (web excluded intentionally).
3. **packages/shared/tsconfig.json** — Extends base, `composite: true`, `rootDir: src`, `outDir: dist`.
4. **packages/server/tsconfig.json** — Extends base, `composite: true`, adds `types: ["node"]`, references `../shared`.
5. **packages/web/tsconfig.json** — Extends base, `noEmit: true`, `module: ESNext`, `moduleResolution: Bundler`, `jsx: preserve`, DOM libs, `composite: false`.

## Verification results

| Package | `tsc --showConfig` Result |
|---------|--------------------------|
| Root | Resolved — empty compilerOptions, references to shared + server |
| shared | TS18003 (no inputs — empty src/, expected) |
| server | Full resolved config printed with all inherited options, `types: ["node"]`, reference to `../shared` |
| web | TS18003 (no inputs — empty src/, expected) |

All configs are syntactically valid. The TS18003 errors are expected because `src/` directories are empty at this stage. Once source files are added, `tsc --showConfig` will print full resolved configs.

## Files created

- `tsconfig.base.json`
- `tsconfig.json` (root)
- `packages/shared/tsconfig.json`
- `packages/server/tsconfig.json`
- `packages/web/tsconfig.json`

## Issues or concerns

None. All files match the brief exactly. Verification confirms configs resolve without schema errors (empty directory TS18003 is expected).
