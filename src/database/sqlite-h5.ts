import type { IDatabase } from './index'
import initSqlJs from 'sql.js'

type SqlJsDatabase = any

const STORAGE_KEY_PREFIX = 'accounting_db_'

export class H5Database implements IDatabase {
  private db: SqlJsDatabase | null = null
  private dbName: string
  private saveScheduled = false

  constructor(dbName = 'accounting_app') {
    this.dbName = dbName
  }

  async init(): Promise<void> {
    const SQL = await initSqlJs({
      locateFile: (file: string) => file
    })
    const saved = localStorage.getItem(STORAGE_KEY_PREFIX + this.dbName)
    if (saved) {
      const buffer = new Uint8Array(JSON.parse(saved))
      this.db = new SQL.Database(buffer)
    } else {
      this.db = new SQL.Database()
    }
    this.db.run('PRAGMA journal_mode=WAL')
    this.db.run('PRAGMA foreign_keys=ON')

    // Auto-save before page unload
    window.addEventListener('beforeunload', () => this.flush())
  }

  async close(): Promise<void> {
    this.flush()
    this.db?.close()
    this.db = null
  }

  /** Export DB to localStorage */
  private flush(): void {
    if (!this.db) return
    const data = this.db.export()
    localStorage.setItem(STORAGE_KEY_PREFIX + this.dbName, JSON.stringify(Array.from(data)))
    this.saveScheduled = false
  }

  /** Debounced save — batches writes within the same microtask cycle */
  private scheduleSave(): void {
    if (this.saveScheduled) return
    this.saveScheduled = true
    Promise.resolve().then(() => this.flush())
  }

  async execute(sql: string, params?: any[]): Promise<void> {
    this.db!.run(sql, params)
    this.scheduleSave()
  }

  async query<T>(sql: string, params?: any[]): Promise<T[]> {
    const stmt = this.db!.prepare(sql)
    if (params) stmt.bind(params)
    const results: T[] = []
    while (stmt.step()) {
      const row = stmt.getAsObject() as Record<string, unknown>
      // Convert snake_case keys to camelCase to match TypeScript interfaces
      const mapped: Record<string, unknown> = {}
      for (const key of Object.keys(row)) {
        const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
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
    this.db!.run(sql, params)
    this.scheduleSave()
    return (this.db!.exec("SELECT last_insert_rowid() as id")[0]?.values[0]?.[0] as number) ?? 0
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    this.db!.run('BEGIN')
    try {
      const result = await fn()
      this.db!.run('COMMIT')
      this.scheduleSave()
      return result
    } catch (e) {
      this.db!.run('ROLLBACK')
      throw e
    }
  }
}
