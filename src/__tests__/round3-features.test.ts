import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { TestDatabase } from './setup'
import { SubjectResolver } from '@/services/subject-resolver'
import { AccountRepository } from '@/repositories/account-repo'
import { IndicatorService } from '@/services/indicator.service'
import { SavedReportService } from '@/services/saved-report.service'
import { SplitTransactionService } from '@/services/split-transaction.service'
import { JournalEntryBuilder } from '@/services/journal-entry-builder'
import { ExcelExportService } from '@/services/excel-export.service'
import { BalanceCalculator } from '@/services/balance-calculator'

describe('IndicatorService', () => {
  let db: TestDatabase
  let svc: IndicatorService
  let resolve: SubjectResolver

  beforeEach(async () => {
    db = new TestDatabase()
    await db.init()
    svc = new IndicatorService(db)
    resolve = new SubjectResolver(db)
    await resolve.preload()
  })

  afterEach(async () => await db.close())

  it('should create an indicator', async () => {
    const id = await svc.create({ name: '月结余率', formula: 'TOTAL_INCOME/TOTAL_EXPENSE' })
    expect(id).toBeGreaterThan(0)
  })

  it('should evaluate a simple indicator', async () => {
    await svc.create({ name: '测试公式', formula: '100 + 200' })
    const results = await svc.evaluate(2026, 5)
    const ours = results.find(r => r.indicator.name === '测试公式')
    expect(ours).toBeDefined()
    expect(ours!.value).toBe(300)
  })

  it('should evaluate SUM over subjects', async () => {
    await svc.create({ name: 'SUM测试', formula: 'SUM(5)' })
    const results = await svc.evaluate(2026, 5)
    const ours = results.find(r => r.indicator.name === 'SUM测试')
    expect(ours).toBeDefined()
    expect(typeof ours!.value).toBe('number')
  })

  it('should evaluate TOTAL_INCOME and TOTAL_EXPENSE', async () => {
    // Seed some income and expense
    const incomeId = await resolve.id('40101')
    const expenseId = await resolve.id('50201')
    const assetId = await resolve.id('10201')
    const repo = new AccountRepository(db)
    const accId = await repo.create({
      name: '测试卡', subjectCode: '10201901', accountType: 'checking', subjectId: assetId,
    })

    // Income 10000
    await db.insert(
      `INSERT INTO transactions (tx_type, tx_date, amount, subject_id, account_id)
       VALUES ('income', '2026-05-10', 10000, ?, ?)`, [incomeId, accId]
    )
    const tx1 = (await db.queryOne<{id: number}>('SELECT last_insert_rowid() as id'))!.id
    await db.insert(
      `INSERT INTO journal_entries (transaction_id, subject_id, direction, amount, entry_date)
       VALUES (?, ?, 'credit', 10000, '2026-05-10')`, [tx1, incomeId]
    )

    // Expense 3000
    await db.insert(
      `INSERT INTO transactions (tx_type, tx_date, amount, subject_id, account_id)
       VALUES ('expense', '2026-05-15', 3000, ?, ?)`, [expenseId, accId]
    )
    const tx2 = (await db.queryOne<{id: number}>('SELECT last_insert_rowid() as id'))!.id
    await db.insert(
      `INSERT INTO journal_entries (transaction_id, subject_id, direction, amount, entry_date)
       VALUES (?, ?, 'debit', 3000, '2026-05-15')`, [tx2, expenseId]
    )

    await svc.create({ name: '月结余测试', formula: 'TOTAL_INCOME - TOTAL_EXPENSE' })
    const results = await svc.evaluate(2026, 5)
    const ours = results.find(r => r.indicator.name === '月结余测试')
    expect(ours).toBeDefined()
    expect(ours!.value).toBeGreaterThan(0)
  })

  it('should reject invalid formulas gracefully', async () => {
    await svc.create({ name: 'XSS公式', formula: 'alert("xss")' })
    const results = await svc.evaluate(2026, 5)
    const ours = results.find(r => r.indicator.name === 'XSS公式')
    expect(ours).toBeDefined()
    expect(ours!.value).toBe(0)
    expect(ours!.formulaDesc).toContain('计算错误')
  })

  it('should handle decimal places', async () => {
    await svc.create({ name: '精度测试', formula: '1/3', decimalPlaces: 4 })
    const results = await svc.evaluate(2026, 5)
    const ours = results.find(r => r.indicator.name === '精度测试')
    expect(ours).toBeDefined()
    expect(ours!.value).toBe(0.3333)
  })

  it('should delete an indicator', async () => {
    const id = await svc.create({ name: '待删除', formula: '1+1' })
    await svc.delete(id)
    const all = await svc.findAll()
    expect(all.find(i => i.id === id)).toBeUndefined()
  })
})

describe('SavedReportService', () => {
  let db: TestDatabase
  let svc: SavedReportService

  beforeEach(async () => {
    db = new TestDatabase()
    await db.init()
    svc = new SavedReportService(db)
  })

  afterEach(async () => await db.close())

  it('should create a saved report', async () => {
    const id = await svc.create({
      name: '本月餐饮',
      filters: { subjects: ['50201'], dateRange: 'thisMonth', type: 'expense' },
    })
    expect(id).toBeGreaterThan(0)
  })

  it('should find all reports', async () => {
    await svc.create({ name: 'A', filters: {} })
    await svc.create({ name: 'B', filters: {}, isPinned: true })
    const all = await svc.findAll()
    expect(all.length).toBe(2)
    // Pinned should come first
    expect(all[0].name).toBe('B')
  })

  it('should toggle pin status', async () => {
    const id = await svc.create({ name: '测试', filters: {} })
    await svc.togglePin(id)
    const rpt = await svc.findById(id)
    expect(rpt?.isPinned).toBe(1)

    await svc.togglePin(id)
    const rpt2 = await svc.findById(id)
    expect(rpt2?.isPinned).toBe(0)
  })

  it('should delete a report', async () => {
    const id = await svc.create({ name: '待删除', filters: {} })
    await svc.delete(id)
    expect(await svc.findById(id)).toBeNull()
  })

  it('should parse filters and display fields from JSON', async () => {
    const id = await svc.create({
      name: '测试', filters: { subjects: ['50201', '50202'], dateRange: 'thisMonth', type: 'expense' },
      displayFields: ['date', 'subject', 'amount'],
    })
    const rpt = await svc.findById(id)
    const filters = svc.parseFilters(rpt!)
    expect(filters.subjects).toEqual(['50201', '50202'])
    const fields = svc.parseDisplayFields(rpt!)
    expect(fields).toEqual(['date', 'subject', 'amount'])
  })
})

describe('SplitTransactionService', () => {
  let db: TestDatabase
  let svc: SplitTransactionService
  let resolve: SubjectResolver
  let txId: number

  beforeEach(async () => {
    db = new TestDatabase()
    await db.init()
    svc = new SplitTransactionService(db)
    resolve = new SubjectResolver(db)
    await resolve.preload()

    const expenseId = await resolve.id('50101')
    txId = await db.insert(
      `INSERT INTO transactions (tx_type, tx_date, amount, subject_id)
       VALUES ('expense', '2026-05-20', 200, ?)`, [expenseId]
    )
  })

  afterEach(async () => await db.close())

  it('should save split items', async () => {
    await svc.saveSplits(txId, [
      { subjectId: await resolve.id('50201'), amount: 150 },
      { subjectId: await resolve.id('50301'), amount: 50 },
    ])
    const splits = await svc.findByTransaction(txId)
    expect(splits.length).toBe(2)
    expect(splits[0].sortOrder).toBe(0)
    expect(splits[1].sortOrder).toBe(1)
  })

  it('should replace old splits on save', async () => {
    await svc.saveSplits(txId, [{ subjectId: await resolve.id('50201'), amount: 100 }])
    await svc.saveSplits(txId, [{ subjectId: await resolve.id('50301'), amount: 200 }])
    const splits = await svc.findByTransaction(txId)
    expect(splits.length).toBe(1)
    expect(splits[0].amount).toBe(200)
  })

  it('should delete all splits for a transaction', async () => {
    await svc.saveSplits(txId, [
      { subjectId: await resolve.id('50201'), amount: 100 },
      { subjectId: await resolve.id('50301'), amount: 100 },
    ])
    await svc.deleteByTransaction(txId)
    const splits = await svc.findByTransaction(txId)
    expect(splits.length).toBe(0)
  })
})

describe('Split Transaction — Journal Entries', () => {
  let db: TestDatabase
  let builder: JournalEntryBuilder
  let resolve: SubjectResolver
  let checkingAccountId: number

  beforeEach(async () => {
    db = new TestDatabase()
    await db.init()
    builder = new JournalEntryBuilder(db)
    resolve = new SubjectResolver(db)
    await resolve.preload()

    const repo = new AccountRepository(db)
    checkingAccountId = await repo.create({
      name: '招商银行', subjectCode: '10201901',
      accountType: 'checking', subjectId: await resolve.id('10201'),
    })
  })

  afterEach(async () => await db.close())

  it('should create per-split debit entries', async () => {
    const foodId = await resolve.id('50201')  // 餐饮
    const shopId = await resolve.id('50301')  // 日常购物

    const result = await builder.process({
      txType: 'expense', txDate: '2026-05-20', amount: 200,
      subjectId: 0, accountId: checkingAccountId,
      splits: [
        { subjectId: foodId, amount: 150, note: '食品' },
        { subjectId: shopId, amount: 50, note: '日用品' },
      ],
    })

    // 2 debit entries + 1 credit entry = 3
    expect(result.entries.length).toBe(3)

    const drEntries = result.entries.filter(e => e.direction === 'debit')
    expect(drEntries.length).toBe(2)
    expect(drEntries[0].amount).toBe(150)
    expect(drEntries[0].subjectId).toBe(foodId)
    expect(drEntries[1].amount).toBe(50)
    expect(drEntries[1].subjectId).toBe(shopId)

    const crEntry = result.entries.find(e => e.direction === 'credit')!
    expect(crEntry.amount).toBe(200)
    expect(crEntry.accountId).toBe(checkingAccountId)

    // Splits should be saved to DB
    const splitSvc = new SplitTransactionService(db)
    const splits = await splitSvc.findByTransaction(result.transactionId)
    expect(splits.length).toBe(2)
  })

  it('should maintain debit = credit with splits', async () => {
    const foodId = await resolve.id('50201')
    const shopId = await resolve.id('50301')

    const result = await builder.process({
      txType: 'expense', txDate: '2026-05-20', amount: 200,
      subjectId: 0, accountId: checkingAccountId,
      splits: [
        { subjectId: foodId, amount: 120 },
        { subjectId: shopId, amount: 80 },
      ],
    })

    const dr = result.entries.filter(e => e.direction === 'debit').reduce((s, e) => s + e.amount, 0)
    const cr = result.entries.filter(e => e.direction === 'credit').reduce((s, e) => s + e.amount, 0)
    expect(Math.abs(dr - cr)).toBeLessThan(0.01)
  })
})

describe('ExcelExportService', () => {
  let db: TestDatabase
  let svc: ExcelExportService
  let resolve: SubjectResolver

  beforeEach(async () => {
    db = new TestDatabase()
    await db.init()
    svc = new ExcelExportService(db)
    resolve = new SubjectResolver(db)
    await resolve.preload()
  })

  afterEach(async () => await db.close())

  it('should export CSV with UTF-8 BOM', async () => {
    const csv = await svc.exportTransactionsCSV({ format: 'csv' })
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toContain('日期')
    expect(csv).toContain('金额')
  })

  it('should export XLSX as valid XML', async () => {
    const xlsx = await svc.exportTransactionsXLSX({ format: 'xlsx' })
    const text = new TextDecoder().decode(xlsx)
    expect(text).toContain('Workbook')
    expect(text).toContain('Worksheet')
    expect(text).toContain('Table')
  })

  it('should export balance sheet as XLSX', async () => {
    const xlsx = await svc.exportBalanceSheet(2026, 5)
    const text = new TextDecoder().decode(xlsx)
    expect(text).toContain('资产负债表')
  })

  it('should export income statement as XLSX', async () => {
    const xlsx = await svc.exportIncomeStatement(2026, 5)
    const text = new TextDecoder().decode(xlsx)
    expect(text).toContain('利润表')
  })

  it('should export indicators as XLSX', async () => {
    const indSvc = new IndicatorService(db)
    await indSvc.create({ name: '测试', formula: '1+1' })

    const xlsx = await svc.exportIndicators(2026, 5)
    const text = new TextDecoder().decode(xlsx)
    expect(text).toContain('测试')
  })
})
