# AGENTS.md - 开发指南

## 项目概述

QQ 大乐斗助手 - Node.js 自动化工具，支持每日任务、乐斗好友等功能。

## 快速启动

```bash
npm start          # 启动服务
```

访问 http://localhost:3000

## 项目结构

```
qq-dld/
├── data/                    # SQLite 数据库
│   └── database.sqlite      # 存储 Cookie、日志、好友、任务配置等
├── public/                  # 前端页面
├── src/
│   ├── actions/             # 游戏操作模块（22 个）
│   │   ├── index.js         # 模块注册中心
│   │   ├── daily-gift.js    # 每日奖励
│   │   ├── friend-fight.js  # 乐斗好友
│   │   ├── adventure.js     # 冒险探索
│   │   ├── task.js          # 任务管理
│   │   ├── formation.js     # 阵型管理
│   │   ├── store.js         # 商店
│   │   ├── wulin.js         # 武林大会
│   │   ├── ten-lottery.js   # 十连抽
│   │   ├── knight-fight.js  # 骑士对决
│   │   ├── tower-fight.js   # 塔
│   │   ├── zodiac.js        # 生肖
│   │   ├── cargo.js         # 商船
│   │   ├── faction.js       # 帮派
│   │   ├── misty.js         # 迷雾
│   │   ├── world-tree.js    # 世界树
│   │   ├── space-relic.js   # 空间遗迹
│   │   ├── scroll-dungeon.js# 卷轴副本
│   │   ├── sect.js          # 门派
│   │   ├── dragon-phoenix.js# 龙凤
│   │   ├── knight-island.js # 骑士岛
│   │   ├── abyss-tide.js    # 深渊潮汐
│   │   ├── callback-recall.js# 召回
│   │   └── scroll-dungeon.js# 卷轴副本
│   ├── core/
│   │   ├── action-base.js   # Action 基类
│   │   └── game-client.js   # HTTP 请求封装
│   ├── db/
│   │   └── index.js         # 数据库操作
│   ├── game/
│   │   └── login.js         # 扫码登录
│   ├── scheduler/
│   │   └── index.js         # 定时任务调度
│   ├── web/
│   │   └── index.js         # Express Web 服务
│   ├── actions/
│   │   └── index.js         # 模块注册
│   └── config/
│       └── index.js         # 配置管理
├── package.json
└── stop.js                  # 停止脚本
```

## 核心模块说明

### Action 基类 (`src/core/action-base.js`)

所有游戏操作模块的基类，提供：
- `run(params)` - 执行操作（子类实现）
- `request(cmd, params)` - 发送游戏请求
- `fetchUrl(url)` - 获取 URL 内容
- `delay(ms)` - 延时
- `extractLinks(html)` - 提取链接
- `extractText(html)` - 提取文本
- `matchPattern(html, patterns)` - 正则匹配
- `log(result, status)` - 记录日志
- `success(data)` / `fail(error)` - 返回结果格式化

### GameClient (`src/core/game-client.js`)

HTTP 请求封装：
- 自动管理 Cookie
- 请求限流（1500ms 间隔）
- 失败重试（最多 3 次）
- 登录状态检测
- 系统繁忙检测

### 数据库 (`src/db/index.js`)

SQLite 数据表：
- `cookies` - 登录 Cookie
- `module_configs` - 模块配置
- `exec_logs` - 执行日志
- `friends` - 好友列表
- `task_types` / `task_configs` - 任务类型与配置
- `faction_task_types` / `faction_task_configs` - 帮派任务配置
- `knight_mission_types` / `knight_mission_configs` - 骑士任务配置
- `settings` - 通用设置

## 新增模块

1. 创建 `src/actions/xxx.js`:

```javascript
const { ActionBase } = require('../core/action-base');

class XxxAction extends ActionBase {
  constructor() {
    super({
      id: 'xxx',
      name: '模块名称',
      description: '模块描述',
      category: '分类',
    });
  }

  async run(params = {}) {
    const html = await this.request('somecmd');
    return this.success({ result: '完成' });
  }
}

module.exports = { XxxAction, action: new XxxAction() };
```

2. 在 `src/actions/index.js` 中注册：

```javascript
const { action: xxx } = require('./xxx');

const actions = new Map([
  ['xxx', xxx],
  // ...
]);

module.exports = { actions, getAction, getAllActions };
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/status` | 检查登录状态 |
| POST | `/api/login` | 扫码登录 |
| POST | `/api/logout` | 退出登录 |
| GET | `/api/modules` | 获取所有模块 |
| GET | `/api/modules/:id` | 获取模块详情 |
| POST | `/api/modules/:id` | 更新模块配置 |
| POST | `/api/run/:id` | 执行模块 |
| GET | `/api/logs` | 获取日志 |
| DELETE | `/api/logs` | 清空日志 |

## 代码规范

- 使用 CommonJS `require()`
- 使用 `async/await`
- 2 空格缩进
- 单引号字符串
- 错误处理使用 try-catch
- 请求超时设置 15000ms

## 技术栈

- **后端**: Node.js + Express
- **数据库**: SQLite (sql.js)
- **自动化**: Puppeteer-Core (扫码登录)
- **HTTP 请求**: Axios
- **定时任务**: Node-Schedule
