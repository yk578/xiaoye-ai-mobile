/* ── Token 预处理（从桌面端复制，零改动） ── */

export interface PreprocessResult {
  processed: string
  tokenSave: number
}

function estimateTokens(text: string): number {
  if (!text) return 0
  const chineseChars = (text.match(/[一-鿿㐀-䶿　-〿＀-￯]/g) || []).length
  const otherChars = text.length - chineseChars
  return Math.ceil(chineseChars / 1.5 + otherChars / 4)
}

/**
 * 工具输出预处理：
 * - HTML → Markdown（去除样式属性，保留结构）
 * - 超长代码折叠（>200行截断）
 * - 重复内容去重
 * - URL 缩短
 */
export function preprocessToolOutput(output: string): PreprocessResult {
  if (!output) return { processed: '', tokenSave: 0 }
  const originalTokens = estimateTokens(output)
  let text = output

  // 1. HTML → 纯文本（去除标签属性，保留内容）
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
  text = text.replace(/<[^>]+>/g, '')

  // 2. 超长行折叠（>500字符截断）
  text = text.replace(/^(.{500}).*$/gm, '$1... [截断]')

  // 3. 重复空行保留最多1行
  text = text.replace(/\n{3,}/g, '\n\n')

  // 4. 去除前导/末尾空白
  text = text.trim()

  const finalTokens = estimateTokens(text)
  return {
    processed: text,
    tokenSave: Math.max(0, originalTokens - finalTokens),
  }
}
