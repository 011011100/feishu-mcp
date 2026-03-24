# 智能体快速入门指南

本指南帮助 AI 智能体快速理解飞书多维表格 MCP 服务器项目。

## 项目速览

| 属性 | 值 |
|------|-----|
| **项目名称** | feishu-mcp |
| **用途** | 飞书多维表格 (Bitable) 的 MCP 服务器 |
| **传输协议** | Streamable HTTP (MCP 2025-03-26) |
| **部署平台** | Zeabur |
| **域名** | https://feishu-mcp.preview.tencent-zeabur.cn/ |

## 核心架构

```
┌─────────────────┐
│  Claude Code    │
│    (本地)       │
└────────┬────────┘
         │ stdio
         ▼
┌─────────────────┐
│  mcp-remote     │
│  (本地桥接)      │
└────────┬────────┘
         │ HTTP POST /sse
         ▼
┌─────────────────┐
│  Zeabur 服务器   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 飞书开放平台 API │
└─────────────────┘
```

### 关键文件映射

| 文件 | 职责 |
|------|------|
| `server/mcp/http.ts` | **主入口**。Streamable HTTP 服务器，处理所有 MCP 请求 |
| `server/mcp/feishu-client.ts` | 飞书 API 客户端，封装认证和请求 |
| `server/mcp/index.ts` | stdio 模式入口（本地调试用） |
| `package.json` | 依赖：MCP SDK 1.6.0, 飞书 SDK |

## 当前功能清单

### 已实现工具

| 工具名 | 方法名 | 飞书 API |
|--------|--------|----------|
| `list_bitable_tables` | `listTables()` | GET `/apps/{app_token}/tables` |
| `list_bitable_records` | `listRecords()` | GET `/apps/{app_token}/tables/{table_id}/records` |
| `search_bitable_records` | `searchRecords()` | 客户端过滤实现 |
| `get_bitable_views` | `getViews()` | GET `/apps/{app_token}/tables/{table_id}/views` |

### 参数规范

**通用必需参数**：
- `appToken`: 多维表格的 app_token（从飞书 URL 获取）

**数据表相关**：
- `tableId`: 数据表 ID
- `viewId` (可选): 视图 ID
- `pageSize` (可选): 每页记录数，默认 500

**搜索相关**：
- `fieldName`: 要搜索的字段名
- `keyword`: 搜索关键词

## 快速修改指南

### 场景 1：添加新工具

```typescript
// 1. feishu-client.ts - 添加 API 方法
async newMethod(appToken: string) {
  const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/new-endpoint`
  return this.request<ReturnType>('GET', url)
}

// 2. http.ts - 添加 Schema
const NewMethodSchema = z.object({
  appToken: z.string().describe('多维表格的 app_token'),
})

// 3. http.ts - 在 ListToolsRequestSchema 添加工具元数据
{
  name: 'new_method',
  description: '描述',
  inputSchema: { ... }
}

// 4. http.ts - 在 CallToolRequestSchema 添加处理逻辑
case 'new_method': {
  const { appToken } = NewMethodSchema.parse(args)
  const result = await feishu.newMethod(appToken)
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
}
```

### 场景 2：修改现有工具

1. 修改 `feishu-client.ts` 中的对应方法
2. 更新 `http.ts` 中的 Schema（如有参数变更）
3. 更新工具 `inputSchema` 定义

### 场景 3：调试问题

**检查日志**：
```bash
# Zeabur 控制台查看 Runtime Logs
```

**本地测试**：
```bash
# 1. 启动本地服务器
npm run start

# 2. 测试连接
curl http://localhost:3000/health

# 3. 测试 MCP 协议
echo '{"jsonrpc":"2.0","id":1,"method":"initialize",...}' | npx mcp-remote http://localhost:3000/sse
```

## 关键代码模式

### 1. 请求认证流程

```typescript
// feishu-client.ts
private async getToken(): Promise<string> {
  // 带缓存的 token 获取
  if (this.tokenCache && Date.now() < this.tokenExpireTime) {
    return this.tokenCache
  }
  // 调用飞书 auth API
}

private async request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const token = await this.getToken()
  // 发送带 Authorization header 的请求
}
```

### 2. 会话管理

```typescript
// http.ts
const transports = new Map<string, StreamableHTTPServerTransport>()

app.post('/sse', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined
  let transport = sessionId ? transports.get(sessionId) : undefined

  if (!transport && isInitializeRequest(req.body)) {
    // 创建新会话
    const newSessionId = randomUUID()
    transport = new StreamableHTTPServerTransport({...})
    const server = createServer() // 每个会话独立 Server
    await server.connect(transport)
  }
})
```

### 3. 错误处理模式

```typescript
try {
  const result = await feishu.someMethod(...)
  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
  }
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error)
  return {
    content: [{ type: 'text', text: `错误: ${errorMessage}` }],
    isError: true,
  }
}
```

## 常见陷阱

### ❌ 不要这样做

```typescript
// 错误：共享 Server 实例
const server = createServer() // 全局创建

app.post('/sse', async (req, res) => {
  await server.connect(transport) // 错误！会报错 "Already connected"
})
```

### ✅ 正确做法

```typescript
// 正确：每个会话独立 Server
app.post('/sse', async (req, res) => {
  const server = createServer() // 会话内创建
  await server.connect(transport)
})
```

## 部署与发布

### 提交规范

```bash
git add .
git commit -m "feat: 添加 xxx 功能"
git push origin main
```

Zeabur 会自动部署。

### 验证部署

```bash
# 检查健康端点
curl https://feishu-mcp.preview.tencent-zeabur.cn/health

# 验证 MCP 连接
echo '{...}' | npx mcp-remote https://feishu-mcp.preview.tencent-zeabur.cn/sse
```

## 参考资源

- **详细开发规范**: `docs/ADDING_FEATURES.md`
- **飞书 API 文档**: https://open.feishu.cn/document/server-docs/docs/bitable-v1/
- **MCP 协议规范**: https://modelcontextprotocol.io/
- **当前域名**: https://feishu-mcp.preview.tencent-zeabur.cn/

## 快速诊断清单

| 问题 | 检查点 |
|------|--------|
| MCP 连接失败 | 检查 Zeabur 部署状态、健康端点 |
| 工具调用失败 | 检查 feishu-client 方法、环境变量 |
| 认证失败 | 检查 FEISHU_APP_ID/SECRET |
| 500 错误 | 查看 Zeabur Runtime Logs |

---

**最后更新**: 2026-03-24
