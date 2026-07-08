# QQ 大乐斗助手 Pro — Comet 执行指南

> 使用 Comet 工作流平台，将现有 qq-dld 项目重构为全新的 TypeScript + Fastify + Vue 3 + Vant 4 + better-sqlite3 架构。

## 目录

1. [Comet 是什么](#1-comet-是什么)
2. [前置准备](#2-前置准备)
3. [项目初始化](#3-项目初始化)
4. [环境健康检查](#4-环境健康检查)
5. [启动重构任务](#5-启动重构任务)
6. [五阶段执行流程](#6-五阶段执行流程)
7. [针对本项目的分阶段执行建议](#7-针对本项目的分阶段执行建议)
8. [实用配置](#8-实用配置)
9. [命令速查表](#9-命令速查表)
10. [故障排查](#10-故障排查)

---

## 1. Comet 是什么

Comet（`@rpamis/comet`）是面向 AI 编码的可恢复长程任务工作流平台。它把 **OpenSpec**（需求规范）+ **Superpowers**（执行方法论）+ **Skill 管理** 串成闭环，通过五个阶段完成一个完整的开发任务。

**三个核心命令记忆点：**

| 命令 | 用途 |
|------|------|
| `/comet` | 做任何 Coding 任务（主入口） |
| `/comet-any` | 组合任意 Skill |
| `comet eval` | 评估任意 Skill |

**五阶段工作流：**

```
/comet  ↓自动检测并启动
/comet-open → /comet-design → /comet-build → /comet-verify → /comet-archive
(需求开放)    (深度设计)       (计划与构建)    (验证与完成)     (归档)
 OpenSpec     Superpowers      Superpowers     Both           OpenSpec
```

产出物：`proposal.md` → `design.md` → 代码提交 → 验证报告 → spec 归档。

---

## 2. 前置准备

### 2.1 系统要求

- **Node.js 20+**
- **npm / npx**
- **Git**（项目须已初始化为 Git 仓库）

### 2.2 安装 Comet CLI

```bash
# 安装 Comet（如已安装可跳过）
npm install -g @rpamis/comet

# 验证安装
comet --version
# 预期输出: 0.3.9 或更高
```

### 2.3 安装 OpenSpec CLI（Comet 依赖）

```bash
# comet doctor 会检测此依赖
npm install -g @fission-ai/openspec@latest

# 验证
openspec --version
```

### 2.4 （可选）升级到最新 Beta

```bash
# 0.4.0-beta 纯 Node runtime，不再依赖 Bash/WSL，推荐升级
npm install -g @rpamis/comet@beta

comet --version
# 预期: 0.4.0-beta.1
```

---

## 3. 项目初始化

### 3.1 在 qq-dld 项目根目录执行

```bash
cd C:\Users\中科华汇\Desktop\qq-dld

# 交互式初始化（推荐首次使用）
comet init

# 或非交互式（指定中文 + 项目级）
comet init --yes --language zh --scope project
```

### 3.2 初始化会做什么

Comet 检测到当前 AI 平台（OpenCode），自动安装三组技能：

```
.opencode/skills/
├── comet/SKILL.md + scripts/*.mjs          # Comet 主技能 + 7 个守护脚本
├── comet-open/SKILL.md                      # 阶段1：需求开放
├── comet-design/SKILL.md                    # 阶段2：深度设计
├── comet-build/SKILL.md                     # 阶段3：计划与构建
├── comet-verify/SKILL.md                    # 阶段4：验证与完成
├── comet-archive/SKILL.md                   # 阶段5：归档
├── comet-hotfix/SKILL.md                    # 热修复模式
├── comet-tweak/SKILL.md                     # 轻量调整模式
├── comet-any/SKILL.md                       # 任意 Skill 组合
├── openspec-*/SKILL.md                      # OpenSpec 规范技能
└── brainstorming/SKILL.md                   # Superpowers 头脑风暴等 14 个
```

同时创建工作目录结构：

```
qq-dld/
├── .comet/config.yaml        # 项目级 Comet 配置
├── .opencode/skills/         # 技能目录（如上）
└── openspec/                 # 需求规范根目录（WHAT）
    ├── config.yaml
    └── changes/              # 每个 change 一个子目录
```

### 3.3 验证初始化成功

```bash
comet status
# 预期: 显示 "No active changes"（正常，尚未启动任务）

comet doctor
# 预期: 所有组件 healthy，skills 全部 installed
```

> **注意**：`comet init` 安装技能可能耗时 1-2 分钟，请耐心等待完成。如超时，重新运行即可（`--skip-existing` 跳过已安装项）。

---

## 4. 环境健康检查

```bash
comet doctor
```

**期望全部通过的检查项：**

| 检查项 | 说明 | 修复方式 |
|--------|------|---------|
| openspec CLI | OpenSpec 命令行工具 | `npm i -g @fission-ai/openspec@latest` |
| work directory | openspec/ 工作目录存在 | 重新 `comet init` |
| skills | 23 个 SKILL.md 全部存在 | `comet init --overwrite` |
| scripts | 7 个守护脚本可执行 | `comet init --overwrite` |
| CodeGraph | （可选）代码图谱 | `codegraph init` |

如果全部 healthy，进入下一步。

---

## 5. 启动重构任务

### 5.1 创建 Git 分支（推荐）

```bash
git checkout -b refactor/v2-pro
```

### 5.2 使用 /comet 主入口

在 AI 编码平台（OpenCode）中输入：

```
/comet 重构 qq-dld 项目为全新架构：TypeScript + Fastify + Vue3 + Vant4 + better-sqlite3，支持多账号、JWT鉴权、npm workspaces monorepo、分层架构（parser/service/repository/data）。将38个游戏模块从职责混杂的单文件拆分为清晰的四层结构。
```

Comet 会自动：
1. 检测当前环境
2. 创建一个 `openspec/changes/<change-name>/` 目录
3. 引导进入 `/comet-open` 阶段

### 5.3 替代：直接使用轻量模式

如果任务较轻或想跳过完整流程：

```
/comet-tweak 添加多账号支持到现有项目
```

```
/comet-hotfix 修复 friend-fight 模块的日志不统一问题
```

| 模式 | 适用场景 | 流程 |
|------|---------|------|
| `/comet`（full） | 大型重构、新功能 | open → design → build → verify → archive |
| `/comet-tweak` | 轻量调整 | open → build → verify → archive |
| `/comet-hotfix` | 紧急修复 | open → build → verify → archive（跳过设计） |

**本项目属于大型重构，推荐使用 `/comet`（full 模式）。**

---

## 6. 五阶段执行流程

### 阶段 1：需求开放 `/comet-open`

**目的**：把模糊需求转化为结构化的 Proposal + Tasks。

**操作**：AI 平台自动执行 `/comet-open`，或手动输入：

```
/comet-open
```

**产出物**（位于 `openspec/changes/<change-name>/`）：

| 文件 | 内容 |
|------|------|
| `proposal.md` | 变更提案：为什么做、做什么、影响范围 |
| `tasks.md` | 任务清单：拆分为可执行的任务条目 |
| `specs/<capability>/spec.md` | 能力规格：delta spec 描述新增/修改的能力 |

**你可以做的事**：
- 审阅 `proposal.md`，确认重构方向与技术栈选择
- 审阅 `tasks.md`，调整任务拆分粒度
- 确认无误后，输入 `/comet-design` 进入下一阶段

**查看状态**：

```bash
comet status
# 显示当前 phase: open，下一步: /comet-design
```

---

### 阶段 2：深度设计 `/comet-design`

**目的**：基于 Proposal 产出详细设计文档。

**操作**：

```
/comet-design
```

**产出物**：

| 文件 | 内容 |
|------|------|
| `docs/superpowers/specs/<design-doc>.md` | 详细设计文档：架构图、接口定义、数据模型 |
| delta spec 更新 | specs/ 下的 spec.md 补充设计细节 |

**Superpowers 方法论介入**：此阶段会调用 `brainstorming` 等技能做深度设计推演。

**你可以做的事**：
- 审阅设计文档，确认 Monorepo 结构、接口定义、数据库 Schema
- 提出修改意见，AI 会迭代设计
- 确认后输入 `/comet-build`

---

### 阶段 3：计划与构建 `/comet-build`

**目的**：制定实现计划并逐步编写代码。

**操作**：

```
/comet-build
```

**产出物**：

| 文件 | 内容 |
|------|------|
| `docs/superpowers/plans/<plan>.md` | 实现计划：分步骤的执行清单 |
| 代码提交 | 实际的代码变更（Git commits） |

**构建模式（.comet.yaml 中 `build_mode`）**：

| 模式 | 说明 | 适用 |
|------|------|------|
| `subagent-driven-development` | 派发子代理并行开发 | 大型任务（推荐本项目） |
| `executing-plans` | 按计划顺序执行 | 中型任务 |
| `direct` | 直接编码 | 小型任务 |

**你可以做的事**：
- 审阅实现计划，确认阶段拆分
- 观察代码生成过程，随时反馈
- 构建完成后输入 `/comet-verify`

---

### 阶段 4：验证与完成 `/comet-verify`

**目的**：验证代码质量，处理代码审查与分支。

**操作**：

```
/comet-verify
```

**产出物**：

| 文件 | 内容 |
|------|------|
| 验证报告 | 测试结果、lint 结果、类型检查结果 |
| 分支处理 | review_mode 决定审查严格程度 |

**验证模式（`verify_mode`）**：

| 模式 | 说明 |
|------|------|
| `light` | 基础验证：编译通过、无报错 |
| `full` | 完整验证：测试通过、lint 通过、类型检查通过 |

**审查模式（`review_mode`）**：

| 模式 | 说明 |
|------|------|
| `off` | 不做代码审查 |
| `standard` | 标准审查 |
| `thorough` | 严格审查（推荐大型重构） |

**你可以做的事**：
- 审阅验证报告，确认测试覆盖
- 修复验证中发现的问题
- 验证通过后输入 `/comet-archive`

---

### 阶段 5：归档 `/comet-archive`

**目的**：将 delta spec 同步到 main spec，归档 change。

**操作**：

```
/comet-archive
```

**产出物**：

| 动作 | 说明 |
|------|------|
| delta → main spec | specs/ 的变更合并到 openspec/ 主规范 |
| change 归档 | 标记为 completed，清理工作目录 |
| Git 分支处理 | 合并/保留分支 |

**归档后**：

```bash
comet status
# 预期: No active changes（任务完成）
```

---

## 7. 针对本项目的分阶段执行建议

本项目是大型架构重构，建议按以下方式与 Comet 配合：

### 7.1 建议拆分为多个 Change

一个 change 不宜过大。建议按实施计划的阶段拆分：

| Change | 内容 | Comet 模式 |
|--------|------|-----------|
| `scaffold-monorepo` | Monorepo 脚手架、tsconfig、eslint、vitest | `/comet` full |
| `core-library` | 核心库：GameClient/CookieManager/RateLimiter/BaseService/BaseParser | `/comet` full |
| `database-layer` | better-sqlite3 连接、schema 迁移、repositories | `/comet` full |
| `module-migration` | 38 个模块逐一迁移为分层架构 | `/comet` full（或 `/comet-tweak` 逐个） |
| `server-fastify` | Fastify 路由 + 服务层 + JWT + WebSocket | `/comet` full |
| `web-vue3` | Vue 3 + Vant 4 前端全部页面 | `/comet` full |
| `docker-deploy` | Dockerfile + docker-compose + 文档 | `/comet-tweak` |

### 7.2 单个 Change 的执行示例

以 `scaffold-monorepo` 为例：

```
步骤1: /comet 创建 Monorepo 脚手架：npm workspaces 结构，包含 packages/shared、packages/core、packages/db、packages/modules、packages/server 和 web/ 前端目录。配置 TypeScript strict、ESLint、Prettier、Vitest。

步骤2: (自动进入 /comet-open)
       → 审阅 proposal.md 和 tasks.md

步骤3: /comet-design
       → 审阅目录结构设计、tsconfig 继承关系

步骤4: /comet-build
       → 观察脚手架生成，确认 package.json/tsconfig.json/.eslintrc

步骤5: /comet-verify
       → 确认 npm install 成功、tsc 无报错

步骤6: /comet-archive
       → 归档，开始下一个 change
```

### 7.3 模块迁移的批量处理

38 个模块迁移是最大工作量。建议：

```
# 方案A：一个大 change（subagent 并行）
/comet 迁移全部38个游戏模块为分层架构，每个模块拆分为 parser/service/data/types 四层，统一继承 BaseService

# 方案B：按分类拆分多个 change（更可控）
/comet 迁移日常类模块（daily-gift, liveness-gift, calendar, callback-recall）
/comet 迁移战斗类模块（friend-fight, knight-fight, tower-fight, peak-fight）
/comet 迁移副本类模块（adventure, zodiac, misty, scroll-dungeon, abyss-tide）
# ...以此类推
```

**推荐方案 B**，每个 change 5-8 个模块，可控性好，验证方便。

---

## 8. 实用配置

### 8.1 开启上下文压缩（Beta）

Design → Build 交接时自动压缩上下文，token 降 25-30%。

编辑 `.comet/config.yaml`：

```yaml
context_compression: beta
```

### 8.2 自动阶段转换

控制阶段完成后是否自动进入下一阶段。

```yaml
# .comet/config.yaml
auto_transition: true   # 自动进入下一阶段（默认）
auto_transition: false  # 手动确认后进入（推荐大型重构）
```

或用环境变量（优先级最高）：

```bash
# PowerShell
$env:COMET_AUTO_TRANSITION = "false"
```

### 8.3 构建模式选择

```yaml
# .comet.yaml（change 级别）
build_mode: subagent-driven-development  # 并行子代理（大型任务）
build_mode: executing-plans              # 顺序执行（中型任务）
build_mode: direct                       # 直接编码（小型任务）
```

### 8.4 验证与审查模式

```yaml
# .comet.yaml
verify_mode: full        # 完整验证
review_mode: thorough    # 严格审查
tdd_mode: tdd            # 测试驱动
tdd_mode: direct         # 直接开发
```

### 8.5 隔离模式

```yaml
# .comet.yaml
isolation: branch     # Git 分支隔离（默认）
isolation: worktree   # Git worktree 隔离（并行开发）
```

---

## 9. 命令速查表

### CLI 命令

| 命令 | 说明 |
|------|------|
| `comet init` | 初始化项目 |
| `comet init --yes --language zh` | 非交互式中文初始化 |
| `comet status` | 查看当前状态与下一步 |
| `comet status --json` | JSON 格式状态 |
| `comet doctor` | 环境健康诊断 |
| `comet dashboard` | 启动本地仪表盘（浏览器查看） |
| `comet update` | 更新 Comet 包 + 技能 |
| `comet uninstall` | 卸载技能/规则/hooks |
| `comet --version` | 查看版本 |
| `comet --help` | 帮助 |

### AI 平台内命令（OpenCode 中输入）

| 命令 | 说明 |
|------|------|
| `/comet <任务描述>` | 主入口，自动启动完整工作流 |
| `/comet-open` | 阶段1：需求开放 |
| `/comet-design` | 阶段2：深度设计 |
| `/comet-build` | 阶段3：计划与构建 |
| `/comet-verify` | 阶段4：验证与完成 |
| `/comet-archive` | 阶段5：归档 |
| `/comet-hotfix <描述>` | 热修复模式（跳过设计） |
| `/comet-tweak <描述>` | 轻量调整模式 |
| `/comet-any` | 组合任意 Skill |

### 状态查看

```bash
# 随时查看当前在哪个阶段、下一步做什么
comet status

# 可视化仪表盘
comet dashboard --port 3001
```

---

## 10. 故障排查

### 问题：comet init 超时

```bash
# 重新运行，跳过已安装项
comet init --yes --skip-existing

# 或强制覆盖
comet init --yes --overwrite
```

### 问题：comet doctor 显示 skills missing

```bash
# 重新安装技能
comet init --overwrite

# 或更新
comet update
```

### 问题：openspec CLI 未安装

```bash
npm install -g @fission-ai/openspec@latest
```

### 问题：阶段卡住无法推进

```bash
# 查看当前状态
comet status --json

# 检查 .comet.yaml 是否有效
# （Comet 会自动校验，如需手动）
npx comet-yaml-validate
```

### 问题：想中途取消任务

```bash
# 删除当前 change 目录
Remove-Item -Recurse -Force openspec/changes/<change-name>

# 重置状态
comet status
```

### 问题：想从特定阶段重新开始

直接在 AI 平台输入对应的阶段命令即可，Comet 会更新 `.comet.yaml` 的 phase 字段：

```
/comet-build    # 从构建阶段重新开始
```

---

## 快速开始（TL;DR）

```bash
# 1. 安装
npm install -g @rpamis/comet @fission-ai/openspec@latest

# 2. 初始化（在 qq-dld 目录）
cd C:\Users\中科华汇\Desktop\qq-dld
git checkout -b refactor/v2-pro
comet init --yes --language zh

# 3. 检查
comet doctor

# 4. 启动重构（在 OpenCode 中输入）
/comet 重构 qq-dld 为 TypeScript + Fastify + Vue3 + Vant4 + better-sqlite3 架构，支持多账号、JWT、npm workspaces、分层架构

# 5. 跟随五阶段流程
#    open → design → build → verify → archive
#    每个阶段审阅产出物，确认后输入下一阶段命令

# 6. 随时查看状态
comet status
```

---

**文档版本**：v1.0  
**适用 Comet 版本**：0.3.9+ / 0.4.0-beta+  
**项目**：QQ 大乐斗助手 Pro 重构
