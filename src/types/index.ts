/* ── 授权方式 ── */
export enum AuthStyle {
  Bearer = 'Bearer',
  XApiKey = 'XApiKey',
  Anthropic = 'Anthropic',
  None = 'None',
  Custom = 'Custom',
}

/* ── 错误类型 ── */
export type ProviderErrorCode =
  | 'NETWORK_ERROR' | 'AUTH_ERROR' | 'RATE_LIMIT' | 'SERVER_ERROR'
  | 'TIMEOUT' | 'STREAM_PARSE_ERROR' | 'CANCELLED'

export class ProviderError extends Error {
  constructor(
    public code: ProviderErrorCode,
    message: string,
    public retryable: boolean,
    public retryAfter?: number
  ) {
    super(message)
    this.name = 'ProviderError'
  }
}

/* ── 流式响应块 ── */
export interface StreamChunk {
  id?: string
  choices: Array<{
    delta: {
      content?: string
      reasoning_content?: string
      role?: string
      tool_calls?: Array<{
        index: number
        id?: string
        type?: 'function'
        function?: { name?: string; arguments?: string }
      }>
    }
    index: number
    finish_reason: 'stop' | 'length' | 'content_filter' | 'tool_calls' | null
  }>
  usage?: StreamUsage
  model?: string
}

export interface StreamUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  prompt_cache_hit_tokens?: number
  prompt_cache_miss_tokens?: number
}

/* ── Provider 配置 ── */
export interface ProviderConfig {
  name: string
  baseUrl: string
  apiKey?: string
  authStyle?: AuthStyle
  defaultModel: string
  defaultTemperature?: number
  defaultMaxTokens?: number
}

export interface ChatOptions {
  signal?: AbortSignal
  thinking?: boolean
  tools?: Array<Record<string, unknown>>
  temperature?: number
  maxTokens?: number
  model?: string
}

export interface LLMProvider {
  readonly name: string
  readonly baseUrl: string
  chat(
    messages: Array<{ role: string; content: string }>,
    options?: ChatOptions
  ): AsyncGenerator<StreamChunk>
  chatSync(
    messages: Array<{ role: string; content: string }>,
    options?: ChatOptions
  ): Promise<string>
  getModels(): Promise<string[]>
}

/* ── 工具类型 ── */
export interface ToolCall {
  id: string
  name: string
  args: Record<string, unknown>
}

export interface ToolLLMSchema {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export interface ToolDef {
  name: string
  description: string
  isReadOnly: boolean
  isDestructive: boolean
}

export interface ToolContext {
  workspaceRoot: string
  requestPermission: (call: ToolCall) => Promise<boolean>
  reportProgress: (callId: string, status: string, detail?: string) => void
}

export type GlobalMode = 'ask' | 'allow_all' | 'deny_all'
export interface PatternRule {
  id: string
  label: string
  pattern: string
  decision: 'allow' | 'deny' | 'ask'
  createdAt: number
}

export interface ProviderStoreEntry {
  name: string
  baseUrl: string
  apiKey: string
  defaultModel: string
  defaultTemperature?: number
  defaultMaxTokens?: number
  authStyle?: string
}

export interface AppConfig {
  apiKey: string
  model: string
  temperature: number
  maxTokens: number
  tokenBudget: number
  thinkingEnabled: boolean
  providers?: ProviderStoreEntry[]
  defaultProvider?: string
}
