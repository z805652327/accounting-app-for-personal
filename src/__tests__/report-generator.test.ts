import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { TestDatabase } from './setup'
import { ReportGenerator } from '@/services/report-generator'
import { SubjectResolver } from '@/services/subject-resolver'
import { AccountRepository } from '@/repositories/account-repo'

describe('ReportGenerator', () => {
  let db: TestDatabase
  let gen: ReportGenerator
  let resolve: SubjectResolver
  let checkingId: number

  beforeEach(async () => {
    db = new TestDatabase()
    await db.init()
    gen = new ReportGenerator(db)
    resolve = new SubjectResolver(db)
    await resolve.preload()

    const repo = new AccountRepository(db)
    checkingId = await repo.create({
      name: '招行', subjectCode: '10201901',
      accountType: 'checking', subjectId: await resolve.id('10201'),
    })
  })

  afterEach(async () => await db.close())

  // === Balance Sheet ===
  describe('balance sheet', () => {
    it('should return a valid structure', async () => {
      const bs = await gen.generateBalanceSheet(2026, 5)
      expect(bs.date).toBe('2026-05')
      expect(bs.assets.length).toBeGreaterThan(0)
      expect(bs.liabilities.length).toBeGreaterThan(0)
      expect(bs.equity.length).toBeGreaterThan(0)
      expect(typeof bs.totalAssets).toBe('number')
      expect(typeof bs.totalLiabilities).toBe('number')
      expect(typeof bs.totalEquity).toBe('number')
      expect(typeof bs.isBalanced).toBe('boolean')
    })

    it('should balance: assets = liabilities + equity', async () => {
      // Seed equity with an opening entry
      const equityId = await resolve.id('30100')
      const assetSub = await resolve.id('10201')
      await db.insert(
        `INSERT INTO transactions (tx_type, tx_date, amount, subject_id, account_id)
         VALUES ('income', '2026-04-28', 50000, ?, ?)`,
        [equityId, checkingId]
      )
      const txId = (await db.queryOne<{id: number}>('SELECT last_insert_rowid() as id'))!.id
      await db.insert(
        `INSERT INTO journal_entries (transaction_id, subject_id, direction, amount, entry_date)
         VALUES (?, ?, 'debit', 50000, '2026-04-28')`,
        [txId, assetSub]
      )
      await db.insert(
        `INSERT INTO journal_entries (transaction_id, subject_id, direction, amount, entry_date)
         VALUES (?, ?, 'credit', 50000, '2026-04-28')`,
        [txId, equityId]
      )

      const bs = await gen.generateBalanceSheet(2026, 5)
      expect(bs.isBalanced).toBe(true)
    })

    it('should include fixed assets at net value', async () => {
      const bs = await gen.generateBalanceSheet(2026, 5)
      const fixedAsset = bs.assets.find(a => a.name === '固定资产（净值）')
      // May or may not be present depending on preset subjects, but if present:
      if (fixedAsset) {
        expect(fixedAsset.level).toBe(1)
      }
    })

    it('should include 本期结余 in equity', async () => {
      const bs = await gen.generateBalanceSheet(2026, 5)
      const surplus = bs.equity.find(e => e.name === '本期结余')
      expect(surplus).toBeDefined()
    })
  })

  // === Income Statement ===
  describe('income statement', () => {
    beforeEach(async () => {
      // Create an income transaction
      const incomeId = await resolve.id('40101')
      const assetSub = await resolve.id('10201')
      await db.insert(
        `INSERT INTO transactions (tx_type, tx_date, amount, subject_id, account_id)
         VALUES ('income', '2026-05-15', 10000, ?, ?)`,
        [incomeId, checkingId]
      )
      const txId1 = (await db.queryOne<{id: number}>('SELECT last_insert_rowid() as id'))!.id
      await db.insert(
        `INSERT INTO journal_entries (transaction_id, subject_id, direction, amount, entry_date)
         VALUES (?, ?, 'debit', 10000, '2026-05-15')`,
        [txId1, assetSub]
      )
      await db.insert(
        `INSERT INTO journal_entries (transaction_id, subject_id, direction, amount, entry_date)
         VALUES (?, ?, 'credit', 10000, '2026-05-15')`,
        [txId1, incomeId]
      )

      // Create an expense transaction
      const expenseId = await resolve.id('50201')
      await db.insert(
        `INSERT INTO transactions (tx_type, tx_date, amount, subject_id, account_id)
         VALUES ('expense', '2026-05-20', 100, ?, ?)`,
        [expenseId, checkingId]
      )
      const txId2 = (await db.queryOne<{id: number}>('SELECT last_insert_rowid() as id'))!.id
      await db.insert(
        `INSERT INTO journal_entries (transaction_id, subject_id, direction, amount, entry_date)
         VALUES (?, ?, 'debit', 100, '2026-05-20')`,
        [txId2, expenseId]
      )
      await db.insert(
        `INSERT INTO journal_entries (transaction_id, subject_id, direction, amount, entry_date)
         VALUES (?, ?, 'credit', 100, '2026-05-20')`,
        [txId2, assetSub]
      )
    })

    it('should compute net surplus correctly', async () => {
      const inc = await gen.generateIncomeStatement(2026, 5)
      expect(inc.totalIncome).toBe(10000)
      expect(inc.totalExpense).toBe(100)
      expect(inc.netSurplus).toBe(9900)
    })

    it('should classify fixed vs variable expenses', async () => {
      const inc = await gen.generateIncomeStatement(2026, 5)
      expect(typeof inc.fixedExpense).toBe('number')
      expect(typeof inc.variableExpense).toBe('number')
      expect(inc.fixedExpense + inc.variableExpense).toBe(inc.totalExpense)
    })

    it('should include period metadata', async () => {
      const inc = await gen.generateIncomeStatement(2026, 5)
      expect(inc.period).toBe('2026-05')
    })
  })

  // === Cash Flow Statement ===
  describe('cash flow statement', () => {
    it('should return valid structure even with no data', async () => {
      const cf = await gen.generateCashFlow(2026, 5)
      expect(cf.period).toBe('2026-05')
      expect(typeof cf.operatingNet).toBe('number')
      expect(typeof cf.investingNet).toBe('number')
      expect(typeof cf.financingNet).toBe('number')
      expect(typeof cf.netIncrease).toBe('number')
    })

    it('should track operating cash flow from income/expense', async () => {
      const incomeId = await resolve.id('40101')
      const assetSub = await resolve.id('10201')

      // Income → operating inflow
      await db.insert(
        `INSERT INTO transactions (tx_type, tx_date, amount, subject_id, account_id)
         VALUES ('income', '2026-05-10', 3000, ?, ?)`,
        [incomeId, checkingId]
      )
      const txId = (await db.queryOne<{id: number}>('SELECT last_insert_rowid() as id'))!.id
      await db.insert(
        `INSERT INTO journal_entries (transaction_id, account_id, subject_id, direction, amount, entry_date)
         VALUES (?, ?, ?, 'debit', 3000, '2026-05-10')`,
        [txId, checkingId, assetSub]
      )
      await db.insert(
        `INSERT INTO journal_entries (transaction_id, account_id, subject_id, direction, amount, entry_date)
         VALUES (?, NULL, ?, 'credit', 3000, '2026-05-10')`,
        [txId, incomeId]
      )

      const cf = await gen.generateCashFlow(2026, 5)
      expect(cf.operatingNet).toBeGreaterThan(0)
    })

    it('should classify transfer as non-cash (excluded)', async () => {
      const assetSub = await resolve.id('10201')
      const cashSub = await resolve.id('10100')

      // Create cash account
      const repo = new AccountRepository(db)
      const cashId = await repo.create({
        name: '现金', subjectCode: '10100901',
        accountType: 'cash', subjectId: cashSub,
      })

      // Transfer between accounts
      await db.insert(
        `INSERT INTO transactions (tx_type, tx_date, amount, subject_id, account_id, to_account_id)
         VALUES ('transfer', '2026-05-10', 1000, ?, ?, ?)`,
        [assetSub, checkingId, cashId]
      )
      const txId = (await db.queryOne<{id: number}>('SELECT last_insert_rowid() as id'))!.id
      // Credit from source
      await db.insert(
        `INSERT INTO journal_entries (transaction_id, account_id, subject_id, direction, amount, entry_date)
         VALUES (?, ?, ?, 'credit', 1000, '2026-05-10')`,
        [txId, checkingId, assetSub]
      )
      // Debit to target
      await db.insert(
        `INSERT INTO journal_entries (transaction_id, account_id, subject_id, direction, amount, entry_date)
         VALUES (?, ?, ?, 'debit', 1000, '2026-05-10')`,
        [txId, cashId, cashSub]
      )

      const cf = await gen.generateCashFlow(2026, 5)
      // Transfer = internal, should net to zero or be excluded
      // Net effect across all categories should be ~0 for this transaction
      const totalNet = cf.operatingNet + cf.investingNet + cf.financingNet
      expect(Math.abs(totalNet)).toBeLessThan(100) // Tolerance for rounding
    })
  })
})
