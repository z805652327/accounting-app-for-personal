import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// ============================================================
// Mock plus.sqlite for AppDatabase
// ============================================================
function createMockPlusSqlite() {
  const tables: Map<string, Map<string, any[][]>> = new Map()
  let lastId = 0

  function ensureDb(name: string) {
    if (!tables.has(name)) tables.set(name, new Map())
    return tables.get(name)!
  }

  return {
    isOpenDatabase: () => true,
    openDatabase: () => {},
    closeDatabase: () => {},
    executeSql: async (params: { name: string; sql: string; values?: any[] }) => {
      const sqlUpper = params.sql.trim().toUpperCase()
      if (sqlUpper.startsWith('INSERT')) {
        lastId++
        return { type: 'success' as const }
      }
      if (sqlUpper.startsWith('UPDATE') || sqlUpper.startsWith('DELETE')) {
        return { type: 'success' as const }
      }
      if (sqlUpper === 'BEGIN' || sqlUpper === 'COMMIT' || sqlUpper === 'ROLLBACK') {
        return { type: 'success' as const }
      }
      if (sqlUpper.startsWith('PRAGMA')) {
        return { type: 'success' as const }
      }
      return { type: 'success' as const }
    },
    selectSql: async (params: { name: string; sql: string; values?: any[] }) => {
      if (params.sql.toUpperCase().includes('LAST_INSERT_ROWID')) {
        return { type: 'success' as const, data: [{ id: lastId }] }
      }
      return { type: 'success' as const, data: [] }
    },
  }
}

// ============================================================
// Mock electronDB for ElectronDatabase
// ============================================================
function createMockElectronDB() {
  let lastId = 0
  return {
    execute: async () => {},
    query: async () => [],
    queryOne: async () => null,
    insert: async () => ++lastId,
  }
}

// ============================================================
// AppDatabase tests
// ============================================================
describe('AppDatabase', () => {
  let plusSqlite: ReturnType<typeof createMockPlusSqlite>

  beforeEach(() => {
    plusSqlite = createMockPlusSqlite()
    // @ts-ignore
    globalThis.plus = { sqlite: plusSqlite }
  })

  afterEach(() => {
    // @ts-ignore
    delete globalThis.plus
  })

  it('should initialize without error', async () => {
    const { AppDatabase } = await import('@/database/sqlite-app')
    const db = new AppDatabase('test_app_db')
    await db.init()
    expect(true).toBe(true)
    await db.close()
  })

  it('should execute INSERT and return lastInsertRowid', async () => {
    const { AppDatabase } = await import('@/database/sqlite-app')
    const db = new AppDatabase('test_app_db')
    await db.init()

    const id = await db.insert("INSERT INTO test_table (col) VALUES (?)", ['hello'])
    expect(id).toBeGreaterThan(0)
    await db.close()
  })

  it('should query and convert snake_case to camelCase', async () => {
    plusSqlite.selectSql = async () => ({
      type: 'success' as const,
      data: [{ parent_id: 5, subject_type: 'asset', is_system: 1 }],
    })

    const { AppDatabase } = await import('@/database/sqlite-app')
    const db = new AppDatabase('test_app_db')
    await db.init()

    const row = await db.queryOne<Record<string, unknown>>('SELECT * FROM test')
    expect(row).not.toBeNull()
    expect(row!.parentId).toBe(5)
    expect(row!.subjectType).toBe('asset')
    expect(row!.isSystem).toBe(1)
    expect((row as any).parent_id).toBeUndefined()
    await db.close()
  })

  it('should query empty results', async () => {
    plusSqlite.selectSql = async () => ({ type: 'success' as const, data: [] })

    const { AppDatabase } = await import('@/database/sqlite-app')
    const db = new AppDatabase('test_app_db')
    await db.init()

    const rows = await db.query('SELECT * FROM empty')
    expect(rows.length).toBe(0)
    expect(await db.queryOne('SELECT * FROM empty')).toBeNull()
    await db.close()
  })

  it('should handle SQL error', async () => {
    const origExecute = plusSqlite.executeSql
    plusSqlite.executeSql = async (params: any) => {
      if (!params.sql.toUpperCase().startsWith('PRAGMA')) {
        return { type: 'fail' as const, message: 'SQL error: table not found' }
      }
      return origExecute(params)
    }

    const { AppDatabase } = await import('@/database/sqlite-app')
    const db = new AppDatabase('test_app_db')
    await db.init()

    await expect(db.execute('BAD SQL')).rejects.toThrow('table not found')
    await db.close()
  })

  it('should support transactions', async () => {
    const { AppDatabase } = await import('@/database/sqlite-app')
    const db = new AppDatabase('test_app_db')
    await db.init()

    let committed = false
    plusSqlite.executeSql = async (params: any) => {
      if (params.sql === 'COMMIT') committed = true
      return { type: 'success' as const }
    }

    await db.transaction(async () => {
      await db.execute("INSERT INTO t VALUES (1)")
    })
    expect(committed).toBe(true)
    await db.close()
  })

  it('should rollback on transaction error', async () => {
    const { AppDatabase } = await import('@/database/sqlite-app')
    const db = new AppDatabase('test_app_db')
    await db.init()

    let rolledBack = false
    plusSqlite.executeSql = async (params: any) => {
      if (params.sql === 'ROLLBACK') rolledBack = true
      return { type: 'success' as const }
    }

    try { await db.transaction(async () => { throw new Error('forced') }) } catch { /* expected */ }
    expect(rolledBack).toBe(true)
    await db.close()
  })
})

// ============================================================
// ElectronDatabase tests
// ============================================================
describe('ElectronDatabase', () => {
  let mockElectron: ReturnType<typeof createMockElectronDB>

  beforeEach(() => {
    mockElectron = createMockElectronDB()
    // @ts-ignore
    globalThis.window.electronDB = mockElectron
  })

  afterEach(() => { delete (globalThis as any).window.electronDB })

  it('should initialize (no-op for Electron)', async () => {
    const { ElectronDatabase } = await import('@/database/sqlite-electron')
    const db = new ElectronDatabase()
    await db.init()
    expect(true).toBe(true)
  })

  it('should delegate query to electronDB', async () => {
    mockElectron.query = async () => [{ id: 1, name: 'test' }]
    const { ElectronDatabase } = await import('@/database/sqlite-electron')
    const db = new ElectronDatabase()
    const rows = await db.query('SELECT * FROM test')
    expect(rows.length).toBe(1)
  })

  it('should delegate queryOne to electronDB', async () => {
    mockElectron.queryOne = async () => ({ id: 42, value: 'found' })
    const { ElectronDatabase } = await import('@/database/sqlite-electron')
    const db = new ElectronDatabase()
    const row = await db.queryOne('SELECT * FROM t WHERE id = 1')
    expect(row!.id).toBe(42)
  })

  it('should delegate insert to electronDB', async () => {
    mockElectron.insert = async () => 99
    const { ElectronDatabase } = await import('@/database/sqlite-electron')
    const db = new ElectronDatabase()
    expect(await db.insert('INSERT INTO t VALUES (1)')).toBe(99)
  })

  it('should delegate execute to electronDB', async () => {
    let executed = false
    mockElectron.execute = async () => { executed = true }
    const { ElectronDatabase } = await import('@/database/sqlite-electron')
    const db = new ElectronDatabase()
    await db.execute('DELETE FROM t')
    expect(executed).toBe(true)
  })

  it('should handle transaction commit', async () => {
    const calls: string[] = []
    mockElectron.execute = async (sql: string) => { calls.push(sql) }
    const { ElectronDatabase } = await import('@/database/sqlite-electron')
    const db = new ElectronDatabase()
    await db.transaction(async () => { await db.execute('INSERT INTO t VALUES (1)') })
    expect(calls).toEqual(['BEGIN', 'INSERT INTO t VALUES (1)', 'COMMIT'])
  })

  it('should handle transaction rollback on error', async () => {
    const calls: string[] = []
    mockElectron.execute = async (sql: string) => { calls.push(sql) }
    const { ElectronDatabase } = await import('@/database/sqlite-electron')
    const db = new ElectronDatabase()
    try { await db.transaction(async () => { await db.execute('INSERT INTO t VALUES (1)'); throw new Error('forced') }) } catch { /* expected */ }
    expect(calls).toContain('ROLLBACK')
  })

  it('should throw when electronDB not available', async () => {
    delete (globalThis as any).window.electronDB // remove electronDB, keep addEventListener
    const { ElectronDatabase } = await import('@/database/sqlite-electron')
    const db = new ElectronDatabase()
    await expect(db.query('SELECT 1')).rejects.toThrow('electronDB not available')
  })
})

// ============================================================
// Factory tests — with local WASM for H5 path
// ============================================================
describe('getDatabase factory', () => {
  beforeEach(() => {
    vi.resetModules()
    // Ensure window mock exists (may have been deleted by prior test)
    if (!(globalThis as any).window) {
      ;(globalThis as any).window = { addEventListener: () => {}, removeEventListener: () => {} }
    }
  })
  afterEach(() => {
    delete (globalThis as any).window.electronDB
    delete (globalThis as any).plus
  })

  it('should return ElectronDatabase when window.electronDB exists', async () => {
    ;(globalThis as any).window.electronDB = createMockElectronDB()
    const { getDatabase } = await import('@/database/factory')
    const db = await getDatabase()
    expect(db.constructor.name).toBe('ElectronDatabase')
    await db.close()
  })

  it('should return AppDatabase when plus.sqlite exists (no electronDB)', async () => {
    delete (globalThis as any).window.electronDB
    ;(globalThis as any).plus = { sqlite: createMockPlusSqlite() }
    const { getDatabase } = await import('@/database/factory')
    const db = await getDatabase()
    expect(db.constructor.name).toBe('AppDatabase')
    await db.close()
  })

  it('should return H5Database when neither electronDB nor plus.sqlite', async () => {
    // Keep the vitest-setup window mock (has addEventListener) but strip electronDB/plus
    delete (globalThis as any).window.electronDB
    delete (globalThis as any).plus
    const { getDatabase, closeDatabase } = await getH5Factory()
    const db = await getDatabase()
    expect(db.constructor.name).toBe('H5Database')
    await closeDatabase().catch(() => {})
  })

  it('should return singleton instance', async () => {
    delete (globalThis as any).window.electronDB
    delete (globalThis as any).plus
    const { getDatabase, closeDatabase } = await getH5Factory()
    const db1 = await getDatabase()
    const db2 = await getDatabase()
    expect(db1).toBe(db2)
    await closeDatabase().catch(() => {})
  })

  it('should clear singleton on close', async () => {
    delete (globalThis as any).window.electronDB
    delete (globalThis as any).plus
    const { getDatabase, closeDatabase } = await getH5Factory()
    const db1 = await getDatabase()
    await closeDatabase().catch(() => {})
    const db2 = await getDatabase()
    expect(db1).not.toBe(db2)
    await closeDatabase().catch(() => {})
  })
})

/**
 * Patch sql.js to serve the local WASM binary instead of CDN URL.
 * Uses vi.doMock before the dynamic import so H5Database picks it up.
 */
async function getH5Factory() {
  const fs = await import('fs')
  const path = await import('path')
  const wasmBinary = fs.readFileSync(
    path.resolve('node_modules/sql.js/dist/sql-wasm.wasm')
  )

  vi.doMock('sql.js', async () => {
    const real = await vi.importActual<typeof import('sql.js')>('sql.js')
    return {
      ...real,
      default: (opts?: any) => real.default({ wasmBinary, ...opts }),
    }
  })

  const factory = await import('@/database/factory')
  return factory
}
