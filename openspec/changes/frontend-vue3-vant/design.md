## Design Approach

### Pages
- Login: QR login status polling, JWT token storage (localStorage)
- Accounts: list accounts, add by uin, delete with confirm
- Modules: list from /api/modules, run with POST /api/run/:id
- Logs: list from /api/logs, clear with DELETE /api/logs

### Navigation
Vant Tabbar at bottom with 4 tabs: 首页 (Status), 账号 (Accounts), 模块 (Modules), 日志 (Logs)

### HTTP Client
Axios instance with baseURL to Fastify (port 3001), interceptor attaches JWT from localStorage.

### Auth Flow
1. User logs in via QR → JWT stored in localStorage
2. Axios interceptor adds Authorization: Bearer <token>
3. 401 response → redirect to login page
