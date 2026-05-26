import type { IDatabase } from '@/database'
import type { Account } from '@/types'

export interface AccountWithBalance extends Account {
  balance: number
}

export class AccountRepository {
  constructor(private db: IDatabase) {}

  async findAll(): Promise<Account[]> {
    return this.db.query<Account>(
      'SELECT * FROM accounts WHERE is_active = 1 ORDER BY subject_code'
    )
  }

  async findById(id: number): Promise<Account | null> {
    return this.db.queryOne<Account>('SELECT * FROM accounts WHERE id = ?', [id])
  }

  async findBySubjectCode(code: string): Promise<Account | null> {
    return this.db.queryOne<Account>(
      'SELECT * FROM accounts WHERE subject_code = ?', [code]
    )
  }

  async create(data: Partial<Account>): Promise<number> {
    return this.db.insert(
      `INSERT INTO accounts (name, subject_code, account_type, subject_id, currency, bank_name, card_last_four, credit_limit, maturity_date, notes, contract_no)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.name!, data.subjectCode!, data.accountType!, data.subjectId!,
       data.currency || 'CNY', data.bankName || null, data.cardLastFour || null,
       data.creditLimit || null, data.maturityDate || null,
       data.notes || null, data.contractNo || null]
    )
  }

  async update(id: number, data: Partial<Account>): Promise<void> {
    const fields: string[] = []
    const values: any[] = []
    for (const [key, value] of Object.entries(data)) {
      const col = key.replace(/([A-Z])/g, '_$1').toLowerCase()
      fields.push(`${col} = ?`)
      values.push(value ?? null)
    }
    values.push(id)
    await this.db.execute(
      `UPDATE accounts SET ${fields.join(', ')} WHERE id = ?`, values
    )
  }

  async getBalance(accountId: number): Promise<number> {
    // Assets: debit increases balance -> balance = SUM(debit) - SUM(credit)
    // Liabilities: credit increases balance -> balance = SUM(credit) - SUM(debit)
    const account = await this.findById(accountId)
    if (!account) return 0

    const accType = account.accountType
    const isAsset = ['cash','checking','fixed_deposit','money_market','receivable',
                     'investment','fixed_asset','prepaid','deposit'].includes(accType)

    const result = await this.db.queryOne<{dr: number | null, cr: number | null}>(
      `SELECT
         SUM(CASE WHEN direction = 'debit' THEN amount ELSE 0 END) as dr,
         SUM(CASE WHEN direction = 'credit' THEN amount ELSE 0 END) as cr
       FROM journal_entries
       WHERE account_id = ?`,
      [accountId]
    )

    const dr = result?.dr ?? 0
    const cr = result?.cr ?? 0
    return isAsset ? dr - cr : cr - dr
  }

  async getAllWithBalances(): Promise<AccountWithBalance[]> {
    const accounts = await this.findAll()
    const result: AccountWithBalance[] = []
    for (const acc of accounts) {
      const balance = await this.getBalance(acc.id)
      result.push({ ...acc, balance })
    }
    return result
  }

  async getNextSubjectCode(subjectId: number): Promise<string> {
    const parent = await this.db.queryOne<{code: string}>(
      'SELECT code FROM accounting_subjects WHERE id = ?', [subjectId]
    )
    if (!parent) throw new Error('Parent subject not found')
    const prefix = parent.code.substring(0, 5)
    const max = await this.db.queryOne<{max: string}>(
      "SELECT MAX(subject_code) as max FROM accounts WHERE subject_code LIKE ?",
      [prefix + '%']
    )
    if (!max?.max) return prefix + '001'
    // Extract the 3-digit serial from chars 5-7 (0-indexed), in case existing data has longer codes
    const raw = max.max.substring(5, 8)
    const serial = (parseInt(raw, 10) || 0) + 1
    if (serial > 999) throw new Error(`科目编码已用完: ${prefix}，请联系开发者`)
    return prefix + String(serial).padStart(3, '0')
  }

  async softDelete(id: number): Promise<void> {
    await this.db.execute(
      'UPDATE accounts SET is_active = 0 WHERE id = ?', [id]
    )
  }

  /**
   * Transfer balance from one account to another by creating journal entries.
   * Uses the correct debit/credit direction to zero out the source account.
   */
  async transferBalance(fromAccountId: number, toAccountId: number, amount: number, entryDate: string, subjectId: number, balance: number): Promise<void> {
    const from = await this.findById(fromAccountId)
    if (!from) throw new Error('源账户不存在')
    const isAsset = !['credit_card','payable','loan'].includes(from.accountType)

    // Determine direction to zero out the source account
    // Positive balance = more debits for assets, more credits for liabilities
    // To zero out, we add the opposite direction
    const sourceDirection: 'debit' | 'credit' = (balance > 0) !== isAsset ? 'debit' : 'credit'
    const targetDirection: 'debit' | 'credit' = sourceDirection === 'debit' ? 'credit' : 'debit'

    // Create an internal transfer transaction record for audit trail
    const txId = await this.db.insert(
      `INSERT INTO transactions (tx_type, tx_date, amount, subject_id, account_id, to_account_id, note)
       VALUES ('transfer', ?, ?, ?, ?, ?, ?)`,
      [entryDate, amount, subjectId, fromAccountId, toAccountId, '删除账户-余额转移']
    )

    await this.db.insert(
      `INSERT INTO journal_entries (transaction_id, account_id, subject_id, direction, amount, entry_date)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [txId, toAccountId, subjectId, targetDirection, amount, entryDate]
    )
    await this.db.insert(
      `INSERT INTO journal_entries (transaction_id, account_id, subject_id, direction, amount, entry_date)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [txId, fromAccountId, subjectId, sourceDirection, amount, entryDate]
    )
  }
}
