import type { IDatabase } from './index'

function db(): ElectronDB {
  const inst = (window as any).electronDB as ElectronDB | undefined
  if (!inst) throw new Error('electronDB not available (not running in Electron?)')
  return inst
}

export class ElectronDatabase implements IDatabase {
  async init(): Promise<void> {
    // ElectronDB is available via preload — no setup needed
  }

  async close(): Promise<void> {}

  async execute(sql: string, params?: any[]): Promise<void> {
    await db().execute(sql, params)
  }

  async query<T>(sql: string, params?: any[]): Promise<T[]> {
    return await db().query(sql, params)
  }

  async queryOne<T>(sql: string, params?: any[]): Promise<T | null> {
    return await db().queryOne(sql, params)
  }

  async insert(sql: string, params?: any[]): Promise<number> {
    return await db().insert(sql, params)
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    await db().execute('BEGIN')
    try {
      const result = await fn()
      await db().execute('COMMIT')
      return result
    } catch (e) {
      await db().execute('ROLLBACK')
      throw e
    }
  }
}
