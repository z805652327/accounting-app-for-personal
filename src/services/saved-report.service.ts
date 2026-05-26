import type { IDatabase } from '@/database'
import type { SavedReport } from '@/types'

const RPT_COLS = `id, name, filters, sort_field as sortField,
  display_fields as displayFields, is_pinned as isPinned`

export class SavedReportService {
  constructor(private db: IDatabase) {}

  async findAll(): Promise<SavedReport[]> {
    return this.db.query<SavedReport>(
      `SELECT ${RPT_COLS} FROM saved_reports ORDER BY is_pinned DESC, id`
    )
  }

  async findById(id: number): Promise<SavedReport | null> {
    return this.db.queryOne<SavedReport>(
      `SELECT ${RPT_COLS} FROM saved_reports WHERE id = ?`, [id]
    )
  }

  async create(data: {
    name: string
    filters: Record<string, unknown>
    sortField?: string
    displayFields?: string[]
    isPinned?: boolean
  }): Promise<number> {
    return this.db.insert(
      `INSERT INTO saved_reports (name, filters, sort_field, display_fields, is_pinned)
       VALUES (?, ?, ?, ?, ?)`,
      [data.name,
       JSON.stringify(data.filters),
       data.sortField || 'tx_date DESC',
       JSON.stringify(data.displayFields || ['date','subject','amount','account','note']),
       data.isPinned ? 1 : 0]
    )
  }

  async update(id: number, data: {
    name?: string
    filters?: Record<string, unknown>
    sortField?: string
    displayFields?: string[]
    isPinned?: boolean
  }): Promise<void> {
    const fields: string[] = []
    const params: any[] = []
    if (data.name !== undefined) { fields.push('name = ?'); params.push(data.name) }
    if (data.filters !== undefined) { fields.push('filters = ?'); params.push(JSON.stringify(data.filters)) }
    if (data.sortField !== undefined) { fields.push('sort_field = ?'); params.push(data.sortField) }
    if (data.displayFields !== undefined) { fields.push('display_fields = ?'); params.push(JSON.stringify(data.displayFields)) }
    if (data.isPinned !== undefined) { fields.push('is_pinned = ?'); params.push(data.isPinned ? 1 : 0) }
    if (fields.length === 0) return
    params.push(id)
    await this.db.execute(
      `UPDATE saved_reports SET ${fields.join(', ')} WHERE id = ?`, params
    )
  }

  async togglePin(id: number): Promise<void> {
    const rpt = await this.findById(id)
    if (!rpt) return
    await this.update(id, { isPinned: !rpt.isPinned })
  }

  async delete(id: number): Promise<void> {
    await this.db.execute('DELETE FROM saved_reports WHERE id = ?', [id])
  }

  /** Parse filters JSON back to object, with defaults */
  parseFilters(rpt: SavedReport): {
    subjects: string[]
    dateRange: string
    type: string
    accountId?: number
  } {
    try {
      return JSON.parse(rpt.filters)
    } catch {
      return { subjects: [], dateRange: 'thisMonth', type: 'expense' }
    }
  }

  parseDisplayFields(rpt: SavedReport): string[] {
    try {
      return JSON.parse(rpt.displayFields)
    } catch {
      return ['date', 'subject', 'amount', 'account', 'note']
    }
  }
}
