// === 会计科目 (accounting_subjects) ===
export interface AccountingSubject {
  id: number
  code: string            // 8位: PPPPPSSS
  name: string
  level: 1 | 2 | 3       // 1=一级, 2=二级, 3=三级
  parentId: number | null // 上级ID
  subjectType: 'asset' | 'liability' | 'equity' | 'income' | 'expense'
  expenseType: 'fixed' | 'variable' | null   // 仅费用类
  cashFlowCategory: 'operating' | 'investing' | 'financing' | null
  isSystem: boolean       // 系统预设只读
  isActive: boolean       // 可停用
  sortOrder: number
}

// === 账户实例 (accounts) ===
export type AccountType =
  | 'cash' | 'checking' | 'fixed_deposit' | 'money_market'
  | 'receivable' | 'investment' | 'fixed_asset' | 'prepaid' | 'deposit'
  | 'credit_card' | 'payable' | 'loan'

export interface Account {
  id: number
  name: string
  subjectCode: string     // 8位三级编码
  accountType: AccountType
  subjectId: number       // 关联L2科目
  currency: string        // 默认 CNY
  bankName?: string
  cardLastFour?: string
  creditLimit?: number    // 信用卡额度
  maturityDate?: string   // 定期到期日
  notes?: string          // 投资品名称/代码等
  contractNo?: string     // 贷款合同号
  isActive: boolean
  createdAt: string
}

// === 交易 (transactions) ===
export type TxType =
  | 'salary' | 'income' | 'expense' | 'transfer'
  | 'investment_buy' | 'investment_sell' | 'valuation_adjust'
  | 'loan_receive' | 'loan_repay'
  | 'prepaid_amortize' | 'asset_purchase' | 'asset_dispose'
  | 'credit_card_spend' | 'credit_card_repay'

export interface Transaction {
  id: number
  txType: TxType
  txDate: string          // YYYY-MM-DD
  amount: number          // 主金额
  subjectId: number       // L2科目
  l3SubjectId: number | null  // 三级明细
  accountId: number | null    // 账户(付款/来源)
  toAccountId: number | null  // 对方账户
  toSubjectId: number | null  // 对方科目
  note: string | null
  isReconciled: boolean
  isDeleted: boolean
  archived: boolean       // 超过60天自动归档
  createdAt: string
}

// === 分录 (journal_entries) ===
export type EntryDirection = 'debit' | 'credit'

export interface JournalEntry {
  id: number
  transactionId: number
  accountId: number | null   // 资金账户(现金/存款等)
  subjectId: number           // L2科目
  l3SubjectId: number | null  // 三级明细
  direction: EntryDirection
  amount: number
  entryDate: string
  createdAt: string
}

// === 摊提计划 (amortization_schedules) ===
export interface AmortizationSchedule {
  id: number
  transactionId: number
  l3SubjectId: number
  totalAmount: number
  periods: number
  amountPerPeriod: number
  remainingPeriods: number
  startDate: string
  isActive: boolean
  createdAt: string
}

// === 折旧配置 (depreciation_configs) ===
export type DepreciationMethod = 'straight_line'

export interface DepreciationConfig {
  id: number
  accountId: number          // 关联资产账户
  assetName: string
  originalValue: number
  residualValue: number
  usefulMonths: number
  method: DepreciationMethod
  depreciationSubjectId: number  // 151xx累计折旧科目
  startDate: string              // 开始计提月份
  isActive: boolean
  createdAt: string
}

// === 投资估值 (investment_valuations) ===
export interface InvestmentValuation {
  id: number
  l3SubjectId: number
  valuationDate: string
  costAmount: number
  marketValue: number
  unrealizedPnl: number     // 浮动盈亏
  createdAt: string
}

// === 投资批次 (investment_lots) ===
export interface InvestmentLot {
  id: number
  l3SubjectId: number
  buyDate: string
  quantity: number
  unitCost: number
  remainingQty: number      // 剩余数量(部分卖出后减少)
  remainingCost: number     // 剩余成本
  createdAt: string
}

// === 预算 (budget) ===
export interface BudgetOverall {
  id: number
  monthlyCap: number
  activeMonth: string       // YYYYMM
  isActive: boolean
}

export interface BudgetThreshold {
  id: number
  subjectId: number         // L2或L3科目ID
  amount: number
  isActive: boolean
}

// === 自定义指标 (user_indicators) ===
export interface UserIndicator {
  id: number
  name: string
  formula: string           // 如 SUM(50202) / TOTAL_EXPENSE
  decimalPlaces: number
  isActive: boolean
}

// === 自定义报表 (saved_reports) ===
export interface SavedReport {
  id: number
  name: string
  filters: string            // JSON
  sortField: string
  displayFields: string      // JSON array
  isPinned: boolean
}

// === 编辑历史 ===
export interface EditHistory {
  id: number
  transactionId: number
  changeReason: string       // 'user_edit' | 'system_depreciation' | etc
  changes: string            // JSON: {field: {old, new}}
  createdAt: string
}

// === 待处理事项 ===
export type PendingItemType = 'depreciation' | 'amortization' | 'recurring'

export interface PendingItem {
  id: number
  itemType: PendingItemType
  referenceId: number
  description: string
  amount: number
  dueDate: string
  isDone: boolean
  createdAt: string
}
