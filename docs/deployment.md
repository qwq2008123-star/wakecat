# 部署可靠性说明(WAKECAT)

## 图片存储
- 演示/单机:`data/uploads/` 本地目录(`WAKECAT_UPLOAD_DIR` 可改路径)。**容器化/重建时该目录默认丢失**——挂载持久卷或设置 `WAKECAT_STORAGE=s3|oss` 启用对象存储适配层(`src/lib/storage.ts`,实现 `ImageStorage` 接口)。
- 图片通过 `/api/img/[name]` 服务,由适配层取回。

## 数据库
- 当前 SQLite(WAL)是**单文件本地库**:只支持单实例读写。多实例/水平扩容必须迁移 PostgreSQL(drizzle 已抽象,换 driver + 连接串即可,SQL 方言需回归)。
- 单实例多进程(如 pm2 cluster)会撞 WAL 写锁——保持单进程,或迁移 PG。
- 备份:定期复制 `data/wakecat.db`(+ `-wal/-shm` 或用 `VACUUM INTO`)。

## 店铺数据隔离
- 所有业务表带 store_id,查询一律带 store_id 过滤;会话读取/写入双校验 store_id + 身份归属(见 services.deliverInSite 与 messages 路由)。
- 新增接口时必须走 requireUser(user.storeId) 或 getBoundMember(store.id, visitorId),禁止裸 query。
