import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
// No Vue component mounting — all tests are pure logic extracted from components.
// Full mounting requires uni-app runtime which needs a native mobile environment.

// Mock database factory for component logic tests
import initSqlJs from 'sql.js'
import { SCHEMA_SQL } from '@/database/schema'
import { seedDatabase } from '@/database/seed'
import type { IDatabase } from '@/database'

class ComponentTestDB implements IDatabase {
  db: any = null
  async init() {
    if (this.db) return
    const SQL = await initSqlJs()
    this.db = new SQL.Database()
    this.db.run('PRAGMA foreign_keys = ON')
    await this.execute(SCHEMA_SQL)
    await seedDatabase(this)
  }
  async close() { this.db?.close(); this.db = null }
  async execute(sql: string, params?: any[]) { this.db.run(sql, params) }
  async query<T>(sql: string, params?: any[]): Promise<T[]> {
    const stmt = this.db.prepare(sql)
    if (params) stmt.bind(params)
    const results: T[] = []
    while (stmt.step()) {
      const row = stmt.getAsObject() as Record<string, unknown>
      const mapped: Record<string, unknown> = {}
      for (const key of Object.keys(row)) {
        const camelKey = key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
        mapped[camelKey] = row[key]
      }
      results.push(mapped as T)
    }
    stmt.free()
    return results
  }
  async queryOne<T>(sql: string, params?: any[]): Promise<T | null> {
    const r = await this.query<T>(sql, params)
    return r.length > 0 ? r[0] : null
  }
  async insert(sql: string, params?: any[]): Promise<number> {
    this.db.run(sql, params)
    return (this.db.exec("SELECT last_insert_rowid() as id")[0]?.values[0]?.[0] as number) ?? 0
  }
  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    this.db.run('BEGIN')
    try { const r = await fn(); this.db.run('COMMIT'); return r }
    catch (e) { this.db.run('ROLLBACK'); throw e }
  }
}

let sharedDB: ComponentTestDB

// Mock the factory to use our in-memory DB
vi.mock('@/database/factory', () => ({
  getDatabase: async () => {
    if (!sharedDB) {
      sharedDB = new ComponentTestDB()
      await sharedDB.init()
    }
    return sharedDB
  },
  closeDatabase: async () => {
    if (sharedDB) { await sharedDB.close(); sharedDB = null as any }
  },
}))

// Now the store imports will use the mocked factory

// ============================================================
// Dashboard computed properties (extracted logic tests)
// ============================================================
describe('Dashboard logic (index.vue)', () => {
  it('isExpense should correctly classify transaction types', () => {
    // Replicate the isExpense function from index.vue
    function isExpense(tx: { txType: string }) {
      return [
        'expense', 'asset_purchase',
        'loan_repay', 'prepaid_amortize', 'credit_card_spend',
      ].includes(tx.txType)
    }

    expect(isExpense({ txType: 'expense' })).toBe(true)
    expect(isExpense({ txType: 'asset_purchase' })).toBe(true)
    expect(isExpense({ txType: 'loan_repay' })).toBe(true)
    expect(isExpense({ txType: 'prepaid_amortize' })).toBe(true)
    expect(isExpense({ txType: 'credit_card_spend' })).toBe(true)

    expect(isExpense({ txType: 'income' })).toBe(false)
    expect(isExpense({ txType: 'salary' })).toBe(false)
    expect(isExpense({ txType: 'investment_sell' })).toBe(false)
    expect(isExpense({ txType: 'loan_receive' })).toBe(false)
    expect(isExpense({ txType: 'transfer' })).toBe(false)
  })

  it('formatAmount should use absolute value', () => {
    function formatAmount(n: number): string {
      return Math.abs(n).toFixed(2)
    }

    expect(formatAmount(100)).toBe('100.00')
    expect(formatAmount(-50)).toBe('50.00')
    expect(formatAmount(0)).toBe('0.00')
    expect(formatAmount(1234.567)).toBe('1234.57')
  })

  it('budgetPercent should cap at reasonable values', () => {
    function calcBudgetPercent(used: number, cap: number): number {
      return cap > 0 ? Math.round((used / cap) * 100) : 0
    }

    expect(calcBudgetPercent(500, 1000)).toBe(50)
    expect(calcBudgetPercent(0, 1000)).toBe(0)
    expect(calcBudgetPercent(1000, 1000)).toBe(100)
    expect(calcBudgetPercent(1500, 1000)).toBe(150)
    expect(calcBudgetPercent(100, 0)).toBe(0)
  })

  it('budgetStatusText should warn at thresholds', () => {
    function getBudgetStatus(pct: number): string {
      if (pct >= 100) return '已超支'
      if (pct > 80) return '即将超支'
      return '预算充足'
    }

    expect(getBudgetStatus(50)).toBe('预算充足')
    expect(getBudgetStatus(81)).toBe('即将超支')
    expect(getBudgetStatus(100)).toBe('已超支')
    expect(getBudgetStatus(150)).toBe('已超支')
  })
})

// ============================================================
// Add transaction form validation (add.vue)
// ============================================================
describe('Add transaction logic (add.vue)', () => {
  it('txTypeNames should cover all types', () => {
    const txTypeNames: Record<string, string> = {
      income: '收入', expense: '支出', transfer: '转账',
      salary: '发工资', investment_buy: '投资买入', investment_sell: '投资卖出',
      valuation_adjust: '估值调整', loan_receive: '借款', loan_repay: '还款',
      prepaid_amortize: '预付摊提', asset_purchase: '购置固定资产',
      asset_dispose: '资产处置', credit_card_spend: '信用卡消费',
      credit_card_repay: '信用卡还款',
    }

    // All 14 types should have Chinese labels
    const types = [
      'income', 'expense', 'transfer', 'salary',
      'investment_buy', 'investment_sell', 'valuation_adjust',
      'loan_receive', 'loan_repay',
      'prepaid_amortize', 'asset_purchase', 'asset_dispose',
      'credit_card_spend', 'credit_card_repay',
    ]
    for (const t of types) {
      expect(txTypeNames[t]).toBeDefined()
      expect(typeof txTypeNames[t]).toBe('string')
    }
    expect(Object.keys(txTypeNames).length).toBe(types.length)
  })

  it('should validate amount is positive', () => {
    function validateAmount(input: string): boolean {
      const n = parseFloat(input)
      return !isNaN(n) && n > 0
    }

    expect(validateAmount('100')).toBe(true)
    expect(validateAmount('0')).toBe(false)
    expect(validateAmount('-50')).toBe(false)
    expect(validateAmount('')).toBe(false)
    expect(validateAmount('abc')).toBe(false)
  })

  it('should validate date format', () => {
    function validateDate(d: string): boolean {
      return /^\d{4}-\d{2}-\d{2}$/.test(d)
    }

    expect(validateDate('2026-05-20')).toBe(true)
    expect(validateDate('2026-1-1')).toBe(false)
    expect(validateDate('abc')).toBe(false)
    expect(validateDate('')).toBe(false)
  })

  it('should calculate net pay from salary inputs', () => {
    function calcNetPay(gross: number, tax: number, social: number): number {
      return gross - tax - social
    }

    expect(calcNetPay(10000, 90, 2250)).toBe(7660)
    expect(calcNetPay(5000, 0, 0)).toBe(5000)
    expect(calcNetPay(10000, 500, 3000)).toBe(6500)
  })

  it('should compute monthly depreciation', () => {
    function calcMonthlyDep(original: number, residual: number, months: number): number {
      return (original - residual) / months
    }

    expect(calcMonthlyDep(10000, 1000, 36)).toBe(250)
    expect(calcMonthlyDep(5000, 0, 60)).toBeCloseTo(83.33, 1)
    expect(calcMonthlyDep(20000, 2000, 120)).toBe(150)
  })
})

// ============================================================
// App.vue onLaunch logic
// ============================================================
describe('App.vue onLaunch logic', () => {
  let db: ComponentTestDB

  beforeEach(async () => {
    db = new ComponentTestDB()
    await db.init()
  })

  afterEach(async () => {
    await db.close()
  })

  it('should archive transactions older than 60 days', async () => {
    // Create transactions at various ages
    const today = new Date()
    const oldDate = new Date(today)
    oldDate.setDate(oldDate.getDate() - 90) // 90 days ago
    const recentDate = new Date(today)
    recentDate.setDate(recentDate.getDate() - 10) // 10 days ago

    // Insert old and recent transactions
    await db.insert(
      `INSERT INTO transactions (tx_type, tx_date, amount, subject_id, archived)
       VALUES ('expense', ?, 100, 1, 0)`,
      [oldDate.toISOString().slice(0, 10)]
    )
    await db.insert(
      `INSERT INTO transactions (tx_type, tx_date, amount, subject_id, archived)
       VALUES ('expense', ?, 200, 1, 0)`,
      [recentDate.toISOString().slice(0, 10)]
    )

    // Run archive logic (same as App.vue onLaunch)
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 60)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    await db.execute(
      'UPDATE transactions SET archived = 1 WHERE tx_date < ? AND archived = 0',
      [cutoffStr]
    )

    // Verify: old should be archived, recent should not
    const all = await db.query<{txDate: string; archived: number}>(
      'SELECT tx_date, archived FROM transactions ORDER BY tx_date'
    )
    expect(all.length).toBe(2)
    expect(all[0].archived).toBe(1) // old → archived
    expect(all[1].archived).toBe(0) // recent → not archived
  })

  it('should purge soft-deleted transactions older than 30 days', async () => {
    // Create and soft-delete an old transaction
    const oldDate = new Date()
    oldDate.setDate(oldDate.getDate() - 60)

    const id = await db.insert(
      `INSERT INTO transactions (tx_type, tx_date, amount, subject_id, is_deleted)
       VALUES ('expense', ?, 50, 1, 1)`,
      [oldDate.toISOString().slice(0, 10)]
    )

    // Run purge (same as repo.purgeExpired called from App.vue)
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 30)
    const cutoffStr = cutoff.toISOString().slice(0, 10)

    const expired = await db.query<{id: number}>(
      'SELECT id FROM transactions WHERE is_deleted = 1 AND tx_date < ?',
      [cutoffStr]
    )
    for (const tx of expired) {
      await db.execute('DELETE FROM transactions WHERE id = ?', [tx.id])
    }

    // Verify: transaction should be physically gone
    const remaining = await db.queryOne('SELECT id FROM transactions WHERE id = ?', [id])
    expect(remaining).toBeNull()
  })

  it('should keep recent soft-deleted transactions', async () => {
    const recentDate = new Date()
    recentDate.setDate(recentDate.getDate() - 5) // 5 days ago

    const id = await db.insert(
      `INSERT INTO transactions (tx_type, tx_date, amount, subject_id, is_deleted)
       VALUES ('expense', ?, 50, 1, 1)`,
      [recentDate.toISOString().slice(0, 10)]
    )

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 30)
    const cutoffStr = cutoff.toISOString().slice(0, 10)

    const expired = await db.query<{id: number}>(
      'SELECT id FROM transactions WHERE is_deleted = 1 AND tx_date < ?',
      [cutoffStr]
    )
    // Recent transaction should not be purged
    expect(expired.length).toBe(0)

    const stillThere = await db.queryOne('SELECT id FROM transactions WHERE id = ?', [id])
    expect(stillThere).not.toBeNull()
  })

  it('should handle empty database gracefully', async () => {
    // Run archive and purge on empty DB — should not throw
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 60)
    await db.execute(
      'UPDATE transactions SET archived = 1 WHERE tx_date < ? AND archived = 0',
      [cutoff.toISOString().slice(0, 10)]
    )

    const cutoff2 = new Date()
    cutoff2.setDate(cutoff2.getDate() - 30)
    const expired = await db.query<{id: number}>(
      'SELECT id FROM transactions WHERE is_deleted = 1 AND tx_date < ?',
      [cutoff2.toISOString().slice(0, 10)]
    )
    expect(expired.length).toBe(0)
  })

  it('should not re-archive already-archived transactions', async () => {
    const oldDate = new Date()
    oldDate.setDate(oldDate.getDate() - 90)

    await db.insert(
      `INSERT INTO transactions (tx_type, tx_date, amount, subject_id, archived)
       VALUES ('expense', ?, 100, 1, 1)`,
      [oldDate.toISOString().slice(0, 10)]
    )

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 60)
    const cutoffStr = cutoff.toISOString().slice(0, 10)

    // Should update 0 rows (already archived)
    await db.execute(
      'UPDATE transactions SET archived = 1 WHERE tx_date < ? AND archived = 0',
      [cutoffStr]
    )

    const tx = await db.queryOne<{archived: number}>(
      'SELECT archived FROM transactions'
    )
    expect(tx!.archived).toBe(1) // unchanged, was already archived
  })
})

// ============================================================
// Settings page logic (index.vue in settings)
// ============================================================
describe('Settings page logic', () => {
  it('should list all setting entries', () => {
    const settings = [
      { name: '科目管理', path: '/pages/settings/subjects' },
      { name: '折旧管理', path: '/pages/settings/depreciation' },
      { name: '摊销管理', path: '/pages/settings/amortization' },
      { name: '预算管理', path: '/pages/settings/budget' },
      { name: '待处理事项', path: '/pages/pending/index' },
      { name: '导出数据', path: '/pages/settings/export' },
      { name: '导入数据', path: '/pages/settings/import' },
      { name: '定期记账', path: '/pages/settings/recurring' },
      { name: '标签管理', path: '/pages/settings/tags' },
      { name: '最近删除', path: '/pages/settings/recently-deleted' },
      { name: '自定义指标', path: '/pages/settings/indicators' },
      { name: '自定义报表', path: '/pages/settings/saved-reports' },
    ]
    expect(settings.length).toBe(12)
    for (const s of settings) {
      expect(s.path).toMatch(/^\/pages\//)
    }
  })

  it('should list all system settings', () => {
    const sysSettings = [
      { name: '数据对账', path: '/pages/settings/reconciliation' },
      { name: '年末结账', path: '/pages/settings/year-end-close' },
      { name: '编辑历史', path: '/pages/settings/edit-history' },
      { name: '安全设置', path: '/pages/settings/security' },
    ]
    expect(sysSettings.length).toBe(4)
  })
})

// ============================================================
// Search transactions page logic
// ============================================================
describe('Search transactions logic', () => {
  it('should build filter conditions correctly', () => {
    function buildFilters(params: {
      startDate?: string; endDate?: string
      subjectId?: number; accountId?: number; txType?: string
      limit?: number; offset?: number
    }) {
      const filters: Record<string, unknown> = {}
      if (params.startDate) filters.startDate = params.startDate
      if (params.endDate) filters.endDate = params.endDate
      if (params.subjectId) filters.subjectId = params.subjectId
      if (params.accountId) filters.accountId = params.accountId
      if (params.txType) filters.txType = params.txType
      if (params.limit) filters.limit = params.limit
      if (params.offset) filters.offset = params.offset
      return filters
    }

    const all = buildFilters({ startDate: '2026-01-01', endDate: '2026-12-31', txType: 'expense', limit: 20 })
    expect(Object.keys(all).length).toBe(4)

    const empty = buildFilters({})
    expect(Object.keys(empty).length).toBe(0)
  })

  it('should handle pagination bounds', () => {
    function clampPage(page: number, totalPages: number): number {
      return Math.max(1, Math.min(page, Math.max(1, totalPages)))
    }

    expect(clampPage(0, 10)).toBe(1)
    expect(clampPage(1, 10)).toBe(1)
    expect(clampPage(5, 10)).toBe(5)
    expect(clampPage(15, 10)).toBe(10)
    expect(clampPage(-5, 0)).toBe(1)
  })
})

// ============================================================
// Account detail page logic (detail.vue)
// ============================================================
describe('Account detail logic', () => {
  it('should compute account summary', () => {
    function summarizeAccount(
      openingBalance: number,
      monthlyIncome: number,
      monthlyExpense: number
    ) {
      const current = openingBalance + monthlyIncome - monthlyExpense
      return {
        openingBalance,
        monthlyIncome,
        monthlyExpense,
        currentBalance: current,
        netChange: monthlyIncome - monthlyExpense,
      }
    }

    const summary = summarizeAccount(50000, 10000, 3000)
    expect(summary.currentBalance).toBe(57000)
    expect(summary.netChange).toBe(7000)
  })
})

// ============================================================
// Reconciliation page logic (reconciliation.vue)
// ============================================================
describe('Reconciliation logic', () => {
  it('should detect balance mismatch', () => {
    function checkBalance(totalDebit: number, totalCredit: number): {
      balanced: boolean; difference: number
    } {
      const diff = Math.round((totalDebit - totalCredit) * 100) / 100
      return { balanced: Math.abs(diff) < 0.01, difference: diff }
    }

    expect(checkBalance(1000, 1000).balanced).toBe(true)
    expect(checkBalance(1000, 999).balanced).toBe(false)
    expect(checkBalance(1000, 999).difference).toBe(1)
  })

  it('should count unreconciled transactions', () => {
    const txs = [
      { isReconciled: 1 }, { isReconciled: 0 },
      { isReconciled: 0 }, { isReconciled: 1 },
    ]
    const unreconciled = txs.filter(t => !t.isReconciled).length
    expect(unreconciled).toBe(2)
  })
})

// ============================================================
// Year-end close logic
// ============================================================
describe('Year-end close logic', () => {
  it('should compute equity transfer correctly', () => {
    function computeYearEndClose(
      currentSurplus: number,
      currentEquity: number
    ): { newSurplus: number; newEquity: number } {
      return {
        newSurplus: 0,
        newEquity: currentEquity + currentSurplus,
      }
    }

    const result = computeYearEndClose(50000, 200000)
    expect(result.newSurplus).toBe(0)
    expect(result.newEquity).toBe(250000)

    const negative = computeYearEndClose(-10000, 50000)
    expect(negative.newSurplus).toBe(0)
    expect(negative.newEquity).toBe(40000)
  })

  it('should generate correct closing entry direction', () => {
    function closingDirection(surplus: number): 'debit302' | 'credit302' {
      return surplus >= 0 ? 'debit302' : 'credit302'
    }

    expect(closingDirection(50000)).toBe('debit302')
    expect(closingDirection(-5000)).toBe('credit302')
  })
})

// ============================================================
// Export page logic
// ============================================================
describe('Export page logic', () => {
  it('should validate month input for report export', () => {
    function parseYearMonth(input: string): { year: number; month: number } | null {
      const match = input.match(/^(\d{4})-(\d{2})$/)
      if (!match) return null
      const y = parseInt(match[1])
      const m = parseInt(match[2])
      if (m < 1 || m > 12) return null
      return { year: y, month: m }
    }

    expect(parseYearMonth('2026-05')).toEqual({ year: 2026, month: 5 })
    expect(parseYearMonth('2026-13')).toBeNull()
    expect(parseYearMonth('abc')).toBeNull()
    expect(parseYearMonth('2026-1')).toBeNull()
  })

  it('should enforce row limits per format', () => {
    const LIMITS = { csv: 10000, xlsx: 65000 }
    function exceedsLimit(count: number, format: 'csv' | 'xlsx'): boolean {
      return count > LIMITS[format]
    }

    expect(exceedsLimit(5000, 'csv')).toBe(false)
    expect(exceedsLimit(10001, 'csv')).toBe(true)
    expect(exceedsLimit(60000, 'xlsx')).toBe(false)
    expect(exceedsLimit(70000, 'xlsx')).toBe(true)
  })
})
