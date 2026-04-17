import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { FeishuClient } from './feishu-client'

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

const SearchBitableAppsSchema = z.object({
  query: z.string().max(100).default('').describe('多维表格名称关键词；留空时列出扫描到的多维表格'),
  folderToken: z.string().optional().describe('从指定云盘文件夹开始搜索（可选）'),
  limit: z.number().int().min(1).max(20).default(10).describe('最多返回多少个结果，默认 10，最大 20'),
})

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

// 飞书客户端
const feishu = new FeishuClient()

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
    {
      name: 'search_bitable_apps',
      description: '按名称递归搜索当前应用可访问的多维表格；query 留空时列出扫描到的多维表格',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: '多维表格名称关键词；留空时列出扫描到的多维表格',
          },
          folderToken: {
            type: 'string',
            description: '从指定云盘文件夹开始搜索（可选）',
          },
          limit: {
            type: 'number',
            description: '最多返回多少个结果，默认 10，最大 20',
          },
        },
      },
    },
  ]

  return { tools }
})

// 处理工具调用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  try {
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

      case 'search_bitable_apps': {
        const { query, folderToken, limit } = SearchBitableAppsSchema.parse(args)
        const result = await feishu.searchBitableApps(query, folderToken, limit)
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

// 启动服务器
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('飞书 Bitable MCP 服务器已启动')
}

main().catch(console.error)
