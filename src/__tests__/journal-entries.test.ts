import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { TestDatabase } from './setup'
import { JournalEntryBuilder } from '@/services/journal-entry-builder'
import { SubjectResolver } from '@/services/subject-resolver'
import { AccountRepository } from '@/repositories/account-repo'

describe('JournalEntryBuilder', () => {
  let db: TestDatabase
  let builder: JournalEntryBuilder
  let resolve: SubjectResolver
  let checkingAccountId: number
  let creditCardId: number
  let investmentAccountId: number
  let fixedAssetAccountId: number

  beforeEach(async () => {
    db = new TestDatabase()
    await db.init()
    builder = new JournalEntryBuilder(db)
    resolve = new SubjectResolver(db)
    await resolve.preload()

    // Create test accounts
    const accountRepo = new AccountRepository(db)

    const checkingSubject = await resolve.id('10201')
    checkingAccountId = await accountRepo.create({
      name: '招商银行', subjectCode: '10201001',
      accountType: 'checking', subjectId: checkingSubject,
    })

    const creditSubject = await resolve.id('20100')
    creditCardId = await accountRepo.create({
      name: '招商信用卡', subjectCode: '20100001',
      accountType: 'credit_card', subjectId: creditSubject,
    })

    const investSubject = await resolve.id('12101')
    investmentAccountId = await accountRepo.create({
      name: '贵州茅台', subjectCode: '12101001',
      accountType: 'investment', subjectId: investSubject,
      notes: '600519',
    })

    const assetSubject = await resolve.id('13103')
    fixedAssetAccountId = await accountRepo.create({
      name: '联想笔记本', subjectCode: '13103001',
      accountType: 'fixed_asset', subjectId: assetSubject,
    })
  })

  afterEach(async () => {
    await db.close()
  })

  // === Income ===
  describe('income', () => {
    it('should create Dr cash + Cr income entries', async () => {
      const incomeSubject = await resolve.id('40101')
      const result = await builder.process({
        txType: 'income', txDate: '2026-05-20', amount: 1000,
        subjectId: incomeSubject, accountId: checkingAccountId,
      })
      expect(result.transactionId).toBeGreaterThan(0)
      expect(result.entries.length).toBe(2)

      const dr = result.entries.find(e => e.direction === 'debit')!
      expect(dr.accountId).toBe(checkingAccountId)
      expect(dr.amount).toBe(1000)

      const cr = result.entries.find(e => e.direction === 'credit')!
      expect(cr.subjectId).toBe(incomeSubject)
      expect(cr.amount).toBe(1000)
    })
  })

  // === Expense ===
  describe('expense', () => {
    it('should create Dr expense + Cr cash entries', async () => {
      const expenseSubject = await resolve.id('50201')
      const result = await builder.process({
        txType: 'expense', txDate: '2026-05-20', amount: 50,
        subjectId: expenseSubject, accountId: checkingAccountId,
      })
      expect(result.entries.length).toBe(2)

      const dr = result.entries.find(e => e.direction === 'debit')!
      expect(dr.subjectId).toBe(expenseSubject)
      expect(dr.amount).toBe(50)

      const cr = result.entries.find(e => e.direction === 'credit')!
      expect(cr.accountId).toBe(checkingAccountId)
      expect(cr.amount).toBe(50)
    })
  })

  // === Transfer ===
  describe('transfer', () => {
    it('should create Dr target + Cr source entries', async () => {
      // Create second account
      const accountRepo = new AccountRepository(db)
      const cashSubject = await resolve.id('10100')
      const cashAccountId = await accountRepo.create({
        name: '现金', subjectCode: '10100001',
        accountType: 'cash', subjectId: cashSubject,
      })

      const transferSubject = await resolve.id('10201')
      const result = await builder.process({
        txType: 'transfer', txDate: '2026-05-20', amount: 500,
        subjectId: transferSubject, accountId: checkingAccountId, toAccountId: cashAccountId,
      })
      expect(result.entries.length).toBe(2)

      const dr = result.entries.find(e => e.direction === 'debit')!
      expect(dr.accountId).toBe(cashAccountId)

      const cr = result.entries.find(e => e.direction === 'credit')!
      expect(cr.accountId).toBe(checkingAccountId)
    })
  })

  // === Salary ===
  describe('salary', () => {
    it('should split gross salary into net pay + tax + social', async () => {
      const salarySubject = await resolve.id('40101')
      const result = await builder.process({
        txType: 'salary', txDate: '2026-05-20', amount: 7660,
        subjectId: salarySubject, accountId: checkingAccountId,
        grossAmount: 10000, taxAmount: 90, socialAmount: 2250,
      })
      // Dr cash(7660) + Dr tax(90) + Dr social(2250) → Cr salary(10000) = 4 entries
      expect(result.entries.length).toBe(4)

      const netDr = result.entries.find(e =>
        e.direction === 'debit' && e.accountId === checkingAccountId
      )!
      expect(netDr.amount).toBe(7660)

      const salaryCr = result.entries.find(e =>
        e.direction === 'credit' && e.subjectId === salarySubject
      )!
      expect(salaryCr.amount).toBe(10000)
    })
  })

  // === Investment Buy ===
  describe('investment buy', () => {
    it('should create Dr investment + Cr cash + investment lot', async () => {
      const investSubject = await resolve.id('12101')
      const result = await builder.process({
        txType: 'investment_buy', txDate: '2026-05-20', amount: 10000,
        subjectId: investSubject, accountId: checkingAccountId,
        l3SubjectId: investmentAccountId, quantity: 100, unitPrice: 100,
      })
      expect(result.entries.length).toBe(2)

      // Verify investment lot was created
      const lots = await db.query(
        'SELECT * FROM investment_lots WHERE l3_subject_id = ?',
        [investmentAccountId]
      )
      expect(lots.length).toBe(1)
    })
  })

  // === Investment Sell ===
  describe('investment sell', () => {
    it('should create Dr cash + Cr investment + Cr gain entries', async () => {
      const investSubject = await resolve.id('12101')

      // First buy
      await builder.process({
        txType: 'investment_buy', txDate: '2026-01-15', amount: 10000,
        subjectId: investSubject, accountId: checkingAccountId,
        l3SubjectId: investmentAccountId, quantity: 100, unitPrice: 100,
      })

      // Then sell at profit
      const result = await builder.process({
        txType: 'investment_sell', txDate: '2026-05-20', amount: 15000,
        subjectId: investSubject, accountId: checkingAccountId,
        l3SubjectId: investmentAccountId, quantity: 100,
      })
      // Dr cash(15000) + Cr investment(10000) + Cr gain(5000) = 3 entries
      const gainEntry = result.entries.find(e =>
        e.direction === 'credit' && e.subjectId !== investSubject && e.amount === 5000
      )
      expect(gainEntry).toBeDefined()
    })
  })

  // === Credit Card Spend ===
  describe('credit card spend', () => {
    it('should debit expense and credit credit card liability', async () => {
      const expenseSubject = await resolve.id('50201')
      const result = await builder.process({
        txType: 'credit_card_spend', txDate: '2026-05-20', amount: 200,
        subjectId: expenseSubject, accountId: creditCardId,
      })

      const cr = result.entries.find(e => e.direction === 'credit')!
      expect(cr.accountId).toBe(creditCardId)
      // Should credit 信用卡欠款(20100)
      const creditSubject = await resolve.id('20100')
      expect(cr.subjectId).toBe(creditSubject)
    })
  })

  // === Prepaid Amortize ===
  describe('prepaid amortize', () => {
    it('should split payment into expense + prepaid + deposit', async () => {
      const rentSubject = await resolve.id('50101')
      const result = await builder.process({
        txType: 'prepaid_amortize', txDate: '2026-05-20', amount: 8000,
        subjectId: rentSubject, accountId: checkingAccountId,
        depositAmount: 2000, prepaidAmount: 4000,
      })
      // Dr expense(2000) + Dr prepaid(4000) + Dr deposit(2000) → Cr cash(8000) = 4 entries
      expect(result.entries.length).toBe(4)

      const expenseDr = result.entries.find(e =>
        e.direction === 'debit' && e.subjectId === rentSubject && e.amount === 2000
      )
      expect(expenseDr).toBeDefined()
    })
  })

  // === Asset Purchase with depreciation ===
  describe('asset purchase', () => {
    it('should create asset entry and depreciation config', async () => {
      const assetSubject = await resolve.id('13103')
      const result = await builder.process({
        txType: 'asset_purchase', txDate: '2026-05-20', amount: 10000,
        subjectId: assetSubject, accountId: checkingAccountId,
        l3SubjectId: fixedAssetAccountId,
        depreciationMonths: 36, residualValue: 1000,
        note: '联想笔记本',
      })
      expect(result.entries.length).toBe(2)

      const configs = await db.query(
        'SELECT * FROM depreciation_configs WHERE account_id = ?',
        [fixedAssetAccountId]
      )
      expect(configs.length).toBe(1)
    })
  })

  // === Ledger balance check ===
  describe('ledger balance', () => {
    it('should maintain debit = credit for all transaction types', async () => {
      const testCases = [
        async () => {
          const sub = await resolve.id('40101')
          return builder.process({
            txType: 'income', txDate: '2026-05-20', amount: 1000,
            subjectId: sub, accountId: checkingAccountId,
          })
        },
        async () => {
          const sub = await resolve.id('50201')
          return builder.process({
            txType: 'expense', txDate: '2026-05-20', amount: 100,
            subjectId: sub, accountId: checkingAccountId,
          })
        },
        async () => {
          const sub = await resolve.id('40101')
          return builder.process({
            txType: 'salary', txDate: '2026-05-20', amount: 7660,
            subjectId: sub, accountId: checkingAccountId,
            grossAmount: 10000, taxAmount: 90, socialAmount: 2250,
          })
        },
      ]

      for (const tc of testCases) {
        const result = await tc()
        const totalDr = result.entries
          .filter(e => e.direction === 'debit')
          .reduce((s, e) => s + e.amount, 0)
        const totalCr = result.entries
          .filter(e => e.direction === 'credit')
          .reduce((s, e) => s + e.amount, 0)
        expect(Math.abs(totalDr - totalCr)).toBeLessThan(0.01)
      }
    })
  })
})
