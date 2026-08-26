# Group 2: TypeScript Configuration Hierarchy

## Tasks Covered
- Task 2.1: Create `tsconfig.base.json` at root
- Task 2.2: Create root `tsconfig.json` (solution-style, project references)
- Task 2.3: Create `packages/shared/tsconfig.json`
- Task 2.4: Create `packages/server/tsconfig.json`
- Task 2.5: Create `packages/web/tsconfig.json`
- Task 2.6: Verify tsconfig chain with `tsc --showConfig`

## Context
All TS configs use `extends` from `tsconfig.base.json`. Package-specific overrides live in package tsconfigs only. No business logic files yet.

## Environment
- Platform: Windows, Node.js 18+, npm 9+
- Base config designed for `target: ES2022`, `module: CommonJS`
- Web package uses ESNext module + Bundler resolution (Vite)
- Repository root: `E:\github\qq-dld`

## 2.1 Create `tsconfig.base.json`
File: `E:\github\qq-dld\tsconfig.base.json`
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

## 2.2 Create root `tsconfig.json`
File: `E:\github\qq-dld\tsconfig.json`
```json
{
  "files": [],
  "references": [
    { "path": "./packages/shared" },
    { "path": "./packages/server" }
  ]
}
```
Note: `packages/web` is NOT referenced here (uses vue-tsc separately).

## 2.3 Create `packages/shared/tsconfig.json`
File: `E:\github\qq-dld\packages\shared\tsconfig.json`
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "rootDir": "src",
    "outDir": "dist",
    "tsBuildInfoFile": "tsconfig.tsbuildinfo"
  },
  "include": ["src/**/*"]
}
```

## 2.4 Create `packages/server/tsconfig.json`
File: `E:\github\qq-dld\packages\server\tsconfig.json`
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "rootDir": "src",
    "outDir": "dist",
    "tsBuildInfoFile": "tsconfig.tsbuildinfo",
    "lib": ["ES2022"],
    "types": ["node"]
  },
  "references": [
    { "path": "../shared" }
  ],
  "include": ["src/**/*"]
}
```

## 2.5 Create `packages/web/tsconfig.json`
File: `E:\github\qq-dld\packages\web\tsconfig.json`
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": false,
    "noEmit": true,
    "rootDir": "src",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": [],
    "jsx": "preserve",
    "useDefineForClassFields": true
  },
  "include": ["src/**/*", "src/**/*.vue", "vite.config.ts", "index.html"]
}
```

## 2.6 Verify Group 2
```powershell
npx tsc --showConfig -p packages/shared/tsconfig.json
npx tsc --showConfig -p packages/server/tsconfig.json
npx tsc --showConfig -p packages/web/tsconfig.json
```
Expected: each prints a fully-resolved config, no schema errors.

## Commit
After completing, commit with message: `feat: add TypeScript config hierarchy (base + 3 workspace tsconfigs)`
