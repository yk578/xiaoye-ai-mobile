/**
 * OpenAICompatibleProvider — React Native 版
 *
 * 和桌面版核心区别：
 * - 桌面版用 fetch + ReadableStream（Hermes 不支持）
 * - 手机版用 XMLHttpRequest.onprogress 逐块解析 SSE
 *
 * 接口完全一致：AsyncGenerator<StreamChunk>
 */

import {
  type LLMProvider, type ProviderConfig, type StreamChunk,
  type ChatOptions, type ProviderErrorCode, ProviderError, AuthStyle,
} from '../../types'

const DEFAULT_AUTH_STYLE = AuthStyle.Bearer

export class OpenAICompatibleProvider implements LLMProvider {
  readonly name: string
  readonly baseUrl: string

  private config: Required<Omit<ProviderConfig, 'name' | 'baseUrl' | 'apiKey' | 'authStyle'>> & {
    apiKey: string | null
    authStyle: AuthStyle
  }

  constructor(config: ProviderConfig) {
    this.name = config.name
    this.baseUrl = config.baseUrl.replace(/\/+$/, '')
    this.config = {
      apiKey: config.apiKey || null,
      authStyle: config.authStyle ?? DEFAULT_AUTH_STYLE,
      defaultModel: config.defaultModel,
      defaultTemperature: config.defaultTemperature ?? 0.7,
      defaultMaxTokens: config.defaultMaxTokens ?? 1048576,
    }
  }

  static fromConfig(config: ProviderConfig): OpenAICompatibleProvider {
    return new OpenAICompatibleProvider(config)
  }

  /* ── 流式聊天（XHR onprogress 代替 ReadableStream）── */

  async *chat(
    messages: Array<{ role: string; content: string }>,
    options?: ChatOptions
  ): AsyncGenerator<StreamChunk> {
    const { signal, thinking = false, tools, temperature, maxTokens, model } = options || {}

    const body: Record<string, unknown> = {
      model: model ?? this.config.defaultModel,
      messages,
      stream: true,
      stream_options: { include_usage: true },
      temperature: temperature ?? this.config.defaultTemperature,
      max_tokens: maxTokens ?? this.config.defaultMaxTokens,
    }
    if (tools && tools.length > 0) body.tools = tools
    if (thinking) body.extra_body = { thinking: { type: 'enabled' } }

    const endpoint = this.getEndpoint()
    const headers = this.buildHeaders('application/json')
    const bodyStr = JSON.stringify(body)
    const timeoutMs = 120_000

    const chunks: StreamChunk[] = []
    let doneResolve: (() => void) | null = null
    let donePromise = new Promise<void>(r => { doneResolve = r })
    let error: Error | null = null
    let aborted = false

    const xhr = new XMLHttpRequest()
    xhr.open('POST', endpoint)
    for (const [k, v] of Object.entries(headers)) {
      xhr.setRequestHeader(k, v)
    }

    let lastIndex = 0

    xhr.onprogress = () => {
      const newText = xhr.responseText.substring(lastIndex)
      lastIndex = xhr.responseText.length
      const lines = newText.split('\n')
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data: ')) continue
        const data = trimmed.slice(6).trim()
        if (data === '[DONE]') {
          doneResolve?.()
          return
        }
        try {
          const chunk: StreamChunk = JSON.parse(data)
          chunks.push(chunk)
          doneResolve?.()
          donePromise = new Promise<void>(r => { doneResolve = r })
        } catch {
          // skip unparseable
        }
      }
    }

    xhr.onerror = () => {
      error = new ProviderError('NETWORK_ERROR', '网络连接失败', true)
      doneResolve?.()
    }

    xhr.ontimeout = () => {
      error = new ProviderError('TIMEOUT', `请求超时（${timeoutMs / 1000}秒无响应）`, true)
      doneResolve?.()
    }

    xhr.onloadend = () => {
      doneResolve?.()
    }

    // 处理 abort
    if (signal) {
      signal.addEventListener('abort', () => {
        aborted = true
        xhr.abort()
        doneResolve?.()
      }, { once: true })
    }

    xhr.timeout = timeoutMs
    xhr.send(bodyStr)

    // 流式产出 chunks
    let sent = 0
    while (!aborted) {
      await donePromise
      if (aborted) break
      while (sent < chunks.length) {
        yield chunks[sent]
        sent++
      }
      if (error) throw error
      if (xhr.readyState === XMLHttpRequest.DONE) break
      donePromise = new Promise<void>(r => { doneResolve = r })
    }

    // 发完剩余的
    while (sent < chunks.length) {
      yield chunks[sent]
      sent++
    }

    // 检查 HTTP 状态
    if (!aborted && xhr.status >= 400) {
      throw this.parseHttpError(xhr.status, xhr.responseText)
    }
  }

  /* ── 非流式聊天 ── */

  async chatSync(
    messages: Array<{ role: string; content: string }>,
    options?: ChatOptions
  ): Promise<string> {
    const { signal, thinking = false, temperature, maxTokens, model } = options || {}

    const body: Record<string, unknown> = {
      model: model ?? this.config.defaultModel,
      messages,
      stream: false,
      temperature: temperature ?? this.config.defaultTemperature,
      max_tokens: maxTokens ?? this.config.defaultMaxTokens,
    }
    if (thinking) body.extra_body = { thinking: { type: 'enabled' } }

    const endpoint = this.getEndpoint()
    const headers = this.buildHeaders('application/json')

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    })

    if (!response.ok) {
      throw this.parseHttpError(response.status, await response.text().catch(() => ''))
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = data?.choices?.[0]?.message?.content
    if (content === undefined || content === null) {
      throw new ProviderError('SERVER_ERROR', '响应中缺少 content 字段', false)
    }
    return content
  }

  /* ── 获取模型列表 ── */

  async getModels(): Promise<string[]> {
    const base = this.baseUrl.replace(/\/v[12]\/*$/, '')
    const url = `${base}/v1/models`
    try {
      const response = await fetch(url, { headers: this.buildHeaders('application/json') })
      if (!response.ok) return []
      const data = (await response.json()) as { data?: Array<{ id: string }> }
      return (data?.data || []).map(m => m.id)
    } catch {
      return []
    }
  }

  /* ── 内部 ── */

  private getEndpoint(): string {
    const base = this.baseUrl.replace(/\/v[12]\/*$/, '')
    return `${base}/v1/chat/completions`
  }

  private buildHeaders(contentType: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': contentType,
      Accept: 'text/event-stream',
    }
    switch (this.config.authStyle) {
      case AuthStyle.Bearer:
        headers['Authorization'] = `Bearer ${this.config.apiKey}`
        break
      case AuthStyle.XApiKey:
        headers['X-Api-Key'] = this.config.apiKey!
        break
      case AuthStyle.Anthropic:
        headers['x-api-key'] = this.config.apiKey!
        headers['anthropic-version'] = '2023-06-01'
        break
      case AuthStyle.None:
      case AuthStyle.Custom:
        break
    }
    return headers
  }

  private parseHttpError(status: number, body: string): ProviderError {
    let message = `HTTP ${status}`
    let code: ProviderErrorCode = 'SERVER_ERROR'
    let retryable = true

    try {
      const err = JSON.parse(body)?.error as { message?: string } | undefined
      if (err?.message) message = err.message
    } catch {}

    switch (status) {
      case 401: case 403:
        code = 'AUTH_ERROR'; retryable = false
        message = 'API Key 无效，请在设置中更新'
        break
      case 429:
        code = 'RATE_LIMIT'; retryable = true
        message = 'API请求频率过高，请稍后重试'
        break
      case 500: case 502: case 503: case 504:
        code = 'SERVER_ERROR'; retryable = true
        message = '服务器错误，正在重试...'
        break
    }
    return new ProviderError(code, message, retryable)
  }
}
