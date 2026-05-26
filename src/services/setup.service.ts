import type { IDatabase } from '@/database'
import { AccountRepository } from '@/repositories/account-repo'
import { SubjectRepository } from '@/repositories/subject-repo'
import { SubjectResolver } from './subject-resolver'

export interface SetupInput {
  accounts: { name: string; accountType: string; subjectId: number; balance: number; bankName?: string; cardLastFour?: string }[]
  liabilities: { name: string; accountType: string; subjectId: number; balance: number; bankName?: string; cardLastFour?: string }[]
}

/**
 * First-time setup: creates accounts/liabilities and generates
 * the opening balance journal entry.
 *
 * Dr/Cr each account → Cr/Dr 期初净资产(301) for the balancing amount.
 */
export class SetupService {
  private resolve: SubjectResolver

  constructor(private db: IDatabase) {
    this.resolve = new SubjectResolver(db)
  }

  async isSetupComplete(): Promise<boolean> {
    const equityId = await this.resolve.id('30100')
    const result = await this.db.queryOne<{cnt: number}>(
      "SELECT COUNT(*) as cnt FROM journal_entries WHERE subject_id = ?",
      [equityId]
    )
    return (result?.cnt ?? 0) > 0
  }

  async execute(input: SetupInput): Promise<void> {
    await this.resolve.preload()
    const accountRepo = new AccountRepository(this.db)

    // Use last day of previous month so balances appear as 期初 in reports
    const now = new Date()
    now.setDate(0)
    const txDate = now.toISOString().slice(0, 10)

    const equitySubjectId = await this.resolve.id('30100')

    await this.db.transaction(async () => {
      let totalAssets = 0
      let totalLiabilities = 0

      // Create asset accounts
      for (const acc of input.accounts) {
        const subjectCode = await accountRepo.getNextSubjectCode(acc.subjectId)
        const accountId = await accountRepo.create({
          name: acc.name,
          subjectCode,
          accountType: acc.accountType as any,
          subjectId: acc.subjectId,
          bankName: acc.bankName,
          cardLastFour: acc.cardLastFour,
        })

        // Dr: asset account (increase)
        const txId = await this.db.insert(
          `INSERT INTO transactions (tx_type, tx_date, amount, subject_id, account_id, note)
           VALUES ('income', ?, ?, ?, ?, '期初余额')`,
          [txDate, acc.balance, acc.subjectId, accountId]
        )

        await this.db.insert(
          `INSERT INTO journal_entries (transaction_id, account_id, subject_id, direction, amount, entry_date)
           VALUES (?, ?, ?, 'debit', ?, ?)`,
          [txId, accountId, acc.subjectId, acc.balance, txDate]
        )

        totalAssets += acc.balance
      }

      // Create liability accounts
      for (const acc of input.liabilities) {
        const subjectCode = await accountRepo.getNextSubjectCode(acc.subjectId)
        const accountId = await accountRepo.create({
          name: acc.name,
          subjectCode,
          accountType: acc.accountType as any,
          subjectId: acc.subjectId,
          bankName: acc.bankName,
          cardLastFour: acc.cardLastFour,
        })

        // Cr: liability account (increase)
        const txId = await this.db.insert(
          `INSERT INTO transactions (tx_type, tx_date, amount, subject_id, account_id, note)
           VALUES ('expense', ?, ?, ?, ?, '期初余额')`,
          [txDate, acc.balance, acc.subjectId, accountId]
        )

        await this.db.insert(
          `INSERT INTO journal_entries (transaction_id, account_id, subject_id, direction, amount, entry_date)
           VALUES (?, ?, ?, 'credit', ?, ?)`,
          [txId, accountId, acc.subjectId, acc.balance, txDate]
        )

        totalLiabilities += acc.balance
      }

      // Net equity = assets - liabilities
      const netEquity = totalAssets - totalLiabilities

      // Generate balancing entry to 期初净资产
      const eqTxId = await this.db.insert(
        `INSERT INTO transactions (tx_type, tx_date, amount, subject_id, note)
         VALUES ('income', ?, ?, ?, '期初净资产（自动计算）')`,
        [txDate, Math.abs(netEquity), equitySubjectId]
      )

      if (netEquity >= 0) {
        await this.db.insert(
          `INSERT INTO journal_entries (transaction_id, subject_id, direction, amount, entry_date)
           VALUES (?, ?, 'credit', ?, ?)`,
          [eqTxId, equitySubjectId, netEquity, txDate]
        )
      } else {
        await this.db.insert(
          `INSERT INTO journal_entries (transaction_id, subject_id, direction, amount, entry_date)
           VALUES (?, ?, 'debit', ?, ?)`,
          [eqTxId, equitySubjectId, -netEquity, txDate]
        )
      }
    })
  }
}
