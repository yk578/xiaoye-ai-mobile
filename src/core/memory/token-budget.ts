/* ── Token 预算追踪 ── */

export class TokenBudgetTracker {
  private budget: number
  private used = 0

  constructor(budget: number = 100000) {
    this.budget = budget
  }

  setBudget(budget: number): void {
    this.budget = budget
  }

  recordUsage(usage: { prompt_tokens: number; completion_tokens: number }): void {
    this.used += usage.prompt_tokens + usage.completion_tokens
  }

  get usedTokens(): number {
    return this.used
  }

  get budgetExceeded(): boolean {
    return this.used >= this.budget
  }

  get remaining(): number {
    return Math.max(0, this.budget - this.used)
  }

  reset(): void {
    this.used = 0
  }
}
