import type { IDatabase } from '@/database'

export interface SplitItem {
  id: number
  transactionId: number
  subjectId: number
  l3SubjectId: number | null
  amount: number
  note: string | null
  sortOrder: number
}

export class SplitTransactionService {
  constructor(private db: IDatabase) {}

  async findByTransaction(txId: number): Promise<SplitItem[]> {
    return this.db.query<SplitItem>(
      `SELECT id, transaction_id as transactionId, subject_id as subjectId,
        l3_subject_id as l3SubjectId, amount, note, sort_order as sortOrder
       FROM split_transactions
       WHERE transaction_id = ?
       ORDER BY sort_order`,
      [txId]
    )
  }

  async create(data: {
    transactionId: number
    subjectId: number
    l3SubjectId?: number | null
    amount: number
    note?: string | null
    sortOrder?: number
  }): Promise<number> {
    return this.db.insert(
      `INSERT INTO split_transactions (transaction_id, subject_id, l3_subject_id, amount, note, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [data.transactionId, data.subjectId, data.l3SubjectId ?? null,
       data.amount, data.note ?? null, data.sortOrder ?? 0]
    )
  }

  async deleteByTransaction(txId: number): Promise<void> {
    await this.db.execute(
      'DELETE FROM split_transactions WHERE transaction_id = ?', [txId]
    )
  }

  async saveSplits(
    txId: number,
    splits: { subjectId: number; l3SubjectId?: number; amount: number; note?: string }[]
  ): Promise<void> {
    await this.deleteByTransaction(txId)
    for (let i = 0; i < splits.length; i++) {
      const s = splits[i]
      await this.create({
        transactionId: txId, subjectId: s.subjectId,
        l3SubjectId: s.l3SubjectId, amount: s.amount,
        note: s.note, sortOrder: i,
      })
    }
  }
}
