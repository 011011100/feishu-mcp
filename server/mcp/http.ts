import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import express from 'express'
import { FeishuClient } from './feishu-client'

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

// 存储 SSE 传输连接
const transports = new Map<string, SSEServerTransport>()

// SSE 端点 - 客户端连接
app.get('/sse', async (req, res) => {
  console.log('SSE 连接请求')
  try {
    const transport = new SSEServerTransport('/messages', res)
    transports.set(transport.sessionId, transport)

    res.on('close', () => {
      console.log('SSE 连接关闭:', transport.sessionId)
      transports.delete(transport.sessionId)
    })

    await server.connect(transport)
    console.log('SSE 连接成功:', transport.sessionId)
  } catch (error) {
    console.error('SSE 连接错误:', error)
    res.status(500).send('Internal Server Error')
  }
})

// 消息端点 - 客户端发送消息
app.post('/messages', async (req, res) => {
  const sessionId = req.query.sessionId as string
  const transport = transports.get(sessionId)

  if (!transport) {
    res.status(400).send('Session not found')
    return
  }

  await transport.handlePostMessage(req, res, req.body)
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
    endpoints: {
      sse: '/sse',
      messages: '/messages',
      health: '/health',
    },
  })
})

// 启动服务器
app.listen(PORT, () => {
  console.log(`飞书 Bitable MCP 服务器已启动`)
  console.log(`- 本地访问: http://localhost:${PORT}`)
  console.log(`- SSE 端点: http://localhost:${PORT}/sse`)
  console.log(`- 健康检查: http://localhost:${PORT}/health`)
  console.log(`环境变量检查: FEISHU_APP_ID=${process.env.FEISHU_APP_ID ? '已设置' : '未设置'}`)
  console.log(`环境变量检查: FEISHU_APP_SECRET=${process.env.FEISHU_APP_SECRET ? '已设置' : '未设置'}`)
})
