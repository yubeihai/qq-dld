# 持续学习指南

## 使用方法

在会话结束时，自动提取学到的模式和经验。

## 学习内容

### 1. 代码模式
```markdown
## 模式：HTML 实体解码后解析

**场景**: 解析游戏返回的 HTML

**步骤**:
1. 先解码 &amp; 实体
2. 使用正则提取数据
3. 处理可能的空值

**代码示例**:
const decodedHtml = html.replace(/&amp;/g, '&');
const match = decodedHtml.match(/B_UID=(\d+)/);
```

### 2. 调试经验
```markdown
## 经验：正则匹配失败的排查

**问题**: 字符串看起来匹配但正则返回 null

**原因**: 
- 字符编码问题
- 隐藏的空格或特殊字符
- 全局正则的状态问题

**解决**:
- 打印字符编码验证
- 使用 .replace(/\s+/g, '') 清理
- 避免重复使用全局正则
```

### 3. 项目知识
```markdown
## 知识：侠友数据结构

**字段**:
- uid: 用户 ID
- name: 昵称
- level: 等级 (如 "288 级")
- menpai: 门派/帮派
- type: friend/mem/xialv

**存储位置**: module_configs.extra_data.xia_friends
```

## 导出格式

```markdown
# 学习记录 - YYYY-MM-DD

## 新学到的模式
1. ...

## 遇到的问题和解决
1. ...

## 需要记住的事项
1. ...
```

## 会话结束时执行

1. 回顾本次会话完成的任务
2. 提取可复用的模式
3. 记录遇到的问题
4. 保存到 `.claude/learnings/` 目录
