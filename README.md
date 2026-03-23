# Feishu Bitable MCP Server

基于 Nuxt + TypeScript 的飞书多维表格 MCP 服务器。

## 功能

- 列出多维表格中的所有数据表
- 读取数据表记录
- 搜索记录
- 获取数据表视图

## 安装

```bash
# 安装依赖
npm install

# 复制环境变量配置
cp .env.example .env

# 编辑 .env，填入你的飞书应用凭证
```

## 配置

在 `.env` 文件中配置：

```env
FEISHU_APP_ID=cli_xxxxxxxxxxxxxxxx
FEISHU_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

获取方式：
1. 访问 [飞书开放平台](https://open.feishu.cn/)
2. 创建企业自建应用
3. 开启 "多维表格" 权限
4. 获取 App ID 和 App Secret

## 使用

### 作为 MCP 服务器运行

```bash
npm run mcp
```

然后在 Claude Code 的 `.claude.json` 中配置：

```json
{
  "mcpServers": {
    "feishu-bitable": {
      "command": "node",
      "args": ["--import", "tsx", "C:/Users/1/Desktop/feishu-mcp/server/mcp/index.ts"],
      "env": {
        "FEISHU_APP_ID": "cli_xxxxxxxxxxxxxxxx",
        "FEISHU_APP_SECRET": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
      }
    }
  }
}
```

### 开发模式

```bash
npm run dev
```

## MCP 工具列表

| 工具名 | 说明 |
|--------|------|
| `list_bitable_tables` | 获取多维表格中的所有数据表 |
| `list_bitable_records` | 读取数据表记录 |
| `search_bitable_records` | 搜索记录 |
| `get_bitable_views` | 获取数据表视图 |

## 示例

在 Claude Code 中使用：

```
帮我列出多维表格 bascnxxxxxxxx 的所有数据表
```

```
帮我读取 bascnxxxxxxxx 表格中 tblxxxxxxxx 表的前 100 条记录
```

## License

MIT
