import { defineEventHandler } from 'h3'

export default defineEventHandler(() => {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'feishu-bitable-mcp',
    version: '1.0.0',
    endpoints: {
      sse: '/api/mcp/sse',
      messages: '/api/mcp/messages?sessionId=xxx',
    }
  }
})
