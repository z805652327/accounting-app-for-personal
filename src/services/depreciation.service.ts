import type { IDatabase } from '@/database'
import type { DepreciationConfig, PendingItem } from '@/types'
import { SubjectResolver } from './subject-resolver'
import { todayStr, monthsBetween, addMonths } from '@/utils/format'

const DEP_COLS = `id, account_id as accountId, asset_name as assetName,
  original_value as originalValue, residual_value as residualValue,
  useful_months as usefulMonths, method,
  depreciation_subject_id as depreciationSubjectId, start_date as startDate,
  is_active as isActive, created_at as createdAt`

export class DepreciationService {
  private resolve: SubjectResolver

  constructor(private db: IDatabase) {
    this.resolve = new SubjectResolver(db)
  }

  async findAll(): Promise<DepreciationConfig[]> {
    return this.db.query<DepreciationConfig>(
      `SELECT ${DEP_COLS} FROM depreciation_configs WHERE is_active = 1 ORDER BY start_date`
    )
  }

  async findById(id: number): Promise<DepreciationConfig | null> {
    return this.db.queryOne<DepreciationConfig>(
      `SELECT ${DEP_COLS} FROM depreciation_configs WHERE id = ?`, [id]
    )
  }

  async create(config: {
    accountId: number
    assetName: string
    originalValue: number
    residualValue: number
    usefulMonths: number
    depreciationSubjectId: number
    startDate: string
  }): Promise<number> {
    return this.db.insert(
      `INSERT INTO depreciation_configs
       (account_id, asset_name, original_value, residual_value, useful_months, method, depreciation_subject_id, start_date)
       VALUES (?, ?, ?, ?, ?, 'straight_line', ?, ?)`,
      [config.accountId, config.assetName, config.originalValue,
       config.residualValue, config.usefulMonths,
       config.depreciationSubjectId, config.startDate]
    )
  }

  async update(id: number, data: { residualValue?: number; usefulMonths?: number; isActive?: boolean }): Promise<void> {
    const old = await this.findById(id)
    if (!old) throw new Error('折旧配置不存在')

    const newResidual = data.residualValue ?? old.residualValue
    const newMonths = data.usefulMonths ?? old.usefulMonths
    const monthsElapsed = monthsBetween(old.startDate, todayStr())
    const monthsRemaining = newMonths - monthsElapsed
    if (monthsRemaining < 1) throw new Error('剩余期限不足')

    const accumulatedDep = await this.getAccumulatedDepreciation(old.accountId)
    const remainingValue = old.originalValue - accumulatedDep
    const newMonthlyDep = (remainingValue - newResidual) / monthsRemaining

    await this.db.execute(
      `UPDATE depreciation_configs SET
        residual_value = ?, useful_months = ?, is_active = ?
       WHERE id = ?`,
      [newResidual, newMonths, data.isActive !== undefined ? (data.isActive ? 1 : 0) : 1, id]
    )
  }

  async terminate(id: number): Promise<void> {
    const config = await this.findById(id)
    if (!config) throw new Error('折旧配置不存在')
    const accumulated = await this.getAccumulatedDepreciation(config.accountId)
    const netValue = config.originalValue - accumulated
    const remainingValue = Math.round((netValue - config.residualValue) * 100) / 100

    if (remainingValue > 0) {
      await this.resolve.preload()
      const assetInfo = await this.db.queryOne<{ subjectId: number; subjectCode: string }>(
        'SELECT subject_id as subjectId, subject_code as subjectCode FROM accounts WHERE id = ?',
        [config.accountId]
      )
      const depSubjId = await this.resolve.id(50703)

      // Create a write-off transaction for the remaining book value
      const txId = await this.db.insert(
        `INSERT INTO transactions (tx_type, tx_date, amount, subject_id, l3_subject_id, account_id, note)
         VALUES ('asset_dispose', ?, ?, ?, ?, ?, '提前终止折旧')`,
        [todayStr(), remainingValue,
         assetInfo?.subjectId ?? 0,
         config.accountId, config.accountId]
      )

      // Dr: 资产处置损益(50703)  Cr: 固定资产
      await this.db.insert(
        `INSERT INTO journal_entries (transaction_id, account_id, subject_id, l3_subject_id, direction, amount, entry_date)
         VALUES (?, NULL, ?, ?, 'debit', ?, ?)`,
        [txId, depSubjId, config.accountId, remainingValue, todayStr()]
      )
      // Write off accumulated depreciation
      if (accumulated > 0) {
        await this.db.insert(
          `INSERT INTO journal_entries (transaction_id, account_id, subject_id, l3_subject_id, direction, amount, entry_date)
           VALUES (?, NULL, ?, ?, 'debit', ?, ?)`,
          [txId, config.depreciationSubjectId, config.accountId, accumulated, todayStr()]
        )
      }
      // Credit the asset at original value
      await this.db.insert(
        `INSERT INTO journal_entries (transaction_id, account_id, subject_id, l3_subject_id, direction, amount, entry_date)
         VALUES (?, NULL, ?, ?, 'credit', ?, ?)`,
        [txId, assetInfo?.subjectId ?? 0, config.accountId, config.originalValue, todayStr()]
      )
    }
    await this.db.execute('UPDATE depreciation_configs SET is_active = 0 WHERE id = ?', [id])
  }

  async generatePendingItems(): Promise<PendingItem[]> {
    await this.resolve.preload()
    const configs = await this.findAll()
    const now = todayStr()
    const items: PendingItem[] = []

    for (const cfg of configs) {
      if (cfg.startDate > now) continue
      const monthsElapsed = monthsBetween(cfg.startDate, now)
      const monthsGenerated = await this.countGeneratedMonths(cfg.id)
      if (monthsGenerated >= monthsElapsed) continue

      for (let m = monthsGenerated; m < monthsElapsed; m++) {
        const depDate = addMonths(cfg.startDate, m + 1)
        const monthlyDep = Math.round((cfg.originalValue - cfg.residualValue) / cfg.usefulMonths * 100) / 100
        items.push({
          id: 0,
          itemType: 'depreciation',
          referenceId: cfg.id,
          description: cfg.assetName,
          amount: monthlyDep,
          dueDate: depDate,
          isDone: false,
          createdAt: now,
        })
      }
    }
    return items
  }

  async executePending(item: PendingItem): Promise<void> {
    await this.resolve.preload()
    const config = await this.findById(item.referenceId)
    if (!config) throw new Error('折旧配置不存在')

    const depExpenseId = await this.resolve.id(50701)
    const txId = await this.db.insert(
      `INSERT INTO transactions (tx_type, tx_date, amount, subject_id, l3_subject_id, account_id, note)
       VALUES ('expense', ?, ?, ?, ?, ?, '折旧：' || ?)`,
      [item.dueDate, item.amount, depExpenseId, config.accountId, config.accountId, config.assetName]
    )

    // Dr: 折旧费(50701)  Cr: 累计折旧(151xx)
    await this.db.insert(
      `INSERT INTO journal_entries (transaction_id, account_id, subject_id, l3_subject_id, direction, amount, entry_date)
       VALUES (?, NULL, ?, ?, 'debit', ?, ?)`,
      [txId, depExpenseId, config.accountId, item.amount, item.dueDate]
    )
    await this.db.insert(
      `INSERT INTO journal_entries (transaction_id, account_id, subject_id, l3_subject_id, direction, amount, entry_date)
       VALUES (?, NULL, ?, NULL, 'credit', ?, ?)`,
      [txId, config.depreciationSubjectId, item.amount, item.dueDate]
    )
  }

  private async getAccumulatedDepreciation(accountId: number): Promise<number> {
    const result = await this.db.queryOne<{bal: number | null}>(
      `SELECT SUM(CASE WHEN direction = 'credit' THEN amount ELSE -amount END) as bal
       FROM journal_entries WHERE l3_subject_id = ? AND subject_id IN
       (SELECT id FROM accounting_subjects WHERE code LIKE '151%')`,
      [accountId]
    )
    return Math.abs(result?.bal ?? 0)
  }

  private async countGeneratedMonths(configId: number): Promise<number> {
    const items = await this.db.queryOne<{cnt: number}>(
      "SELECT COUNT(*) as cnt FROM pending_items WHERE item_type = 'depreciation' AND reference_id = ? AND is_done = 1",
      [configId]
    )
    return items?.cnt ?? 0
  }

}
