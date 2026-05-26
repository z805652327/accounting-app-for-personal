import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { TestDatabase } from './setup'
import { TransactionRepository } from '@/repositories/transaction-repo'
import { SubjectRepository } from '@/repositories/subject-repo'
import { AccountRepository } from '@/repositories/account-repo'
import { SubjectResolver } from '@/services/subject-resolver'

describe('TransactionRepository — archive lock & soft delete', () => {
  let db: TestDatabase
  let repo: TransactionRepository
  let createdTxId: number

  beforeEach(async () => {
    db = new TestDatabase()
    await db.init()
    repo = new TransactionRepository(db)

    // Create a test account first
    const accountRepo = new AccountRepository(db)
    const resolve = new SubjectResolver(db)
    await resolve.preload()
    const checkingSubject = await resolve.id('10201')
    const code = await accountRepo.getNextSubjectCode(checkingSubject)
    await accountRepo.create({
      name: '测试账户',
      subjectCode: code,
      accountType: 'checking',
      subjectId: checkingSubject,
    })

    // Create a test transaction
    const expenseSubject = await resolve.id('50101')
    createdTxId = await repo.create({
      txType: 'expense',
      txDate: '2026-05-15',
      amount: 100,
      subjectId: expenseSubject,
      note: '测试交易',
    })
  })

  afterEach(async () => {
    await db.close()
  })

  // === Archive lock tests ===
  describe('archive lock', () => {
    it('should prevent updating an archived transaction', async () => {
      await db.execute(
        'UPDATE transactions SET archived = 1 WHERE id = ?',
        [createdTxId]
      )
      await expect(
        repo.update(createdTxId, { amount: 200 })
      ).rejects.toThrow('已归档的交易无法修改')
    })

    it('should prevent soft-deleting an archived transaction', async () => {
      await db.execute(
        'UPDATE transactions SET archived = 1 WHERE id = ?',
        [createdTxId]
      )
      await expect(
        repo.softDelete(createdTxId)
      ).rejects.toThrow('已归档的交易无法删除')
    })

    it('should allow updating a non-archived transaction', async () => {
      await repo.update(createdTxId, { amount: 200 })
      const tx = await repo.findById(createdTxId)
      expect(tx?.amount).toBe(200)
    })

    it('should prevent updating a soft-deleted transaction', async () => {
      await repo.softDelete(createdTxId)
      await expect(
        repo.update(createdTxId, { amount: 200 })
      ).rejects.toThrow('已删除的交易无法修改')
    })
  })

  // === Soft delete tests ===
  describe('soft delete', () => {
    it('should mark is_deleted = 1', async () => {
      await repo.softDelete(createdTxId)
      const tx = await repo.findById(createdTxId)
      expect(tx?.isDeleted).toBe(1)
    })

    it('should exclude deleted transactions from findDetails', async () => {
      await repo.softDelete(createdTxId)
      const results = await repo.findDetails({})
      expect(results.find(r => r.id === createdTxId)).toBeUndefined()
    })

    it('should prevent double soft-delete', async () => {
      await repo.softDelete(createdTxId)
      await expect(
        repo.softDelete(createdTxId)
      ).rejects.toThrow('交易已被删除')
    })

    it('should restore a soft-deleted transaction', async () => {
      await repo.softDelete(createdTxId)
      await repo.restore(createdTxId)
      const tx = await repo.findById(createdTxId)
      expect(tx?.isDeleted).toBe(0)

      const results = await repo.findDetails({})
      expect(results.find(r => r.id === createdTxId)).toBeDefined()
    })

    it('should show restored transactions in findDeleted result', async () => {
      await repo.softDelete(createdTxId)
      const deleted = await repo.findDeleted()
      expect(deleted.find(d => d.id === createdTxId)).toBeDefined()
    })

    it('should throw when restoring a non-deleted transaction', async () => {
      await expect(
        repo.restore(createdTxId)
      ).rejects.toThrow('该交易未被删除')
    })
  })

  // === Permanent delete tests ===
  describe('permanent delete', () => {
    it('should physically remove the transaction', async () => {
      await repo.softDelete(createdTxId)
      await repo.permanentDelete(createdTxId)
      const tx = await repo.findById(createdTxId)
      expect(tx).toBeNull()
    })

    it('should cascade delete journal entries', async () => {
      // Insert mock journal entries
      await db.execute(
        `INSERT INTO journal_entries (transaction_id, subject_id, direction, amount, entry_date)
         VALUES (?, 1, 'debit', 100, '2026-05-15')`,
        [createdTxId]
      )
      await repo.permanentDelete(createdTxId)

      const entries = await db.query(
        'SELECT id FROM journal_entries WHERE transaction_id = ?',
        [createdTxId]
      )
      expect(entries.length).toBe(0)
    })
  })

  // === Purge expired tests ===
  describe('purge expired', () => {
    it('should purge transactions deleted more than 30 days ago', async () => {
      // Create an old transaction
      const oldTxId = await repo.create({
        txType: 'expense',
        txDate: '2025-01-01',
        amount: 50,
        subjectId: 1,
      })
      await repo.softDelete(oldTxId)

      const purged = await repo.purgeExpired()
      expect(purged).toBe(1)
      expect(await repo.findById(oldTxId)).toBeNull()
    })

    it('should keep transactions deleted less than 30 days ago', async () => {
      await repo.softDelete(createdTxId) // txDate is 2026-05-15

      const purged = await repo.purgeExpired()
      expect(purged).toBe(0)
      expect(await repo.findById(createdTxId)).not.toBeNull()
    })
  })

  // === Edge case: non-existent transaction ===
  describe('edge cases', () => {
    it('should throw when updating non-existent transaction', async () => {
      await expect(
        repo.update(99999, { amount: 200 })
      ).rejects.toThrow('交易不存在')
    })

    it('should throw when soft-deleting non-existent transaction', async () => {
      await expect(
        repo.softDelete(99999)
      ).rejects.toThrow('交易不存在')
    })

    it('should throw when restoring non-existent transaction', async () => {
      await expect(
        repo.restore(99999)
      ).rejects.toThrow('交易不存在')
    })
  })
})

describe('TransactionRepository — transaction operations', () => {
  let db: TestDatabase
  let repo: TransactionRepository

  beforeEach(async () => {
    db = new TestDatabase()
    await db.init()
    repo = new TransactionRepository(db)
  })

  afterEach(async () => {
    await db.close()
  })

  it('should create a transaction and return its ID', async () => {
    const id = await repo.create({
      txType: 'expense',
      txDate: '2026-05-20',
      amount: 50,
      subjectId: 1,
      note: '午餐',
    })
    expect(id).toBeGreaterThan(0)

    const tx = await repo.findById(id)
    expect(tx).not.toBeNull()
    expect(tx!.txType).toBe('expense')
    expect(tx!.amount).toBe(50)
  })

  it('should filter by date range', async () => {
    await repo.create({ txType: 'expense', txDate: '2026-01-01', amount: 10, subjectId: 1 })
    await repo.create({ txType: 'expense', txDate: '2026-06-01', amount: 20, subjectId: 1 })
    await repo.create({ txType: 'expense', txDate: '2026-12-01', amount: 30, subjectId: 1 })

    const results = await repo.findDetails({
      startDate: '2026-03-01',
      endDate: '2026-09-01',
    })
    expect(results.length).toBe(1)
    expect(results[0].amount).toBe(20)
  })

  it('should filter by transaction type', async () => {
    await repo.create({ txType: 'income', txDate: '2026-05-01', amount: 100, subjectId: 1 })
    await repo.create({ txType: 'expense', txDate: '2026-05-01', amount: 50, subjectId: 1 })
    await repo.create({ txType: 'expense', txDate: '2026-05-01', amount: 30, subjectId: 1 })

    const results = await repo.findDetails({ txType: 'expense' })
    expect(results.length).toBe(2)
  })
})
