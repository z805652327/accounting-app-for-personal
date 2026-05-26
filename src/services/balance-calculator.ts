import type { IDatabase } from '@/database'

export interface SubjectBalance {
  subjectId: number
  subjectCode: string
  subjectName: string
  level: number
  parentId: number | null
  subjectType: string
  expenseType: string | null
  openingBalance: number  // debit - credit before period
  debitAmount: number     // period debit total
  creditAmount: number    // period credit total
  closingBalance: number
}

/**
 * Calculates subject balances for a given period.
 * Used by all three financial statements.
 */
export class BalanceCalculator {
  constructor(private db: IDatabase) {}

  async calculate(
    year: number,
    month: number,
    includeOpening: boolean = true
  ): Promise<SubjectBalance[]> {
    const periodStart = `${year}-${String(month).padStart(2, '0')}-01`
    // Calculate month end
    const nextMonth = month === 12 ? 1 : month + 1
    const nextYear = month === 12 ? year + 1 : year
    const periodEnd = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`

    // All subjects (DB auto-converts snake_case columns to camelCase)
    interface SubjectRow {
      id: number; code: string; name: string; level: number;
      parentId: number | null; subjectType: string; expenseType: string | null
    }
    const subjects = await this.db.query<SubjectRow>(
      'SELECT id, code, name, level, parent_id, subject_type, expense_type FROM accounting_subjects ORDER BY sort_order, code'
    )

    // Get all journal entries up to period end
    const result: SubjectBalance[] = []

    for (const sub of subjects) {
      // Period activity (within this month)
      const periodActivity = await this.db.queryOne<{dr: number | null, cr: number | null}>(
        `SELECT
           SUM(CASE WHEN direction = 'debit' THEN amount ELSE 0 END) as dr,
           SUM(CASE WHEN direction = 'credit' THEN amount ELSE 0 END) as cr
         FROM journal_entries
         WHERE subject_id = ? AND entry_date >= ? AND entry_date < ?`,
        [sub.id, periodStart, periodEnd]
      )

      // Opening balance (all activity before this period)
      let openingBalance = 0
      if (includeOpening) {
        const opening = await this.db.queryOne<{bal: number | null}>(
          `SELECT SUM(CASE WHEN direction = 'debit' THEN amount ELSE -amount END) as bal
           FROM journal_entries
           WHERE subject_id = ? AND entry_date < ?`,
          [sub.id, periodStart]
        )
        // For asset/expense: normal balance is debit (positive)
        // For liability/equity/income: normal balance is credit (negative in our SUM)
        openingBalance = opening?.bal ?? 0
      }

      const dr = periodActivity?.dr ?? 0
      const cr = periodActivity?.cr ?? 0

      // Normal balance direction:
      // The SQL opening is SUM(debit) - SUM(credit) (debit-normal convention).
      // For credit-normal subjects, negate to show a positive opening balance.
      const isDebitNormal = ['asset', 'expense'].includes(sub.subjectType)
      const normalOpening = isDebitNormal ? openingBalance : -openingBalance
      const closingBalance = isDebitNormal
        ? normalOpening + dr - cr
        : normalOpening - dr + cr

      result.push({
        subjectId: sub.id,
        subjectCode: sub.code,
        subjectName: sub.name,
        level: sub.level,
        parentId: sub.parentId,
        subjectType: sub.subjectType,
        expenseType: sub.expenseType,
        openingBalance: normalOpening,
        debitAmount: dr,
        creditAmount: cr,
        closingBalance,
      })
    }

    // Roll up L3 balances into L2 parents
    // L3 subjects are detailed categories; L2 parents should show the aggregate
    const l3ToL2 = new Map<number, number>()
    for (const sub of subjects) {
      if (sub.level === 3 && sub.parentId) {
        l3ToL2.set(sub.id, sub.parentId)
      }
    }

    if (l3ToL2.size > 0) {
      for (const [l3Id, l2Id] of l3ToL2) {
        const l3 = result.find(r => r.subjectId === l3Id)
        const l2 = result.find(r => r.subjectId === l2Id)
        if (l3 && l2) {
          l2.openingBalance += l3.openingBalance
          l2.debitAmount += l3.debitAmount
          l2.creditAmount += l3.creditAmount
          l2.closingBalance += l3.closingBalance
        }
      }
    }

    return result
  }
}
