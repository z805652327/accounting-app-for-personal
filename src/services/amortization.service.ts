import type { IDatabase } from '@/database'
import type { AmortizationSchedule, PendingItem } from '@/types'
import { SubjectResolver } from './subject-resolver'
import { todayStr, monthsBetween, addMonths } from '@/utils/format'

const AMORT_COLS = `id, transaction_id as transactionId, l3_subject_id as l3SubjectId,
  total_amount as totalAmount, periods, amount_per_period as amountPerPeriod,
  remaining_periods as remainingPeriods, start_date as startDate,
  is_active as isActive, created_at as createdAt`

export class AmortizationService {
  private resolve: SubjectResolver

  constructor(private db: IDatabase) {
    this.resolve = new SubjectResolver(db)
  }

  async findAll(): Promise<AmortizationSchedule[]> {
    return this.db.query<AmortizationSchedule>(
      `SELECT ${AMORT_COLS} FROM amortization_schedules WHERE is_active = 1 ORDER BY start_date`
    )
  }

  async create(data: {
    transactionId: number
    l3SubjectId: number
    totalAmount: number
    periods: number
    amountPerPeriod: number
    startDate: string
  }): Promise<number> {
    return this.db.insert(
      `INSERT INTO amortization_schedules
       (transaction_id, l3_subject_id, total_amount, periods, amount_per_period, remaining_periods, start_date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [data.transactionId, data.l3SubjectId, data.totalAmount,
       data.periods, data.amountPerPeriod, data.periods, data.startDate]
    )
  }

  async generatePendingItems(): Promise<PendingItem[]> {
    await this.resolve.preload()
    const schedules = await this.findAll()
    const now = todayStr()
    const items: PendingItem[] = []

    for (const s of schedules) {
      const elapsed = monthsBetween(s.startDate, now)
      const doneCount = s.periods - s.remainingPeriods
      if (elapsed <= doneCount) continue

      for (let i = doneCount; i < elapsed && i < s.periods; i++) {
        const dueDate = addMonths(s.startDate, i + 1)
        const subjectName = await this.getSubjectName(s.l3SubjectId)
        items.push({
          id: 0,
          itemType: 'amortization',
          referenceId: s.id,
          description: `摊销：${subjectName}`,
          amount: s.amountPerPeriod,
          dueDate,
          isDone: false,
          createdAt: now,
        })
      }
    }
    return items
  }

  async executePending(item: PendingItem): Promise<void> {
    await this.resolve.preload()
    const schedule = await this.db.queryOne<AmortizationSchedule>(
      `SELECT ${AMORT_COLS} FROM amortization_schedules WHERE id = ?`, [item.referenceId]
    )
    if (!schedule) throw new Error('摊销计划不存在')

    // Use the L3 subject to determine which expense subject to use
    const l3Subject = await this.db.queryOne<{ parentId: number; subjectType: string }>(
      'SELECT parent_id as parentId, subject_type as subjectType FROM accounting_subjects WHERE id = ?',
      [schedule.l3SubjectId]
    )
    // L3's parent is the L2 expense subject — fall back to 50101 if unknown
    const expenseSubjectId = (l3Subject && l3Subject.subjectType === 'expense')
      ? l3Subject.parentId
      : await this.resolve.id(50101)

    const txId = await this.db.insert(
      `INSERT INTO transactions (tx_type, tx_date, amount, subject_id, l3_subject_id, note)
       VALUES ('expense', ?, ?, ?, ?, ?)`,
      [item.dueDate, item.amount, expenseSubjectId, schedule.l3SubjectId, item.description]
    )

    // Dr: 费用科目  Cr: 待摊费用(141)
    const prepaidId = await this.resolve.id(14100)
    await this.db.insert(
      `INSERT INTO journal_entries (transaction_id, account_id, subject_id, l3_subject_id, direction, amount, entry_date)
       VALUES (?, NULL, ?, ?, 'debit', ?, ?)`,
      [txId, expenseSubjectId, schedule.l3SubjectId, item.amount, item.dueDate]
    )
    await this.db.insert(
      `INSERT INTO journal_entries (transaction_id, account_id, subject_id, l3_subject_id, direction, amount, entry_date)
       VALUES (?, NULL, ?, NULL, 'credit', ?, ?)`,
      [txId, prepaidId, item.amount, item.dueDate]
    )

    await this.db.execute(
      'UPDATE amortization_schedules SET remaining_periods = remaining_periods - 1 WHERE id = ?',
      [schedule.id]
    )
  }

  private async getSubjectName(subjectId: number): Promise<string> {
    const sub = await this.db.queryOne<{name: string}>(
      'SELECT name FROM accounting_subjects WHERE id = ?', [subjectId]
    )
    return sub?.name || `科目#${subjectId}`
  }

}
