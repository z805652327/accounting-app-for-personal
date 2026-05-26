import type { IDatabase } from '@/database'
import type { PendingItem } from '@/types'
import { DepreciationService } from './depreciation.service'
import { AmortizationService } from './amortization.service'
import { RecurringService } from './recurring.service'

export class PendingService {
  private depService: DepreciationService
  private amorService: AmortizationService
  private recService: RecurringService

  constructor(private db: IDatabase) {
    this.depService = new DepreciationService(db)
    this.amorService = new AmortizationService(db)
    this.recService = new RecurringService(db)
  }

  /** Generate all pending items for the current month */
  async generateAll(): Promise<PendingItem[]> {
    // Clear previous unprocessed items
    await this.db.execute("DELETE FROM pending_items WHERE is_done = 0")

    const depItems = await this.depService.generatePendingItems()
    const amorItems = await this.amorService.generatePendingItems()
    const recItems = await this.recService.generatePendingItems()

    for (const item of [...depItems, ...amorItems, ...recItems]) {
      await this.db.insert(
        `INSERT INTO pending_items (item_type, reference_id, description, amount, due_date, is_done)
         VALUES (?, ?, ?, ?, ?, 0)`,
        [item.itemType, item.referenceId, item.description, item.amount, item.dueDate]
      )
    }

    return this.getAll()
  }

  async getAll(): Promise<PendingItem[]> {
    return this.db.query<PendingItem>(
      'SELECT * FROM pending_items WHERE is_done = 0 ORDER BY due_date'
    )
  }

  async execute(item: PendingItem): Promise<void> {
    switch (item.itemType) {
      case 'depreciation':
        await this.depService.executePending(item)
        break
      case 'amortization':
        await this.amorService.executePending(item)
        break
      case 'recurring':
        await this.recService.executePending(item)
        break
    }
    await this.db.execute('UPDATE pending_items SET is_done = 1 WHERE id = ?', [item.id])
  }

  async executeAll(): Promise<void> {
    const items = await this.getAll()
    for (const item of items) {
      await this.execute(item)
    }
  }

  async dismiss(id: number): Promise<void> {
    await this.db.execute("DELETE FROM pending_items WHERE id = ? AND is_done = 0", [id])
  }
}
