import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { TestDatabase } from './setup'
import { BalanceCalculator } from '@/services/balance-calculator'
import { SubjectResolver } from '@/services/subject-resolver'
import { AccountRepository } from '@/repositories/account-repo'

describe('BalanceCalculator', () => {
  let db: TestDatabase
  let calc: BalanceCalculator
  let resolve: SubjectResolver
  let accountId: number

  beforeEach(async () => {
    db = new TestDatabase()
    await db.init()
    calc = new BalanceCalculator(db)
    resolve = new SubjectResolver(db)
    await resolve.preload()

    const repo = new AccountRepository(db)
    const checking = await resolve.id('10201')
    accountId = await repo.create({
      name: '测试卡', subjectCode: '10201901',
      accountType: 'checking', subjectId: checking,
    })
  })

  afterEach(async () => await db.close())

  it('should return balances for all subjects', async () => {
    const balances = await calc.calculate(2026, 5)
    expect(balances.length).toBeGreaterThan(50)
    // Every balance should have required fields
    for (const b of balances) {
      expect(b.subjectId).toBeGreaterThan(0)
      expect(typeof b.subjectName).toBe('string')
      expect(typeof b.closingBalance).toBe('number')
    }
  })

  it('should compute opening balance from entries before period', async () => {
    const expenseId = await resolve.id('50101')

    // Insert a journal entry before May 2026
    await db.insert(
      `INSERT INTO transactions (tx_type, tx_date, amount, subject_id, account_id)
       VALUES ('expense', '2026-04-15', 100, ?, ?)`,
      [expenseId, accountId]
    )
    const txId = (await db.queryOne<{id: number}>('SELECT last_insert_rowid() as id'))!.id
    await db.insert(
      `INSERT INTO journal_entries (transaction_id, subject_id, direction, amount, entry_date)
       VALUES (?, ?, 'debit', 100, '2026-04-15')`,
      [txId, expenseId]
    )
    await db.insert(
      `INSERT INTO journal_entries (transaction_id, subject_id, direction, amount, entry_date)
       VALUES (?, ?, 'credit', 100, '2026-04-15')`,
      [txId, await resolve.id('10201')]
    )

    const balances = await calc.calculate(2026, 5)
    const expense = balances.find(b => b.subjectId === expenseId)
    expect(expense).toBeDefined()
    expect(expense!.openingBalance).toBe(100)
  })

  it('should show zero period activity when no entries in month', async () => {
    const incomeId = await resolve.id('40101')
    const balances = await calc.calculate(2026, 5)
    const income = balances.find(b => b.subjectId === incomeId)
    expect(income).toBeDefined()
    expect(income!.debitAmount).toBe(0)
    expect(income!.creditAmount).toBe(0)
  })

  it('should compute period debit and credit separately', async () => {
    const incomeId = await resolve.id('40101')
    const assetId = await resolve.id('10201')

    await db.insert(
      `INSERT INTO transactions (tx_type, tx_date, amount, subject_id, account_id)
       VALUES ('income', '2026-05-10', 500, ?, ?)`,
      [incomeId, accountId]
    )
    const txId = (await db.queryOne<{id: number}>('SELECT last_insert_rowid() as id'))!.id
    await db.insert(
      `INSERT INTO journal_entries (transaction_id, subject_id, direction, amount, entry_date)
       VALUES (?, ?, 'credit', 500, '2026-05-10')`,
      [txId, incomeId]
    )
    await db.insert(
      `INSERT INTO journal_entries (transaction_id, subject_id, direction, amount, entry_date)
       VALUES (?, ?, 'debit', 500, '2026-05-10')`,
      [txId, assetId]
    )

    const balances = await calc.calculate(2026, 5)
    const income = balances.find(b => b.subjectId === incomeId)
    expect(income!.creditAmount).toBe(500)
    expect(income!.debitAmount).toBe(0)
    expect(income!.closingBalance).toBe(500)
  })

  it('should handle credit-normal subjects (income/liability/equity)', async () => {
    const equityId = await resolve.id('30100')
    const assetId = await resolve.id('10201')

    // Create a positive net equity scenario
    await db.insert(
      `INSERT INTO transactions (tx_type, tx_date, amount, subject_id, account_id)
       VALUES ('income', '2026-04-15', 10000, ?, ?)`,
      [equityId, accountId]
    )
    const txId = (await db.queryOne<{id: number}>('SELECT last_insert_rowid() as id'))!.id
    // Credit equity (net worth is positive)
    await db.insert(
      `INSERT INTO journal_entries (transaction_id, subject_id, direction, amount, entry_date)
       VALUES (?, ?, 'debit', 10000, '2026-04-15')`,
      [txId, assetId]
    )
    await db.insert(
      `INSERT INTO journal_entries (transaction_id, subject_id, direction, amount, entry_date)
       VALUES (?, ?, 'credit', 10000, '2026-04-15')`,
      [txId, equityId]
    )

    const balances = await calc.calculate(2026, 5)
    const equity = balances.find(b => b.subjectId === equityId)
    // Equity is credit-normal — should show as positive
    expect(equity!.openingBalance).toBe(10000)
  })

  it('should exclude entries after period end', async () => {
    const expenseId = await resolve.id('50101')
    const assetId = await resolve.id('10201')

    // Entry in June (after May period)
    await db.insert(
      `INSERT INTO transactions (tx_type, tx_date, amount, subject_id, account_id)
       VALUES ('expense', '2026-06-05', 200, ?, ?)`,
      [expenseId, accountId]
    )
    const txId = (await db.queryOne<{id: number}>('SELECT last_insert_rowid() as id'))!.id
    await db.insert(
      `INSERT INTO journal_entries (transaction_id, subject_id, direction, amount, entry_date)
       VALUES (?, ?, 'debit', 200, '2026-06-05')`,
      [txId, expenseId]
    )
    await db.insert(
      `INSERT INTO journal_entries (transaction_id, subject_id, direction, amount, entry_date)
       VALUES (?, ?, 'credit', 200, '2026-06-05')`,
      [txId, assetId]
    )

    const balances = await calc.calculate(2026, 5)
    const expense = balances.find(b => b.subjectId === expenseId)
    expect(expense!.debitAmount).toBe(0) // Not in May
    expect(expense!.creditAmount).toBe(0)
  })

  it('should handle year boundary (December → January)', async () => {
    const expenseId = await resolve.id('50101')
    const assetId = await resolve.id('10201')

    await db.insert(
      `INSERT INTO transactions (tx_type, tx_date, amount, subject_id, account_id)
       VALUES ('expense', '2025-12-20', 300, ?, ?)`,
      [expenseId, accountId]
    )
    const txId = (await db.queryOne<{id: number}>('SELECT last_insert_rowid() as id'))!.id
    await db.insert(
      `INSERT INTO journal_entries (transaction_id, subject_id, direction, amount, entry_date)
       VALUES (?, ?, 'debit', 300, '2025-12-20')`,
      [txId, expenseId]
    )
    await db.insert(
      `INSERT INTO journal_entries (transaction_id, subject_id, direction, amount, entry_date)
       VALUES (?, ?, 'credit', 300, '2025-12-20')`,
      [txId, assetId]
    )

    // January 2026 — December 2025 should be in opening balance
    const balances = await calc.calculate(2026, 1)
    const expense = balances.find(b => b.subjectId === expenseId)
    expect(expense!.openingBalance).toBe(300)
    expect(expense!.debitAmount).toBe(0)
  })
})
