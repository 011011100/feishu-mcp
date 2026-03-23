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
   * 使用飞书 SDK 的备用方法
   */
  async listTablesWithSDK(appToken: string) {
    const result = await this.client.bitable.appTable.list({
      path: { app_token: appToken },
    })
    return result
  }
}
