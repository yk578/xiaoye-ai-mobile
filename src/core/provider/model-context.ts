/* ── 已知模型的上下文窗口（K = 1024 tokens） ── */

const KNOWN_WINDOWS: Record<string, number> = {
  'deepseek-v4-pro': 1_048_576,
  'deepseek-v4-flash': 1_048_576,
  'deepseek-v4': 1_048_576,
  'deepseek-chat': 1_048_576,
  'deepseek-reasoner': 1_048_576,
  'gpt-4o': 128_000,
  'gpt-4o-mini': 128_000,
  'gpt-4-turbo': 128_000,
  'claude-opus-4-8': 200_000,
  'claude-sonnet-4-6': 200_000,
  'claude-haiku-4-5': 200_000,
  'gemini-2.0-flash': 1_048_576,
  'gemini-2.0-pro': 2_097_152,
}

const DEFAULT_WINDOW = 128_000

export function getModelContextWindow(modelName: string): number {
  // 精确匹配优先
  if (KNOWN_WINDOWS[modelName]) return KNOWN_WINDOWS[modelName]
  const lower = modelName.toLowerCase()
  // 模糊匹配
  for (const [key, size] of Object.entries(KNOWN_WINDOWS)) {
    if (lower.includes(key)) return size
  }
  return DEFAULT_WINDOW
}

export function estimateTokens(text: string): number {
  if (!text) return 0
  const chineseChars = (text.match(/[一-鿿㐀-䶿　-〿＀-￯]/g) || []).length
  const otherChars = text.length - chineseChars
  return Math.ceil(chineseChars / 1.5 + otherChars / 4)
}
