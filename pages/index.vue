<template>
  <div class="container mx-auto px-4 py-12 max-w-4xl">
    <div class="bg-white rounded-xl shadow-lg p-8">
      <div class="flex items-center gap-4 mb-6">
        <div class="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
          <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
        </div>
        <div>
          <h1 class="text-2xl font-bold text-gray-800">飞书多维表格 MCP 服务器</h1>
          <p class="text-gray-500">Feishu Bitable MCP Server</p>
        </div>
      </div>

      <div class="space-y-6">
        <!-- 状态卡片 -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="bg-green-50 border border-green-200 rounded-lg p-4">
            <div class="flex items-center gap-2 mb-2">
              <span class="w-2 h-2 bg-green-500 rounded-full"></span>
              <span class="text-sm font-medium text-green-800">服务状态</span>
            </div>
            <p class="text-green-700">运行中</p>
          </div>

          <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div class="flex items-center gap-2 mb-2">
              <span class="w-2 h-2 bg-blue-500 rounded-full"></span>
              <span class="text-sm font-medium text-blue-800">MCP 协议</span>
            </div>
            <p class="text-blue-700">stdio 模式</p>
          </div>
        </div>

        <!-- 工具列表 -->
        <div>
          <h2 class="text-lg font-semibold text-gray-800 mb-4">可用工具</h2>
          <div class="space-y-3">
            <div v-for="tool in tools" :key="tool.name" class="border rounded-lg p-4 hover:shadow-md transition-shadow">
              <div class="flex items-center justify-between mb-2">
                <code class="text-sm font-mono bg-gray-100 px-2 py-1 rounded">{{ tool.name }}</code>
              </div>
              <p class="text-gray-600 text-sm">{{ tool.description }}</p>
            </div>
          </div>
        </div>

        <!-- 配置说明 -->
        <div class="bg-gray-50 rounded-lg p-6">
          <h2 class="text-lg font-semibold text-gray-800 mb-4">Claude Code 配置</h2>
          <p class="text-sm text-gray-600 mb-3">
            在 <code class="bg-gray-200 px-1 rounded">.claude.json</code> 中添加以下配置：
          </p>
          <pre class="bg-gray-800 text-gray-100 rounded-lg p-4 overflow-x-auto text-sm"><code>{{ mcpConfig }}</code></pre>
        </div>

        <!-- 使用示例 -->
        <div class="bg-gray-50 rounded-lg p-6">
          <h2 class="text-lg font-semibold text-gray-800 mb-4">使用示例</h2>
          <div class="space-y-2 text-sm text-gray-600">
            <p>• 帮我列出多维表格 <code class="bg-gray-200 px-1 rounded">bascnxxxxxxxx</code> 的所有数据表</p>
            <p>• 读取 <code class="bg-gray-200 px-1 rounded">bascnxxxxxxxx</code> 表格中 <code class="bg-gray-200 px-1 rounded">tblxxxxxxxx</code> 表的记录</p>
            <p>• 在表格中搜索关键词 "项目进度"</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const tools = [
  {
    name: 'list_bitable_tables',
    description: '获取多维表格中的所有数据表',
  },
  {
    name: 'list_bitable_records',
    description: '读取数据表记录列表，支持分页和视图筛选',
  },
  {
    name: 'search_bitable_records',
    description: '在数据表中搜索记录，支持字段级别的关键词搜索',
  },
  {
    name: 'get_bitable_views',
    description: '获取数据表的所有视图（表格视图、看板视图等）',
  },
]

const mcpConfig = JSON.stringify({
  mcpServers: {
    'feishu-bitable': {
      command: 'node',
      args: ['--import', 'tsx', 'C:/Users/1/Desktop/feishu-mcp/server/mcp/index.ts'],
      env: {
        FEISHU_APP_ID: 'cli_xxxxxxxxxxxxxxxx',
        FEISHU_APP_SECRET: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
      }
    }
  }
}, null, 2)
</script>
