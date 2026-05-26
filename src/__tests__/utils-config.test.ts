import { describe, it, expect } from 'vitest'
import { formatMoney, formatDate, getPeriodStart, getPeriodEnd, todayStr } from '@/utils/format'
import {
  TX_TYPE_NAMES, ACCOUNT_TYPE_LABELS, EXPENSE_CATEGORIES,
  CASH_ACCOUNT_TYPES, ASSET_ACCOUNT_TYPES, LIABILITY_ACCOUNT_TYPES,
} from '@/config/index'

// ============================================================
// Format utilities
// ============================================================
describe('formatMoney', () => {
  it('should prefix with ¥', () => {
    expect(formatMoney(100)).toBe('¥100.00')
  })

  it('should handle negative numbers', () => {
    expect(formatMoney(-50)).toBe('¥50.00')
  })

  it('should format to 2 decimal places', () => {
    expect(formatMoney(99.9)).toBe('¥99.90')
    expect(formatMoney(0.001)).toBe('¥0.00')
  })

  it('should handle zero', () => {
    expect(formatMoney(0)).toBe('¥0.00')
  })

  it('should handle large numbers', () => {
    expect(formatMoney(1234567.89)).toBe('¥1234567.89')
  })
})

describe('formatDate', () => {
  it('should format Date object to YYYY-MM-DD', () => {
    const d = new Date(2026, 4, 15) // May 15, 2026
    expect(formatDate(d)).toBe('2026-05-15')
  })

  it('should format date string input', () => {
    expect(formatDate('2026-01-01')).toBe('2026-01-01')
  })

  it('should handle single-digit month/day padding', () => {
    const d = new Date(2026, 0, 5) // Jan 5, 2026
    expect(formatDate(d)).toBe('2026-01-05')
  })

  it('should handle year-end dates', () => {
    const d = new Date(2026, 11, 31) // Dec 31, 2026
    expect(formatDate(d)).toBe('2026-12-31')
  })
})

describe('getPeriodStart', () => {
  it('should return first day of month', () => {
    expect(getPeriodStart(2026, 5)).toBe('2026-05-01')
    expect(getPeriodStart(2026, 1)).toBe('2026-01-01')
    expect(getPeriodStart(2026, 12)).toBe('2026-12-01')
  })

  it('should pad single-digit months', () => {
    expect(getPeriodStart(2026, 3)).toBe('2026-03-01')
    expect(getPeriodStart(2026, 9)).toBe('2026-09-01')
  })
})

describe('getPeriodEnd', () => {
  it('should return first day of next month', () => {
    expect(getPeriodEnd(2026, 5)).toBe('2026-06-01')
    expect(getPeriodEnd(2026, 1)).toBe('2026-02-01')
  })

  it('should handle year boundary', () => {
    expect(getPeriodEnd(2026, 12)).toBe('2027-01-01')
  })

  it('should handle various months', () => {
    expect(getPeriodEnd(2026, 3)).toBe('2026-04-01')
    expect(getPeriodEnd(2026, 11)).toBe('2026-12-01')
  })
})

describe('todayStr', () => {
  it('should return YYYY-MM-DD format', () => {
    const result = todayStr()
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('should match current date', () => {
    const now = new Date()
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    expect(todayStr()).toBe(expected)
  })
})

// ============================================================
// Config constants
// ============================================================
describe('TX_TYPE_NAMES', () => {
  it('should cover all transaction types', () => {
    const types = [
      'income', 'expense', 'transfer',
      'salary', 'investment_buy', 'investment_sell', 'valuation_adjust',
      'loan_receive', 'loan_repay',
      'prepaid_amortize', 'asset_purchase', 'asset_dispose',
      'credit_card_spend', 'credit_card_repay',
    ]
    for (const t of types) {
      expect(TX_TYPE_NAMES[t]).toBeDefined()
    }
    expect(Object.keys(TX_TYPE_NAMES).length).toBe(types.length)
  })
})

describe('ACCOUNT_TYPE_LABELS', () => {
  it('should cover all 12 account types from spec', () => {
    const types = [
      'cash', 'checking', 'fixed_deposit', 'money_market',
      'receivable', 'investment', 'fixed_asset', 'prepaid', 'deposit',
      'credit_card', 'payable', 'loan',
    ]
    for (const t of types) {
      expect(ACCOUNT_TYPE_LABELS[t]).toBeDefined()
    }
  })
})

describe('EXPENSE_CATEGORIES', () => {
  it('should have disjoint fixed and variable sets', () => {
    for (const code of EXPENSE_CATEGORIES.fixed) {
      expect(EXPENSE_CATEGORIES.variable).not.toContain(code)
    }
  })

  it('should include all known expense L1 codes', () => {
    const all = [...EXPENSE_CATEGORIES.fixed, ...EXPENSE_CATEGORIES.variable, ...EXPENSE_CATEGORIES.mixed]
    expect(all).toContain('501')
    expect(all).toContain('502')
    expect(all).toContain('503')
    expect(all).toContain('504')
    expect(all).toContain('505')
    expect(all).toContain('506')
    expect(all).toContain('507')
    expect(all).toContain('508')
    expect(all).toContain('509')
    expect(all).toContain('599')
  })
})

describe('Account type lists', () => {
  it('should have no overlap between asset and liability types', () => {
    for (const at of ASSET_ACCOUNT_TYPES) {
      expect(LIABILITY_ACCOUNT_TYPES).not.toContain(at)
    }
  })

  it('should have CASH_ACCOUNT_TYPES as subset of ASSET_ACCOUNT_TYPES', () => {
    for (const ct of CASH_ACCOUNT_TYPES) {
      expect(ASSET_ACCOUNT_TYPES).toContain(ct)
    }
  })
})
