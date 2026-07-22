import type { LLMProvider } from '../../types'

export class ProviderRegistry {
  private static instance: ProviderRegistry
  private providers: Map<string, LLMProvider> = new Map()
  private defaultName: string | null = null

  private constructor() {}

  static getInstance(): ProviderRegistry {
    if (!ProviderRegistry.instance) {
      ProviderRegistry.instance = new ProviderRegistry()
    }
    return ProviderRegistry.instance
  }

  register(name: string, provider: LLMProvider): void {
    if (this.providers.has(name)) {
      console.warn(`[ProviderRegistry] "${name}" 已存在，将被覆盖`)
    }
    this.providers.set(name, provider)
    if (this.providers.size === 1) this.defaultName = name
  }

  get(name: string): LLMProvider {
    const p = this.providers.get(name)
    if (!p) throw new Error(`Provider "${name}" 未注册`)
    return p
  }

  getDefault(): LLMProvider {
    if (!this.defaultName || !this.providers.has(this.defaultName)) {
      const first = this.providers.values().next()
      if (!first.value) throw new Error('没有已注册的 Provider')
      this.defaultName = first.value.name
      return first.value
    }
    return this.providers.get(this.defaultName)!
  }

  setDefault(name: string): void {
    if (!this.providers.has(name)) {
      throw new Error(`无法设置默认 Provider: "${name}" 未注册`)
    }
    this.defaultName = name
  }

  listProviders(): string[] {
    return Array.from(this.providers.keys())
  }

  remove(name: string): boolean {
    const removed = this.providers.delete(name)
    if (removed && this.defaultName === name) {
      const first = this.providers.values().next()
      this.defaultName = first.value ? first.value.name : null
    }
    return removed
  }

  clear(): void {
    this.providers.clear()
    this.defaultName = null
  }

  hasProvider(): boolean {
    return this.providers.size > 0
  }
}
