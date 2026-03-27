# QQ 大乐斗项目技能

## 项目概述

QQ 大乐斗自动任务系统，基于 Node.js + Express + SQLite 的游戏自动化框架。

**核心功能：**
- 自动任务执行（每日签到、好友乐斗等）
- 定时任务调度（node-schedule）
- Web 管理界面（Express + 原生 HTML/JS）
- 侠友管理（好友、帮友、侠侣扫描与战斗）

---

## 技术栈

| 类别 | 技术 |
|------|------|
| 运行时 | Node.js |
| Web 框架 | Express 4.18 |
| 数据库 | sql.js (SQLite) |
| HTTP 请求 | Axios 1.6 |
| 定时任务 | node-schedule 2.1 |
| 无头浏览器 | Puppeteer Core 22.6（扫码登录） |

---

## 项目结构

```
qq-dld/
├── data/                    # SQLite 数据库存储
│   └── database.sqlite
├── public/                  # 前端静态文件
│   └── index.html          # 单页管理界面
├── src/
│   ├── db/index.js         # 数据库包装层
│   ├── game/
│   │   ├── login.js        # 扫码登录
│   │   ├── runner.js       # 任务执行引擎
│   │   ├── explorer.js     # URL 探索模块
│   │   ├── friendfight.js  # 好友乐斗/侠友扫描
│   │   ├── dailygift.js    # 每日礼包
│   │   └── player.js       # 玩家信息
│   ├── scheduler/index.js  # 定时任务调度
│   └── web/index.js        # Express 服务器 + API
├── logs/                    # 执行日志
└── AGENTS.md               # 开发指南
```

---

## 核心模块说明

### 1. 数据库层 (`src/db/index.js`)

**表结构：**
- `module_configs` - 任务模块配置
- `exec_logs` - 执行历史
- `link_records` - URL 链接记录
- `link_flows` - URL 流程序列
- `settings` - 系统设置
- `cookies` - 登录 Cookie

**包装类：**
```javascript
const { moduleConfigs, execLogs, cookieDb } = require('./db');

// 模块配置
moduleConfigs.create({ id, name, cmd, params });
moduleConfigs.update(id, { auto_enabled: 1 });
moduleConfigs.getAll();
moduleConfigs.getById(id);

// 执行日志
execLogs.add({ moduleId, moduleName, result, status });
execLogs.getAll(limit);

// Cookie 管理
cookieDb.get();
cookieDb.set(cookie);
```

### 2. 游戏逻辑层

#### `src/game/login.js` - 扫码登录
```javascript
const { login, checkLogin } = require('./game/login');

// 触发扫码登录（打开浏览器）
await login();

// 检查登录状态
const loggedIn = checkLogin();
```

#### `src/game/runner.js` - 任务执行引擎
```javascript
const { runModule, runByCommand, getCookie } = require('./game/runner');

// 执行指定模块
await runModule(moduleId, params);

// 执行游戏命令
await runByCommand('friendlist', { page: '1' });
```

#### `src/game/friendfight.js` - 好友乐斗
```javascript
const { scanAllXiaFriends, getXiaFriendsFromModule } = require('./game/friendfight');

// 扫描所有侠友（好友 + 帮友 + 侠侣）
const friends = await scanAllXiaFriends();
// 返回：[{ uid, name, level, menpai, type, enabled }]

// 侠友数据结构
{
  uid: '166',
  name: '财神发财鹅',
  level: '288 级',
  menpai: '',  // 门派/帮派
  type: 'friend',  // friend/mem/xialv
  enabled: true
}
```

#### `src/game/explorer.js` - URL 探索
```javascript
const { exploreModule, fetchPage, parseHtmlLinks } = require('./game/explorer');

// 获取页面
const html = await fetchPage(url);

// 解析链接
const links = parseHtmlLinks(html);
// 返回：[{ url, text }]
```

### 3. Web API (`src/web/index.js`)

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/modules` | GET | 获取所有模块 |
| `/api/modules/:id` | GET/POST/DELETE | 模块 CRUD |
| `/api/run/:id` | POST | 执行模块 |
| `/api/exec` | POST | 执行命令 |
| `/api/xia-friends` | GET/POST | 侠友管理 |
| `/api/scan-xia-friends` | POST | 扫描侠友 |
| `/api/logs` | GET | 执行日志 |
| `/api/status` | GET | 登录状态 |
| `/api/login` | POST | 扫码登录 |

### 4. 定时调度 (`src/scheduler/index.js`)

```javascript
const { startScheduler, runModuleNow } = require('./scheduler');

// 启动调度器
startScheduler();

// 立即执行模块
runModuleNow(moduleId);
```

---

## HTML 解析模式

### 侠友扫描解析

```javascript
// 1. 解码 HTML 实体
const decodedHtml = html.replace(/&amp;/g, '&');

// 2. 提取好友链接
const linkRegex = /cmd=totalinfo[^\s>]*B_UID=(\d+)[^\s>]*/g;

// 3. 提取名称（a 标签内）
const name = decodedHtml.substring(nextBracket + 1, closeA);

// 4. 提取等级（a 标签后）
const levelMatch = searchRange.match(/[0-9]+\s*级/);

// 5. 提取门派（等级后，<br 前）
const menpaiMatch = menpaiRange.match(/^([^<]*?)(?:<br|<a|$)/);
```

### 好友列表结构
```html
侠:<a href="...cmd=totalinfo&B_UID=166...">财神发财鹅</a>288 级<a href="...">乐斗</a>
```

---

## 开发规范

### 代码风格
- CommonJS `require()` 语法
- 2 空格缩进
- 单引号 `'`
- 必须使用分号
- 函数 camelCase，常量 UPPER_SNAKE_CASE

### 错误处理
```javascript
try {
  const result = await sendRequest('friendlist', { page: '1' });
  return result;
} catch (error) {
  throw new Error(`请求失败：${error.message}`);
}
```

### API 响应格式
```javascript
// 成功
{ success: true, result: data, count: 10 }

// 失败
{ success: false, error: '错误消息' }
```

### 测试
- TDD 工作流：RED → GREEN → REFACTOR
- 核心模块覆盖率 >= 80%
- 测试文件：`test-*.js`

---

## 常用命令

### 启动服务
```bash
npm start          # 生产环境
npm run dev        # 开发环境
node src/web/index.js
```

### 运行测试
```bash
node test.js
node test-friendfight.js
```

### 数据库操作
```bash
# 初始化数据库
node setup-db.js

# 备份数据库
cp data/database.sqlite data/backup.sqlite
```

---

## 游戏命令参考

| 命令 | 说明 | 参数 |
|------|------|------|
| `friendlist` | 好友列表 | page |
| `viewmem` | 帮友列表 | - |
| `viewxialv` | 侠侣列表 | - |
| `totalinfo` | 玩家信息 | B_UID, type |
| `fight` | 乐斗 | B_UID |
| `index` | 首页 | - |
| `dailygift` | 每日礼包 | - |

---

## 安全注意事项

1. **Cookie 管理**
   - 存储到 `cookies` 表
   - 不输出到日志
   - 定期更新

2. **请求频率**
   - 添加延迟避免封禁
   - 错误时重试机制

3. **数据备份**
   - 定期备份 `data/database.sqlite`
   - 大改动前先备份

---

## 扩展新模块

### 步骤

1. **创建游戏模块** `src/game/newmodule.js`
```javascript
const { cookieDb } = require('../db');

async function getCookie() {
  const cookie = cookieDb.get();
  if (!cookie) throw new Error('未登录');
  return cookie.value;
}

async function doSomething() {
  // 实现逻辑
}

module.exports = { doSomething };
```

2. **注册到 runner** `src/game/runner.js`
```javascript
case 'newmodule':
  const { doSomething } = require('./newmodule');
  result = await doSomething();
  break;
```

3. **添加预设模块** `setup-db.js`
```javascript
moduleConfigs.create({
  id: 'newmodule',
  name: '新模块',
  cmd: 'newmodule',
  params: '{}'
});
```

4. **编写测试** `test-newmodule.js`
```javascript
const { doSomething } = require('./src/game/newmodule');

test('doSomething 正常工作', async () => {
  await initDb();
  const result = await doSomething();
  expect(result).toBeDefined();
});
```

---

## 调试技巧

### 1. 查看日志
```bash
# 执行日志
tail -f logs/*.log

# 数据库内容
node -e "const db = require('./src/db'); db.initDb().then(() => console.log(db.moduleConfigs.getAll()))"
```

### 2. 测试 API
```bash
curl http://localhost:3000/api/modules
curl http://localhost:3000/api/xia-friends
```

### 3. HTML 解析调试
```javascript
// 保存原始 HTML 用于分析
const fs = require('fs');
fs.writeFileSync('debug.html', html);
```

---

## 相关资源

- 项目文档：`项目介绍.md`
- 开发指南：`AGENTS.md`
- Everything Claude Code: https://github.com/affaan-m/everything-claude-code
