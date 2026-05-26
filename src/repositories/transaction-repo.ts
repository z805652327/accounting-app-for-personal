import type { IDatabase } from '@/database'
import type { Transaction, JournalEntry } from '@/types'

export interface TransactionDetail extends Transaction {
  subjectName: string
  accountName?: string
  toAccountName?: string
}

export class TransactionRepository {
  constructor(private db: IDatabase) {}

  async findById(id: number): Promise<Transaction | null> {
    return this.db.queryOne<Transaction>(
      'SELECT * FROM transactions WHERE id = ?', [id]
    )
  }

  async findDetails(filters: {
    startDate?: string
    endDate?: string
    subjectId?: number
    accountId?: number
    txType?: string
    limit?: number
    offset?: number
  } = {}): Promise<TransactionDetail[]> {
    let sql = `
      SELECT t.*, s.name as subjectName,
        a1.name as accountName, a2.name as toAccountName
      FROM transactions t
      LEFT JOIN accounting_subjects s ON t.subject_id = s.id
      LEFT JOIN accounts a1 ON t.account_id = a1.id
      LEFT JOIN accounts a2 ON t.to_account_id = a2.id
      WHERE t.is_deleted = 0
    `
    const params: any[] = []

    if (filters.startDate) { sql += ' AND t.tx_date >= ?'; params.push(filters.startDate) }
    if (filters.endDate) { sql += ' AND t.tx_date <= ?'; params.push(filters.endDate) }
    if (filters.subjectId) { sql += ' AND t.subject_id = ?'; params.push(filters.subjectId) }
    if (filters.accountId) { sql += ' AND (t.account_id = ? OR t.to_account_id = ?)'; params.push(filters.accountId, filters.accountId) }
    if (filters.txType) { sql += ' AND t.tx_type = ?'; params.push(filters.txType) }

    sql += ' ORDER BY t.tx_date DESC, t.id DESC'
    if (filters.limit) { sql += ' LIMIT ?'; params.push(filters.limit) }
    if (filters.offset) { sql += ' OFFSET ?'; params.push(filters.offset) }

    return this.db.query<TransactionDetail>(sql, params)
  }

  async create(tx: Partial<Transaction>): Promise<number> {
    return this.db.insert(
      `INSERT INTO transactions (tx_type, tx_date, amount, subject_id, l3_subject_id, account_id, to_account_id, to_subject_id, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [tx.txType!, tx.txDate!, tx.amount!, tx.subjectId!, tx.l3SubjectId ?? null,
       tx.accountId ?? null, tx.toAccountId ?? null, tx.toSubjectId ?? null, tx.note ?? null]
    )
  }

  async update(id: number, tx: Partial<Transaction>): Promise<void> {
    const current = await this.findById(id)
    if (!current) throw new Error('交易不存在')
    if (current.isDeleted) throw new Error('已删除的交易无法修改')
    if (current.archived) throw new Error('已归档的交易无法修改')

    const fields: string[] = []
    const params: any[] = []
    if (tx.txType !== undefined) { fields.push('tx_type = ?'); params.push(tx.txType) }
    if (tx.txDate !== undefined) { fields.push('tx_date = ?'); params.push(tx.txDate) }
    if (tx.amount !== undefined) { fields.push('amount = ?'); params.push(tx.amount) }
    if (tx.subjectId !== undefined) { fields.push('subject_id = ?'); params.push(tx.subjectId) }
    if (tx.l3SubjectId !== undefined) { fields.push('l3_subject_id = ?'); params.push(tx.l3SubjectId) }
    if (tx.accountId !== undefined) { fields.push('account_id = ?'); params.push(tx.accountId) }
    if (tx.toAccountId !== undefined) { fields.push('to_account_id = ?'); params.push(tx.toAccountId) }
    if (tx.toSubjectId !== undefined) { fields.push('to_subject_id = ?'); params.push(tx.toSubjectId) }
    if (tx.note !== undefined) { fields.push('note = ?'); params.push(tx.note) }
    if (fields.length === 0) return
    params.push(id)
    await this.db.execute(
      `UPDATE transactions SET ${fields.join(', ')} WHERE id = ?`, params
    )
  }

  async softDelete(id: number): Promise<void> {
    const current = await this.findById(id)
    if (!current) throw new Error('交易不存在')
    if (current.isDeleted) throw new Error('交易已被删除')
    if (current.archived) throw new Error('已归档的交易无法删除')
    await this.db.execute(
      'UPDATE transactions SET is_deleted = 1 WHERE id = ?', [id]
    )
  }

  /** Restore a soft-deleted transaction */
  async restore(id: number): Promise<void> {
    const current = await this.findById(id)
    if (!current) throw new Error('交易不存在')
    if (!current.isDeleted) throw new Error('该交易未被删除')
    await this.db.execute(
      'UPDATE transactions SET is_deleted = 0 WHERE id = ?', [id]
    )
  }

  /** Permanently delete a soft-deleted transaction and its journal entries.
   *  If the transaction is archived (>60 days), generates reverse entries to restore balances. */
  async permanentDelete(id: number): Promise<void> {
    const current = await this.findById(id)
    if (!current) throw new Error('交易不存在')

    // For archived transactions: generate reverse entries before deletion
    if (current.archived) {
      const entries = await this.getJournalEntries(id)
      const today = new Date().toISOString().slice(0, 10)
      for (const je of entries) {
        const reverseDir = je.direction === 'debit' ? 'credit' : 'debit'
        await this.db.insert(
          `INSERT INTO journal_entries (transaction_id, account_id, subject_id, l3_subject_id, direction, amount, entry_date)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [id, je.accountId, je.subjectId, je.l3SubjectId, reverseDir, je.amount, today]
        )
      }
    }

    await this.db.execute('DELETE FROM journal_entries WHERE transaction_id = ?', [id])
    await this.db.execute('DELETE FROM edit_history WHERE transaction_id = ?', [id])
    await this.db.execute('DELETE FROM transaction_tags WHERE transaction_id = ?', [id])
    await this.db.execute('DELETE FROM transactions WHERE id = ?', [id])
  }

  /** List recently deleted transactions (last 30 days) */
  async findDeleted(): Promise<TransactionDetail[]> {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const cutoff = thirtyDaysAgo.toISOString().slice(0, 10)

    return this.db.query<TransactionDetail>(
      `SELECT t.*, s.name as subjectName,
        a1.name as accountName, a2.name as toAccountName
       FROM transactions t
       LEFT JOIN accounting_subjects s ON t.subject_id = s.id
       LEFT JOIN accounts a1 ON t.account_id = a1.id
       LEFT JOIN accounts a2 ON t.to_account_id = a2.id
       WHERE t.is_deleted = 1 AND t.tx_date >= ?
       ORDER BY t.tx_date DESC, t.id DESC`,
      [cutoff]
    )
  }

  /** Auto-purge soft-deleted transactions older than 30 days */
  async purgeExpired(): Promise<number> {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const cutoff = thirtyDaysAgo.toISOString().slice(0, 10)

    const expired = await this.db.query<{id: number}>(
      'SELECT id FROM transactions WHERE is_deleted = 1 AND tx_date < ?',
      [cutoff]
    )
    for (const tx of expired) {
      await this.permanentDelete(tx.id)
    }
    return expired.length
  }

  async recordEditHistory(transactionId: number, reason: string, changes: Record<string, {old: any, new: any}>): Promise<void> {
    await this.db.insert(
      'INSERT INTO edit_history (transaction_id, change_reason, changes) VALUES (?, ?, ?)',
      [transactionId, reason, JSON.stringify(changes)]
    )
    // Keep only latest 10 records per transaction (spec 13.5)
    await this.db.execute(
      `DELETE FROM edit_history WHERE id IN (
        SELECT id FROM edit_history WHERE transaction_id = ?
        ORDER BY id DESC LIMIT -1 OFFSET 10
      )`,
      [transactionId]
    )
  }

  // === Journal Entry operations ===
  async insertJournalEntry(je: Partial<JournalEntry>): Promise<number> {
    return this.db.insert(
      `INSERT INTO journal_entries (transaction_id, account_id, subject_id, l3_subject_id, direction, amount, entry_date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [je.transactionId!, je.accountId ?? null, je.subjectId!, je.l3SubjectId ?? null,
       je.direction!, je.amount!, je.entryDate!]
    )
  }

  async getJournalEntries(transactionId: number): Promise<JournalEntry[]> {
    return this.db.query<JournalEntry>(
      'SELECT * FROM journal_entries WHERE transaction_id = ? ORDER BY id', [transactionId]
    )
  }

  async getEntriesByDateRange(startDate: string, endDate: string): Promise<JournalEntry[]> {
    return this.db.query<JournalEntry>(
      `SELECT je.* FROM journal_entries je
       WHERE je.entry_date >= ? AND je.entry_date <= ?
       ORDER BY je.entry_date, je.id`,
      [startDate, endDate]
    )
  }
}
