/**
 * 分层摘要器 — 对话记忆压缩
 *
 * 实现分层摘要策略：
 * - L1（短期）：保留最近 N 条消息原文
 * - L2（中期）：将较旧的消息合并为摘要
 * - L3（长期）：将中期摘要再压缩为关键词/要点
 */

import { estimateTokens } from '../provider/model-context'

export type SummaryLevel = 'L1' | 'L2' | 'L3'

export interface SummaryLayer {
  level: SummaryLevel
  content: string
  tokenCount: number
  sourceMessageIds: string[]
  createdAt: string
}

export interface SummarizationConfig {
  /** L1 保留的原始消息数 */
  l1MessageLimit: number
  /** L2 摘要的最大 Token 数 */
  l2TokenLimit: number
  /** L3 摘要的最大 Token 数 */
  l3TokenLimit: number
  /** 触发 L2 摘要的 Token 阈值 */
  l2TriggerTokens: number
  /** 触发 L3 摘要的 Token 阈值 */
  l3TriggerTokens: number
}

const DEFAULT_CONFIG: SummarizationConfig = {
  l1MessageLimit: 10,
  l2TokenLimit: 2000,
  l3TokenLimit: 500,
  l2TriggerTokens: 8000,
  l3TriggerTokens: 24000,
}

export class Summarizer {
  private config: SummarizationConfig
  private layers: Map<SummaryLevel, SummaryLayer[]> = new Map()

  constructor(config?: Partial<SummarizationConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.layers.set('L1', [])
    this.layers.set('L2', [])
    this.layers.set('L3', [])
  }

  /** 添加消息到 L1 层 */
  addMessage(id: string, content: string): void {
    const l1 = this.layers.get('L1')!
    l1.push({
      level: 'L1',
      content,
      tokenCount: estimateTokens(content),
      sourceMessageIds: [id],
      createdAt: new Date().toISOString(),
    })

    // 超出 L1 限制 → 最旧的消息提升到 L2
    while (l1.length > this.config.l1MessageLimit) {
      const oldest = l1.shift()!
      this.promoteToL2(oldest)
    }

    this.checkThresholds()
  }

  /** 获取当前 L1 的原始消息内容列表 */
  getL1Messages(): string[] {
    return (this.layers.get('L1') || []).map(l => l.content)
  }

  /** 获取 L2 摘要 */
  getL2Summary(): string {
    const l2 = this.layers.get('L2') || []
    if (l2.length === 0) return ''
    return l2.map(l => l.content).join('\n---\n')
  }

  /** 获取 L3 摘要 */
  getL3Summary(): string {
    const l3 = this.layers.get('L3') || []
    if (l3.length === 0) return ''
    return l3.map(l => l.content).join('\n • ')
  }

  /** 获取完整的上下文（用于注入 LLM） */
  getContext(): string {
    const parts: string[] = []

    const l3 = this.getL3Summary()
    if (l3) parts.push(`## 历史概要\n${l3}`)

    const l2 = this.getL2Summary()
    if (l2) parts.push(`## 近期摘要\n${l2}`)

    return parts.join('\n\n')
  }

  /** 统计所有层的 Token 数 */
  getTotalTokens(): number {
    let total = 0
    for (const layer of this.layers.values()) {
      for (const item of layer) {
        total += item.tokenCount
      }
    }
    return total
  }

  /* ── 内部 ── */

  private promoteToL2(item: SummaryLayer): void {
    const l2 = this.layers.get('L2')!
    item.level = 'L2'
    // 合并到 L2: 如果上一个 L2 摘要较短，合并之
    const last = l2[l2.length - 1]
    if (last && last.tokenCount < this.config.l2TokenLimit / 2) {
      last.content += '\n' + item.content
      last.tokenCount = estimateTokens(last.content)
      last.sourceMessageIds.push(...item.sourceMessageIds)
    } else {
      l2.push(item)
    }
  }

  private checkThresholds(): void {
    const total = this.getTotalTokens()

    // L2 → L3 提升
    if (total > this.config.l3TriggerTokens) {
      this.compressL2ToL3()
    }

    // L2 压缩
    if (total > this.config.l2TriggerTokens) {
      this.compressL2()
    }
  }

  /** 将旧 L2 提升为 L3 */
  private compressL2ToL3(): void {
    const l2 = this.layers.get('L2')!
    const l3 = this.layers.get('L3')!
    while (l2.length > 1) {
      const oldest = l2.shift()!
      oldest.level = 'L3'
      // 提取关键要点而不是原文
      const concise = this.extractKeyPoints(oldest.content)
      l3.push({
        ...oldest,
        content: concise,
        tokenCount: estimateTokens(concise),
      })
      // 保持 L3 在限制内
      while (l3.length > 5) l3.shift()
    }
  }

  /** 压缩 L2 中过多的内容 */
  private compressL2(): void {
    const l2 = this.layers.get('L2')!
    while (l2.length > 3) {
      const oldest = l2.shift()!
      const concise = this.extractKeyPoints(oldest.content)
      oldest.content = concise
      oldest.tokenCount = estimateTokens(concise)
      l2.push(oldest)
    }
  }

  /** 简单要点提取：取每段首句 */
  private extractKeyPoints(text: string): string {
    const lines = text.split('\n').filter(l => l.trim())
    if (lines.length <= 3) return text
    // 取首句 + 最后一句
    const first = lines.slice(0, 2).join('; ')
    const last = lines[lines.length - 1]
    return `${first} ... ${last}`
  }

  /** 清空所有层 */
  clear(): void {
    this.layers.set('L1', [])
    this.layers.set('L2', [])
    this.layers.set('L3', [])
  }
}
