# QQ 大乐斗助手 - Agent 配置

## 项目专家 Agent

### qq-dld-expert
**触发词**: qq 大乐斗、游戏模块、自动任务、乐斗好友、每日任务

**能力**:
- 熟悉 QQ 大乐斗游戏 API 接口
- 了解模块开发流程 (ActionBase 继承)
- 配置定时任务和调度器
- 解析游戏 HTML 响应

**常用命令**:
```
/plan - 新功能规划
/tdd - TDD 测试驱动开发
/code-review - 代码审查
```

### nodejs-backend
**触发词**: API 开发、数据库、爬虫、自动化、Express

**能力**:
- Express REST API 开发
- SQLite 数据库操作
- Puppeteer 浏览器自动化
- HTTP 请求封装和重试机制

### test-engineer
**触发词**: 测试、E2E、coverage、bug、playwright

**能力**:
- Playwright E2E 测试编写
- API 接口测试
- 测试覆盖率分析
- TDD 开发流程

---

## 开发工作流

### 新增模块流程
1. 创建 `src/actions/xxx.js`
2. 继承 `ActionBase` 类
3. 实现 `run()` 方法
4. 在 `src/actions/index.js` 注册
5. 编写测试用例
6. 配置定时任务

### 模块开发模板
```javascript
const { ActionBase } = require('../core/action-base');

class XxxAction extends ActionBase {
  constructor() {
    super({
      id: 'xxx',
      name: '模块名称',
      description: '功能描述',
      category: '分类',
    });
  }

  async run(params = {}) {
    const html = await this.request('cmd');
    return this.success({ result: '完成' });
  }
}

module.exports = { XxxAction, action: new XxxAction() };
```

---

## 上下文感知

### 数据库上下文
- **module_configs**: 模块配置 (定时任务开关、执行时间)
- **exec_logs**: 执行日志 (成功/失败状态)
- **cookies**: 登录凭证 (qq 登录 cookie)
- **settings**: 系统设置

### API 上下文
- 所有请求通过 `GameClient` 封装
- 自动处理限流 (1.5s 间隔) 和重试 (3 次)
- 检测系统繁忙状态

### 安全上下文
- Cookie 存储于 SQLite 数据库
- 用户输入需要验证
- 错误信息不泄露敏感数据
