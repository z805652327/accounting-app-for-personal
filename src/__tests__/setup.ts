import initSqlJs from 'sql.js'
import { SCHEMA_SQL } from '@/database/schema'
import { seedDatabase } from '@/database/seed'
import type { IDatabase } from '@/database'

/** In-memory SQLite database for tests — mirrors the H5Database but with a clean interface */
export class TestDatabase implements IDatabase {
  private db: any = null

  async init(): Promise<void> {
    const SQL = await initSqlJs()
    this.db = new SQL.Database()
    this.db.run('PRAGMA foreign_keys = ON')
    await this.execute(SCHEMA_SQL)
    await seedDatabase(this)
  }

  async close(): Promise<void> {
    this.db?.close()
    this.db = null
  }

  async execute(sql: string, params?: any[]): Promise<void> {
    this.db.run(sql, params)
  }

  async query<T>(sql: string, params?: any[]): Promise<T[]> {
    const stmt = this.db.prepare(sql)
    if (params) stmt.bind(params)
    const results: T[] = []
    while (stmt.step()) {
      const row = stmt.getAsObject() as Record<string, unknown>
      const mapped: Record<string, unknown> = {}
      for (const key of Object.keys(row)) {
        const camelKey = key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
        mapped[camelKey] = row[key]
      }
      results.push(mapped as T)
    }
    stmt.free()
    return results
  }

  async queryOne<T>(sql: string, params?: any[]): Promise<T | null> {
    const results = await this.query<T>(sql, params)
    return results.length > 0 ? results[0] : null
  }

  async insert(sql: string, params?: any[]): Promise<number> {
    this.db.run(sql, params)
    const result = this.db.exec("SELECT last_insert_rowid() as id")
    return (result[0]?.values[0]?.[0] as number) ?? 0
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    this.db.run('BEGIN')
    try {
      const result = await fn()
      this.db.run('COMMIT')
      return result
    } catch (e) {
      this.db.run('ROLLBACK')
      throw e
    }
  }
}
