# QQ 大乐斗助手

QQ 大乐斗自动任务系统 - 基于 Node.js 的 Web 自动化工具，支持扫码登录、每日任务、乐斗好友等功能。

## 功能特性

### 核心功能
- **扫码登录** - 支持 QQ 扫码登录，自动保存 Cookie
- **定时任务** - 支持自定义定时执行任务
- **执行日志** - 记录所有任务执行结果
- **Web 界面** - 浏览器访问操作，无需命令行

### 任务模块

| 模块 ID | 名称 | 说明 | 分类 |
|--------|------|------|------|
| `dailygift` | 每日奖励 | 领取每日礼包、传功符礼包、达人礼包、无字天书礼包 | 每日任务 |
| `friendfight` | 乐斗好友 | 乐斗好友/帮友/侠侣，体力不足自动使用药水 | 好友 |
| `store` | 商店 | 商店相关功能 | - |
| `wulin` | 武林 | 武林挑战 | - |
| `tenlottery` | 十连抽 | 十连抽奖 | - |
| `knightfight` | 骑士乐斗 | 骑士乐斗功能 | - |
| `towerfight` | 爬塔 | 爬塔挑战 | - |
| `callbackrecall` | 好友召回 | 召回好友功能 | - |
| `adventure` | 冒险 | 冒险挑战 | - |
| `task` | 任务 | 每日任务管理 | - |
| `zodiac` | 生肖 | 生肖相关 | - |
| `cargo` | 押镖 | 押镖功能 | - |
| `faction` | 帮派 | 帮派相关 | - |
| `misty` | 迷雾 | 迷雾探索 | - |
| `formation` | 阵法 | 阵法扫描与配置 | - |
| `worldtree` | 世界树 | 世界树相关 | - |
| `spacerelic` | 太空遗迹 | 太空遗迹探索 | - |
| `scrolldungeon` | 卷轴副本 | 卷轴副本挑战 | - |
| `sect` | 宗门 | 宗门相关 | - |
| `dragonphoenix` | 龙凤 | 龙凤挑战 | - |
| `knightisland` | 骑士岛 | 骑士岛任务 | - |
| `abysstide` | 深渊潮汐 | 深渊潮汐挑战 | - |

## 快速开始

### 环境要求
- Node.js 16+
- Chrome 或 Edge 浏览器（用于扫码登录）

### 安装

```bash
# 安装依赖
npm install

# 启动服务
npm start
```

启动成功后访问：http://localhost:3000

### 使用流程

1. **扫码登录**
   - 访问 http://localhost:3000
   - 点击"扫码登录"
   - 使用 QQ 扫码完成登录
   - Cookie 会自动保存到数据库

2. **手动执行任务**
   - 在模块列表中选择要执行的任务
   - 点击"立即执行"按钮

3. **配置定时任务**
   - 进入模块配置页面
   - 启用"自动执行"
   - 设置执行时间（格式：HH:mm）
   - 保存配置后自动生效

4. **乐斗好友管理**
   - 扫描好友列表
   - 勾选要乐斗的好友
   - 执行乐斗任务（体力不足时自动使用药水）

## 项目结构

```
qq-dld/
├── data/                 # SQLite 数据库（Cookie、日志、配置）
├── public/               # 前端页面
├── src/
│   ├── actions/          # 任务模块
│   │   ├── daily-gift.js    # 每日奖励
│   │   ├── friend-fight.js  # 乐斗好友
│   │   └── ...            # 其他 20+ 模块
│   ├── core/
│   │   ├── game-client.js   # HTTP 请求封装
│   │   └── action-base.js   # Action 基类
│   ├── game/
│   │   └── login.js         # 扫码登录
│   ├── scheduler/
│   │   └── index.js         # 定时任务调度
│   ├── web/
│   │   └── index.js         # Web 服务
│   └── db/
│       └── index.js         # 数据库操作
├── package.json
├── AGENTS.md           # 开发指南
└── README.md
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
| GET | `/api/logs` | 获取执行日志 |
| DELETE | `/api/logs` | 清空日志 |
| GET | `/api/xia-friends` | 获取侠侣列表 |
| POST | `/api/scan-xia-friends` | 扫描好友列表 |
| GET | `/api/formation-scan` | 扫描阵法 |
| GET | `/api/task-list` | 获取任务列表 |
| GET | `/api/knight-mission-list` | 获取骑士岛任务 |

## 新增模块

1. 创建 `src/actions/xxx.js`:

```javascript
const { ActionBase } = require('../core/action-base');

class XxxAction extends ActionBase {
  constructor() {
    super({
      id: 'xxx',
      name: '模块名称',
      category: '分类',
    });
  }

  async run(params = {}) {
    const html = await this.request('somecmd', params);
    return this.success({ result: '完成' });
  }
}

module.exports = { XxxAction, action: new XxxAction() };
```

2. 在 `src/actions/index.js` 中注册模块

3. 重启服务后即可在界面中使用

## 代码规范

- 使用 CommonJS `require()`
- 使用 `async/await` 处理异步
- 2 空格缩进
- 单引号字符串

## 依赖

```json
{
  "axios": "^1.6.7",
  "express": "^4.18.2",
  "node-schedule": "^2.1.1",
  "puppeteer-core": "^22.6.4",
  "sql.js": "^1.10.3"
}
```

## 注意事项

1. 本项目仅供学习交流使用
2. 请合理使用自动化功能，避免影响游戏平衡
3. Cookie 存储在本地 SQLite 数据库中，请妥善保管

## License

MIT
