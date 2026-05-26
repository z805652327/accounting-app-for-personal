import type { IDatabase } from '@/database'
import type { PendingItem } from '@/types'
import { SubjectResolver } from './subject-resolver'
import { todayStr } from '@/utils/format'

export interface RecurringRule {
  id: number
  name: string
  txType: string
  amount: number
  subjectId: number
  l3SubjectId: number | null
  accountId: number | null
  toAccountId: number | null
  note: string | null
  frequency: 'monthly' | 'quarterly' | 'yearly'
  startDate: string
  endDate: string | null
  isActive: boolean
  lastGenerated: string | null
  createdAt: string
}

const RULE_COLS = `id, name, tx_type as txType, amount,
  subject_id as subjectId, l3_subject_id as l3SubjectId,
  account_id as accountId, to_account_id as toAccountId,
  note, frequency, start_date as startDate, end_date as endDate,
  is_active as isActive, last_generated as lastGenerated,
  created_at as createdAt`

export class RecurringService {
  private resolve: SubjectResolver

  constructor(private db: IDatabase) {
    this.resolve = new SubjectResolver(db)
  }

  async findAll(): Promise<RecurringRule[]> {
    return this.db.query<RecurringRule>(
      `SELECT ${RULE_COLS} FROM recurring_rules WHERE is_active = 1 ORDER BY start_date`
    )
  }

  async findById(id: number): Promise<RecurringRule | null> {
    return this.db.queryOne<RecurringRule>(
      `SELECT ${RULE_COLS} FROM recurring_rules WHERE id = ?`, [id]
    )
  }

  async create(rule: {
    name: string
    txType: string
    amount: number
    subjectId: number
    l3SubjectId?: number | null
    accountId?: number | null
    toAccountId?: number | null
    note?: string | null
    frequency: string
    startDate: string
    endDate?: string | null
  }): Promise<number> {
    return this.db.insert(
      `INSERT INTO recurring_rules (name, tx_type, amount, subject_id, l3_subject_id, account_id, to_account_id, note, frequency, start_date, end_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [rule.name, rule.txType, rule.amount, rule.subjectId,
       rule.l3SubjectId ?? null, rule.accountId ?? null,
       rule.toAccountId ?? null, rule.note ?? null,
       rule.frequency, rule.startDate, rule.endDate ?? null]
    )
  }

  async update(id: number, data: Partial<RecurringRule>): Promise<void> {
    const fields: string[] = []
    const params: any[] = []
    const fieldMap: Record<string, string> = {
      name: 'name', txType: 'tx_type', amount: 'amount',
      subjectId: 'subject_id', l3SubjectId: 'l3_subject_id',
      accountId: 'account_id', toAccountId: 'to_account_id',
      note: 'note', frequency: 'frequency',
      startDate: 'start_date', endDate: 'end_date',
      isActive: 'is_active',
    }
    for (const [key, col] of Object.entries(fieldMap)) {
      if ((data as any)[key] !== undefined) {
        fields.push(`${col} = ?`)
        params.push((data as any)[key])
      }
    }
    if (fields.length === 0) return
    params.push(id)
    await this.db.execute(
      `UPDATE recurring_rules SET ${fields.join(', ')} WHERE id = ?`, params
    )
  }

  async toggleActive(id: number, isActive: boolean): Promise<void> {
    await this.db.execute(
      'UPDATE recurring_rules SET is_active = ? WHERE id = ?',
      [isActive ? 1 : 0, id]
    )
  }

  async delete(id: number): Promise<void> {
    await this.db.execute('DELETE FROM recurring_rules WHERE id = ?', [id])
  }

  /** Generate pending items for all active recurring rules */
  async generatePendingItems(): Promise<PendingItem[]> {
    const rules = await this.findAll()
    const now = todayStr()
    const items: PendingItem[] = []

    for (const rule of rules) {
      // Check if rule has passed its end date
      if (rule.endDate && rule.endDate < now) continue

      // Calculate which occurrence we're at
      const nextDue = this.calcNextDue(rule)
      if (!nextDue) continue

      // Check if already generated for this period
      if (rule.lastGenerated && rule.lastGenerated >= nextDue) continue

      const subjectName = await this.getSubjectName(rule.subjectId)
      items.push({
        id: 0,
        itemType: 'recurring',
        referenceId: rule.id,
        description: `${rule.name}（${subjectName}）`,
        amount: rule.amount,
        dueDate: nextDue,
        isDone: false,
        createdAt: now,
      })
    }
    return items
  }

  /** Execute a recurring rule — create the actual transaction */
  async executePending(item: PendingItem): Promise<void> {
    const rule = await this.findById(item.referenceId)
    if (!rule) throw new Error('定期记账规则不存在')

    const txId = await this.db.insert(
      `INSERT INTO transactions (tx_type, tx_date, amount, subject_id, l3_subject_id, account_id, to_account_id, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [rule.txType, item.dueDate, rule.amount, rule.subjectId,
       rule.l3SubjectId, rule.accountId, rule.toAccountId,
       rule.note || `定期记账：${rule.name}`]
    )

    // Generate simple journal entries based on txType
    await this.generateEntries(txId, rule, item.dueDate)

    // Update last_generated
    await this.db.execute(
      'UPDATE recurring_rules SET last_generated = ? WHERE id = ?',
      [item.dueDate, rule.id]
    )
  }

  private calcNextDue(rule: RecurringRule): string | null {
    const now = todayStr()
    if (rule.startDate > now) return null

    const [sy, sm] = rule.startDate.split('-').map(Number)
    const [ny, nm] = now.split('-').map(Number)
    const totalMonthsNow = ny * 12 + nm
    const totalMonthsStart = sy * 12 + sm

    const freqMonths = rule.frequency === 'monthly' ? 1
      : rule.frequency === 'quarterly' ? 3 : 12

    // How many full periods have elapsed
    const periodsElapsed = Math.floor((totalMonthsNow - totalMonthsStart) / freqMonths)
    // Next due is the upcoming period
    const nextPeriod = periodsElapsed * freqMonths
    const totalMonths = totalMonthsStart + nextPeriod
    const year = Math.floor((totalMonths - 1) / 12)
    const month = ((totalMonths - 1) % 12) + 1

    // Handle month overflow (e.g. Jan 31 → Feb 28)
    let day = parseInt(rule.startDate.slice(8, 10)) || 1
    const dim = new Date(year, month, 0).getDate()
    if (day > dim) day = dim

    const due = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return due <= now ? due : null
  }

  private async generateEntries(txId: number, rule: RecurringRule, entryDate: string): Promise<void> {
    await this.resolve.preload()

    const make = (subjectId: number | null, accountId: number | null,
                  l3Id: number | null, direction: string, amount: number) =>
      this.db.insert(
        `INSERT INTO journal_entries (transaction_id, account_id, subject_id, l3_subject_id, direction, amount, entry_date)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [txId, accountId, subjectId, l3Id, direction, amount, entryDate]
      )

    const isLiability = rule.txType === 'loan_receive' || rule.txType === 'credit_card_spend'

    if (rule.txType === 'income' || rule.txType === 'salary') {
      // Dr cash → Cr income
      if (rule.accountId) {
        const accSub = await this.getAccountSubjectId(rule.accountId)
        await make(accSub, rule.accountId, null, 'debit', rule.amount)
      }
      await make(rule.subjectId, null, rule.l3SubjectId, 'credit', rule.amount)
    } else if (rule.txType === 'expense') {
      // Dr expense → Cr cash
      await make(rule.subjectId, null, rule.l3SubjectId, 'debit', rule.amount)
      if (rule.accountId) {
        const accSub = await this.getAccountSubjectId(rule.accountId)
        await make(accSub, rule.accountId, null, 'credit', rule.amount)
      }
    } else if (rule.txType === 'transfer') {
      // Dr target → Cr source
      if (rule.accountId && rule.toAccountId) {
        const fromSub = await this.getAccountSubjectId(rule.accountId)
        const toSub = await this.getAccountSubjectId(rule.toAccountId)
        await make(toSub, rule.toAccountId, null, 'debit', rule.amount)
        await make(fromSub, rule.accountId, null, 'credit', rule.amount)
      }
    } else if (rule.txType === 'loan_receive') {
      if (rule.accountId) {
        const accSub = await this.getAccountSubjectId(rule.accountId)
        await make(accSub, rule.accountId, null, 'debit', rule.amount)
      }
      await make(rule.subjectId, null, rule.l3SubjectId, 'credit', rule.amount)
    } else if (rule.txType === 'loan_repay') {
      await make(rule.subjectId, null, rule.l3SubjectId, 'debit', rule.amount)
      if (rule.accountId) {
        const accSub = await this.getAccountSubjectId(rule.accountId)
        await make(accSub, rule.accountId, null, 'credit', rule.amount)
      }
    }
  }

  private async getAccountSubjectId(accountId: number): Promise<number> {
    const account = await this.db.queryOne<{ subjectId: number }>(
      'SELECT subject_id as subjectId FROM accounts WHERE id = ?', [accountId]
    )
    if (!account) throw new Error(`账户 ${accountId} 不存在`)
    return account.subjectId
  }

  private async getSubjectName(subjectId: number): Promise<string> {
    const sub = await this.db.queryOne<{ name: string }>(
      'SELECT name FROM accounting_subjects WHERE id = ?', [subjectId]
    )
    return sub?.name || `科目#${subjectId}`
  }

}
