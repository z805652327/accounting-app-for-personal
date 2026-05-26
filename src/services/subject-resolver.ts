import type { IDatabase } from '@/database'

/**
 * Resolves subject codes (e.g. 50101, 30300) to their actual database IDs.
 * The subject code and auto-increment ID are different numbers — this utility
 * bridges the gap so services can reference subjects by their stable code.
 */
export class SubjectResolver {
  private cache = new Map<string, number>()

  constructor(private db: IDatabase) {}

  async id(code: string | number): Promise<number> {
    const key = String(code)
    if (this.cache.has(key)) return this.cache.get(key)!

    const row = await this.db.queryOne<{ id: number }>(
      'SELECT id FROM accounting_subjects WHERE code = ?', [key]
    )
    if (!row) throw new Error(`科目编码 ${key} 不存在`)
    this.cache.set(key, row.id)
    return row.id
  }

  /** Preload all subjects into cache — call once at startup */
  async preload(): Promise<void> {
    const rows = await this.db.query<{ id: number; code: string }>(
      'SELECT id, code FROM accounting_subjects'
    )
    for (const r of rows) {
      this.cache.set(r.code, r.id)
    }
  }

  clear(): void {
    this.cache.clear()
  }
}
