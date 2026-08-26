# Group 5: packages/web Skeleton

## Tasks Covered
- Task 5.1: Create `packages/web/package.json` with full metadata
- Task 5.2: Create `packages/web/vite.config.ts` and `packages/web/index.html`
- Task 5.3: Create `packages/web/src/main.ts` and `packages/web/src/App.vue`
- Task 5.4: Build and verify web package (typecheck + vite build)

## Context
- Web is ESM (Vite-native). Creates an SPA with Vue 3 + Vant 4.
- `type: "module"` in package.json for ESM.
- NOT composite, NOT in root tsc --build project references.
- Placeholder `packages/web/package.json` already exists from Group 1.

## Environment
- Repo root: `E:\github\qq-dld`
- Platform: Windows, npm workspaces

## 5.1 Create `packages/web/package.json`

File: `E:\github\qq-dld\packages\web\package.json`
```json
{
  "name": "@qq-dld/web",
  "version": "0.0.0",
  "private": true,
  "description": "Vue3 + Vant4 web frontend workspace",
  "type": "module",
  "scripts": {
    "build": "vue-tsc --noEmit && vite build",
    "typecheck": "vue-tsc --noEmit",
    "dev": "vite"
  },
  "dependencies": {
    "@qq-dld/shared": "0.0.0",
    "vue": "^3.4.27",
    "vant": "^4.9.1"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0.4",
    "vite": "^5.2.11",
    "vue-tsc": "^2.0.19"
  },
  "files": ["dist"]
}
```

## 5.2 Create `packages/web/vite.config.ts`

File: `E:\github\qq-dld\packages\web\vite.config.ts`
```ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
  },
});
```

## 5.2b Create `packages/web/index.html`

File: `E:\github\qq-dld\packages\web\index.html`
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>qq-dld</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

## 5.3a Create `packages/web/src/App.vue`

File: `E:\github\qq-dld\packages\web\src\App.vue`
```vue
<script setup lang="ts">
import { ref, type Ref } from 'vue';
import type { Account } from '@qq-dld/shared';
import { VButton } from 'vant';

const account: Ref<Account> = ref({
  id: 1,
  nickname: 'web-sample',
  status: 'active',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});
</script>

<template>
  <div class="root">
    <h1>qq-dld web</h1>
    <VButton>{{ account.nickname }}</VButton>
  </div>
</template>

<style scoped>
.root {
  font-family: sans-serif;
  padding: 1rem;
}
</style>
```

## 5.3b Create `packages/web/src/main.ts`

File: `E:\github\qq-dld\packages\web\src\main.ts`
```ts
import { createApp } from 'vue';
import App from './App.vue';
import 'vant/lib/index.css';

createApp(App).mount('#app');
```

## 5.3c (Optional) Create `packages/web/src/env.d.ts`

Only if vue-tsc/vite typecheck fails on missing module declarations:
```ts
/// <reference types="vite/client" />
declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}
declare module '*.css';
```

## 5.4 Verify
```powershell
npm install -w @qq-dld/web
npm run typecheck -w @qq-dld/web
npm run build -w @qq-dld/web
```

## Commit
After completing, commit with: `feat: create web package skeleton with Vue3 + Vant4 and workspace type import`
