# QQ 大乐斗 - Claude 配置规则

## 安全规则（必须遵守）

### 1. 密钥和凭证
- ❌ 禁止硬编码密码、API 密钥、Token
- ✅ 使用环境变量或配置文件
- ✅ Cookie 必须通过扫码登录获取，存储到数据库

### 2. 用户输入验证
- 所有外部输入必须验证
- URL 参数需要编码处理
- 防止 XSS 和注入攻击

### 3. 文件操作
- 不写入敏感位置
- 数据库文件保持在 `data/` 目录
- 日志文件保持在 `logs/` 目录

## 代码风格

### 1. JavaScript 规范
- 使用 CommonJS `require()` 语法
- 2 空格缩进
- 单引号 `'`
- 语句末尾必须加分号
- 行宽约 100 字符

### 2. 命名约定
- 文件：小写 + 连字符 `friendfight.js`
- 函数：camelCase `parseXiaFriends()`
- 常量：UPPER_SNAKE_CASE `BASE_URL`
- 数据库字段：snake_case `module_id`

### 3. 错误处理
- 异步操作必须 try-catch
- 用户错误信息用中文
- API 返回统一格式 `{ success: boolean, ... }`

```javascript
// ✅ 好的示例
async function getFriendList(page = 1) {
  try {
    const result = await sendRequest('friendlist', { page: String(page) });
    return result;
  } catch (error) {
    throw new Error(`请求失败：${error.message}`);
  }
}

// ❌ 差的示例
async function getFriendList(page) {
  const result = await sendRequest('friendlist', { page }); // 无错误处理
  return result;
}
```

## 测试规范

### 1. TDD 工作流
1. 先写失败的测试（RED）
2. 实现最少代码让测试通过（GREEN）
3. 重构改进代码（REFACTOR）

### 2. 覆盖率要求
- 核心模块 >= 80%
- 新功能必须带测试

### 3. 测试文件
- 命名：`test-*.js` 或 `*-test.js`
- 位置：项目根目录或 `tests/` 目录
- 运行：`node test.js` 或 `node tests/run-all.js`

## Git 工作流

### 提交信息格式
```
<type>: <description>

[optional body]
```

**Type 类型：**
- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式
- `refactor`: 重构
- `test`: 测试相关
- `chore`: 构建/工具

**示例：**
```
feat: 添加侠友扫描功能
fix: 修复等级匹配正则表达式
refactor: 优化 parseXiaFriends 函数性能
```

### 分支管理
- `main`: 主分支，保持稳定
- `feature/*`: 功能分支
- `fix/*`: 修复分支

## 性能优化

### 1. Token 管理
- 系统提示保持简洁
- 及时清理不需要的上下文
- 使用 strategic-compact 压缩

### 2. 数据库
- SQLite 操作后及时 save
- 批量操作使用事务
- 避免重复查询

### 3. 网络请求
- 复用 Cookie
- 请求失败自动重试
- 设置合理超时时间

## 项目结构

```
qq-dld/
├── .claude/           # Claude 配置
│   ├── rules/         # 规则文件
│   ├── commands/      # 自定义命令
│   └── agents/        # 子代理配置
├── data/              # SQLite 数据库
├── public/            # 前端静态文件
├── src/
│   ├── db/           # 数据库层
│   ├── game/         # 游戏逻辑
│   ├── scheduler/    # 定时任务
│   └── web/          # Web 服务器
├── logs/             # 执行日志
└── test-*.js         # 测试文件
```

## 开发提示

### 1. 添加新功能
1. 在 `src/game/` 创建模块文件
2. 在 `src/game/runner.js` 注册命令
3. 在 `setup-db.js` 添加预设模块
4. 编写测试文件

### 2. 解析 HTML
```javascript
// 先解码 HTML 实体
const decodedHtml = html.replace(/&amp;/g, '&');

// 使用正则提取数据
const linkRegex = /cmd=totalinfo[^\s>]*B_UID=(\d+)[^\s>]*/g;
```

### 3. 数据库操作
```javascript
const { moduleConfigs, execLogs } = require('../db');

// 创建/更新配置
moduleConfigs.create({ id, name, cmd, params });
moduleConfigs.update(id, { auto_enabled: 1 });
```

## 禁止事项

- ❌ 修改 `.gitignore` 排除 `data/database.sqlite`
- ❌ 在生产环境使用 `console.log` 调试
- ❌ 直接操作数据库文件
- ❌ 硬编码游戏服务器 URL
- ❌ 未经测试直接部署

## 推荐实践

- ✅ 新功能先写测试
- ✅ 复杂逻辑添加注释
- ✅ 定期清理日志文件
- ✅ 备份数据库再大改动
- ✅ 使用中文注释和错误信息
