import type { IDatabase } from './index'

interface PlusSqlite {
  openDatabase(params: {name: string; path: string}): void
  isOpenDatabase(params: {name: string; path: string}): boolean
  executeSql(params: {name: string; sql: string; values?: any[]}): Promise<PlusSqliteResult>
  selectSql(params: {name: string; sql: string; values?: any[]}): Promise<PlusSqliteResult>
  closeDatabase(params: {name: string}): void
}

interface PlusSqliteResult {
  type: 'success' | 'fail'
  message?: string
  data?: any[]
}

export class AppDatabase implements IDatabase {
  private dbName: string
  private dbPath: string
  private sqlite: PlusSqlite | null = null

  constructor(dbName = 'accounting_app') {
    this.dbName = dbName
    this.dbPath = `_doc/${dbName}.db`
  }

  async init(): Promise<void> {
    // @ts-ignore - plus is available in App platform
    if (typeof plus === 'undefined' || !plus.sqlite) {
      throw new Error('plus.sqlite not available')
    }
    // @ts-ignore
    this.sqlite = plus.sqlite as PlusSqlite

    if (!this.sqlite.isOpenDatabase({name: this.dbName, path: this.dbPath})) {
      this.sqlite.openDatabase({name: this.dbName, path: this.dbPath})
    }

    await this.execute('PRAGMA foreign_keys=ON')
  }

  async close(): Promise<void> {
    if (this.sqlite) {
      this.sqlite.closeDatabase({name: this.dbName})
    }
  }

  async execute(sql: string, params?: any[]): Promise<void> {
    if (!this.sqlite) throw new Error('Database not initialized')
    const result = await this.sqlite.executeSql({
      name: this.dbName,
      sql,
      values: params
    })
    if (result.type === 'fail') {
      throw new Error(result.message || 'SQL execute error')
    }
  }

  async query<T>(sql: string, params?: any[]): Promise<T[]> {
    if (!this.sqlite) throw new Error('Database not initialized')
    const result = await this.sqlite.selectSql({
      name: this.dbName,
      sql,
      values: params
    })
    if (result.type === 'fail') {
      throw new Error(result.message || 'SQL query error')
    }
    // Convert snake_case keys to camelCase to match TypeScript interfaces
    return ((result.data || []) as any[]).map(row => {
      const mapped: Record<string, unknown> = {}
      for (const key of Object.keys(row)) {
        const camelKey = key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
        mapped[camelKey] = row[key]
      }
      return mapped as T
    })
  }

  async queryOne<T>(sql: string, params?: any[]): Promise<T | null> {
    const rows = await this.query<T>(sql, params)
    return rows.length > 0 ? rows[0] : null
  }

  async insert(sql: string, params?: any[]): Promise<number> {
    await this.execute(sql, params)
    const row = await this.queryOne<{id: number}>('SELECT last_insert_rowid() as id')
    return row?.id ?? 0
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    await this.execute('BEGIN')
    try {
      const result = await fn()
      await this.execute('COMMIT')
      return result
    } catch (e) {
      await this.execute('ROLLBACK')
      throw e
    }
  }
}
