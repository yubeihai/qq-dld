# QQ 大乐斗助手 - 自定义命令

## /dld-status
**描述**: 检查项目运行状态

**执行**:
```bash
node -e "const {checkLogin}=require('./src/game/login');console.log('登录状态:',checkLogin()?'已登录':'未登录')"
```

---

## /dld-logs
**描述**: 查看最近执行日志

**执行**:
```bash
node -e "const {execLogs,initDb}=require('./src/db');initDb().then(()=>console.log(JSON.stringify(execLogs.getAll(10),null,2)))"
```

---

## /dld-modules
**描述**: 列出所有可用模块

**执行**:
```bash
node -e "const {getAllActions}=require('./src/actions');getAllActions().forEach(m=>console.log(m.id,'-',m.name))"
```

---

## /dld-run [module-id]
**描述**: 运行指定模块

**示例**: `/dld-run dailygift`

---

## /dld-add-module
**描述**: 添加新模块的快速指南

**步骤**:
1. 创建 `src/actions/模块名.js`
2. 继承 `ActionBase` 类
3. 实现 `run()` 方法
4. 在 `src/actions/index.js` 中注册
5. 重启服务

---

## /dld-test
**描述**: 运行测试套件

**执行**:
```bash
npx playwright test
```

---

## /dld-coverage
**描述**: 查看测试覆盖率

**执行**:
```bash
npx playwright test --coverage
npx playwright show-report
```

---

## /dld-scheduler
**描述**: 查看定时任务配置

**说明**: 查看 `data/database.sqlite` 中 `module_configs` 表的 `auto_enabled` 和 `auto_time` 字段

---

## 常用快捷操作

### 重启服务
```bash
npm start
```

### 重新登录
```bash
curl -X POST http://localhost:3000/api/login
```

### 查看模块列表
```bash
curl http://localhost:3000/api/modules
```

### 执行模块
```bash
curl -X POST http://localhost:3000/api/run/dailygift
```

### 查看日志
```bash
curl http://localhost:3000/api/logs
```
