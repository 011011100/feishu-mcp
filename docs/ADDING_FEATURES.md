# 飞书多维表格 MCP 服务器 - 功能添加规范

本文档详细说明如何为飞书 Bitable MCP 服务器添加新功能。

## 目录

1. [项目架构概述](#项目架构概述)
2. [添加新功能的完整流程](#添加新功能的完整流程)
3. [核心文件说明](#核心文件说明)
4. [API 实现规范](#api-实现规范)
5. [测试与验证](#测试与验证)
6. [部署流程](#部署流程)

---

## 项目架构概述

```
feishu-mcp/
├── server/mcp/
│   ├── http.ts              # MCP HTTP 服务器入口（Streamable HTTP 协议）
│   ├── index.ts             # MCP stdio 服务器入口（本地调试）
│   ├── server.ts            # MCP 服务器工厂函数
│   └── feishu-client.ts     # 飞书 API 客户端封装
├── docs/
│   └── ADDING_FEATURES.md   # 本文件
└── agent.md                 # 智能体快速入门指南
```

### 技术栈

- **MCP SDK**: `@modelcontextprotocol/sdk` v1.6.0+
- **传输协议**: Streamable HTTP (MCP 2025-03-26 协议版本)
- **飞书 SDK**: `@larksuiteoapi/node-sdk`
- **运行时**: Node.js + TypeScript (tsx)

---

## 添加新功能的完整流程

### 步骤 1：确定功能范围

在添加新功能前，确认以下信息：

1. **飞书 API 端点**: 查看 [飞书开放平台文档](https://open.feishu.cn/document/)
2. **权限需求**: 确认需要的权限 scope
3. **参数设计**: 设计工具的输入参数（使用 Zod 进行验证）
4. **返回格式**: 确定返回给客户端的数据结构

### 步骤 2：在 feishu-client.ts 添加 API 方法

在 `server/mcp/feishu-client.ts` 中添加新的 API 调用方法：

```typescript
/**
 * 新功能描述
 * @param appToken 多维表格的 app_token
 * @param tableId 数据表 ID
 * @param param3 其他参数
 */
async newFeature(appToken: string, tableId: string, param3: string) {
  const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/new-endpoint`

  return this.request<{
    items: any[]
    total: number
  }>('POST', url, {
    param3: param3
  })
}
```

**规范要求**：
- 使用 JSDoc 注释说明方法功能
- 参数类型要明确
- 使用 `this.request<T>()` 统一发送请求
- 返回类型使用泛型指定

### 步骤 3：在 http.ts 添加工具定义

#### 3.1 添加 Zod Schema（用于参数验证）

在文件顶部的 Schema 定义区域添加：

```typescript
const NewFeatureSchema = z.object({
  appToken: z.string().describe('多维表格的 app_token'),
  tableId: z.string().describe('数据表 ID'),
  param3: z.string().describe('参数说明'),
})
```

#### 3.2 在工具列表中添加新工具

在 `createServer()` 函数的 `ListToolsRequestSchema` 处理中添加：

```typescript
{
  name: 'new_feature_name',
  description: '工具的中文描述，说明功能和用途',
  inputSchema: {
    type: 'object',
    properties: {
      appToken: {
        type: 'string',
        description: '多维表格的 app_token（从 URL 中获取）',
      },
      tableId: {
        type: 'string',
        description: '数据表 ID',
      },
      param3: {
        type: 'string',
        description: '参数说明',
      },
    },
    required: ['appToken', 'tableId', 'param3'],
  },
}
```

#### 3.3 在 CallToolRequestSchema 中添加处理逻辑

在 `switch (name)` 语句中添加新 case：

```typescript
case 'new_feature_name': {
  const { appToken, tableId, param3 } = NewFeatureSchema.parse(args)
  const result = await feishu.newFeature(appToken, tableId, param3)
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(result, null, 2),
      },
    ],
  }
}
```

### 步骤 4：添加错误处理

确保在出错时返回标准格式的错误信息：

```typescript
try {
  // ... 工具逻辑
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error)
  return {
    content: [
      {
        type: 'text',
        text: `错误: ${errorMessage}`,
      },
    ],
    isError: true,
  }
}
```

### 步骤 5：更新文档

1. 更新 `README.md` 中的工具列表
2. 添加使用示例
3. 记录新功能的参数说明

---

## 核心文件说明

### feishu-client.ts

飞书 API 客户端，封装了与飞书开放平台的通信。

**关键方法**：
- `getToken()`: 获取 tenant_access_token（带缓存）
- `request<T>()`: 发送 API 请求的统一方法

**添加新 API 的模板**：

```typescript
/**
 * 功能描述
 * API 文档链接: https://open.feishu.cn/document/xxx
 */
async methodName(appToken: string, ...params) {
  const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/xxx`
  return this.request<ReturnType>('METHOD', url, body)
}
```

### http.ts

MCP HTTP 服务器，处理 Streamable HTTP 协议。

**架构说明**：
- 每个客户端连接创建独立的 `Server` 实例
- 使用 `StreamableHTTPServerTransport` 处理传输
- 会话管理通过 `transports` Map 实现

**关键区域**：
1. **Schema 定义区**（顶部）：所有 Zod Schema
2. **工具列表区**（`ListToolsRequestSchema` 处理）：工具元数据
3. **工具处理区**（`CallToolRequestSchema` 处理）：工具逻辑

### index.ts

MCP stdio 服务器，用于本地调试。

**注意**：
- 结构与 `http.ts` 类似，但使用 `StdioServerTransport`
- 修改 `http.ts` 后，通常需要同步修改 `index.ts`

---

## API 实现规范

### 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 工具名 | snake_case | `list_bitable_tables` |
| 方法名 | camelCase | `listTables` |
| Schema 名 | PascalCase | `ListTablesSchema` |
| 参数名 | camelCase | `appToken`, `tableId` |

### 工具描述规范

工具描述应该：
1. 清晰说明功能
2. 说明参数来源
3. 说明返回内容

示例：
```typescript
description: '获取多维表格中的所有数据表，返回表格ID、名称等基本信息'
```

### 参数设计规范

1. **必需参数**: `appToken` 通常是必需的
2. **可选参数**: 使用 `z.optional()` 标记
3. **默认值**: 使用 `z.default(value)` 设置

示例：
```typescript
const ListRecordsSchema = z.object({
  appToken: z.string().describe('多维表格的 app_token'),
  tableId: z.string().describe('数据表 ID'),
  viewId: z.string().optional().describe('视图 ID（可选）'),
  pageSize: z.number().default(500).describe('每页记录数，默认 500'),
})
```

### 返回格式规范

所有工具返回统一格式：

```typescript
return {
  content: [
    {
      type: 'text',
      text: JSON.stringify(result, null, 2),
    },
  ],
  // isError: true  // 仅在出错时添加
}
```

---

## 测试与验证

### 本地测试

1. **启动本地服务器**：
   ```bash
   pnpm start
   ```

2. **使用 mcp-remote 测试**：
   ```bash
   echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | npx mcp-remote http://localhost:3000/sse
   ```

3. **查看健康检查**：
   ```bash
   curl http://localhost:3000/health
   ```

### 测试工具调用

创建测试脚本 `test-tool.js`：

```javascript
const testTool = {
  jsonrpc: '2.0',
  id: 2,
  method: 'tools/call',
  params: {
    name: 'new_feature_name',
    arguments: {
      appToken: 'bascnxxxx',
      tableId: 'tblxxxx',
      param3: 'value'
    }
  }
}

console.log(JSON.stringify(testTool))
```

运行：
```bash
node test-tool.js | npx mcp-remote http://localhost:3000/sse
```

---

## 部署流程

### 1. 提交代码

```bash
git add .
git commit -m "feat: 添加 xxx 功能"
git push origin main
```

### 2. 验证部署

Zeabur 会自动部署。验证：

```bash
curl https://feishu-mcp.preview.tencent-zeabur.cn/health
```

### 3. 测试远程连接

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize",...}' | npx mcp-remote https://feishu-mcp.preview.tencent-zeabur.cn/sse
```

### 4. 重启 Claude Code

在 Claude Code 中运行 `/mcp` 验证连接状态。

---

## 附录

### 常用飞书 Bitable API 端点

| 功能 | HTTP 方法 | 端点 |
|------|-----------|------|
| 列出数据表 | GET | `/open-apis/bitable/v1/apps/{app_token}/tables` |
| 列出记录 | GET | `/open-apis/bitable/v1/apps/{app_token}/tables/{table_id}/records` |
| 新增记录 | POST | `/open-apis/bitable/v1/apps/{app_token}/tables/{table_id}/records` |
| 更新记录 | PUT | `/open-apis/bitable/v1/apps/{app_token}/tables/{table_id}/records/{record_id}` |
| 删除记录 | DELETE | `/open-apis/bitable/v1/apps/{app_token}/tables/{table_id}/records/{record_id}` |
| 列出视图 | GET | `/open-apis/bitable/v1/apps/{app_token}/tables/{table_id}/views` |

### 参考文档

- [飞书开放平台 - 多维表格](https://open.feishu.cn/document/server-docs/docs/bitable-v1/bitable-overview)
- [MCP SDK TypeScript 文档](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP 协议规范](https://modelcontextprotocol.io/)
