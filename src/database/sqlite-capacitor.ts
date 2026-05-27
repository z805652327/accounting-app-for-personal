import type { IDatabase } from './index'
import initSqlJs from 'sql.js'

type SqlJsDatabase = any

const DB_FILENAME = 'accounting.db'

async function getFilesystem(): Promise<any> {
  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem')
    return { Filesystem, Directory }
  } catch { return null }
}

export class CapacitorDatabase implements IDatabase {
  private db: SqlJsDatabase | null = null
  private flushing = false
  private lastFlush = Promise.resolve()

  async init(): Promise<void> {
    const SQL = await this.getSqlJs()
    let saved: Uint8Array | null = null

    const fs = await getFilesystem()
    if (fs) {
      try {
        const result = await fs.Filesystem.readFile({
          path: DB_FILENAME,
          directory: fs.Directory.Data,
        })
        saved = new Uint8Array(result.data as ArrayBuffer)
      } catch {}
    }

    if (!saved) {
      try {
        const raw = localStorage.getItem('accounting_db_capacitor')
        if (raw) saved = new Uint8Array(JSON.parse(raw))
      } catch {}
    }

    this.db = saved ? new SQL.Database(saved) : new SQL.Database()
    this.db.run('PRAGMA journal_mode=WAL')
    this.db.run('PRAGMA foreign_keys=ON')

    // Listen for app pause — flush immediately before suspension
    window.addEventListener('beforeunload', () => this.flushSync())
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.flushSync()
    })
  }

  private async getSqlJs(): Promise<any> {
    return initSqlJs({
      locateFile: (file: string) => file
    })
  }

  async close(): Promise<void> {
    await this.lastFlush
    await this.flush()
    this.db?.close()
    this.db = null
  }

  /** Synchronous emergency flush (for beforeunload/appPause) */
  private flushSync(): void {
    if (!this.db) return
    const data = this.db.export()
    // Use sendBeacon-like approach: write to localStorage as emergency backup
    try {
      localStorage.setItem('accounting_db_capacitor', JSON.stringify(Array.from(data)))
    } catch {}
  }

  /** Async flush to Capacitor Filesystem + localStorage */
  private async flush(): Promise<void> {
    if (!this.db || this.flushing) return
    this.flushing = true
    try {
      const data = this.db.export()
      const buffer = Array.from(data)

      const fs = await getFilesystem()
      if (fs) {
        try {
          await fs.Filesystem.writeFile({
            path: DB_FILENAME,
            data: new Uint8Array(data),
            directory: fs.Directory.Data,
          })
        } catch {}
      }

      // Always save to localStorage as backup
      try {
        localStorage.setItem('accounting_db_capacitor', JSON.stringify(buffer))
      } catch {}
    } finally {
      this.flushing = false
    }
  }

  /** Chain flushes to avoid concurrent writes */
  private chainFlush(): void {
    this.lastFlush = this.lastFlush.then(() => this.flush())
  }

  async execute(sql: string, params?: any[]): Promise<void> {
    this.db!.run(sql, params)
    this.chainFlush()
  }

  async query<T>(sql: string, params?: any[]): Promise<T[]> {
    const stmt = this.db!.prepare(sql)
    if (params) stmt.bind(params)
    const results: T[] = []
    while (stmt.step()) {
      const row = stmt.getAsObject() as Record<string, unknown>
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
    this.chainFlush()
    return (this.db!.exec("SELECT last_insert_rowid() as id")[0]?.values[0]?.[0] as number) ?? 0
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    this.db!.run('BEGIN')
    try {
      const result = await fn()
      this.db!.run('COMMIT')
      this.chainFlush()
      return result
    } catch (e) {
      this.db!.run('ROLLBACK')
      throw e
    }
  }
}
