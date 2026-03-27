# TDD 测试驱动开发指南

## 工作流程

### 1. RED - 写失败的测试
```javascript
// test-friendfight.js
const { parseXiaFriends } = require('./src/game/friendfight');

test('parseXiaFriends 应提取好友 UID 和名称', () => {
  const html = '侠：<a href="...B_UID=166...">财神发财鹅</a>288 级';
  const result = parseXiaFriends(html);
  
  // 此时函数可能还不存在或返回空数组
  expect(result).toHaveLength(1);
  expect(result[0].uid).toBe('166');
  expect(result[0].name).toBe('财神发财鹅');
});
```

### 2. GREEN - 实现最少代码
```javascript
// src/game/friendfight.js
function parseXiaFriends(html) {
  // 只实现让测试通过的最少代码
  const uidMatch = html.match(/B_UID=(\d+)/);
  const nameMatch = html.match(/>([^<]+)<\/a>/);
  
  return [{
    uid: uidMatch[1],
    name: nameMatch[1].trim()
  }];
}
```

### 3. REFACTOR - 重构改进
- 提取重复代码
- 改进命名
- 添加注释
- 优化性能

### 4. VERIFY - 验证
```bash
# 运行测试
node test-friendfight.js

# 检查覆盖率
# 确保 >= 80%
```

## 测试模式

### 单元测试
```javascript
// 测试单个函数
test('parseXiaFriends 解析好友信息', () => {
  // ...
});
```

### 集成测试
```javascript
// 测试模块间交互
test('scanAllXiaFriends 扫描所有好友', async () => {
  // ...
});
```

### 边界测试
```javascript
// 测试边界情况
test('空 HTML 返回空数组', () => {
  expect(parseXiaFriends('')).toEqual([]);
});

test('HTML 无好友返回空数组', () => {
  expect(parseXiaFriends('<html></html>')).toEqual([]);
});
```

## 测试检查清单

- [ ] 正常情况
- [ ] 边界情况（空值、极大值、极小值）
- [ ] 错误情况（无效输入、网络错误）
- [ ] 性能要求

## 常用断言

```javascript
// 值相等
expect(result.uid).toBe('166');
expect(result.level).toEqual('288 级');

// 数组
expect(friends).toHaveLength(10);
expect(friends).toContainEqual({ uid: '166' });

// 布尔值
expect(success).toBe(true);
expect(error).toBeDefined();

// 字符串
expect(name).toMatch(/财神/);
expect(html).toContain('B_UID');
```
