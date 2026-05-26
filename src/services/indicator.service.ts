import type { IDatabase } from '@/database'
import type { UserIndicator } from '@/types'
import { BalanceCalculator } from './balance-calculator'

const IND_COLS = `id, name, formula, decimal_places as decimalPlaces, is_active as isActive`

export interface IndicatorResult {
  indicator: UserIndicator
  value: number
  numerator: number
  denominator: number
  formulaDesc: string
}

export class IndicatorService {
  constructor(private db: IDatabase) {}

  async findAll(): Promise<UserIndicator[]> {
    return this.db.query<UserIndicator>(
      `SELECT ${IND_COLS} FROM user_indicators WHERE is_active = 1 ORDER BY id`
    )
  }

  async findById(id: number): Promise<UserIndicator | null> {
    return this.db.queryOne<UserIndicator>(
      `SELECT ${IND_COLS} FROM user_indicators WHERE id = ?`, [id]
    )
  }

  async create(data: {
    name: string
    formula: string
    decimalPlaces?: number
  }): Promise<number> {
    return this.db.insert(
      `INSERT INTO user_indicators (name, formula, decimal_places, is_active)
       VALUES (?, ?, ?, 1)`,
      [data.name, data.formula, data.decimalPlaces ?? 2]
    )
  }

  async update(id: number, data: { name?: string; formula?: string; decimalPlaces?: number }): Promise<void> {
    const fields: string[] = []
    const params: any[] = []
    if (data.name !== undefined) { fields.push('name = ?'); params.push(data.name) }
    if (data.formula !== undefined) { fields.push('formula = ?'); params.push(data.formula) }
    if (data.decimalPlaces !== undefined) { fields.push('decimal_places = ?'); params.push(data.decimalPlaces) }
    if (fields.length === 0) return
    params.push(id)
    await this.db.execute(
      `UPDATE user_indicators SET ${fields.join(', ')} WHERE id = ?`, params
    )
  }

  async toggleActive(id: number, isActive: boolean): Promise<void> {
    await this.db.execute(
      'UPDATE user_indicators SET is_active = ? WHERE id = ?',
      [isActive ? 1 : 0, id]
    )
  }

  async delete(id: number): Promise<void> {
    await this.db.execute('DELETE FROM user_indicators WHERE id = ?', [id])
  }

  /** Evaluate all indicators against a specific year/month */
  async evaluate(year: number, month: number): Promise<IndicatorResult[]> {
    const indicators = await this.findAll()
    const calc = new BalanceCalculator(this.db)
    const balances = await calc.calculate(year, month)

    // Pre-compute system variables
    const totalIncome = balances
      .filter(b => b.subjectType === 'income')
      .reduce((s, b) => s + b.closingBalance, 0)
    const totalExpense = balances
      .filter(b => b.subjectType === 'expense')
      .reduce((s, b) => s + b.closingBalance, 0)
    const assets = balances
      .filter(b => b.subjectType === 'asset')
      .reduce((s, b) => s + b.closingBalance, 0)
    const liabilities = balances
      .filter(b => b.subjectType === 'liability')
      .reduce((s, b) => s + b.closingBalance, 0)
    const netAsset = assets - liabilities

    const results: IndicatorResult[] = []
    for (const ind of indicators) {
      try {
        const value = this.evalFormula(ind.formula, balances, {
          totalIncome, totalExpense, netAsset,
        })
        results.push({
          indicator: ind,
          value: Math.round(value * Math.pow(10, ind.decimalPlaces))
            / Math.pow(10, ind.decimalPlaces),
          numerator: 0,
          denominator: 0,
          formulaDesc: ind.formula,
        })
      } catch {
        results.push({
          indicator: ind,
          value: 0,
          numerator: 0,
          denominator: 0,
          formulaDesc: `${ind.formula} (计算错误)`,
        })
      }
    }
    return results
  }

  /** Simple formula evaluator */
  private evalFormula(
    formula: string,
    balances: any[],
    vars: { totalIncome: number; totalExpense: number; netAsset: number }
  ): number {
    let expr = formula.trim()

    // Resolve SUM(code) — sum balances whose subjectCode starts with the given code
    expr = expr.replace(/SUM\s*\(\s*(\d+)\s*\)/gi, (_, code) => {
      const total = balances
        .filter((b: any) => b.subjectCode.startsWith(code))
        .reduce((s: number, b: any) => s + b.closingBalance, 0)
      return String(Math.round(total * 100) / 100)
    })

    // Resolve system variables
    expr = expr.replace(/TOTAL_INCOME/gi, String(vars.totalIncome))
    expr = expr.replace(/TOTAL_EXPENSE/gi, String(vars.totalExpense))
    expr = expr.replace(/NET_ASSET/gi, String(vars.netAsset))

    // Safety: only allow digits, operators, parens, decimal points, whitespace
    const sanitized = expr.replace(/\s+/g, '')
    if (!/^[\d+\-*/().]+$/.test(sanitized)) {
      throw new Error(`Invalid expression: ${sanitized}`)
    }

    // Safe eval — only arithmetic
    const result = new Function(`return (${sanitized})`)()
    if (typeof result !== 'number' || !isFinite(result)) {
      throw new Error(`Computation error: ${sanitized}`)
    }
    return result
  }
}
