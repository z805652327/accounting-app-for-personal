export const TX_TYPE_NAMES: Record<string, string> = {
  income: '收入',
  expense: '支出',
  transfer: '转账',
  salary: '发工资',
  investment_buy: '投资买入',
  investment_sell: '投资卖出',
  valuation_adjust: '估值调整',
  loan_receive: '借款',
  loan_repay: '还款',
  prepaid_amortize: '预付摊提',
  asset_purchase: '购置固定资产',
  asset_dispose: '资产处置',
  credit_card_spend: '信用卡消费',
  credit_card_repay: '信用卡还款',
}

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  cash: '现金',
  checking: '活期账户',
  fixed_deposit: '定期存款',
  money_market: '货币基金',
  receivable: '应收款',
  investment: '投资资产',
  fixed_asset: '固定资产',
  prepaid: '待摊费用',
  deposit: '押金/保证金',
  credit_card: '信用卡',
  payable: '应付款',
  loan: '借款',
}

export const EXPENSE_CATEGORIES = {
  fixed: ['501', '502', '507', '508'],
  variable: ['503', '504', '506', '599'],
  mixed: ['505', '509'],
} as const

export const CASH_ACCOUNT_TYPES = ['cash', 'checking', 'fixed_deposit', 'money_market']

export const ASSET_ACCOUNT_TYPES = ['cash', 'checking', 'fixed_deposit', 'money_market',
  'receivable', 'investment', 'fixed_asset', 'prepaid', 'deposit']

export const LIABILITY_ACCOUNT_TYPES = ['credit_card', 'payable', 'loan']
