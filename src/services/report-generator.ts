import type { IDatabase } from '@/database'
import { BalanceCalculator, type SubjectBalance } from './balance-calculator'

interface BalanceSheetItem {
  name: string
  amount: number
  level: number        // 0=group header, 1=L1, 2=L2
  group?: string       // group identifier for sub-items
  isGroup?: boolean    // true for group header rows
  indent?: boolean     // true for sub-items that should be indented
}

interface BalanceSheet {
  date: string
  assets: BalanceSheetItem[]
  liabilities: BalanceSheetItem[]
  equity: BalanceSheetItem[]
  totalAssets: number
  totalLiabilities: number
  totalEquity: number
  isBalanced: boolean
}

interface IncomeStatement {
  period: string
  incomes: { name: string; amount: number; level: number; category: string }[]
  expenses: { name: string; amount: number; level: number; category: string; expenseType: string | null }[]
  totalIncome: number
  totalExpense: number
  netSurplus: number
  fixedExpense: number
  variableExpense: number
}

interface CashFlowStatement {
  period: string
  operatingInflows: { name: string; amount: number }[]
  operatingOutflows: { name: string; amount: number }[]
  operatingNet: number
  investingInflows: { name: string; amount: number }[]
  investingOutflows: { name: string; amount: number }[]
  investingNet: number
  financingInflows: { name: string; amount: number }[]
  financingOutflows: { name: string; amount: number }[]
  financingNet: number
  netIncrease: number
  openingCash: number
  closingCash: number
}

/** Classify a transaction type into cash flow category */
function classifyCashFlow(txType: string): 'operating' | 'investing' | 'financing' | null {
  switch (txType) {
    case 'income':
    case 'expense':
    case 'salary':
    case 'prepaid_amortize':
      return 'operating'
    case 'investment_buy':
    case 'investment_sell':
    case 'asset_purchase':
    case 'asset_dispose':
      return 'investing'
    case 'loan_receive':
    case 'loan_repay':
    case 'credit_card_repay':
      return 'financing'
    // Non-cash or internal:
    case 'transfer':
    case 'valuation_adjust':
    case 'credit_card_spend':
      return null
    default:
      return 'operating'
  }
}

export class ReportGenerator {
  private calculator: BalanceCalculator

  constructor(private db: IDatabase) {
    this.calculator = new BalanceCalculator(db)
  }

  // --- 资产负债表 ---
  async generateBalanceSheet(year: number, month: number): Promise<BalanceSheet> {
    const balances = await this.calculator.calculate(year, month)
    const date = `${year}-${String(month).padStart(2, '0')}`

    // Build subject tree for hierarchical rollup
    const allSubjects = await this.db.query<{id: number; code: string; name: string; level: number; parentId: number | null; subjectType: string}>(
      'SELECT id, code, name, level, parent_id, subject_type FROM accounting_subjects'
    )
    const childrenMap = new Map<number, number[]>()
    const subjectMap = new Map<number, typeof allSubjects[0]>()
    for (const s of allSubjects) {
      subjectMap.set(s.id, s)
      if (s.parentId) {
        const c = childrenMap.get(s.parentId) || []
        c.push(s.id)
        childrenMap.set(s.parentId, c)
      }
    }

    // Get all descendant IDs for a subject (including itself)
    function getDescendantIds(subjectId: number): number[] {
      const ids: number[] = [subjectId]
      const children = childrenMap.get(subjectId)
      if (children) {
        for (const cid of children) {
          ids.push(...getDescendantIds(cid))
        }
      }
      return ids
    }

    // Calculate rolled-up closing balance for an L1 subject
    function getRolledUpBalance(subjectId: number): number {
      const descIds = getDescendantIds(subjectId)
      let total = 0
      for (const bal of balances) {
        if (descIds.includes(bal.subjectId)) {
          total += bal.closingBalance
        }
      }
      return Math.round(total * 100) / 100
    }

    const mapSubject = (b: typeof allSubjects[0], overrides?: Partial<BalanceSheetItem>): BalanceSheetItem => ({
      name: b.name,
      amount: getRolledUpBalance(b.id),
      level: b.level,
      indent: false,
      ...overrides,
    })

    function groupHeader(name: string): BalanceSheetItem {
      return { name, amount: 0, level: 0, isGroup: true }
    }

    function indentItem(b: BalanceSheetItem): BalanceSheetItem {
      return { ...b, indent: true }
    }

    // Assets — grouped structure per spec Section 3
    const assetL1s = allSubjects.filter(s => s.subjectType === 'asset' && s.level === 1 && !s.code.startsWith('151'))
    const currentAssetCodes = ['10100','10200','10300','11100','14100','14200']
    const investAssetCodes = ['12100']
    const fixedAssetCodes = ['13100']

    const currentAssets = assetL1s.filter(s => currentAssetCodes.includes(s.code)).map(s => indentItem(mapSubject(s)))
    const investAssets = assetL1s.filter(s => investAssetCodes.includes(s.code)).map(s => indentItem(mapSubject(s)))
    const fixedOriginals = assetL1s.filter(s => fixedAssetCodes.includes(s.code))
    // Expand fixed assets to L2 detail
    const fixedDetail: BalanceSheetItem[] = []
    for (const l1 of fixedOriginals) {
      const l2s = allSubjects.filter(s => s.parentId === l1.id)
      for (const l2 of l2s) {
        fixedDetail.push(indentItem(mapSubject(l2)))
      }
    }
    const depSubjects = allSubjects.filter(s => s.code.startsWith('151') && s.level === 2)
    const depDetail = depSubjects.map(s => indentItem(mapSubject(s)))

    const fixedOriginTotal = fixedOriginals.reduce((s, a) => s + getRolledUpBalance(a.id), 0)
    const depTotal = depSubjects.reduce((s, a) => s + getRolledUpBalance(a.id), 0)
    const fixedAssetNet = Math.round((fixedOriginTotal - depTotal) * 100) / 100

    const assets: BalanceSheetItem[] = [
      groupHeader('流动资产'),
      ...currentAssets,
      groupHeader('投资资产'),
      ...investAssets,
      groupHeader('固定资产原值'),
      ...fixedDetail,
      groupHeader('减：累计折旧'),
      ...depDetail,
      { name: '固定资产（净值）', amount: fixedAssetNet, level: 1 },
    ]

    // Liabilities — grouped
    const liabilityL1s = allSubjects.filter(s => s.subjectType === 'liability' && s.level === 1)
    const shortTermCodes = ['20100','20200','21100']
    const longTermCodes = ['22100']
    const shortTerm = liabilityL1s.filter(s => shortTermCodes.includes(s.code)).map(s => indentItem(mapSubject(s)))
    const longTerm = liabilityL1s.filter(s => longTermCodes.includes(s.code)).map(s => indentItem(mapSubject(s)))

    const liabilities: BalanceSheetItem[] = [
      groupHeader('流动负债'),
      ...shortTerm,
      groupHeader('长期负债'),
      ...longTerm,
    ]

    // Equity
    const equity = allSubjects
      .filter(s => s.subjectType === 'equity' && s.level === 1)
      .map(s => mapSubject(s))

    const incomeBal = balances.filter(b => b.subjectType === 'income').reduce((s, b) => s + b.closingBalance, 0)
    const expenseBal = balances.filter(b => b.subjectType === 'expense').reduce((s, b) => s + b.closingBalance, 0)
    const currentSurplus = incomeBal - expenseBal

    const surplusIdx = equity.findIndex(e => e.name === '本期结余')
    if (surplusIdx >= 0) {
      equity[surplusIdx].amount = Math.round(currentSurplus * 100) / 100
    } else {
      equity.push({ name: '本期结余', amount: Math.round(currentSurplus * 100) / 100, level: 1 })
    }

    const nonGroupAssets = assets.filter(a => !a.isGroup)
    const totalAssets = nonGroupAssets.reduce((s, a) => s + a.amount, 0)
    const totalLiabilities = liabilities.filter(l => !l.isGroup).reduce((s, l) => s + l.amount, 0)
    const totalEquity = equity.reduce((s, e) => s + e.amount, 0)

    return {
      date,
      assets, liabilities, equity,
      totalAssets: Math.round(totalAssets * 100) / 100,
      totalLiabilities: Math.round(totalLiabilities * 100) / 100,
      totalEquity: Math.round(totalEquity * 100) / 100,
      isBalanced: Math.abs(totalAssets - totalLiabilities - totalEquity) < 0.01,
    }
  }

  // --- 利润表 ---
  async generateIncomeStatement(year: number, month: number): Promise<IncomeStatement> {
    const balances = await this.calculator.calculate(year, month)
    const period = `${year}-${String(month).padStart(2, '0')}`

    // Get all subjects for L1/L2 hierarchy
    const allSubjects = await this.db.query<{ id: number; code: string; name: string; level: number; parentId: number | null; subjectType: string; expenseType: string | null }>(
      'SELECT id, code, name, level, parent_id, subject_type, expense_type FROM accounting_subjects WHERE is_active = 1'
    )

    // Build L3→L2 rollup: map each balance to its effective L2
    // L3 balances go to parent L2, L2 balances stay as-is
    const l2BalanceMap = new Map<number, number>() // L2 subjectId → total balance
    const l1BalanceMap = new Map<number, number>() // L1 subjectId → total balance
    const l2ToL1 = new Map<number, number>() // L2 → L1 parent
    const l2Info = new Map<number, { name: string; code: string; expenseType: string | null }>()

    // Build L2→L1 mapping
    for (const s of allSubjects) {
      if (s.level === 2 && s.parentId) l2ToL1.set(s.id, s.parentId)
      if (s.level === 2) l2Info.set(s.id, { name: s.name, code: s.code, expenseType: s.expenseType })
    }

    // Roll up balances: L3→L2, L2→L1
    for (const b of balances) {
      let l2Id: number | undefined
      if (b.level === 2) {
        l2Id = b.subjectId
      } else if (b.level === 3) {
        // Find parent L2
        const parentCode = b.subjectCode.substring(0, 5)
        const parent = allSubjects.find(s => s.level === 2 && s.code === parentCode)
        if (parent) l2Id = parent.id
      }
      if (l2Id) {
        const cur = l2BalanceMap.get(l2Id) || 0
        l2BalanceMap.set(l2Id, cur + b.closingBalance)
        // Roll up to L1
        const l1Id = l2ToL1.get(l2Id)
        if (l1Id) {
          l1BalanceMap.set(l1Id, (l1BalanceMap.get(l1Id) || 0) + b.closingBalance)
        }
      }
    }

    // Build L1 items (for section headers in display)
    const l1Info = new Map<number, { name: string; code: string }>()
    for (const s of allSubjects) {
      if (s.level === 1) l1Info.set(s.id, { name: s.name, code: s.code })
    }

    const incomes: { name: string; amount: number; level: number; category: string; code: string; expenseType?: string | null }[] = []
    const expenses: { name: string; amount: number; level: number; category: string; code: string; expenseType?: string | null }[] = []

    // Output L1 headers + L2 details (including zero-balance L2)
    for (const s of allSubjects) {
      if (s.level !== 2) continue
      if (s.subjectType !== 'income' && s.subjectType !== 'expense') continue
      const amt = Math.round((l2BalanceMap.get(s.id) || 0) * 100) / 100
      const l1Id = l2ToL1.get(s.id)
      const l1 = l1Id ? l1Info.get(l1Id) : null
      const item = {
        name: s.name, amount: amt, level: 2,
        category: s.code.substring(0, 3), code: s.code,
        expenseType: s.expenseType,
        l1Name: l1?.name || '', l1Code: l1?.code || ''
      }
      if (s.subjectType === 'income') incomes.push(item)
      else expenses.push(item)
    }

    // Add L1 totals
    for (const [l1Id, l1Amt] of l1BalanceMap) {
      const l1 = l1Info.get(l1Id)
      if (!l1) continue
      const amt = Math.round(l1Amt * 100) / 100
      const l2children = allSubjects.filter(s => s.level === 2 && s.parentId === l1Id)
      const stype = l2children[0]?.subjectType
      const item = { name: l1.name, amount: amt, level: 1, category: l1.code, code: l1.code, l1Name: '', l1Code: l1.code }
      if (stype === 'income') incomes.unshift(item)
      else if (stype === 'expense') expenses.unshift(item)
    }

    const totalIncome = incomes.reduce((s, i) => s + i.amount, 0)
    const totalExpense = expenses.reduce((s, e) => s + e.amount, 0)

    // Fixed vs variable from DB expense_type field (not hardcoded code prefixes)
    const fixedExpense = balances
      .filter(b => b.subjectType === 'expense' && b.expenseType === 'fixed')
      .reduce((s, b) => s + b.closingBalance, 0)
    const variableExpense = totalExpense - fixedExpense

    return {
      period,
      incomes, expenses,
      totalIncome: Math.round(totalIncome * 100) / 100,
      totalExpense: Math.round(totalExpense * 100) / 100,
      netSurplus: Math.round((totalIncome - totalExpense) * 100) / 100,
      fixedExpense: Math.round(fixedExpense * 100) / 100,
      variableExpense: Math.round(variableExpense * 100) / 100,
    }
  }

  // --- 现金流量表 ---
  async generateCashFlow(year: number, month: number): Promise<CashFlowStatement> {
    const period = `${year}-${String(month).padStart(2, '0')}`
    const periodStart = `${period}-01`
    const nextMonth = month === 12 ? 1 : month + 1
    const nextYear = month === 12 ? year + 1 : year
    const periodEnd = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`

    // Get all cash accounts (cash, checking, money market)
    interface CashAccountRow { id: number; subjectCode: string; name: string }
    const cashAccounts = await this.db.query<CashAccountRow>(
      "SELECT id, subject_code, name FROM accounts WHERE subject_code LIKE '101%' OR subject_code LIKE '102%' OR subject_code LIKE '103%'"
    )
    const cashAccountIds = cashAccounts.map(a => a.id)
    if (cashAccountIds.length === 0) {
      return { period, operatingInflows: [], operatingOutflows: [], operatingNet: 0,
        investingInflows: [], investingOutflows: [], investingNet: 0,
        financingInflows: [], financingOutflows: [], financingNet: 0,
        netIncrease: 0, openingCash: 0, closingCash: 0 }
    }

    // Get all journal entries for cash accounts in the period
    const placeholders = cashAccountIds.map(() => '?').join(',')
    interface EntryRow { id: number; accountId: number; subjectId: number; direction: string; amount: number; entryDate: string; cashFlowCategory: string | null; txType: string }
    const entries = await this.db.query<EntryRow>(
      `SELECT je.id, je.account_id, je.subject_id, je.direction, je.amount, je.entry_date, s.cash_flow_category, t.tx_type
       FROM journal_entries je
       JOIN accounting_subjects s ON je.subject_id = s.id
       JOIN transactions t ON je.transaction_id = t.id
       WHERE je.account_id IN (${placeholders})
         AND je.entry_date >= ? AND je.entry_date < ?
       ORDER BY je.entry_date`,
      [...cashAccountIds, periodStart, periodEnd]
    )

    const operatingIn: { name: string; amount: number }[] = []
    const operatingOut: { name: string; amount: number }[] = []
    const investingIn: { name: string; amount: number }[] = []
    const investingOut: { name: string; amount: number }[] = []
    const financingIn: { name: string; amount: number }[] = []
    const financingOut: { name: string; amount: number }[] = []

    for (const e of entries) {
      const cfCat = classifyCashFlow(e.txType)
      if (!cfCat) continue // skip transfers, valuation, credit_card_spend

      const txTypeNames: Record<string, string> = {
        income: '收入', expense: '支出', salary: '工资', transfer: '转账',
        investment_buy: '投资买入', investment_sell: '投资卖出',
        loan_receive: '借款收入', loan_repay: '还款支出',
        asset_purchase: '购置资产', asset_dispose: '资产处置',
        credit_card_spend: '信用卡消费', credit_card_repay: '信用卡还款',
        prepaid_amortize: '预付摊提', valuation_adjust: '估值调整'
      }
      const item = { name: txTypeNames[e.txType] || e.txType, amount: e.amount }
      const isInflow = e.direction === 'debit' // cash increases on debit

      if (cfCat === 'operating') {
        if (isInflow) operatingIn.push(item)
        else operatingOut.push(item)
      } else if (cfCat === 'investing') {
        if (isInflow) investingIn.push(item)
        else investingOut.push(item)
      } else if (cfCat === 'financing') {
        if (isInflow) financingIn.push(item)
        else financingOut.push(item)
      }
    }

    const operatingNet = this.sum(operatingIn) - this.sum(operatingOut)
    const investingNet = this.sum(investingIn) - this.sum(investingOut)
    const financingNet = this.sum(financingIn) - this.sum(financingOut)
    const netIncrease = operatingNet + investingNet + financingNet

    // Opening and closing cash balances
    const openingCash = await this.getCashBalance(cashAccountIds, periodStart)
    const closingCash = openingCash + netIncrease

    return { period,
      operatingInflows: operatingIn, operatingOutflows: operatingOut, operatingNet,
      investingInflows: investingIn, investingOutflows: investingOut, investingNet,
      financingInflows: financingIn, financingOutflows: financingOut, financingNet,
      netIncrease, openingCash, closingCash,
    }
  }

  private sum(items: { amount: number }[]): number {
    return Math.round(items.reduce((s, i) => s + i.amount, 0) * 100) / 100
  }

  private async getCashBalance(accountIds: number[], beforeDate: string): Promise<number> {
    const placeholders = accountIds.map(() => '?').join(',')
    const result = await this.db.queryOne<{bal: number | null}>(
      `SELECT SUM(CASE WHEN direction = 'debit' THEN amount ELSE -amount END) as bal
       FROM journal_entries
       WHERE account_id IN (${placeholders}) AND entry_date < ?`,
      [...accountIds, beforeDate]
    )
    return result?.bal ?? 0
  }
}
