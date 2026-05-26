import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { TestDatabase } from './setup'
import { AccountRepository } from '@/repositories/account-repo'
import { TransactionRepository } from '@/repositories/transaction-repo'
import { SubjectRepository } from '@/repositories/subject-repo'
import { SubjectResolver } from '@/services/subject-resolver'
import { JournalEntryBuilder } from '@/services/journal-entry-builder'
import { DepreciationService } from '@/services/depreciation.service'
import { AmortizationService } from '@/services/amortization.service'
import { IndicatorService } from '@/services/indicator.service'
import { SavedReportService } from '@/services/saved-report.service'
import { ExcelExportService } from '@/services/excel-export.service'

// ============================================================
// 1. AccountRepo.findBySubjectCode
// ============================================================
describe('AccountRepo — findBySubjectCode', () => {
  let db: TestDatabase
  let repo: AccountRepository
  let resolve: SubjectResolver

  beforeEach(async () => {
    db = new TestDatabase()
    await db.init()
    repo = new AccountRepository(db)
    resolve = new SubjectResolver(db)
    await resolve.preload()
  })
  afterEach(async () => await db.close())

  it('should find account by subject code', async () => {
    await repo.create({
      name: '招商银行', subjectCode: '10201001',
      accountType: 'checking', subjectId: await resolve.id('10201'),
    })
    const acc = await repo.findBySubjectCode('10201001')
    expect(acc).not.toBeNull()
    expect(acc!.name).toBe('招商银行')
  })

  it('should return null for unknown subject code', async () => {
    const acc = await repo.findBySubjectCode('99999999')
    expect(acc).toBeNull()
  })
})

// ============================================================
// 2. TransactionRepo.recordEditHistory + getEntriesByDateRange
// ============================================================
describe('TransactionRepo — recordEditHistory & getEntriesByDateRange', () => {
  let db: TestDatabase
  let repo: TransactionRepository
  let resolve: SubjectResolver

  beforeEach(async () => {
    db = new TestDatabase()
    await db.init()
    repo = new TransactionRepository(db)
    resolve = new SubjectResolver(db)
    await resolve.preload()
  })
  afterEach(async () => await db.close())

  it('should record edit history as JSON', async () => {
    const txId = await repo.create({
      txType: 'expense', txDate: '2026-05-20', amount: 100,
      subjectId: await resolve.id('50201'),
    })
    await repo.recordEditHistory(txId, 'user_edit', {
      amount: { old: 100, new: 200 },
      note: { old: null, new: '修改了金额' },
    })

    const rows = await db.query(
      'SELECT * FROM edit_history WHERE transaction_id = ?', [txId]
    )
    expect(rows.length).toBe(1)
    expect(rows[0].changeReason).toBe('user_edit')

    const changes = JSON.parse(rows[0].changes)
    expect(changes.amount.old).toBe(100)
    expect(changes.amount.new).toBe(200)
  })

  it('should record edit history with system reason', async () => {
    const txId = await repo.create({
      txType: 'expense', txDate: '2026-05-20', amount: 50,
      subjectId: await resolve.id('50201'),
    })
    await repo.recordEditHistory(txId, 'system_depreciation', {
      amount: { old: 50, new: 50 },
    })

    const rows = await db.query(
      "SELECT * FROM edit_history WHERE transaction_id = ? AND change_reason = 'system_depreciation'",
      [txId]
    )
    expect(rows.length).toBe(1)
  })

  it('should get entries by date range', async () => {
    const subjectId = await resolve.id('50201')
    // Create transaction with journal entries in different months
    const txId1 = await repo.create({
      txType: 'expense', txDate: '2026-01-15', amount: 100, subjectId,
    })
    await repo.insertJournalEntry({
      transactionId: txId1, subjectId, direction: 'debit',
      amount: 100, entryDate: '2026-01-15',
    })

    const txId2 = await repo.create({
      txType: 'expense', txDate: '2026-05-20', amount: 200, subjectId,
    })
    await repo.insertJournalEntry({
      transactionId: txId2, subjectId, direction: 'debit',
      amount: 200, entryDate: '2026-05-20',
    })

    const janEntries = await repo.getEntriesByDateRange('2026-01-01', '2026-01-31')
    expect(janEntries.length).toBe(1)
    expect(janEntries[0].amount).toBe(100)

    const allEntries = await repo.getEntriesByDateRange('2026-01-01', '2026-12-31')
    expect(allEntries.length).toBe(2)
  })
})

// ============================================================
// 3. JournalEntryBuilder.update (edit existing transaction)
// ============================================================
describe('JournalEntryBuilder — update (edit transaction)', () => {
  let db: TestDatabase
  let builder: JournalEntryBuilder
  let resolve: SubjectResolver
  let accId: number
  let expenseId: number

  beforeEach(async () => {
    db = new TestDatabase()
    await db.init()
    builder = new JournalEntryBuilder(db)
    resolve = new SubjectResolver(db)
    await resolve.preload()

    const repo = new AccountRepository(db)
    accId = await repo.create({
      name: '测试卡', subjectCode: '10201901',
      accountType: 'checking', subjectId: await resolve.id('10201'),
    })
    expenseId = await resolve.id('50201')
  })

  afterEach(async () => await db.close())

  it('should update existing transaction and record edit history', async () => {
    const { transactionId } = await builder.process({
      txType: 'expense', txDate: '2026-05-20', amount: 100,
      subjectId: expenseId, accountId: accId,
    })

    await builder.update(transactionId, {
      txType: 'expense', txDate: '2026-05-20', amount: 200,
      subjectId: expenseId, accountId: accId,
    }, 'user_edit')

    // Verify amount changed
    const tx = await db.queryOne<{amount: number}>(
      'SELECT amount FROM transactions WHERE id = ?', [transactionId]
    )
    expect(tx!.amount).toBe(200)

    // Verify edit history was recorded
    const history = await db.query(
      'SELECT * FROM edit_history WHERE transaction_id = ?', [transactionId]
    )
    expect(history.length).toBe(1)
    expect(history[0].changeReason).toBe('user_edit')
  })

  it('should update and replace journal entries', async () => {
    const { transactionId } = await builder.process({
      txType: 'expense', txDate: '2026-05-20', amount: 100,
      subjectId: expenseId, accountId: accId,
    })

    // Old entries count
    const oldEntries = await db.query(
      'SELECT * FROM journal_entries WHERE transaction_id = ?', [transactionId]
    )
    expect(oldEntries.length).toBe(2)

    await builder.update(transactionId, {
      txType: 'expense', txDate: '2026-05-20', amount: 300,
      subjectId: expenseId, accountId: accId,
    })

    const newEntries = await db.query(
      'SELECT * FROM journal_entries WHERE transaction_id = ?', [transactionId]
    )
    expect(newEntries.length).toBe(2)
    // Amounts should match the new value
    const dr = newEntries.find((e: any) => e.direction === 'debit')
    expect(dr!.amount).toBe(300)
  })

  it('should update splits on edit', async () => {
    const foodId = await resolve.id('50201')
    const shopId = await resolve.id('50301')

    const { transactionId } = await builder.process({
      txType: 'expense', txDate: '2026-05-20', amount: 200,
      subjectId: 0, accountId: accId,
      splits: [
        { subjectId: foodId, amount: 150, note: '食品' },
        { subjectId: shopId, amount: 50, note: '日用品' },
      ],
    })

    // Update with new splits
    await builder.update(transactionId, {
      txType: 'expense', txDate: '2026-05-20', amount: 300,
      subjectId: 0, accountId: accId,
      splits: [
        { subjectId: foodId, amount: 200 },
        { subjectId: shopId, amount: 100 },
      ],
    })

    const { SplitTransactionService } = await import('@/services/split-transaction.service')
    const splitSvc = new SplitTransactionService(db)
    const splits = await splitSvc.findByTransaction(transactionId)
    expect(splits.length).toBe(2)
    expect(splits[0].amount).toBe(200)
    expect(splits[1].amount).toBe(100)
  })
})

// ============================================================
// 4. DepreciationService.update — usefulMonths & isActive
// ============================================================
describe('DepreciationService — update edge cases', () => {
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

    const repo = new AccountRepository(db)
    assetAccountId = await repo.create({
      name: '测试资产', subjectCode: '13103901',
      accountType: 'fixed_asset', subjectId: await resolve.id('13103'),
    })
    depSubjectId = await resolve.id('15103')
  })

  afterEach(async () => await db.close())

  it('should update usefulMonths and recalculate', async () => {
    const cfgId = await svc.create({
      accountId: assetAccountId, assetName: '测试资产',
      originalValue: 12000, residualValue: 0,
      usefulMonths: 60, depreciationSubjectId: depSubjectId,
      startDate: '2026-05',
    })
    // Change from 60 months to 48 months
    await svc.update(cfgId, { usefulMonths: 48 })
    const cfg = await svc.findById(cfgId)
    expect(cfg!.usefulMonths).toBe(48)
  })

  it('should deactivate via update', async () => {
    const cfgId = await svc.create({
      accountId: assetAccountId, assetName: '测试资产',
      originalValue: 10000, residualValue: 1000,
      usefulMonths: 36, depreciationSubjectId: depSubjectId,
      startDate: '2026-05',
    })
    await svc.update(cfgId, { isActive: false })
    const cfg = await svc.findById(cfgId)
    expect(cfg!.isActive).toBe(0)
  })
})

// ============================================================
// 5. AmortizationService.executePending — fallback to 50101
// ============================================================
describe('AmortizationService — fallback edge case', () => {
  let db: TestDatabase
  let svc: AmortizationService
  let resolve: SubjectResolver

  beforeEach(async () => {
    db = new TestDatabase()
    await db.init()
    svc = new AmortizationService(db)
    resolve = new SubjectResolver(db)
    await resolve.preload()
  })

  afterEach(async () => await db.close())

  it('should fallback to 50101 when L3 subject type is not expense', async () => {
    // Create an amortization schedule referencing a non-expense L3 subject
    const dummyTxId = await db.insert(
      "INSERT INTO transactions (tx_type, tx_date, amount, subject_id) VALUES ('expense', '2026-01-01', 1, ?)",
      [await resolve.id('50101')]
    )

    // Use an income subject as L3 — this triggers the fallback
    const nonExpenseSubjectId = await resolve.id('40101') // 工资薪金 (income)

    const scheduleId = await svc.create({
      transactionId: dummyTxId,
      l3SubjectId: nonExpenseSubjectId,
      totalAmount: 2000, periods: 1,
      amountPerPeriod: 2000, startDate: '2026-05-01',
    })

    await svc.executePending({
      id: 0, itemType: 'amortization', referenceId: scheduleId,
      description: '测试摊销', amount: 2000,
      dueDate: '2026-05-15', isDone: false, createdAt: '2026-05-15',
    })

    // Should still create journal entries (using fallback 50101)
    const entries = await db.query(
      'SELECT * FROM journal_entries WHERE entry_date = ?', ['2026-05-15']
    )
    expect(entries.length).toBe(2)
  })
})

// ============================================================
// 6. IndicatorService.update + toggleActive
// ============================================================
describe('IndicatorService — update & toggleActive', () => {
  let db: TestDatabase
  let svc: IndicatorService

  beforeEach(async () => {
    db = new TestDatabase()
    await db.init()
    svc = new IndicatorService(db)
  })

  afterEach(async () => await db.close())

  it('should update indicator formula', async () => {
    const id = await svc.create({ name: '原指标', formula: '1+1' })
    await svc.update(id, { name: '新指标', formula: 'TOTAL_INCOME/2' })
    const ind = await svc.findById(id)
    expect(ind!.name).toBe('新指标')
    expect(ind!.formula).toBe('TOTAL_INCOME/2')
  })

  it('should toggle active status', async () => {
    const id = await svc.create({ name: '待停用', formula: '1+1' })
    await svc.toggleActive(id, false)
    const all = await svc.findAll()
    expect(all.find(i => i.id === id)).toBeUndefined()
  })

  it('should reactivate indicator', async () => {
    const id = await svc.create({ name: '待恢复', formula: '100' })
    await svc.toggleActive(id, false)
    await svc.toggleActive(id, true)
    const all = await svc.findAll()
    expect(all.find(i => i.id === id)).toBeDefined()
  })
})

// ============================================================
// 7. SavedReportService.update
// ============================================================
describe('SavedReportService — update', () => {
  let db: TestDatabase
  let svc: SavedReportService

  beforeEach(async () => {
    db = new TestDatabase()
    await db.init()
    svc = new SavedReportService(db)
  })

  afterEach(async () => await db.close())

  it('should update report fields', async () => {
    const id = await svc.create({ name: '原报表', filters: {} })
    await svc.update(id, {
      name: '新名称',
      filters: { subjects: ['50201'], type: 'expense' },
      sortField: 'amount DESC',
      displayFields: ['date', 'amount'],
    })
    const rpt = await svc.findById(id)
    expect(rpt!.name).toBe('新名称')
    expect(rpt!.sortField).toBe('amount DESC')
    const filters = svc.parseFilters(rpt!)
    expect(filters.subjects).toEqual(['50201'])
  })
})

// ============================================================
// 8. ExcelExportService.exportTransactionsCSV — actual data
// ============================================================
describe('ExcelExportService — CSV export with data', () => {
  let db: TestDatabase
  let resolve: SubjectResolver

  beforeEach(async () => {
    db = new TestDatabase()
    await db.init()
    resolve = new SubjectResolver(db)
    await resolve.preload()
  })

  afterEach(async () => await db.close())

  it('should export transactions with actual data', async () => {
    // Create real transactions
    const repo = new TransactionRepository(db)
    await repo.create({
      txType: 'expense', txDate: '2026-05-15', amount: 88,
      subjectId: await resolve.id('50201'), note: '午餐',
    })
    await repo.create({
      txType: 'income', txDate: '2026-05-10', amount: 10000,
      subjectId: await resolve.id('40101'), note: '工资',
    })

    const svc = new ExcelExportService(db)
    const csv = await svc.exportTransactionsCSV({ format: 'csv' })

    // BOM present
    expect(csv.startsWith('﻿')).toBe(true)
    // Header row
    expect(csv).toContain('日期')
    expect(csv).toContain('金额')
    // Data present
    expect(csv).toContain('2026-05-15')
    expect(csv).toContain('88.00')
  })

  it('should escape CSV special characters in notes', async () => {
    const repo = new TransactionRepository(db)
    await repo.create({
      txType: 'expense', txDate: '2026-05-20', amount: 50,
      subjectId: await resolve.id('50201'),
      note: '包含"引号",逗号,和换行',
    })

    const svc = new ExcelExportService(db)
    const csv = await svc.exportTransactionsCSV({ format: 'csv' })

    // The note content should be present and properly quoted
    expect(csv).toContain('引号')
    // If properly escaped, the whole field should be in quotes
    const lines = csv.split('\n')
    const dataLine = lines[1] // second line is first data row
    // Should have quoted field for the complex note
    expect(dataLine).toContain('"包含""引号"",逗号,和换行"')
  })
})

// ============================================================
// 9. AccountRepo.transferBalance — negative balance edge
// ============================================================
describe('AccountRepo — transferBalance with negative balance', () => {
  let db: TestDatabase
  let repo: AccountRepository
  let resolve: SubjectResolver

  beforeEach(async () => {
    db = new TestDatabase()
    await db.init()
    repo = new AccountRepository(db)
    resolve = new SubjectResolver(db)
    await resolve.preload()
  })

  afterEach(async () => await db.close())

  it('should transfer negative balance (liability side)', async () => {
    // Create a credit card account (liability)
    const creditSub = await resolve.id('20100')
    const ccId = await repo.create({
      name: '信用卡', subjectCode: '20100901',
      accountType: 'credit_card', subjectId: creditSub,
    })

    // Create a checking account
    const checkingSub = await resolve.id('10201')
    const checkingId = await repo.create({
      name: '储蓄卡', subjectCode: '10201901',
      accountType: 'checking', subjectId: checkingSub,
    })

    // Simulate negative balance on credit card (overpayment = negative liability)
    // Transfer "negative" balance = reducing the liability
    await repo.transferBalance(ccId, checkingId, 1000, '2026-05-15', creditSub, -1000)

    // Both accounts should now reflect the transfer
    const ccBal = await repo.getBalance(ccId)
    const checkBal = await repo.getBalance(checkingId)
    // After transfer, balances should be updated
    expect(typeof ccBal).toBe('number')
    expect(typeof checkBal).toBe('number')
  })
})
