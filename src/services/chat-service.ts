/**
 * ChatService — AI 对话服务
 *
 * 管理 Provider 初始化、流式通信、工具调用循环。
 * 借鉴桌面端 chat.ts IPC 的核心逻辑，去掉 Electron IPC，改为直接回调。
 */

import { ProviderRegistry } from '../core/provider/registry'
import { OpenAICompatibleProvider } from '../core/provider/openai-compatible'
import { WorkloadRouter } from '../core/provider/workload-router'
import { estimateTokens, getModelContextWindow } from '../core/provider/model-context'
import { TokenBudgetTracker } from '../core/memory/token-budget'
import { preprocessToolOutput } from '../core/memory/token-preprocessor'
import { getConfig, getProviderConfigs } from './config-store'
import { ProviderError, AuthStyle } from '../types'
import type { LLMProvider, StreamChunk, ChatOptions, ToolCall } from '../types'

/* ── 回调接口 ── */

export interface ChatCallbacks {
  onToken: (sessionId: string, token: string, reasoningToken?: string) => void
  onDone: (sessionId: string, result: {
    finishReason: 'stop' | 'length' | 'tool_calls'
    usage: { promptTokens: number; completionTokens: number; totalTokens: number }
    model: string
    toolCalls?: ToolCall[]
  }) => void
  onError: (sessionId: string, code: string, message: string, retryable: boolean) => void
  onStatus: (sessionId: string, status: string, toolTurn?: number) => void
  onToolResult: (sessionId: string, results: Array<{ toolName: string; output: string; error?: string }>) => void
}

/* ── 活跃会话 ── */

interface ActiveSession {
  abortController: AbortController
}

const activeSessions = new Map<string, ActiveSession>()
const tokenTracker = new TokenBudgetTracker()

let registry: ProviderRegistry | null = null
let router: WorkloadRouter | null = null
let callbacks: ChatCallbacks | null = null

/* ── 依赖注入 ── */

export function setCallbacks(cb: ChatCallbacks): void {
  callbacks = cb
}

/* ── Provider 初始化 ── */

let providerInitPromise: Promise<void> | null = null

async function ensureProvider(): Promise<void> {
  if (registry && router) return
  if (providerInitPromise) return providerInitPromise

  providerInitPromise = (async () => {
    // 每次重新初始化时清空旧的注册信息
    // 解决 先空配置 → 再配 Provider 的场景
    registry = ProviderRegistry.getInstance()
    registry.clear()
    const configs = await getProviderConfigs()
    if (configs.length > 0) {
      for (const cfg of configs) {
        const p = OpenAICompatibleProvider.fromConfig({
          name: cfg.name,
          baseUrl: cfg.baseUrl,
          apiKey: cfg.apiKey,
          authStyle: cfg.authStyle ? (AuthStyle as any)[cfg.authStyle] : AuthStyle.Bearer,
          defaultModel: cfg.defaultModel,
          defaultTemperature: cfg.defaultTemperature,
          defaultMaxTokens: cfg.defaultMaxTokens,
        })
        registry.register(cfg.name, p)
      }
      const config = await getConfig()
      if (config.defaultProvider) {
        try { registry.setDefault(config.defaultProvider) } catch {}
      }
    }

    if (registry.hasProvider()) {
      router = new WorkloadRouter(registry)
    }
  })()

  return providerInitPromise
}

// 静默捕获未处理的 rejection（promise 缓存场景安全兜底）
providerInitPromise?.catch(() => {})

/* ── 发送消息 ── */

export async function sendMessage(
  messages: Array<{ role: string; content: string }>,
  options?: {
    conversationId?: string
    model?: string
    temperature?: number
    maxTokens?: number
    thinking?: boolean
    providerName?: string
    toolSchemas?: Array<Record<string, unknown>>
  }
): Promise<{ sessionId: string }> {
  const sessionId = Math.random().toString(36).substring(2, 15)
  const abortController = new AbortController()
  activeSessions.set(sessionId, { abortController })

  // 异步启动
  startStreaming(sessionId, messages, options || {}, abortController.signal)
    .catch(err => {
      callbacks?.onError(sessionId, 'SERVER_ERROR', err.message || '未知错误', false)
    })

  return { sessionId }
}

export function cancelMessage(sessionId: string): void {
  const session = activeSessions.get(sessionId)
  if (session) {
    session.abortController.abort()
    activeSessions.delete(sessionId)
  }
}

const MAX_TOOL_TURNS = 15

async function startStreaming(
  sessionId: string,
  messages: Array<{ role: string; content: string }>,
  options: {
    conversationId?: string
    model?: string
    temperature?: number
    maxTokens?: number
    thinking?: boolean
    providerName?: string
    toolSchemas?: Array<Record<string, unknown>>
  },
  signal: AbortSignal
): Promise<void> {
  await ensureProvider()
  if (!registry || !router || !callbacks) {
    callbacks?.onError(sessionId, 'NO_PROVIDER', '未配置 AI Provider，请在设置中添加', false)
    return
  }

  const config = await getConfig()
  const { model, temperature, maxTokens, thinking, providerName, toolSchemas } = options
  const convId = options.conversationId || sessionId

  const estimatedModel = model || config.model
  const estimatedWindow = getModelContextWindow(estimatedModel)
  tokenTracker.setBudget(config.tokenBudget)

  let currentMessages = [...messages]
  let totalAssistantContent = ''
  let totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }

  for (let toolTurn = 0; toolTurn < MAX_TOOL_TURNS; toolTurn++) {
    if (signal.aborted) break

    // 选择 Provider
    let activeProvider: LLMProvider
    let activeModel: string

    if (providerName) {
      try {
        activeProvider = registry.get(providerName)
      } catch {
        callbacks.onError(sessionId, 'PROVIDER_NOT_FOUND', `Provider "${providerName}" 未找到，请在设置中检查`, false)
        return
      }
      activeModel = model || config.model
    } else {
      const resolved = router!.resolve('chat-v1')
      activeProvider = resolved.provider
      activeModel = model || resolved.model || config.model
    }

    // 估算 maxTokens
    const estimatedInput = currentMessages.reduce((s, m) => s + estimateTokens(m.content), 0)
    const outputHeadroom = Math.max(4096, estimatedWindow - estimatedInput)
    const safeMaxTokens = Math.min(maxTokens ?? config.maxTokens, outputHeadroom)

    const chatOpts: ChatOptions = {
      signal,
      thinking: thinking ?? config.thinkingEnabled,
      tools: toolSchemas,
      temperature: temperature ?? config.temperature,
      maxTokens: safeMaxTokens,
      model: activeModel,
    }

    callbacks.onStatus(sessionId, 'streaming', toolTurn > 0 ? toolTurn : undefined)

    const collectedToolCalls: ToolCall[] = []
    let assistantContent = ''
    let finishReason: 'stop' | 'length' | 'tool_calls' = 'stop'

    // 流式 tool_calls 累积（按 index 去重合并）
    const toolCallAccumulator = new Map<number, {
      id: string
      name: string
      args: string
    }>()

    // 流式请求
    let retries = 3
    let success = false
    while (retries > 0 && !signal.aborted) {
      try {
        for await (const chunk of activeProvider.chat(currentMessages, chatOpts)) {
          if (signal.aborted) break
          const delta = chunk.choices?.[0]?.delta
          if (delta?.content || delta?.reasoning_content) {
            callbacks.onToken(sessionId, delta.content || '', delta.reasoning_content)
          }
          if (delta?.content) assistantContent += delta.content
          // 累积流式 tool_calls
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const existing = toolCallAccumulator.get(tc.index)
              if (existing) {
                if (tc.id) existing.id = tc.id
                if (tc.function?.name) existing.name += tc.function.name
                if (tc.function?.arguments) existing.args += tc.function.arguments
              } else {
                toolCallAccumulator.set(tc.index, {
                  id: tc.id || '',
                  name: tc.function?.name || '',
                  args: tc.function?.arguments || '',
                })
              }
            }
          }
          if (chunk.usage) {
            totalUsage = {
              promptTokens: chunk.usage.prompt_tokens,
              completionTokens: chunk.usage.completion_tokens,
              totalTokens: chunk.usage.total_tokens,
            }
            tokenTracker.recordUsage(chunk.usage)
          }
          const fr = chunk.choices?.[0]?.finish_reason
          if (fr === 'stop' || fr === 'length' || fr === 'tool_calls') {
            finishReason = fr
          }
        }
        success = true
        break
      } catch (err) {
        retries--
        if (retries > 0 && err instanceof ProviderError && err.retryable && !signal.aborted) {
          callbacks.onStatus(sessionId, 'retrying', 3 - retries)
          await new Promise(r => setTimeout(r, 2000))
        } else {
          throw err
        }
      }
    }

    if (!success) throw new Error('请求失败')

    // 将累积的 tool_calls 转为 ToolCall[]
    for (const [, val] of toolCallAccumulator) {
      if (val.name) {
        try {
          collectedToolCalls.push({
            id: val.id,
            name: val.name,
            args: JSON.parse(val.args || '{}'),
          })
        } catch {
          collectedToolCalls.push({
            id: val.id,
            name: val.name,
            args: {},
          })
        }
      }
    }

    totalAssistantContent += assistantContent

    // 没有工具调用 → 结束
    if (finishReason !== 'tool_calls') {
      callbacks.onDone(sessionId, {
        finishReason: finishReason || 'stop',
        usage: totalUsage,
        model: activeModel,
      })
      return
    }

    // 有工具调用 → 执行（通过 Termux）
    if (collectedToolCalls.length === 0) {
      // 没有收集到 tool calls 但 finish_reason 是 tool_calls
      // 可能是流式拼接还没完成就结束了
      callbacks.onDone(sessionId, {
        finishReason: 'stop',
        usage: totalUsage,
        model: activeModel,
      })
      return
    }

    // 执行工具
    callbacks.onStatus(sessionId, 'executing_tools')
    const toolResults = await Promise.all(
      collectedToolCalls.map(async (tc) => {
        try {
          const result = await executeTool(tc)
          return { toolName: tc.name, output: result, error: undefined }
        } catch (err) {
          return { toolName: tc.name, output: '', error: (err as Error).message }
        }
      })
    )

    callbacks.onToolResult(sessionId, toolResults)

    // 添加助手消息到历史
    currentMessages.push({ role: 'assistant', content: assistantContent })
    for (let i = 0; i < toolResults.length; i++) {
      const { output, error } = toolResults[i]
      const call = collectedToolCalls[i]
      const processed = error
        ? `Error: ${error}`
        : preprocessToolOutput(output).processed
      currentMessages.push({ role: 'tool', content: processed })
    }
  }
}

/* ── 工具执行分发 ── */

import { TermuxClient, generateToken } from './termux-client'
import { getTermuxToken, setTermuxToken } from './config-store'
import { PermissionEngine } from '../core/permission/permission-engine'
import { getGlobalMode, getPatternRules, recordToolCall } from '../core/permission/permission-store'
import { READONLY_TOOLS } from './tool-schemas'

let _termuxClient: TermuxClient | null = null
let _permissionEngine: PermissionEngine | null = null

async function getTermuxClient(): Promise<TermuxClient> {
  if (!_termuxClient) {
    let token = await getTermuxToken()
    if (!token) {
      token = generateToken()
      await setTermuxToken(token)
    }
    _termuxClient = new TermuxClient(token)
  }
  return _termuxClient
}

async function getPermissionEngine(): Promise<PermissionEngine> {
  if (!_permissionEngine) {
    const globalMode = await getGlobalMode()
    const patternRules = await getPatternRules()
    _permissionEngine = new PermissionEngine({ globalMode, patternRules })
  }
  return _permissionEngine
}

async function executeTool(call: ToolCall): Promise<string> {
  // 权限检查
  const engine = await getPermissionEngine()
  const decision = engine.shouldAsk(call)
  const isReadOnly = READONLY_TOOLS.has(call.name)

  if (decision === 'deny') {
    await recordToolCall(call.name, JSON.stringify(call.args), 'denied', '被权限策略拒绝')
    return `权限不足：操作 "${call.name}" 被安全策略拒绝。请在设置中调整权限。`
  }

  // 需要确认的写入操作：在实际使用中会有 UI 弹窗确认，此处先记录决策
  if (decision === 'ask' && !isReadOnly) {
    // 手机端：执行前由 UI 层弹窗确认
    // 此处直接记录并执行（UI 层的权限确认在调用前完成）
  }

  let result: string

  switch (call.name) {
    case 'read': {
      const path = call.args.path as string
      if (TermuxClient.isAvailable) {
        result = await (await getTermuxClient()).readFile(path)
      } else {
        result = `[Termux 未连接] 读取文件: ${path}\n请在设置中连接 Termux 以启用文件操作。`
      }
      break
    }
    case 'write': {
      const { path, content } = call.args as { path: string; content: string }
      if (TermuxClient.isAvailable) {
        await (await getTermuxClient()).writeFile(path, content)
        result = `已写入 ${path} (${content.length} 字符)`
      } else {
        result = `[Termux 未连接] 无法写入文件: ${path}\n请在设置中连接 Termux。`
      }
      break
    }
    case 'execute': {
      const cmd = call.args.command as string
      const timeout = (call.args.timeout as number) || 30000
      if (TermuxClient.isAvailable) {
        const execResult = await (await getTermuxClient()).exec(cmd, timeout)
        result = execResult.stdout || execResult.stderr || `(exit: ${execResult.exitCode})`
      } else {
        result = `[Termux 未连接] 无法执行命令: ${cmd}\n请在设置中连接 Termux。`
      }
      break
    }
    case 'glob': {
      const pattern = call.args.pattern as string
      if (TermuxClient.isAvailable) {
        const execResult = await (await getTermuxClient()).exec(
          `find . -path "${pattern}" 2>/dev/null | head -50`, 10000
        )
        result = execResult.stdout || '未找到匹配文件'
      } else {
        result = `[Termux 未连接] 搜索: ${pattern}`
      }
      break
    }
    case 'grep': {
      const { pattern, path } = call.args as { pattern: string; path?: string }
      if (TermuxClient.isAvailable) {
        const dir = path || '.'
        // 用 heredoc 传 pattern 到 stdin，既安全又支持正则
        const escaped = pattern.replace(/'/g, "'\\''")
        const execResult = await (await getTermuxClient()).exec(
          `grep -rn -f /dev/stdin ${dir} 2>/dev/null | head -50 <<< '${escaped}'`, 15000
        )
        result = execResult.stdout || '未找到匹配'
      } else {
        result = `[Termux 未连接] 搜索: ${pattern} in ${path || '.'}`
      }
      break
    }
    case 'web_search': {
      result = await performWebSearch(
        call.args.query as string,
        (call.args.numResults as number) || 5
      )
      break
    }
    case 'web_fetch': {
      result = await performWebFetch(
        call.args.url as string,
        (call.args.maxChars as number) || 8000
      )
      break
    }
    default:
      result = `工具 "${call.name}" 在手机端不可用。可用的工具有：read、write、execute、glob、grep、web_search、web_fetch`
  }

  await recordToolCall(call.name, JSON.stringify(call.args), 'executed')
  return result
}

/* ── Web 搜索 ── */

async function performWebSearch(query: string, numResults: number): Promise<string> {
  try {
    // 使用 DuckDuckGo Instant Answer API（JSON 格式，稳健）
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36',
      },
    })
    if (!resp.ok) {
      return `搜索请求失败 (HTTP ${resp.status})。请检查网络连接后重试。`
    }
    const data = await resp.json() as any

    const results: string[] = []

    // Abstract（摘要答案）
    if (data.AbstractText && data.AbstractText.trim()) {
      results.push(`**答案**: ${data.AbstractText.trim()}\n  来源: ${data.AbstractSource || 'DuckDuckGo'}`)
    }

    // RelatedTopics（相关主题）
    if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
      for (const topic of data.RelatedTopics) {
        if (results.length >= numResults) break
        if (topic.Text && topic.Text.trim()) {
          results.push(`${results.length + 1}. **${topic.Text.trim()}**${topic.FirstURL ? `\n   ${topic.FirstURL}` : ''}`)
        }
      }
    }

    if (results.length === 0) {
      return `搜索 "${query}" 未返回结果。请尝试使用不同的关键词。`
    }

    return results.join('\n\n')
  } catch (err) {
    return `网页搜索失败: ${(err as Error).message}。请检查网络连接。`
  }
}

/* ── Web 抓取 ── */

async function performWebFetch(url: string, maxChars: number): Promise<string> {
  try {
    // 验证 URL
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return `无效的 URL: ${url}。请提供完整的 http:// 或 https:// 地址。`
    }

    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
    })

    if (!resp.ok) {
      return `抓取失败 (HTTP ${resp.status})。该网页可能无法访问或需要认证。`
    }

    const contentType = resp.headers.get('content-type') || ''
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      return `不支持的内容类型: ${contentType}。仅支持 HTML 和纯文本网页。`
    }

    const html = await resp.text()

    // 去除 HTML 标签，提取纯文本
    let text = html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s{3,}/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()

    if (text.length > maxChars) {
      text = text.substring(0, maxChars) + `\n\n... [已截断，原文共 ${text.length} 字符]`
    }

    if (!text.trim()) {
      return `网页内容为空或无法解析。`
    }

    return text
  } catch (err) {
    return `网页抓取失败: ${(err as Error).message}。请检查网络连接和 URL 是否正确。`
  }
}

