# Brainstorm Summary — data-layer-migration

## 确认的技术方案
- DataLayer 单例 + better-sqlite3
- 序号 SQL 迁移（SHA256 checksum 幂等）
- RepositoryBase<T> 泛型 CRUD + 6 个具体 Repository
- 遗留数据迁移脚本 (better-sqlite3 直接读旧库)
- 默认数据库路径：packages/server/data/database.sqlite

## 关键取舍与风险
- better-sqlite3 native 编译风险：Windows 需 build-tools
- 两个数据库文件分离：旧 app 仍用 data/database.sqlite，新层用 packages/server/data/
- Migration 顺序依赖文件名编号

## 测试策略
- :memory: DB 跑 CRUD roundtrip 测试
- 文件 DB 跑迁移幂等验证

## Spec Patch
无需要 patch 的 spec
