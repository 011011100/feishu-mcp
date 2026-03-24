import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import express from 'express'
import { FeishuClient } from './feishu-client'
import { randomUUID } from 'crypto'

// 创建 Express 应用
const app = express()
app.use(express.json())
const PORT = process.env.PORT || 3000

// 工具参数定义
const ListTablesSchema = z.object({
  appToken: z.string().describe('多维表格的 app_token'),
})

const ListRecordsSchema = z.object({
  appToken: z.string().describe('多维表格的 app_token'),
  tableId: z.string().describe('数据表 ID'),
  viewId: z.string().optional().describe('视图 ID（可选）'),
  pageSize: z.number().default(500).describe('每页记录数，默认 500'),
})

const SearchRecordsSchema = z.object({
  appToken: z.string().describe('多维表格的 app_token'),
  tableId: z.string().describe('数据表 ID'),
  fieldName: z.string().describe('要搜索的字段名'),
  keyword: z.string().describe('搜索关键词'),
})

// 飞书客户端 - 延迟初始化
let feishuClient: FeishuClient | null = null

function getFeishuClient(): FeishuClient {
  if (!feishuClient) {
    feishuClient = new FeishuClient()
  }
  return feishuClient
}

// 创建 MCP 服务器
const server = new Server(
  {
    name: 'feishu-bitable-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
)

// 注册工具列表
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools: Tool[] = [
    {
      name: 'list_bitable_tables',
      description: '获取多维表格中的所有数据表',
      inputSchema: {
        type: 'object',
        properties: {
          appToken: {
            type: 'string',
            description: '多维表格的 app_token（从 URL 中获取）',
          },
        },
        required: ['appToken'],
      },
    },
    {
      name: 'list_bitable_records',
      description: '读取数据表中的记录列表',
      inputSchema: {
        type: 'object',
        properties: {
          appToken: {
            type: 'string',
            description: '多维表格的 app_token',
          },
          tableId: {
            type: 'string',
            description: '数据表 ID',
          },
          viewId: {
            type: 'string',
            description: '视图 ID（可选）',
          },
          pageSize: {
            type: 'number',
            description: '每页记录数，默认 500',
          },
        },
        required: ['appToken', 'tableId'],
      },
    },
    {
      name: 'search_bitable_records',
      description: '在数据表中搜索记录',
      inputSchema: {
        type: 'object',
        properties: {
          appToken: {
            type: 'string',
            description: '多维表格的 app_token',
          },
          tableId: {
            type: 'string',
            description: '数据表 ID',
          },
          fieldName: {
            type: 'string',
            description: '要搜索的字段名',
          },
          keyword: {
            type: 'string',
            description: '搜索关键词',
          },
        },
        required: ['appToken', 'tableId', 'fieldName', 'keyword'],
      },
    },
    {
      name: 'get_bitable_views',
      description: '获取数据表的所有视图',
      inputSchema: {
        type: 'object',
        properties: {
          appToken: {
            type: 'string',
            description: '多维表格的 app_token',
          },
          tableId: {
            type: 'string',
            description: '数据表 ID',
          },
        },
        required: ['appToken', 'tableId'],
      },
    },
  ]

  return { tools }
})

// 处理工具调用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  try {
    const feishu = getFeishuClient()

    switch (name) {
      case 'list_bitable_tables': {
        const { appToken } = ListTablesSchema.parse(args)
        const result = await feishu.listTables(appToken)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      }

      case 'list_bitable_records': {
        const { appToken, tableId, viewId, pageSize } = ListRecordsSchema.parse(args)
        const result = await feishu.listRecords(appToken, tableId, viewId, pageSize)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      }

      case 'search_bitable_records': {
        const { appToken, tableId, fieldName, keyword } = SearchRecordsSchema.parse(args)
        const result = await feishu.searchRecords(appToken, tableId, fieldName, keyword)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      }

      case 'get_bitable_views': {
        const { appToken, tableId } = z.object({
          appToken: z.string(),
          tableId: z.string(),
        }).parse(args)
        const result = await feishu.getViews(appToken, tableId)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      }

      default:
        throw new Error(`未知工具: ${name}`)
    }
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
})

// 会话管理
const transports = new Map<string, StreamableHTTPServerTransport>()

// 新的 Streamable HTTP 端点
app.post('/sse', async (req, res) => {
  console.log('Streamable HTTP 请求:', req.headers['mcp-session-id'] || 'new session')

  try {
    // 检查是否是新的会话
    const sessionId = req.headers['mcp-session-id'] as string | undefined
    let transport = sessionId ? transports.get(sessionId) : undefined

    if (!transport) {
      // 创建新会话
      const newSessionId = randomUUID()
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => newSessionId,
        onsessioninitialized: (session) => {
          console.log('会话已初始化:', session)
          transports.set(session, transport!)
        },
      })

      transport.onclose = () => {
        console.log('会话关闭:', newSessionId)
        transports.delete(newSessionId)
      }

      await server.connect(transport)
    }

    await transport.handleRequest(req, res, req.body)
  } catch (error) {
    console.error('处理请求错误:', error)
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
        },
        id: null,
      })
    }
  }
})

// 支持 GET 请求（用于 SSE 模式回退）
app.get('/sse', async (req, res) => {
  console.log('SSE GET 请求 - 返回会话列表')
  res.json({
    sessions: Array.from(transports.keys()),
    protocol: 'MCP 2025-03-26 (Streamable HTTP)',
  })
})

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// 首页
app.get('/', (req, res) => {
  res.json({
    name: 'Feishu Bitable MCP Server',
    version: '1.0.0',
    protocol: 'MCP 2025-03-26 (Streamable HTTP)',
    endpoints: {
      mcp: '/sse (POST for MCP, GET for info)',
      health: '/health',
    },
  })
})

// 启动服务器
app.listen(PORT, () => {
  console.log(`飞书 Bitable MCP 服务器已启动`)
  console.log(`- 本地访问: http://localhost:${PORT}`)
  console.log(`- MCP 端点: http://localhost:${PORT}/sse`)
  console.log(`- 健康检查: http://localhost:${PORT}/health`)
  console.log(`环境变量检查: FEISHU_APP_ID=${process.env.FEISHU_APP_ID ? '已设置' : '未设置'}`)
  console.log(`环境变量检查: FEISHU_APP_SECRET=${process.env.FEISHU_APP_SECRET ? '已设置' : '未设置'}`)
})
