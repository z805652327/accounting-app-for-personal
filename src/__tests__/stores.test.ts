import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import initSqlJs from 'sql.js'
import { SCHEMA_SQL } from '@/database/schema'
import { seedDatabase } from '@/database/seed'
import type { IDatabase } from '@/database'

// ============================================================
// Shared in-memory DB — created once, reused across all stores
// ============================================================
class StoreTestDB implements IDatabase {
  db: any = null
  async init() {
    if (this.db) return
    const SQL = await initSqlJs()
    this.db = new SQL.Database()
    this.db.run('PRAGMA foreign_keys = ON')
    await this.execute(SCHEMA_SQL)
    await seedDatabase(this)
  }
  async close() { this.db?.close(); this.db = null }
  async execute(sql: string, params?: any[]) { this.db.run(sql, params) }
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
// Patch the factory: replace getDatabase with our pre-built DB.
// We use a tricky import-then-override approach because vi.mock
// is hoisted and can't handle async setup.
// ============================================================
import * as factory from '@/database/factory'

let sharedDB: StoreTestDB

beforeEach(async () => {
  // Create a fresh DB for each test group
  sharedDB = new StoreTestDB()
  await sharedDB.init()

  // Replace the singleton getter
  vi.spyOn(factory, 'getDatabase').mockResolvedValue(sharedDB as any)
  vi.spyOn(factory, 'closeDatabase').mockImplementation(async () => {
    await sharedDB.close()
    sharedDB = null as any
    vi.restoreAllMocks()
  })

  setActivePinia(createPinia())
})

afterEach(async () => {
  if (sharedDB) {
    await sharedDB.close()
    sharedDB = null as any
  }
  vi.restoreAllMocks()
})

// Import stores AFTER mocks are set up
import { useSubjectStore } from '@/stores/subjects'
import { useAccountStore } from '@/stores/accounts'
import { useTransactionStore } from '@/stores/transactions'
import { vi } from 'vitest'

describe('useSubjectStore', () => {
  it('should load subjects from database', async () => {
    const store = useSubjectStore()
    await store.load()
    expect(store.subjects.length).toBeGreaterThan(80)
  })

  it('should build tree structure', async () => {
    const store = useSubjectStore()
    await store.load()
    const tree = store.tree
    expect(tree.length).toBeGreaterThan(15)
    expect(Array.isArray(tree[0].children)).toBe(true)
  })

  it('should get subject by id', async () => {
    const store = useSubjectStore()
    await store.load()
    const first = store.subjects[0]
    expect(store.getById(first.id)!.code).toBe(first.code)
  })

  it('should get subject by code', async () => {
    const store = useSubjectStore()
    await store.load()
    expect(store.getByCode('50101')!.name).toBe('房租')
  })

  it('should get children of a parent', async () => {
    const store = useSubjectStore()
    await store.load()
    const parent = store.getByCode('40100')!
    expect(store.getChildren(parent.id).length).toBeGreaterThanOrEqual(3)
  })

  it('should filter L1 and L2', async () => {
    const store = useSubjectStore()
    await store.load()
    expect(store.getL1Subjects().every(s => s.level === 1)).toBe(true)
    expect(store.getL2Subjects().every(s => s.level === 2)).toBe(true)
  })

  it('should return undefined for bad id', async () => {
    const store = useSubjectStore()
    await store.load()
    expect(store.getById(99999)).toBeUndefined()
  })

  it('should track loading state', async () => {
    const store = useSubjectStore()
    expect(store.loading).toBe(false)
    const p = store.load()
    expect(store.loading).toBe(true)
    await p
    expect(store.loading).toBe(false)
  })
})

describe('useAccountStore', () => {
  it('should load accounts', async () => {
    const store = useAccountStore()
    await store.load()
    expect(Array.isArray(store.accounts)).toBe(true)
  })

  it('should create account with initial balance', async () => {
    const subStore = useSubjectStore()
    await subStore.load()
    const store = useAccountStore()
    const checkingSub = subStore.getByCode('10201')!

    const id = await store.create({
      name: '招商银行测试', accountType: 'checking',
      subjectId: checkingSub.id, bankName: '招商银行',
      cardLastFour: '8888', initialBalance: 50000,
    })
    const acc = store.getById(id)
    expect(acc!.name).toBe('招商银行测试')
    expect(acc!.balance).toBe(50000)
  })

  it('should create account with zero balance', async () => {
    const subStore = useSubjectStore()
    await subStore.load()
    const id = await useAccountStore().create({
      name: '空账户', accountType: 'checking',
      subjectId: subStore.getByCode('10201')!.id,
    })
    expect(useAccountStore().getById(id)!.balance).toBe(0)
  })

  it('should create credit card with limit', async () => {
    const subStore = useSubjectStore()
    await subStore.load()
    const store = useAccountStore()
    const id = await store.create({
      name: '招行信用卡', accountType: 'credit_card',
      subjectId: subStore.getByCode('20100')!.id,
      creditLimit: 30000,
    })
    const acc = store.getById(id)
    expect(acc!.accountType).toBe('credit_card')
    expect(acc!.creditLimit).toBe(30000)
  })

  it('should update account', async () => {
    const subStore = useSubjectStore()
    await subStore.load()
    const store = useAccountStore()
    const id = await store.create({
      name: '旧名', accountType: 'checking',
      subjectId: subStore.getByCode('10201')!.id,
    })
    await store.update(id, { name: '新名', cardLastFour: '1234' })
    const acc = store.getById(id)
    expect(acc!.name).toBe('新名')
    expect(acc!.cardLastFour).toBe('1234')
  })

  it('should delete account and transfer balance', async () => {
    const subStore = useSubjectStore()
    await subStore.load()
    const store = useAccountStore()
    const sub = subStore.getByCode('10201')!

    const srcId = await store.create({
      name: '源', accountType: 'checking', subjectId: sub.id,
      initialBalance: 1000,
    })
    const dstId = await store.create({
      name: '目标', accountType: 'checking', subjectId: sub.id,
    })
    await store.deleteAccount(srcId, dstId)
    await store.load()
    expect(store.getById(srcId)).toBeUndefined()
  })
})

describe('useTransactionStore', () => {
  it('should load recent transactions', async () => {
    const store = useTransactionStore()
    await store.loadRecent()
    expect(Array.isArray(store.recentTxns)).toBe(true)
  })

  it('should create transaction via journal entry builder', async () => {
    const subStore = useSubjectStore()
    const accStore = useAccountStore()
    await subStore.load()
    await accStore.load()

    const accId = await accStore.create({
      name: '测试卡', accountType: 'checking',
      subjectId: subStore.getByCode('10201')!.id,
    })

    const store = useTransactionStore()
    const { transactionId, entries } = await store.create({
      txType: 'expense', txDate: '2026-05-20', amount: 88,
      subjectId: subStore.getByCode('50201')!.id, accountId: accId,
      note: '午餐',
    })
    expect(transactionId).toBeGreaterThan(0)
    expect(entries.length).toBe(2)
  })

  it('should search by type', async () => {
    const subStore = useSubjectStore()
    const accStore = useAccountStore()
    await subStore.load()
    await accStore.load()
    const accId = await accStore.create({
      name: '测试卡', accountType: 'checking',
      subjectId: subStore.getByCode('10201')!.id,
    })

    const store = useTransactionStore()
    await store.create({
      txType: 'expense', txDate: '2026-05-20', amount: 50,
      subjectId: subStore.getByCode('50201')!.id, accountId: accId,
    })
    await store.create({
      txType: 'income', txDate: '2026-05-21', amount: 500,
      subjectId: subStore.getByCode('40101')!.id, accountId: accId,
    })

    const results = await store.search({ txType: 'expense' })
    expect(results.every((r: any) => r.txType === 'expense')).toBe(true)
  })

  it('should update a transaction', async () => {
    const subStore = useSubjectStore()
    const accStore = useAccountStore()
    await subStore.load()
    await accStore.load()
    const accId = await accStore.create({
      name: '测试卡', accountType: 'checking',
      subjectId: subStore.getByCode('10201')!.id,
    })
    const expenseSub = subStore.getByCode('50201')!
    const store = useTransactionStore()

    const { transactionId } = await store.create({
      txType: 'expense', txDate: '2026-05-20', amount: 100,
      subjectId: expenseSub.id, accountId: accId,
    })
    await store.updateTx(transactionId, {
      txType: 'expense', txDate: '2026-05-20', amount: 200,
      subjectId: expenseSub.id, accountId: accId,
    })

    const results = await store.search({})
    const updated = results.find((r: any) => r.id === transactionId)
    expect(updated!.amount).toBe(200)
  })

  it('should soft delete transaction', async () => {
    const subStore = useSubjectStore()
    const accStore = useAccountStore()
    await subStore.load()
    await accStore.load()
    const accId = await accStore.create({
      name: '测试卡', accountType: 'checking',
      subjectId: subStore.getByCode('10201')!.id,
    })
    const store = useTransactionStore()

    const { transactionId } = await store.create({
      txType: 'expense', txDate: '2026-05-20', amount: 30,
      subjectId: subStore.getByCode('50201')!.id, accountId: accId,
    })
    await store.loadRecent()
    const before = store.recentTxns.length

    await store.softDelete(transactionId)
    await store.loadRecent()
    expect(store.recentTxns.length).toBe(before - 1)
  })
})
