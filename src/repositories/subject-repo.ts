import type { IDatabase } from '@/database'
import type { AccountingSubject } from '@/types'

export class SubjectRepository {
  constructor(private db: IDatabase) {}

  async findAll(): Promise<AccountingSubject[]> {
    return this.db.query<AccountingSubject>(
      'SELECT * FROM accounting_subjects ORDER BY sort_order, code'
    )
  }

  async findActive(): Promise<AccountingSubject[]> {
    return this.db.query<AccountingSubject>(
      'SELECT * FROM accounting_subjects WHERE is_active = 1 ORDER BY sort_order, code'
    )
  }

  async findById(id: number): Promise<AccountingSubject | null> {
    return this.db.queryOne<AccountingSubject>(
      'SELECT * FROM accounting_subjects WHERE id = ?', [id]
    )
  }

  async findByCode(code: string): Promise<AccountingSubject | null> {
    return this.db.queryOne<AccountingSubject>(
      'SELECT * FROM accounting_subjects WHERE code = ?', [code]
    )
  }

  async findChildren(parentId: number): Promise<AccountingSubject[]> {
    return this.db.query<AccountingSubject>(
      'SELECT * FROM accounting_subjects WHERE parent_id = ? ORDER BY code', [parentId]
    )
  }

  async findTree(): Promise<AccountingSubject[]> {
    return this.findAll()
  }

  async createL3(data: {
    code: string
    name: string
    parentId: number
    subjectType: AccountingSubject['subjectType']
    expenseType?: 'fixed' | 'variable' | null
    cashFlowCategory?: 'operating' | 'investing' | 'financing' | null
  }): Promise<number> {
    const maxSort = await this.db.queryOne<{max: number}>(
      'SELECT MAX(sort_order) as max FROM accounting_subjects WHERE parent_id = ?', [data.parentId]
    )
    return this.db.insert(
      `INSERT INTO accounting_subjects (code, name, level, parent_id, subject_type, expense_type, cash_flow_category, is_system, sort_order)
       VALUES (?, ?, 3, ?, ?, ?, ?, 0, ?)`,
      [data.code, data.name, data.parentId, data.subjectType,
       data.expenseType ?? null, data.cashFlowCategory ?? null,
       (maxSort?.max ?? 0) + 1]
    )
  }

  async toggleActive(id: number, isActive: boolean): Promise<void> {
    await this.db.execute(
      'UPDATE accounting_subjects SET is_active = ? WHERE id = ? AND is_system = 0',
      [isActive ? 1 : 0, id]
    )
  }

  async getNextL3Code(parentCode: string): Promise<string> {
    // parentCode is 5 chars (padded), generate next 3-digit serial
    const prefix = parentCode.padEnd(5, '0').substring(0, 5)
    const max = await this.db.queryOne<{max: string}>(
      "SELECT MAX(code) as max FROM accounting_subjects WHERE code LIKE ? AND level = 3",
      [prefix + '%']
    )
    if (!max?.max) return prefix + '001'
    const serial = parseInt(max.max.substring(5), 10) + 1
    return prefix + String(serial).padStart(3, '0')
  }
}
