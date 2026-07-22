import { ProviderRegistry } from './registry'
import type { LLMProvider } from '../../types'

export type WorkloadRole =
  | 'reasoning-v1' | 'chat-v1' | 'coding-v1' | 'agentic-v1'
  | 'vision-v1' | 'summarization-v1' | 'reasoning-quick-v1'

export interface WorkloadRoute {
  role: WorkloadRole
  provider: string
  model?: string
  temperature?: number
}

export interface ResolvedRoute {
  provider: LLMProvider
  model?: string
  temperature?: number
}

type ProviderTier = 'flash' | 'pro' | 'default'

function detectTier(name: string): ProviderTier {
  const lower = name.toLowerCase()
  if (/flash|light|lite|fast|quick/.test(lower)) return 'flash'
  if (/pro|max|reasoning|ultra/.test(lower)) return 'pro'
  return 'default'
}

function findProviderByTier(registry: ProviderRegistry, desired: ProviderTier): string | null {
  const providers = registry.listProviders()
  if (providers.length === 0) return null
  const candidates = providers.filter(p => detectTier(p) === desired)
  if (candidates.length > 0) return candidates[0]
  const def = registry.listProviders().find(p => detectTier(p) === 'default')
  if (def) return def
  return providers[0]
}

export class WorkloadRouter {
  private routes: Map<WorkloadRole, WorkloadRoute> = new Map()
  private registry: ProviderRegistry

  constructor(registry: ProviderRegistry, customRoutes?: Partial<Record<WorkloadRole, WorkloadRoute>>) {
    this.registry = registry
    this.initDefaultRoutes()
    if (customRoutes) {
      for (const [role, route] of Object.entries(customRoutes)) {
        if (route) this.routes.set(role as WorkloadRole, route)
      }
    }
  }

  private initDefaultRoutes(): void {
    const setRoute = (role: WorkloadRole, provider: string) => {
      this.routes.set(role, { role, provider })
    }
    const flash = findProviderByTier(this.registry, 'flash')
    const pro = findProviderByTier(this.registry, 'pro')
    if (flash) setRoute('summarization-v1', flash)
    if (pro) {
      setRoute('reasoning-v1', pro)
      setRoute('coding-v1', pro)
    }
  }

  resolve(role: WorkloadRole): ResolvedRoute {
    const route = this.routes.get(role)
    const providerName = route?.provider || this.registry.listProviders()[0]
    if (!providerName) throw new Error(`没有已注册的 Provider，无法解析角色 "${role}"`)
    return {
      provider: this.registry.get(providerName),
      model: route?.model,
      temperature: route?.temperature,
    }
  }

  setRoute(role: WorkloadRole, route: WorkloadRoute): void {
    this.routes.set(role, route)
  }

  getRoutes(): WorkloadRoute[] {
    return Array.from(this.routes.values())
  }
}

export function createRouter(registry?: ProviderRegistry, routes?: Partial<Record<WorkloadRole, WorkloadRoute>>): WorkloadRouter {
  const reg = registry || ProviderRegistry.getInstance()
  return new WorkloadRouter(reg, routes)
}
