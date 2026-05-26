import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { TestDatabase } from './setup'
import { RecurringService } from '@/services/recurring.service'
import { SubjectResolver } from '@/services/subject-resolver'
import { AccountRepository } from '@/repositories/account-repo'

describe('RecurringService', () => {
  let db: TestDatabase
  let svc: RecurringService
  let resolve: SubjectResolver
  let accountId: number
  let expenseSubjectId: number
  let incomeSubjectId: number

  beforeEach(async () => {
    db = new TestDatabase()
    await db.init()
    svc = new RecurringService(db)
    resolve = new SubjectResolver(db)
    await resolve.preload()

    const accountRepo = new AccountRepository(db)
    const checkingSub = await resolve.id('10201')
    accountId = await accountRepo.create({
      name: '测试账户', subjectCode: '10201999',
      accountType: 'checking', subjectId: checkingSub,
    })

    expenseSubjectId = await resolve.id('50101')
    incomeSubjectId = await resolve.id('40101')
  })

  afterEach(async () => {
    await db.close()
  })

  describe('CRUD', () => {
    it('should create a recurring rule', async () => {
      const id = await svc.create({
        name: '每月房租', txType: 'expense', amount: 3000,
        subjectId: expenseSubjectId, accountId,
        frequency: 'monthly', startDate: '2026-01-15',
      })
      expect(id).toBeGreaterThan(0)

      const rule = await svc.findById(id)
      expect(rule).not.toBeNull()
      expect(rule!.name).toBe('每月房租')
      expect(rule!.frequency).toBe('monthly')
    })

    it('should list all active rules', async () => {
      await svc.create({
        name: '房租', txType: 'expense', amount: 3000,
        subjectId: expenseSubjectId, accountId,
        frequency: 'monthly', startDate: '2026-01-01',
      })
      await svc.create({
        name: '工资', txType: 'income', amount: 10000,
        subjectId: incomeSubjectId, accountId,
        frequency: 'monthly', startDate: '2026-01-01',
      })

      const rules = await svc.findAll()
      expect(rules.length).toBe(2)
    })

    it('should toggle active status', async () => {
      const id = await svc.create({
        name: '房租', txType: 'expense', amount: 3000,
        subjectId: expenseSubjectId, accountId,
        frequency: 'monthly', startDate: '2026-01-01',
      })
      await svc.toggleActive(id, false)
      const rule = await svc.findById(id)
      expect(rule?.isActive).toBe(0)

      // Should not appear in findAll (which filters active only)
      const rules = await svc.findAll()
      expect(rules.find(r => r.id === id)).toBeUndefined()
    })

    it('should update rule fields', async () => {
      const id = await svc.create({
        name: '旧名称', txType: 'expense', amount: 1000,
        subjectId: expenseSubjectId, accountId,
        frequency: 'monthly', startDate: '2026-01-01',
      })
      await svc.update(id, { name: '新名称', amount: 2000 })
      const rule = await svc.findById(id)
      expect(rule?.name).toBe('新名称')
      expect(rule?.amount).toBe(2000)
    })

    it('should delete a rule', async () => {
      const id = await svc.create({
        name: '待删除', txType: 'expense', amount: 100,
        subjectId: expenseSubjectId, accountId,
        frequency: 'monthly', startDate: '2026-01-01',
      })
      await svc.delete(id)
      const rule = await svc.findById(id)
      expect(rule).toBeNull()
    })
  })

  describe('pending items generation', () => {
    it('should generate pending items for due monthly rules', async () => {
      // Create a rule that started 2 months ago
      const today = new Date()
      const twoMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 2, 15)
      const startDate = twoMonthsAgo.toISOString().slice(0, 10)

      await svc.create({
        name: '月度房租', txType: 'expense', amount: 3000,
        subjectId: expenseSubjectId, accountId,
        frequency: 'monthly', startDate,
      })

      const items = await svc.generatePendingItems()
      // Should have at least this month's due item
      const relevantItems = items.filter(i => i.itemType === 'recurring' && i.description.includes('月度房租'))
      expect(relevantItems.length).toBeGreaterThan(0)
    })

    it('should not generate for future start dates', async () => {
      await svc.create({
        name: '将来的规则', txType: 'expense', amount: 1000,
        subjectId: expenseSubjectId, accountId,
        frequency: 'monthly', startDate: '2027-06-01',
      })
      const items = await svc.generatePendingItems()
      const relevant = items.filter(i => i.description.includes('将来的规则'))
      expect(relevant.length).toBe(0)
    })

    it('should not generate for expired rules with end date passed', async () => {
      await svc.create({
        name: '已过期', txType: 'expense', amount: 1000,
        subjectId: expenseSubjectId, accountId,
        frequency: 'monthly', startDate: '2025-01-01', endDate: '2025-12-31',
      })
      const items = await svc.generatePendingItems()
      const relevant = items.filter(i => i.description.includes('已过期'))
      expect(relevant.length).toBe(0)
    })

    it('should handle quarterly frequency', async () => {
      const today = new Date()
      const fourMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 4, 1)
      const startDate = fourMonthsAgo.toISOString().slice(0, 10)

      await svc.create({
        name: '季度保险', txType: 'expense', amount: 900,
        subjectId: expenseSubjectId, accountId,
        frequency: 'quarterly', startDate,
      })
      const items = await svc.generatePendingItems()
      const relevant = items.filter(i => i.description.includes('季度保险'))
      // At least one quarter should have elapsed
      expect(relevant.length).toBeGreaterThan(0)
    })
  })

  describe('execution', () => {
    it('should create a real transaction when executing a pending item', async () => {
      const ruleId = await svc.create({
        name: '执行测试', txType: 'expense', amount: 500,
        subjectId: expenseSubjectId, accountId,
        frequency: 'monthly', startDate: '2026-05-01',
      })

      await svc.executePending({
        id: 0, itemType: 'recurring', referenceId: ruleId,
        description: '执行测试', amount: 500,
        dueDate: '2026-05-15', isDone: false, createdAt: '2026-05-15',
      })

      // Verify transaction was created
      const txs = await db.query(
        "SELECT * FROM transactions WHERE note LIKE '%执行测试%'"
      )
      expect(txs.length).toBe(1)

      // Verify journal entries were created
      const entries = await db.query(
        'SELECT * FROM journal_entries WHERE transaction_id = ?',
        [txs[0].id]
      )
      expect(entries.length).toBe(2)
    })

    it('should update last_generated on execution', async () => {
      const ruleId = await svc.create({
        name: 'lastgen测试', txType: 'income', amount: 8000,
        subjectId: incomeSubjectId, accountId,
        frequency: 'monthly', startDate: '2026-05-01',
      })

      await svc.executePending({
        id: 0, itemType: 'recurring', referenceId: ruleId,
        description: 'lastgen测试', amount: 8000,
        dueDate: '2026-05-20', isDone: false, createdAt: '2026-05-20',
      })

      const rule = await svc.findById(ruleId)
      expect(rule?.lastGenerated).toBe('2026-05-20')
    })
  })
})
