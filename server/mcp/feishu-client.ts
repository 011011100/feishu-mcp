import * as lark from '@larksuiteoapi/node-sdk'

export class FeishuClient {
  private client: lark.Client
  private tokenCache: string | null = null
  private tokenExpireTime: number = 0

  constructor() {
    const appId = process.env.FEISHU_APP_ID
    const appSecret = process.env.FEISHU_APP_SECRET

    if (!appId || !appSecret) {
      throw new Error('缺少飞书应用凭证，请设置 FEISHU_APP_ID 和 FEISHU_APP_SECRET')
    }

    this.client = new lark.Client({
      appId,
      appSecret,
      appType: lark.AppType.SelfBuild,
    })
  }

  /**
   * 获取 tenant_access_token
   */
  private async getToken(): Promise<string> {
    // 缓存未过期，直接返回
    if (this.tokenCache && Date.now() < this.tokenExpireTime) {
      return this.tokenCache
    }

    const appId = process.env.FEISHU_APP_ID!
    const appSecret = process.env.FEISHU_APP_SECRET!

    const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
    })

    const data = await response.json()

    if (data.code !== 0) {
      throw new Error(`获取 token 失败: ${data.msg}`)
    }

    this.tokenCache = data.tenant_access_token
    // token 有效期通常是 2 小时，这里提前 5 分钟过期
    this.tokenExpireTime = Date.now() + (data.expire - 300) * 1000

    return this.tokenCache
  }

  /**
   * 发送 API 请求
   */
  private async request<T>(method: string, url: string, body?: unknown): Promise<T> {
    const token = await this.getToken()

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    const data = await response.json()

    if (data.code !== 0) {
      throw new Error(`API 错误: ${data.msg} (code: ${data.code})`)
    }

    return data.data as T
  }

  /**
   * 获取多维表格下的所有数据表
   */
  async listTables(appToken: string) {
    const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables`
    return this.request<{ items: any[]; total: number }>('GET', url)
  }

  /**
   * 获取数据表记录
   */
  async listRecords(appToken: string, tableId: string, viewId?: string, pageSize: number = 500) {
    const params = new URLSearchParams()
    params.append('page_size', String(pageSize))
    if (viewId) params.append('view_id', viewId)

    const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records?${params}`
    return this.request<{ items: any[]; total: number; has_more: boolean; page_token?: string }>('GET', url)
  }

  /**
   * 搜索记录
   */
  async searchRecords(appToken: string, tableId: string, fieldName: string, keyword: string) {
    // 先获取所有记录，然后过滤
    // 注意：实际生产环境应该使用更高效的搜索方式
    const allRecords = await this.listRecords(appToken, tableId, undefined, 500)

    const filtered = allRecords.items.filter((record: any) => {
      const fieldValue = record.fields[fieldName]
      if (typeof fieldValue === 'string') {
        return fieldValue.toLowerCase().includes(keyword.toLowerCase())
      }
      if (Array.isArray(fieldValue)) {
        return fieldValue.some(v => String(v).toLowerCase().includes(keyword.toLowerCase()))
      }
      return String(fieldValue).toLowerCase().includes(keyword.toLowerCase())
    })

    return { items: filtered, total: filtered.length }
  }

  /**
   * 获取数据表的所有视图
   */
  async getViews(appToken: string, tableId: string) {
    const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/views`
    return this.request<{ items: any[]; total: number }>('GET', url)
  }

  /**
   * 搜索 Wiki
   * API 文档: https://open.feishu.cn/document/server-docs/docs/wiki-v2/wiki-search
   * @param query 搜索关键词，长度不超过50个字符
   * @param spaceId 知识空间ID（可选）
   * @param nodeId 节点ID（可选，过滤该节点及其子节点）
   * @param pageToken 分页token（可选）
   * @param pageSize 每页数量，默认20，最大50
   */
  async searchWiki(
    query: string,
    spaceId?: string,
    nodeId?: string,
    pageToken?: string,
    pageSize: number = 20
  ) {
    const params = new URLSearchParams()
    if (pageToken) params.append('page_token', pageToken)
    params.append('page_size', String(Math.min(pageSize, 50)))

    const url = `https://open.feishu.cn/open-apis/wiki/v2/nodes/search?${params}`

    const body: Record<string, unknown> = { query }
    if (spaceId) body.space_id = spaceId
    if (nodeId) body.node_id = nodeId

    return this.request<{
      items: Array<{
        node_id: string
        space_id: string
        obj_type: number
        obj_token: string
        parent_id: string
        sort_id: number
        title: string
        url: string
        icon: string
      }>
      page_token?: string
      has_more: boolean
    }>('POST', url, body)
  }

  /**
   * 使用飞书 SDK 的备用方法
   */
  async listTablesWithSDK(appToken: string) {
    const result = await this.client.bitable.appTable.list({
      path: { app_token: appToken },
    })
    return result
  }
}
