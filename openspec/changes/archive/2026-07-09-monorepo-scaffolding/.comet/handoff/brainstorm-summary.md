# Brainstorm Summary — monorepo-scaffolding

## 确认的技术方案

### 构建：tsc emit（非 tsup）for server/shared
- server/shared 用 tsc emit 产出 CJS + .d.ts
- `tsc --build` 一步完成：类型检查 + emit + 依赖排序（shared 先于 server）
- 原因：tsup 默认 esbuild 打包，后续 better-sqlite3（原生 .node）/puppeteer-core 打包会失败；且 project references 需要 tsc 生成 .d.ts，用 tsup 需双构建链
- tsup 留作未来性能优化

### Web 类型检查：vue-tsc 独立
- 根 tsconfig.json references 只含 shared+server（不含 web）
- web 用 vue-tsc --noEmit 独立类型检查（Vue SFC 需 Volar）
- web tsconfig: noEmit:true, lib:[ES2022,DOM,DOM.Iterable], module:ESNext, moduleResolution:Bundler
- 根 typecheck = tsc --build && vue-tsc --noEmit -p packages/web/tsconfig.json

### 构建顺序：workspaces 数组排序
- workspaces: ["packages/shared", "packages/server", "packages/web"]
- npm run build --workspaces 按数组顺序执行，确保 shared 先构建

### tsconfig.base.json
- target ES2022, module CommonJS, moduleResolution Node, strict true, esModuleInterop true, skipLibCheck true, declaration true, declarationMap true, sourceMap true, forceConsistentCasingInFileNames true, resolveJsonModule true
- web 覆盖 module->ESNext, moduleResolution->Bundler

### shared 包
- package.json: @qq-dld/shared, private, main=dist/index.js, types=dist/index.d.ts
- src/types.ts: 7 个 domain type 骨架（Account/Module/ModuleConfig/ExecLog/Friend/TaskConfig/SchedulerJob）
- src/index.ts: re-export types

### web 包
- deps: vue@^3, vant@^4; devDeps: vite@^5, @vitejs/plugin-vue, vue-tsc, typescript
- vite.config.ts: plugin-vue
- index.html: div#app + module script
- src/main.ts: createApp(App).use(Button).mount('#app')
- src/App.vue: van-button "Hello QQ大乐斗"

## 关键取舍与风险
- tsc emit 比 tsup 慢，但脚手架阶段无感知；增量构建（tsc --build --watch）缓解
- web 不在 project references 中，失去增量类型检查联动；可接受（vite dev 有自己的 HMR）
- 根 package.json 混合用途（workspaces 编排 + 旧应用启动），靠脚本名区分
- npm workspaces 在 Windows 用 junction（非 symlink），npm 9+ 兼容

## 测试策略
纯构建时验证，无单元测试：
1. npm install 成功、workspaces 识别
2. npm run typecheck 通过
3. npm run build 产出 dist/
4. npm start 旧应用仍运行
5. 回滚干净

## Spec Patch
- Req 2: 根 tsconfig 引用 shared+server（非三个）；web 经 vue-tsc 独立类型检查
- Req 3: server/shared 用 tsc emit CJS（非 tsup）
