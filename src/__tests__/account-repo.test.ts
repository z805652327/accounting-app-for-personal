import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { TestDatabase } from './setup'
import { AccountRepository } from '@/repositories/account-repo'
import { SubjectResolver } from '@/services/subject-resolver'

describe('AccountRepository', () => {
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

  describe('CRUD', () => {
    it('should create an account with auto-generated subject code', async () => {
      const checking = await resolve.id('10201')
      const id = await repo.create({
        name: '招商银行', subjectCode: '10201901',
        accountType: 'checking', subjectId: checking,
        bankName: '招商银行', cardLastFour: '1111',
      })
      expect(id).toBeGreaterThan(0)

      const acc = await repo.findById(id)
      expect(acc).not.toBeNull()
      expect(acc!.name).toBe('招商银行')
      expect(acc!.accountType).toBe('checking')
      expect(acc!.bankName).toBe('招商银行')
    })

    it('should list all active accounts', async () => {
      await repo.create({ name: 'A', subjectCode: '10201901', accountType: 'checking', subjectId: await resolve.id('10201') })
      await repo.create({ name: 'B', subjectCode: '10300901', accountType: 'money_market', subjectId: await resolve.id('10300') })

      const accounts = await repo.findAll()
      expect(accounts.length).toBeGreaterThanOrEqual(2)
    })

    it('should soft-delete an account', async () => {
      const id = await repo.create({ name: '待删除', subjectCode: '10201902', accountType: 'checking', subjectId: await resolve.id('10201') })
      await repo.softDelete(id)
      const acc = await repo.findById(id)
      expect(acc?.isActive).toBe(0)
      // Should not appear in findAll
      const all = await repo.findAll()
      expect(all.find(a => a.id === id)).toBeUndefined()
    })

    it('should update account fields', async () => {
      const id = await repo.create({ name: '旧名', subjectCode: '10201903', accountType: 'checking', subjectId: await resolve.id('10201') })
      await repo.update(id, { name: '新名', cardLastFour: '8888' })
      const acc = await repo.findById(id)
      expect(acc!.name).toBe('新名')
      expect(acc!.cardLastFour).toBe('8888')
    })
  })

  describe('subject code generation', () => {
    it('should generate sequential subject codes', async () => {
      const checking = await resolve.id('10201')
      const code1 = await repo.getNextSubjectCode(checking)
      expect(code1).toMatch(/^10201/)
      // Extract serial
      const serial = parseInt(code1.slice(5), 10)
      expect(serial).toBeGreaterThan(0)
    })

    it('should increment from existing codes', async () => {
      const checking = await resolve.id('10201')
      await repo.create({ name: 'A', subjectCode: '10201001', accountType: 'checking', subjectId: checking })
      const nextCode = await repo.getNextSubjectCode(checking)
      expect(nextCode).toBe('10201002')
    })
  })

  describe('balance calculation', () => {
    it('should return 0 for account with no entries', async () => {
      const id = await repo.create({ name: '空账户', subjectCode: '10201904', accountType: 'checking', subjectId: await resolve.id('10201') })
      const bal = await repo.getBalance(id)
      expect(bal).toBe(0)
    })

    it('should compute positive balance for asset with debit entries', async () => {
      const id = await repo.create({ name: '有余额', subjectCode: '10201905', accountType: 'checking', subjectId: await resolve.id('10201') })
      // Simulate journal entries
      const assetSub = await resolve.id('10201')
      await db.insert(
        `INSERT INTO transactions (tx_type, tx_date, amount, subject_id, account_id)
         VALUES ('income', '2026-05-01', 5000, ?, ?)`,
        [assetSub, id]
      )
      const txId = (await db.queryOne<{id: number}>('SELECT last_insert_rowid() as id'))!.id
      await db.insert(
        `INSERT INTO journal_entries (transaction_id, account_id, subject_id, direction, amount, entry_date)
         VALUES (?, ?, ?, 'debit', 5000, '2026-05-01')`,
        [txId, id, assetSub]
      )
      await db.insert(
        `INSERT INTO journal_entries (transaction_id, account_id, subject_id, direction, amount, entry_date)
         VALUES (?, NULL, ?, 'credit', 5000, '2026-05-01')`,
        [txId, await resolve.id('40101')]
      )

      const bal = await repo.getBalance(id)
      expect(bal).toBe(5000)
    })

    it('should compute liability balance correctly (credit increases)', async () => {
      const creditSub = await resolve.id('20100')
      const id = await repo.create({ name: '信用卡', subjectCode: '20100901', accountType: 'credit_card', subjectId: creditSub, creditLimit: 10000 })

      // Simulate credit card spend (credit increases liability)
      await db.insert(
        `INSERT INTO transactions (tx_type, tx_date, amount, subject_id, account_id)
         VALUES ('credit_card_spend', '2026-05-01', 3000, ?, ?)`,
        [creditSub, id]
      )
      const txId = (await db.queryOne<{id: number}>('SELECT last_insert_rowid() as id'))!.id
      await db.insert(
        `INSERT INTO journal_entries (transaction_id, account_id, subject_id, direction, amount, entry_date)
         VALUES (?, ?, ?, 'credit', 3000, '2026-05-01')`,
        [txId, id, creditSub]
      )

      const bal = await repo.getBalance(id)
      expect(bal).toBe(3000)
    })

    it('should return all accounts with balances', async () => {
      const id = await repo.create({ name: '有余额', subjectCode: '10201906', accountType: 'checking', subjectId: await resolve.id('10201') })
      const results = await repo.getAllWithBalances()
      expect(results.length).toBeGreaterThan(0)
      const acc = results.find(a => a.id === id)
      expect(acc).toBeDefined()
      expect(typeof acc!.balance).toBe('number')
    })
  })

  describe('transfer balance', () => {
    it('should create transfer journal entries', async () => {
      const assetSub = await resolve.id('10201')
      const src = await repo.create({ name: '源账户', subjectCode: '10201907', accountType: 'checking', subjectId: assetSub })
      const dst = await repo.create({ name: '目标账户', subjectCode: '10201908', accountType: 'checking', subjectId: assetSub })

      // Give source a balance
      await db.insert(
        `INSERT INTO transactions (tx_type, tx_date, amount, subject_id, account_id)
         VALUES ('income', '2026-05-01', 1000, ?, ?)`,
        [assetSub, src]
      )
      const txId = (await db.queryOne<{id: number}>('SELECT last_insert_rowid() as id'))!.id
      await db.insert(
        `INSERT INTO journal_entries (transaction_id, account_id, subject_id, direction, amount, entry_date)
         VALUES (?, ?, ?, 'debit', 1000, '2026-05-01')`,
        [txId, src, assetSub]
      )

      await repo.transferBalance(src, dst, 500, '2026-05-15', assetSub, 500)

      const srcBal = await repo.getBalance(src)
      const dstBal = await repo.getBalance(dst)
      expect(srcBal).toBe(500)
      expect(dstBal).toBe(500)
    })
  })
})
