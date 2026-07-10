# QQ 大乐斗助手 — 登录流程说明文档

> 本文档完整记录了 QQ 大乐斗游戏的扫码登录流程，包括涉及的 URL、Cookie、关键算法，以及历史上踩过的坑。
> 供后续维护参考，防止同类问题再次出现。

---

## 一、整体流程概览

游戏「QQ 大乐斗」(`dld.qzapp.z.qq.com`) 使用 **QQ 互联(OAuth 2.0)** 进行登录鉴权。整个流程由 7 步组成，涉及 3 个域名：

```
xui.ptlogin2.qq.com   ← 扫码登录核心（二维码、轮询、check_sig）
graph.qq.com          ← QQ 互联 OAuth（authorize、获取 code）
dld.qzapp.z.qq.com    ← 游戏站点（用 code 换 openId / accessToken）
```

```
用户打开登录页
     │
     ▼
① 加载 xlogin 页面      →  获取 pt_login_sig 等 session cookie
     │
     ▼
② 请求 ptqrshow         →  获取 qrsig cookie + 二维码 PNG
     │
     ▼
③ 轮询 ptqrlogin       →  返回 ptuiCB('66'/'67'/'0', ...)，code=0 表示扫码成功
     │                     第 3 个参数是 check_sig 回调 URL
     ▼
④ GET check_sig URL      →  302 跳转到 graph.qq.com/oauth2.0/login_jump
     │                     ⚠️ 此步设置 p_skey、p_uin、pt_oauth_token 等关键 cookie
     ▼
⑤ POST oauth2.0/authorize →  302 跳转到 dld.qzapp.z.qq.com/index.php?code=XXXX
     │                     ⚠️ 需要 g_tk（由 p_skey 计算）作为 CSRF token
     ▼
⑥ GET index.php?code=X   →  设置 openId、accessToken、newuin cookie
     │                     302 跳转到游戏主页 phonepk?cmd=index
     ▼
⑦ 后续所有游戏请求携带 openId + accessToken + newuin cookie
```

---

## 二、详细步骤

### Step 1 — 加载 xlogin 页面（初始化 session）

```
GET https://xui.ptlogin2.qq.com/cgi-bin/xlogin
    ?appid=716027609
    &daid=383
    &style=33
    &login_text=登录
    &hide_title_bar=1
    &hide_border=1
    &target=self
    &s_url=<URLENCODED https://graph.qq.com/oauth2.0/login_jump>
    &pt_3rd_aid=102067279
```

**作用**：初始化登录 session。

**获取的 Cookie**（Domain: `.ptlogin2.qq.com`）：

| Cookie | 说明 |
|--------|------|
| `pt_login_sig` | 登录签名，后续 ptqrlogin 请求需要 |
| `pt_user_id` | 用户 ID 标识 |
| `pt_clientip` / `pt_serverip` | 客户端/服务器 IP 标识 |
| `pt_local_token` | 本地 token |
| `uikey` | UI key |
| `pt_guid_sig` | GUID 签名 |

---

### Step 2 — 获取二维码

```
GET https://xui.ptlogin2.qq.com/ssl/ptqrshow
    ?appid=716027609
    &e=2
    &l=M
    &s=3
    &d=72
    &v=4
    &t=<random>
    &daid=383
    &pt_3rd_aid=102067279
    &u1=<URLENCODED https://graph.qq.com/oauth2.0/login_jump>
```

**作用**：获取二维码图片和 `qrsig`。

**请求头**：需要携带 Step 1 获取的 Cookie。

**响应**：
- **Body**：PNG 图片（base64 后给前端 `<img>` 显示）
- **Set-Cookie**：`qrsig=XXXX`（Domain: `.ptlogin2.qq.com`）

---

### Step 3 — 轮询扫码状态

```
GET https://xui.ptlogin2.qq.com/ssl/ptqrlogin
    ?u1=<URLENCODED https://graph.qq.com/oauth2.0/login_jump>
    &ptqrtoken=<hash33(qrsig)>
    &ptredirect=0
    &h=1
    &t=1
    &g=1
    &from_ui=1
    &ptlang=2052
    &action=0-0-<timestamp>
    &js_ver=26030415
    &js_type=1
    &login_sig=<URLENCODED pt_login_sig>
    &pt_uistyle=40
    &aid=716027609
    &daid=383
    &pt_3rd_aid=102067279
```

**关键**：`ptqrtoken` = `hash33(qrsig)`，算法见 [附录 A](#附录-a--hash33-算法)。

**请求头**：需要携带 `pt_login_sig` + `qrsig` 等 Cookie。

**响应**（text/html，非 JSON）：

```
ptuiCB('CODE','sub','callbackUrl','param','msg','nickname');
```

| code | 含义 |
|------|------|
| `66` | 等待扫码 |
| `67` | 已扫码，等待手机确认 |
| `0`  | 登录成功 → `callbackUrl` 是 check_sig URL，`nickname` 是 QQ 昵称 |
| `65` | 二维码过期 |

**成功时 callbackUrl 示例**：

```
https://ssl.ptlogin2.graph.qq.com/check_sig
    ?pttype=1
    &uin=1157247929
    &service=ptqrlogin
    &nodirect=0
    &ptsigx=XXXX
    &s_url=https%3A%2F%2Fgraph.qq.com%2Foauth2.0%2Flogin_jump
    &ptlang=2052
    &ptredirect=100
    &aid=716027609
    &daid=383
    &pt_3rd_aid=102067279
    ...
```

---

### Step 4 — GET check_sig URL（获取 graph.qq.com cookies）

```
GET <callbackUrl from Step 3>
```

**请求头**：携带当前所有 Cookie。

**响应**：`302 → https://graph.qq.com/oauth2.0/login_jump`

**⚠️ 最重要的 Cookie 在这一步设置**（Domain: `.graph.qq.com`）：

| Cookie | 说明 |
|--------|------|
| **`p_skey`** | **计算 g_tk 的关键，必须有值** |
| `p_uin` | `o` + QQ 号 |
| `pt4_token` | token |
| `pt_oauth_token` | OAuth 临时 token |
| `pt_login_type` | 登录类型（值为 `3`） |

同时设置（Domain: `.ptlogin2.qq.com` / `.qq.com`）：

| Cookie | 说明 |
|--------|------|
| `pt2gguin` | `o` + QQ 号 |
| `superuin` / `supertoken` / `superkey` | 上次登录凭据 |
| `ptcz` / `RK` | 通用 QQ cookie |
| `ptnick_<uin>` | QQ 昵称 |

---

### ⚠️ 坑点：同名 Set-Cookie 互相覆盖

check_sig 响应会发送**多个同名 Set-Cookie**，但 Domain 不同。例如：

```
Set-Cookie: p_skey=jdsF03YeY0VWSHlTs2Gv...; Domain=graph.qq.com; Secure;     ← 真实值
Set-Cookie: p_skey=; Expires=Thu, 01 Jan 1970; Domain=qq.com;               ← 删除指令（空值）
```

如果用 `Record<string, string>` 存储 cookie，后解析的空值会**覆盖**前面的真实值，导致 `p_skey` 丢失，后续 `g_tk` 算出来是 `5381`（初始值，因为没有 p_skey 字符），authorize POST 会失败。

**解决方案**（`packages/server/src/auth/qq-login-client.ts:32`）：
检测 `Expires=...1970` 的删除型 Set-Cookie，跳过不处理：

```typescript
const isDelete = parts.some((p: string) => {
  const t = p.trim().toLowerCase();
  return t.startsWith('expires=') && t.includes('1970');
});
if (isDelete && cookies[name]) continue;  // 已有真实值，跳过删除指令
```

---

### Step 5 — POST oauth2.0/authorize（获取 OAuth code）

这是整个流程最关键的一步，模拟浏览器中 `login_jump` 页面通过 `postMessage` 触发的 `Q.agree()` 表单提交。

```
POST https://graph.qq.com/oauth2.0/authorize

Content-Type: application/x-www-form-urlencoded
Referer: https://graph.qq.com/oauth2.0/show?which=Login&display=pc&response_type=code
         &client_id=102067279&redirect_uri=https://dld.qzapp.z.qq.com/index.php&scope=all
Cookie: <携带 Step 4 获取的全部 graph.qq.com cookie>
```

**表单参数**：

| 参数 | 值 | 说明 |
|------|-----|------|
| `response_type` | `code` | OAuth code 模式 |
| `client_id` | `102067279` | 大乐斗的 QQ 互联 appid |
| `redirect_uri` | `https://dld.qzapp.z.qq.com/index.php` | 游戏首页 |
| `scope` | `all` | 授权范围 |
| `from_ptlogin` | `1` | 表示从 ptlogin 登录 |
| `src` | `1` | 来源标识 |
| `update_auth` | `0` | 不更新授权 |
| `openapi` | `#` | 默认授权 |
| **`g_tk`** | `<由 p_skey 计算>` | **CSRF token，必须正确** |
| `auth_time` | `Date.now()` | 当前时间戳 |
| `ui` | `<graph.qq.com 的 ui cookie>` | UI 标识 |

**响应**：`302 → https://dld.qzapp.z.qq.com/index.php?code=6FC773E727EACCFF8316EB125B8066A9`

从 Location 头中提取 `code` 参数。

> **如果 g_tk 不正确**（如 `5381`），authorize 会 302 回 `graph.qq.com/oauth2.0/show?which=Login`（重新要求登录），而不是带 code 跳转游戏站。

---

### Step 6 — GET 游戏首页（用 code 换游戏 cookie）

```
GET https://dld.qzapp.z.qq.com/index.php?code=<OAuth code>
```

**响应**：

- `302 → https://dld.qzapp.z.qq.com/qpet/cgi-bin/phonepk?cmd=index&channel=0`
- **Set-Cookie**（Domain: `.qq.com`）：

| Cookie | 说明 |
|--------|------|
| **`openId`** | 游戏 openid，唯一用户标识 |
| **`accessToken`** | 游戏访问令牌 |
| **`newuin`** | QQ 号（不带 `o` 前缀） |

> 这 3 个 cookie 是游戏鉴权的核心，后续所有游戏请求都需要携带。

---

### Step 7 — 后续游戏请求

```
GET https://dld.qzapp.z.qq.com/qpet/cgi-bin/phonepk?cmd=<CMD>&channel=0&g_ut=1
Cookie: openId=XXX; accessToken=XXX; newuin=XXX; ...
```

如果 cookie 失效，返回的 HTML 是一个自动跳转登录页：

```html
<meta http-equiv="refresh" content="1;url=https://xui.ptlogin2.qq.com/cgi-bin/xlogin?...">
<script>location.replace("https://xui.ptlogin2.qq.com/...")</script>
```

这时需要重新走 Step 1-6 扫码登录。

---

## 三、关键算法

### 附录 A — hash33 算法

用于 Step 3 计算 `ptqrtoken`。

```typescript
function hash33(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash += (hash << 5) + s.charCodeAt(i);
  }
  return hash & 0x7fffffff;  // 确保是正整数
}
```

**输入**：`qrsig` cookie 的值。

---

### 附录 B — g_tk 算法

用于 Step 5 计算 CSRF token。

```typescript
function calcGtk(pSkey: string): number {
  let hash = 5381;  // ⚠️ 注意初始值是 5381，不是 0！与 hash33 不同
  for (let i = 0; i < pSkey.length; i++) {
    hash += (hash << 5) + pSkey.charCodeAt(i);
  }
  return hash & 0x7fffffff;
}
```

**输入**：`p_skey` cookie 的值（Domain: `.graph.qq.com`）。

**重要**：`g_tk` 和 `hash33` 算法几乎相同，**唯一区别是初始值** —— `hash33` 从 `0` 开始，`g_tk` 从 `5381` 开始。

如果 `p_skey` 为空，`g_tk` 会等于 `5381`（初始值本身），authorize 请求会失败。

---

### 附录 C — ptuiCB 响应解析

`ptqrlogin` 返回的不是 JSON，而是 JS 回调格式：

```
ptuiCB('0', '0', 'https://ssl.ptlogin2.graph.qq.com/check_sig?...', '0', 'login', '融化的泪');
```

参数顺序（逗号分隔，单引号包裹）：

| 位置 | 含义 |
|------|------|
| 1 | 状态码（`0` = 成功） |
| 2 | sub |
| 3 | callbackUrl（成功时是 check_sig URL） |
| 4 | param |
| 5 | 消息（如 `login`） |
| 6 | 昵称 |

解析时需要注意参数内可能包含逗号，需按单引号配对分割。

---

## 四、历史踩坑记录

### 坑 1：用 `pt_oauth_token` 当 OAuth code（旧版错误）

**现象**：登录显示成功，但游戏模块执行全部返回"未知错误"。

**原因**：旧代码在 `completeLogin()` 中读取 `pt_oauth_token` cookie 值作为 OAuth code 直接拼接游戏 URL。实际上 `pt_oauth_token` 不是 OAuth code，真正的 code 需要通过 POST `authorize` 获取。

**正确做法**：先走 check_sig 获取 `p_skey` → 计算 `g_tk` → POST `authorize` → 从 302 Location 中提取 `code`。

---

### 坑 2：同名 Set-Cookie 覆盖导致 p_skey 丢失

**现象**：`g_tk` 恒为 `5381`，authorize POST 总是失败。

**原因**：`check_sig` 响应包含多个同名 Set-Cookie，一个带 Domain=`graph.qq.com` 的真实值，一个带 Domain=`qq.com` 的空值删除指令。用 `Record<string, string>` 存储时，空值覆盖了真实值。

**解决方案**：在 `parseSetCookie()` 中检测 `Expires=...1970` 的删除型 Set-Cookie，如果 cookie 已有值则跳过。同时 `mergeCookies()` 中空值不覆盖已有非空值。

---

### 坑 3：服务器未重启导致旧代码运行

**现象**：代码已修改但行为不变。

**原因**：`tsx` (TypeScript 执行器) 不热重载。修改 `.ts` 源码后必须杀掉旧 Node 进程并重新启动服务器。

**教训**：每次修改登录代码后，**必须重启服务器**再测试。

---

### 坑 4：better-sqlite3 原生模块缺失

**现象**：服务器无法启动，报 `Could not locate the bindings file`。

**原因**：`better-sqlite3` 是 C++ 原生模块，需要编译。它绑定特定的 Node ABI 版本（如 Node 20 = NODE_MODULE_VERSION 115）。`npm rebuild` 需要 Visual Studio（Windows），如果没有则失败。错误的 `npm install` 可能会清空 `build/Release/` 目录。

**解决方案**：从 GitHub Releases 下载对应版本的预编译二进制：
- 下载 `better-sqlite3-v11.0.0-node-v115-win32-x64.tar.gz`
- 解压后将 `better_sqlite3.node` 复制到 `packages/server/node_modules/better-sqlite3/build/Release/` 和 `build/` 目录

---

## 五、相关文件

| 文件 | 说明 |
|------|------|
| `packages/server/src/auth/qq-login-client.ts` | 登录核心实现（initSession / getQrCode / checkStatus / completeLogin） |
| `packages/server/src/auth/routes.ts` | Fastify 路由（/qr/start, /qr/status, /login, /logout） |
| `packages/server/src/gateway/cookie-manager.ts` | Cookie 管理（从 DB 读取账号 cookie） |
| `packages/server/src/modules/daily-gift/index.ts` | 每日奖励模块（测试登录是否成功的首选） |
| `packages/server/login-debug.log` | completeLogin 调试日志（每次登录追加写入） |
| `capture-login-flow.js` | 早期的 puppeteer 登录流程抓取脚本（根目录） |
| `login-capture-summary.json` | 抓取的完整登录流程结构化数据 |

---

## 六、快速验证步骤

1. 启动服务器（Node v20，需要 better-sqlite3 原生模块）：

```bash
cd packages/server
JWT_SECRET=dev-secret-key node ../../node_modules/tsx/dist/cli.mjs src/server.ts
```

2. 获取二维码：

```bash
curl -X POST http://localhost:3001/api/auth/qr/start
# 返回 { sessionId, qrImage (data:image/png;base64,...) }
```

3. 用手机 QQ 扫码确认。

4. 轮询状态：

```bash
curl http://localhost:3001/api/auth/qr/status?id=<sessionId>
# 成功返回 { status: "success", token: "...", account: {...} }
```

5. 执行游戏模块验证 cookie 有效：

```bash
curl -X POST http://localhost:3001/api/run/dailygift \
  -H "Authorization: Bearer <token>"
# 成功返回 { success: true, result: { status: "success", ... } }
```

6. 检查调试日志确认流程：

```bash
tail -30 packages/server/login-debug.log
# 应看到: g_tk: <非5381的数字>, OAuth code: XXX, game Set-Cookie: openId=..., accessToken=..., newuin=...
```