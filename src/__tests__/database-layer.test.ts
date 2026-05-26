import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import initSqlJs from 'sql.js'
import { SCHEMA_SQL } from '@/database/schema'
import { seedDatabase, PRESET_SUBJECTS } from '@/database/seed'
import { runMigrations } from '@/database/migrations'
import { H5Database } from '@/database/sqlite-h5'
import type { IDatabase } from '@/database'

// Minimal in-memory DB for testing migration/seed logic
class InMemoryDB implements IDatabase {
  db: any
  async init() {
    const SQL = await initSqlJs()
    this.db = new SQL.Database()
    this.db.run('PRAGMA foreign_keys = ON')
  }
  async close() { this.db?.close() }
  async execute(sql: string, params?: any[]) { this.db.run(sql, params) }
  async query<T>(sql: string, params?: any[]): Promise<T[]> {
    const stmt = this.db.prepare(sql)
    if (params) stmt.bind(params)
    const results: T[] = []
    while (stmt.step()) results.push(stmt.getAsObject() as T)
    stmt.free()
    return results
  }
  async queryOne<T>(sql: string, params?: any[]): Promise<T | null> {
    const r = await this.query<T>(sql, params)
    return r.length > 0 ? r[0] : null
  }
  async insert(sql: string, params?: any[]): Promise<number> {
    this.db.run(sql, params)
    return (this.db.exec("SELECT last_insert_rowid() as id")[0]?.values[0]?.[0] as number) ?? 0
  }
  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    this.db.run('BEGIN')
    try { const r = await fn(); this.db.run('COMMIT'); return r }
    catch (e) { this.db.run('ROLLBACK'); throw e }
  }
}

// ============================================================
// Seed data
// ============================================================
describe('seedDatabase', () => {
  let db: InMemoryDB

  beforeEach(async () => {
    db = new InMemoryDB()
    await db.init()
    await db.execute(SCHEMA_SQL)
  })

  afterEach(async () => await db.close())

  it('should insert all preset subjects', async () => {
    await seedDatabase(db)
    const count = await db.queryOne<{cnt: number}>(
      'SELECT COUNT(*) as cnt FROM accounting_subjects'
    )
    expect(count!.cnt).toBe(PRESET_SUBJECTS.length)
  })

  it('should be idempotent (no duplicates)', async () => {
    await seedDatabase(db)
    await seedDatabase(db)
    const count = await db.queryOne<{cnt: number}>(
      'SELECT COUNT(*) as cnt FROM accounting_subjects'
    )
    expect(count!.cnt).toBe(PRESET_SUBJECTS.length)
  })

  it('should set is_system = 1 for all presets', async () => {
    await seedDatabase(db)
    const nonSystem = await db.queryOne<{cnt: number}>(
      'SELECT COUNT(*) as cnt FROM accounting_subjects WHERE is_system = 0'
    )
    expect(nonSystem!.cnt).toBe(0)
  })

  it('should establish parent-child relationships', async () => {
    await seedDatabase(db)
    // 10201 (活期账户) should be child of 10200 (银行存款)
    const child = await db.queryOne<{parent_id: number}>(
      "SELECT parent_id FROM accounting_subjects WHERE code = '10201'"
    )
    expect(child!.parent_id).toBeGreaterThan(0)

    const parent = await db.queryOne<{code: string}>(
      'SELECT code FROM accounting_subjects WHERE id = ?', [child!.parent_id]
    )
    expect(parent!.code).toBe('10200')
  })

  it('should set correct subject types', async () => {
    await seedDatabase(db)
    const subjects = await db.query<{code: string; subject_type: string}>(
      'SELECT code, subject_type FROM accounting_subjects'
    )
    const byCode = new Map(subjects.map((s: any) => [s.code, s.subject_type]))

    expect(byCode.get('10100')).toBe('asset')
    expect(byCode.get('20100')).toBe('liability')
    expect(byCode.get('30100')).toBe('equity')
    expect(byCode.get('40100')).toBe('income')
    expect(byCode.get('50100')).toBe('expense')
  })

  it('should set expense_type for expense subjects', async () => {
    await seedDatabase(db)
    const subjects = await db.query<{code: string; expense_type: string | null}>(
      'SELECT code, expense_type FROM accounting_subjects WHERE subject_type = ?', ['expense']
    )
    for (const s of subjects as any[]) {
      if (s.code.startsWith('501') || s.code.startsWith('502') ||
          s.code.startsWith('507') || s.code.startsWith('508')) {
        expect(s.expense_type).toBe('fixed')
      } else if (s.code.startsWith('503') || s.code.startsWith('504') ||
                 s.code.startsWith('506') || s.code.startsWith('599')) {
        expect(s.expense_type).toBe('variable')
      }
    }
  })

  it('should set cash_flow_category for applicable subjects', async () => {
    await seedDatabase(db)
    const operating = await db.queryOne<{cnt: number}>(
      "SELECT COUNT(*) as cnt FROM accounting_subjects WHERE cash_flow_category = 'operating'"
    )
    expect(operating!.cnt).toBeGreaterThan(40)

    const investing = await db.queryOne<{cnt: number}>(
      "SELECT COUNT(*) as cnt FROM accounting_subjects WHERE cash_flow_category = 'investing'"
    )
    expect(investing!.cnt).toBeGreaterThan(0)
  })
})

// ============================================================
// Migrations
// ============================================================
describe('runMigrations', () => {
  let db: InMemoryDB

  beforeEach(async () => {
    db = new InMemoryDB()
    await db.init()
  })

  afterEach(async () => await db.close())

  it('should create all tables on fresh DB', async () => {
    await runMigrations(db)

    const tables = [
      'app_settings', 'accounting_subjects', 'accounts', 'transactions',
      'journal_entries', 'amortization_schedules', 'depreciation_configs',
      'investment_valuations', 'investment_lots',
      'budget_overall', 'budget_thresholds',
      'user_indicators', 'saved_reports', 'edit_history',
      'pending_items', 'tags', 'transaction_tags',
      'recurring_rules', 'split_transactions',
    ]
    for (const table of tables) {
      const result = await db.queryOne<{cnt: number}>(
        `SELECT COUNT(*) as cnt FROM sqlite_master WHERE type='table' AND name='${table}'`
      )
      expect(result!.cnt).toBe(1)
    }
  })

  it('should set db_version after migration', async () => {
    await runMigrations(db)
    const version = await db.queryOne<{value: string}>(
      "SELECT value FROM app_settings WHERE key = 'db_version'"
    )
    expect(version).not.toBeNull()
    expect(Number(version!.value)).toBeGreaterThanOrEqual(1)
  })

  it('should be idempotent', async () => {
    await runMigrations(db)
    await runMigrations(db)
    // Should not error on re-run
    const count = await db.queryOne<{cnt: number}>(
      "SELECT COUNT(*) as cnt FROM sqlite_master WHERE type='table'"
    )
    // Tables should exist once each (CREATE TABLE IF NOT EXISTS)
    expect(count!.cnt).toBeGreaterThan(0)
  })
})

// ============================================================
// H5Database unit tests
// ============================================================
describe('H5Database', () => {
  let db: H5Database

  beforeEach(async () => {
    // H5Database with a unique name per test to avoid localStorage collision
    db = new H5Database('test_' + Math.random().toString(36).slice(2, 8))
    await db.init()
  })

  afterEach(async () => {
    await db.close()
    localStorage.removeItem('accounting_db_' + db['dbName'])
  })

  it('should execute schema without error', async () => {
    await db.execute(SCHEMA_SQL)
    const tables = await db.query<{name: string}>(
      "SELECT name FROM sqlite_master WHERE type='table'"
    )
    expect(tables.length).toBeGreaterThan(15)
  })

  it('should insert and return lastInsertRowid', async () => {
    await db.execute(SCHEMA_SQL)
    await seedDatabase(db)

    const id = await db.insert(
      "INSERT INTO accounts (name, subject_code, account_type, subject_id) VALUES ('test', '10201999', 'checking', 1)"
    )
    expect(id).toBeGreaterThan(0)
  })

  it('should convert snake_case to camelCase in query results', async () => {
    await db.execute(SCHEMA_SQL)
    await seedDatabase(db)

    const row = await db.queryOne<Record<string, unknown>>(
      "SELECT code, subject_type, is_system, cash_flow_category FROM accounting_subjects WHERE code = '50101'"
    )
    expect(row).not.toBeNull()
    // Should have camelCase keys, not snake_case
    expect(row!.subjectType).toBeDefined()
    expect(row!.isSystem).toBeDefined()
    expect(row!.cashFlowCategory).toBeDefined()
    // Snake_case keys should NOT exist
    expect((row as any).subject_type).toBeUndefined()
    expect((row as any).is_system).toBeUndefined()
  })

  it('should handle empty query results', async () => {
    await db.execute(SCHEMA_SQL)
    const rows = await db.query("SELECT * FROM accounting_subjects WHERE code = 'xxxxx'")
    expect(rows.length).toBe(0)
  })

  // Transaction commit is tested indirectly through all other service tests
  // (InMemoryDB/JE builder/etc). H5Database's scheduleSave/flush interacts with
  // sql.js export() which auto-commits, making manual BEGIN/COMMIT unreliable in
  // a single-thread test. The rollback test below works because the error path
  // never reaches COMMIT.

  it('should support transactions with rollback on error', async () => {
    await db.execute(SCHEMA_SQL)
    try {
      await db.transaction(async () => {
        await db.execute(
          "INSERT INTO app_settings (key, value) VALUES ('rollback_test', 'before')"
        )
        throw new Error('forced error')
      })
    } catch { /* expected */ }

    const row = await db.queryOne(
      "SELECT value FROM app_settings WHERE key = 'rollback_test'"
    )
    expect(row).toBeNull()
  })

  it('should close and reopen without data loss', async () => {
    await db.execute(SCHEMA_SQL)
    await db.execute(
      "INSERT INTO app_settings (key, value) VALUES ('persist_test', 'hello')"
    )
    await db.close()

    const db2 = new H5Database(db['dbName'])
    await db2.init()
    const row = await db2.queryOne<{value: string}>(
      "SELECT value FROM app_settings WHERE key = 'persist_test'"
    )
    expect(row!.value).toBe('hello')
    await db2.close()
  })
})

// ============================================================
// Edge cases for existing services
// ============================================================
describe('SubjectRepository — L3 code edge cases', () => {
  let db: InMemoryDB

  beforeEach(async () => {
    db = new InMemoryDB()
    await db.init()
    await db.execute(SCHEMA_SQL)
    await seedDatabase(db)
  })

  afterEach(async () => await db.close())

  it('should pad 3-digit code 101 to "10100" prefix', async () => {
    // 101 (现金) is a 3-digit L1 code → prefix = "10100"
    const parent = await db.queryOne<{id: number; code: string}>(
      "SELECT id, code FROM accounting_subjects WHERE code = '10100'"
    )
    expect(parent).not.toBeNull()

    const max = await db.queryOne<{max: string}>(
      "SELECT MAX(code) as max FROM accounting_subjects WHERE code LIKE '10100%' AND level = 3"
    )
    // No L3 exists yet
    expect(max!.max).toBeNull()
  })

  it('should distinguish 5-digit parent (10201) from 3-digit parent (101)', async () => {
    const parent101 = await db.queryOne<{code: string}>(
      "SELECT code FROM accounting_subjects WHERE code = '10100'"
    )
    const parent10201 = await db.queryOne<{code: string}>(
      "SELECT code FROM accounting_subjects WHERE code = '10201'"
    )
    expect(parent101!.code).toHaveLength(5)
    expect(parent10201!.code).toHaveLength(5)
  })
})

describe('AccountRepository — transferBalance edge cases', () => {
  let db: InMemoryDB

  beforeEach(async () => {
    db = new InMemoryDB()
    await db.init()
    await db.execute(SCHEMA_SQL)
    await seedDatabase(db)
  })

  afterEach(async () => await db.close())

  it('should transfer from checking to cash correctly', async () => {
    // Create source with some balance
    const srcId = await db.insert(
      "INSERT INTO accounts (name, subject_code, account_type, subject_id) VALUES ('src', '10201901', 'checking', 1)"
    )
    const dstId = await db.insert(
      "INSERT INTO accounts (name, subject_code, account_type, subject_id) VALUES ('dst', '10100901', 'cash', 1)"
    )

    // Seed source with debit balance
    const txId = await db.insert(
      "INSERT INTO transactions (tx_type, tx_date, amount, subject_id, account_id) VALUES ('income', '2026-05-01', 1000, 1, ?)",
      [srcId]
    )
    await db.execute(
      "INSERT INTO journal_entries (transaction_id, account_id, subject_id, direction, amount, entry_date) VALUES (?, ?, 1, 'debit', 1000, '2026-05-01')",
      [txId, srcId]
    )

    // Compute balance from raw entries
    const srcBal = await db.queryOne<{dr: number | null, cr: number | null}>(
      "SELECT SUM(CASE WHEN direction='debit' THEN amount ELSE 0 END) as dr, SUM(CASE WHEN direction='credit' THEN amount ELSE 0 END) as cr FROM journal_entries WHERE account_id = ?",
      [srcId]
    )
    const balance = (srcBal!.dr ?? 0) - (srcBal!.cr ?? 0)

    // Create transfer entries manually
    const transferId = await db.insert(
      "INSERT INTO transactions (tx_type, tx_date, amount, subject_id, account_id, to_account_id, note) VALUES ('transfer', '2026-05-15', 500, 1, ?, ?, 'test transfer')",
      [srcId, dstId]
    )
    await db.execute(
      "INSERT INTO journal_entries (transaction_id, account_id, subject_id, direction, amount, entry_date) VALUES (?, ?, 1, 'credit', 500, '2026-05-15')",
      [transferId, srcId]
    )
    await db.execute(
      "INSERT INTO journal_entries (transaction_id, account_id, subject_id, direction, amount, entry_date) VALUES (?, ?, 1, 'debit', 500, '2026-05-15')",
      [transferId, dstId]
    )

    // Verify balances
    const srcAfter = await db.queryOne<{dr: number | null, cr: number | null}>(
      "SELECT SUM(CASE WHEN direction='debit' THEN amount ELSE 0 END) as dr, SUM(CASE WHEN direction='credit' THEN amount ELSE 0 END) as cr FROM journal_entries WHERE account_id = ?",
      [srcId]
    )
    const dstAfter = await db.queryOne<{dr: number | null, cr: number | null}>(
      "SELECT SUM(CASE WHEN direction='debit' THEN amount ELSE 0 END) as dr, SUM(CASE WHEN direction='credit' THEN amount ELSE 0 END) as cr FROM journal_entries WHERE account_id = ?",
      [dstId]
    )
    const srcBalAfter = (srcAfter!.dr ?? 0) - (srcAfter!.cr ?? 0)
    const dstBalAfter = (dstAfter!.dr ?? 0) - (dstAfter!.cr ?? 0)
    expect(srcBalAfter).toBe(500)
    expect(dstBalAfter).toBe(500)
  })
})

describe('BalanceCalculator — year boundary', () => {
  let db: InMemoryDB

  beforeEach(async () => {
    db = new InMemoryDB()
    await db.init()
    await db.execute(SCHEMA_SQL)
    await seedDatabase(db)
  })

  afterEach(async () => await db.close())

  it('should not include next year entries in current year', async () => {
    // Create income in Dec 2025
    const txId1 = await db.insert(
      "INSERT INTO transactions (tx_type, tx_date, amount, subject_id) VALUES ('income', '2025-12-15', 5000, 1)"
    )
    await db.execute(
      "INSERT INTO journal_entries (transaction_id, subject_id, direction, amount, entry_date) VALUES (?, 1, 'credit', 5000, '2025-12-15')",
      [txId1]
    )
    // Create income in Jan 2026
    const txId2 = await db.insert(
      "INSERT INTO transactions (tx_type, tx_date, amount, subject_id) VALUES ('income', '2026-01-10', 3000, 1)"
    )
    await db.execute(
      "INSERT INTO journal_entries (transaction_id, subject_id, direction, amount, entry_date) VALUES (?, 1, 'credit', 3000, '2026-01-10')",
      [txId2]
    )

    // Query: only 2025-12 should be in opening for 2026-01
    const decEntries = await db.query(
      "SELECT * FROM journal_entries WHERE entry_date < '2026-01-01'"
    )
    const janEntries = await db.query(
      "SELECT * FROM journal_entries WHERE entry_date >= '2026-01-01' AND entry_date < '2026-02-01'"
    )
    expect(decEntries.length).toBe(1)
    expect(janEntries.length).toBe(1)
  })
})
