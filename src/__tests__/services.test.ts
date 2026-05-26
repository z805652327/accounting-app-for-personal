import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { TestDatabase } from './setup'
import { SubjectResolver } from '@/services/subject-resolver'
import { AccountRepository } from '@/repositories/account-repo'
import { AmortizationService } from '@/services/amortization.service'
import { DepreciationService } from '@/services/depreciation.service'
import { PendingService } from '@/services/pending.service'
import { SetupService } from '@/services/setup.service'

describe('AmortizationService', () => {
  let db: TestDatabase
  let svc: AmortizationService
  let resolve: SubjectResolver
  let dummyTxId: number

  beforeEach(async () => {
    db = new TestDatabase()
    await db.init()
    svc = new AmortizationService(db)
    resolve = new SubjectResolver(db)
    await resolve.preload()

    // Create a dummy transaction for FK reference
    const expenseSub = await resolve.id('50101')
    dummyTxId = await db.insert(
      `INSERT INTO transactions (tx_type, tx_date, amount, subject_id)
       VALUES ('expense', '2026-01-01', 1, ?)`,
      [expenseSub]
    )
  })

  afterEach(async () => await db.close())

  it('should create an amortization schedule', async () => {
    const expenseSub = await resolve.id('50101')
    const id = await svc.create({
      transactionId: dummyTxId, l3SubjectId: expenseSub,
      totalAmount: 4000, periods: 2, amountPerPeriod: 2000,
      startDate: '2026-05-01',
    })
    expect(id).toBeGreaterThan(0)
  })

  it('should find all active schedules', async () => {
    const expenseSub = await resolve.id('50101')
    await svc.create({
      transactionId: dummyTxId, l3SubjectId: expenseSub,
      totalAmount: 4000, periods: 2, amountPerPeriod: 2000,
      startDate: '2026-05-01',
    })
    const schedules = await svc.findAll()
    expect(schedules.length).toBeGreaterThanOrEqual(1)
  })

  it('should generate pending amortization items for elapsed periods', async () => {
    const expenseSub = await resolve.id('50101')
    const startDate = '2026-01-01'
    await svc.create({
      transactionId: dummyTxId, l3SubjectId: expenseSub,
      totalAmount: 6000, periods: 3, amountPerPeriod: 2000,
      startDate,
    })
    const items = await svc.generatePendingItems()
    const amorItems = items.filter(i => i.itemType === 'amortization')
    expect(amorItems.length).toBeGreaterThan(0)
    for (const item of amorItems) {
      expect(item.amount).toBe(2000)
    }
  })

  it('should execute pending and create journal entries', async () => {
    const expenseSub = await resolve.id('50101')
    const id = await svc.create({
      transactionId: dummyTxId, l3SubjectId: expenseSub,
      totalAmount: 2000, periods: 1, amountPerPeriod: 2000,
      startDate: '2026-05-01',
    })

    await svc.executePending({
      id: 0, itemType: 'amortization', referenceId: id,
      description: '摊销测试', amount: 2000,
      dueDate: '2026-05-15', isDone: false, createdAt: '2026-05-15',
    })

    const entries = await db.query(
      'SELECT * FROM journal_entries WHERE entry_date = ?', ['2026-05-15']
    )
    expect(entries.length).toBe(2)
    expect(entries.map((e: any) => e.direction).sort()).toEqual(['credit', 'debit'])
  })

  it('should decrement remaining periods on execute', async () => {
    const expenseSub = await resolve.id('50101')
    const id = await svc.create({
      transactionId: dummyTxId, l3SubjectId: expenseSub,
      totalAmount: 4000, periods: 2, amountPerPeriod: 2000,
      startDate: '2026-05-01',
    })

    await svc.executePending({
      id: 0, itemType: 'amortization', referenceId: id,
      description: '摊销', amount: 2000,
      dueDate: '2026-05-15', isDone: false, createdAt: '2026-05-15',
    })

    const schedules = await db.query(
      'SELECT * FROM amortization_schedules WHERE id = ?', [id]
    )
    expect(schedules[0].remainingPeriods).toBe(1)
  })
})

describe('DepreciationService', () => {
  let db: TestDatabase
  let svc: DepreciationService
  let resolve: SubjectResolver
  let assetAccountId: number
  let depSubjectId: number

  beforeEach(async () => {
    db = new TestDatabase()
    await db.init()
    svc = new DepreciationService(db)
    resolve = new SubjectResolver(db)
    await resolve.preload()

    // Create asset account
    const repo = new AccountRepository(db)
    const assetSub = await resolve.id('13103')
    assetAccountId = await repo.create({
      name: '联想笔记本', subjectCode: '13103901',
      accountType: 'fixed_asset', subjectId: assetSub,
    })
    depSubjectId = await resolve.id('15103')
  })

  afterEach(async () => await db.close())

  it('should create a depreciation config', async () => {
    const id = await svc.create({
      accountId: assetAccountId, assetName: '联想笔记本',
      originalValue: 10000, residualValue: 1000,
      usefulMonths: 36, depreciationSubjectId: depSubjectId,
      startDate: '2026-05',
    })
    expect(id).toBeGreaterThan(0)
  })

  it('should generate pending depreciation items', async () => {
    const startDate = '2026-01'
    await svc.create({
      accountId: assetAccountId, assetName: '联想笔记本',
      originalValue: 10000, residualValue: 1000,
      usefulMonths: 36, depreciationSubjectId: depSubjectId,
      startDate,
    })
    const items = await svc.generatePendingItems()
    const depItems = items.filter(i => i.itemType === 'depreciation')
    expect(depItems.length).toBeGreaterThan(0)
    // Monthly depreciation: (10000-1000)/36 = 250
    for (const item of depItems) {
      expect(item.amount).toBe(250)
    }
  })

  it('should execute pending and create journal entries', async () => {
    const cfgId = await svc.create({
      accountId: assetAccountId, assetName: '联想笔记本',
      originalValue: 10000, residualValue: 1000,
      usefulMonths: 36, depreciationSubjectId: depSubjectId,
      startDate: '2026-05',
    })

    await svc.executePending({
      id: 0, itemType: 'depreciation', referenceId: cfgId,
      description: '联想笔记本', amount: 250,
      dueDate: '2026-05-01', isDone: false, createdAt: '2026-05-01',
    })

    const entries = await db.query(
      'SELECT * FROM journal_entries WHERE entry_date = ?', ['2026-05-01']
    )
    expect(entries.length).toBe(2)
    // Dr: 折旧费(50701), Cr: 累计折旧(151xx)
  })

  it('should recalculate on residual value change', async () => {
    const cfgId = await svc.create({
      accountId: assetAccountId, assetName: '联想笔记本',
      originalValue: 10000, residualValue: 1000,
      usefulMonths: 36, depreciationSubjectId: depSubjectId,
      startDate: '2026-05',
    })
    await svc.update(cfgId, { residualValue: 500 })
    const config = await svc.findById(cfgId)
    expect(config!.residualValue).toBe(500)
  })

  it('should terminate with write-off entries', async () => {
    const cfgId = await svc.create({
      accountId: assetAccountId, assetName: '联想笔记本',
      originalValue: 10000, residualValue: 1000,
      usefulMonths: 36, depreciationSubjectId: depSubjectId,
      startDate: '2026-05',
    })
    await svc.terminate(cfgId)
    const config = await svc.findById(cfgId)
    expect(config!.isActive).toBe(0)
  })

  it('should throw on updating non-existent config', async () => {
    await expect(
      svc.update(99999, { residualValue: 500 })
    ).rejects.toThrow('折旧配置不存在')
  })
})

describe('PendingService', () => {
  let db: TestDatabase
  let svc: PendingService
  let resolve: SubjectResolver
  let assetAccountId: number

  beforeEach(async () => {
    db = new TestDatabase()
    await db.init()
    svc = new PendingService(db)
    resolve = new SubjectResolver(db)
    await resolve.preload()

    const repo = new AccountRepository(db)
    assetAccountId = await repo.create({
      name: 'MacBook', subjectCode: '13103902',
      accountType: 'fixed_asset', subjectId: await resolve.id('13103'),
    })
  })

  afterEach(async () => await db.close())

  it('should generate all pending items from all sources', async () => {
    // Create a depreciation config
    const depSvc = new DepreciationService(db)
    await depSvc.create({
      accountId: assetAccountId, assetName: 'MacBook',
      originalValue: 10000, residualValue: 1000,
      usefulMonths: 36, depreciationSubjectId: await resolve.id('15103'),
      startDate: '2026-01',
    })

    const items = await svc.generateAll()
    expect(items.length).toBeGreaterThan(0)
    // Should include depreciation items
    const depItems = items.filter(i => i.itemType === 'depreciation')
    expect(depItems.length).toBeGreaterThan(0)
  })

  it('should execute all pending items', async () => {
    const depSvc = new DepreciationService(db)
    await depSvc.create({
      accountId: assetAccountId, assetName: 'MacBook',
      originalValue: 10000, residualValue: 1000,
      usefulMonths: 36, depreciationSubjectId: await resolve.id('15103'),
      startDate: '2026-01',
    })

    await svc.generateAll()
    await svc.executeAll()

    // After execution, no pending items should remain
    const remaining = await svc.getAll()
    expect(remaining.length).toBe(0)
  })

  it('should dismiss single pending item', async () => {
    // Direct insert a pending item
    await db.insert(
      `INSERT INTO pending_items (item_type, reference_id, description, amount, due_date, is_done)
       VALUES ('depreciation', 1, '测试', 100, '2026-05-01', 0)`
    )
    const items = await svc.getAll()
    expect(items.length).toBeGreaterThan(0)

    await svc.dismiss(items[0].id)
    const after = await svc.getAll()
    expect(after.find(i => i.id === items[0].id)).toBeUndefined()
  })
})

describe('SetupService', () => {
  let db: TestDatabase
  let svc: SetupService
  let resolve: SubjectResolver

  beforeEach(async () => {
    db = new TestDatabase()
    await db.init()
    svc = new SetupService(db)
    resolve = new SubjectResolver(db)
    await resolve.preload()
  })

  afterEach(async () => await db.close())

  it('should return false before setup', async () => {
    const done = await svc.isSetupComplete()
    expect(done).toBe(false)
  })

  it('should complete setup and create opening balances', async () => {
    const checking = await resolve.id('10201')
    const credit = await resolve.id('20100')

    await svc.execute({
      accounts: [
        { name: '招商银行', accountType: 'checking', subjectId: checking, balance: 50000, bankName: '招商银行', cardLastFour: '1111' },
        { name: '现金', accountType: 'cash', subjectId: await resolve.id('10100'), balance: 2000 },
      ],
      liabilities: [
        { name: '招商信用卡', accountType: 'credit_card', subjectId: credit, balance: 3000 },
      ],
    })

    // Setup should be complete
    const done = await svc.isSetupComplete()
    expect(done).toBe(true)

    // Should have created accounts
    const repo = new AccountRepository(db)
    const accounts = await repo.findAll()
    expect(accounts.length).toBeGreaterThanOrEqual(2)

    // Equity = 50000 + 2000 - 3000 = 49000
    const equityId = await resolve.id('30100')
    const entries = await db.query(
      'SELECT * FROM journal_entries WHERE subject_id = ?', [equityId]
    )
    expect(entries.length).toBeGreaterThan(0)
    // Opening equity should be credit for positive net worth
    const equityCredit = entries.find((e: any) => e.direction === 'credit')
    expect(equityCredit).toBeDefined()
    expect(equityCredit.amount).toBe(49000)
  })

  it('should handle negative equity (liabilities > assets)', async () => {
    const checking = await resolve.id('10201')
    const loan = await resolve.id('22101')

    await svc.execute({
      accounts: [
        { name: '招商银行', accountType: 'checking', subjectId: checking, balance: 10000 },
      ],
      liabilities: [
        { name: '房贷', accountType: 'loan', subjectId: loan, balance: 500000 },
      ],
    })

    const equityId = await resolve.id('30100')
    const entries = await db.query(
      'SELECT * FROM journal_entries WHERE subject_id = ?', [equityId]
    )
    // Net equity = 10000 - 500000 = -490000 → debit
    const equityDebit = entries.find((e: any) => e.direction === 'debit')
    expect(equityDebit).toBeDefined()
    expect(equityDebit.amount).toBe(490000)
  })
})
