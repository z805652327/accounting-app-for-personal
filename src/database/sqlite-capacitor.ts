import type { IDatabase } from './index'
import initSqlJs from 'sql.js'

type SqlJsDatabase = any

const DB_FILENAME = 'accounting.db'

// Lazy-load Capacitor Filesystem (only available in Capacitor runtime)
async function getFilesystem(): Promise<any> {
  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem')
    return { Filesystem, Directory }
  } catch {
    return null
  }
}

export class CapacitorDatabase implements IDatabase {
  private db: SqlJsDatabase | null = null
  private saveScheduled = false
  private sqlPromise: Promise<any> | null = null

  async init(): Promise<void> {
    const SQL = await this.getSqlJs()
    let saved: Uint8Array | null = null

    // Try loading from Capacitor Filesystem
    const fs = await getFilesystem()
    if (fs) {
      try {
        const result = await fs.Filesystem.readFile({
          path: DB_FILENAME,
          directory: fs.Directory.Data,
        })
        saved = new Uint8Array(result.data as ArrayBuffer)
      } catch {
        // File doesn't exist yet — start fresh
      }
    }

    // Fallback: try localStorage
    if (!saved) {
      try {
        const raw = localStorage.getItem('accounting_db_capacitor')
        if (raw) saved = new Uint8Array(JSON.parse(raw))
      } catch {}
    }

    this.db = saved ? new SQL.Database(saved) : new SQL.Database()
    this.db.run('PRAGMA journal_mode=WAL')
    this.db.run('PRAGMA foreign_keys=ON')
  }

  private async getSqlJs(): Promise<any> {
    if (this.sqlPromise) return this.sqlPromise
    this.sqlPromise = initSqlJs({
      locateFile: (file: string) => {
        const mapped = file.replace('sql-wasm-browser', 'sql-wasm')
        return `https://sql.js.org/dist/${mapped}`
      }
    })
    return this.sqlPromise
  }

  async close(): Promise<void> {
    await this.flush()
    this.db?.close()
    this.db = null
  }

  private async flush(): Promise<void> {
    if (!this.db) return
    const data = this.db.export()
    const buffer = Array.from(data)

    // Try Capacitor Filesystem first
    const fs = await getFilesystem()
    if (fs) {
      try {
        await fs.Filesystem.writeFile({
          path: DB_FILENAME,
          data: new Uint8Array(data),
          directory: fs.Directory.Data,
        })
        this.saveScheduled = false
        return
      } catch {}
    }

    // Fallback: localStorage
    try {
      localStorage.setItem('accounting_db_capacitor', JSON.stringify(buffer))
    } catch {}
    this.saveScheduled = false
  }

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
