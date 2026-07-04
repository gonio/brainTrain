# BrainTrain 多人对战后端

多人对战（Versus Mode）的实时后端：Node + Express + Socket.IO + Postgres。提供匿名账号、（后续）房间匹配、舒尔特 1v1 同步竞速、准确率排行榜。

对应设计 spec：`brain-train/docs/superpowers/specs/2026-07-04-multiplayer-versus-design.md`

## 开发环境准备

### 1. 装 Postgres（本机）

推荐用 Docker：

```bash
docker run -d --name bt-pg \
  -e POSTGRES_USER=braintrain \
  -e POSTGRES_PASSWORD=braintrain \
  -e POSTGRES_DB=braintrain \
  -p 5432:5432 \
  postgres:16
```

再建一个测试库（测试代码用，避免污染开发数据）：

```bash
docker exec -it bt-pg psql -U braintrain -c "CREATE DATABASE braintrain_test;"
```

或本机原生安装 Postgres 后，手动建库建用户：

```bash
psql -U postgres -c "CREATE USER braintrain WITH PASSWORD 'braintrain';"
psql -U postgres -c "CREATE DATABASE braintrain OWNER braintrain;"
psql -U postgres -c "CREATE DATABASE braintrain_test OWNER braintrain;"
```

### 2. 配置环境变量

```bash
cd server
cp .env.example .env
# 按需修改 .env 里的 DATABASE_URL / 密码
```

### 3. 安装与启动

```bash
npm install
npm run dev   # 热重载（tsx watch），监听 3001
```

启动成功会打印：`[server] 多人对战后端已启动，端口 3001`

### 4. 测试

```bash
npm test            # 跑全部测试
npx vitest run tests/authService.test.ts   # 跑单个文件
```

> **注意：** 纯逻辑测试（`authService.test.ts`、`authStore.test.ts`、`versusSocket.test.ts`、`app.test.ts`）不需要 Postgres 即可通过。DB 集成测试（`db.test.ts`、`authRepository.test.ts`、`authRoutes.test.ts`、`socketAuth.test.ts`）需要 Postgres 运行并配置好 `TEST_DATABASE_URL`。

## 本地冒烟验证

启动后端后（`npm run dev`），用 curl 验证 REST：

```bash
# 健康检查
curl http://localhost:3001/api/health
# 预期：{"status":"ok"}

# 建匿名账号
curl -X POST http://localhost:3001/api/auth/anonymous
# 预期：{"user":{"id":"...","username":"迅捷猎豹#3F7K","avatar":"🦊","token":"...","createdAt":"..."},"token":"..."}

# 用返回的 token 查当前用户（替换 <TOKEN>）
curl http://localhost:3001/api/auth/me -H "Authorization: Bearer <TOKEN>"
# 预期：{"user":{...}}

# 不带 token 应返回 401
curl http://localhost:3001/api/auth/me
# 预期：{"error":"未提供 token"}
```

Socket.IO 鉴权验证（浏览器 console，前端 dev 已启动）：

```javascript
// 先建号
const r = await fetch('http://localhost:3001/api/auth/anonymous', { method: 'POST' });
const { token } = await r.json();

// 带有效 token 连 socket
const sock = io('http://localhost:3001', { auth: { token } });
sock.on('connect', () => console.log('连接成功', sock.id));
sock.on('connect_error', (e) => console.log('连接失败', e.message));
// 预期：打印「连接成功 <socketid>」

// 无效 token 应被拒
const bad = io('http://localhost:3001', { auth: { token: '错的' } });
bad.on('connect_error', (e) => console.log('预期失败:', e.message));
// 预期：打印「预期失败: token 无效」
```

## 生产部署（腾讯轻量服务器）

### Postgres

```bash
sudo apt install postgresql
sudo -u postgres psql -c "CREATE USER braintrain WITH PASSWORD '强密码';"
sudo -u postgres psql -c "CREATE DATABASE braintrain OWNER braintrain;"
```

### Node 服务（PM2 守护）

```bash
cd /data/server   # 后端代码部署位置
npm ci --omit=dev
npm run build
pm2 start dist/index.js --name braintrain-server
pm2 save
pm2 startup        # 开机自启
```

### Nginx 反代（追加到现有 server 配置）

现有 Nginx 已服务前端静态文件（`/data/www/`），追加后端反代：

```nginx
# 在现有 server 块内追加
location /api/ {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}

location /socket.io/ {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

重载：`sudo nginx -t && sudo nginx -s reload`

### 生产 .env

```env
DATABASE_URL=postgresql://braintrain:强密码@localhost:5432/braintrain
PORT=3001
CORS_ORIGIN=https://你的域名
```

## 目录结构

```
server/
├── src/
│   ├── config.ts              # 环境变量配置
│   ├── db.ts                  # Postgres 连接池 + schema 初始化
│   ├── app.ts                 # Express + Socket.IO 组装
│   ├── index.ts               # 启动入口
│   ├── types.ts               # 共享类型
│   ├── schema.sql             # 建表 SQL（users）
│   ├── auth/
│   │   ├── authService.ts     # 纯逻辑：昵称/头像/token 生成
│   │   ├── authRepository.ts  # users 表增查
│   │   ├── authRoutes.ts      # POST /anonymous, GET /me
│   │   └── authMiddleware.ts  # Bearer token 鉴权中间件
│   └── realtime/
│       └── socketAuth.ts      # Socket.IO 连接鉴权中间件
├── tests/                     # vitest 测试
│   ├── setup.ts               # 全局 setup（仅设 NODE_ENV）
│   ├── setupDb.ts             # DB 测试 opt-in 生命周期
│   └── helpers.ts             # 测试辅助（buildTestApp）
├── schema.sql → 实际在 server/schema.sql
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── .env.example
```

## 当前进度（计划一）

✅ 后端骨架 + 匿名账号 + Postgres 已完成。后续计划：

- 计划二：Room Engine + 大厅 + 匹配
- 计划三：舒尔特 PvP
- 计划四：战绩 + 排行榜
- 计划五：前端大厅 + 对战页 + 排行榜页 UI
