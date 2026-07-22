/* ── 事件总线（从桌面端复制，零改动） ── */

export const Events = {
  PROVIDER_CHANGED: 'provider:changed',
  MESSAGE_SENT: 'message:sent',
  MESSAGE_RECEIVED: 'message:received',
  TOOL_CALLED: 'tool:called',
  CONTEXT_THRESHOLD: 'context:threshold',
  SESSION_START: 'session:start',
  SESSION_END: 'session:end',
} as const

export type EventName = (typeof Events)[keyof typeof Events]

export class EventBus {
  private static instance: EventBus
  private listeners = new Map<string, Set<Function>>()

  static getInstance(): EventBus {
    if (!EventBus.instance) EventBus.instance = new EventBus()
    return EventBus.instance
  }

  on(event: string, handler: Function): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event)!.add(handler)
    return () => this.off(event, handler)
  }

  off(event: string, handler: Function): void {
    this.listeners.get(event)?.delete(handler)
  }

  emit(event: string, data?: unknown): void {
    const handlers = this.listeners.get(event)
    if (!handlers || handlers.size === 0) return
    for (const handler of handlers) {
      try { handler(data) } catch (err) {
        console.error(`[EventBus] Handler error for "${event}":`, err)
      }
    }
  }
}

export const eventBus = EventBus.getInstance()
