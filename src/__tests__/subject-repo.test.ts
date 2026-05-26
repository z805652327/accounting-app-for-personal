import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { TestDatabase } from './setup'
import { SubjectRepository } from '@/repositories/subject-repo'

describe('SubjectRepository', () => {
  let db: TestDatabase
  let repo: SubjectRepository

  beforeEach(async () => {
    db = new TestDatabase()
    await db.init()
    repo = new SubjectRepository(db)
  })

  afterEach(async () => await db.close())

  it('should find all subjects including presets', async () => {
    const subjects = await repo.findAll()
    expect(subjects.length).toBeGreaterThan(80)
  })

  it('should find subject by id', async () => {
    const all = await repo.findAll()
    const first = all[0]
    const found = await repo.findById(first.id)
    expect(found).not.toBeNull()
    expect(found!.code).toBe(first.code)
  })

  it('should find subject by code', async () => {
    const sub = await repo.findByCode('50101')
    expect(sub).not.toBeNull()
    expect(sub!.name).toBe('房租')
    expect(sub!.level).toBe(2)
  })

  it('should find children of a parent', async () => {
    const parent = await repo.findByCode('40100') // 劳动收入
    expect(parent).not.toBeNull()
    const children = await repo.findChildren(parent!.id)
    expect(children.length).toBeGreaterThanOrEqual(3) // 工资薪金, 奖金/津贴, 兼职/副业
    for (const c of children) {
      expect(c.parentId).toBe(parent!.id)
    }
  })

  it('should create a level-3 subject with auto code', async () => {
    const parent = await repo.findByCode('50101') // 房租
    const code = await repo.getNextL3Code(parent!.code)
    expect(code).toMatch(/^50101\d{3}$/)

    const id = await repo.createL3({
      code,
      name: '阳光花园房租',
      parentId: parent!.id,
      subjectType: 'expense',
      expenseType: 'fixed',
      cashFlowCategory: 'operating',
    })
    expect(id).toBeGreaterThan(0)

    const sub = await repo.findById(id)
    expect(sub!.name).toBe('阳光花园房租')
    expect(sub!.level).toBe(3)
    expect(sub!.isSystem).toBe(0)
  })

  it('should generate sequential L3 codes', async () => {
    const parent = await repo.findByCode('50101')
    const code1 = await repo.getNextL3Code(parent!.code)
    await repo.createL3({
      code: code1, name: 'A', parentId: parent!.id,
      subjectType: 'expense',
    })
    const code2 = await repo.getNextL3Code(parent!.code)
    const serial1 = parseInt(code1.slice(5), 10)
    const serial2 = parseInt(code2.slice(5), 10)
    expect(serial2).toBe(serial1 + 1)
  })

  it('should toggle active status for non-system subjects', async () => {
    const parent = await repo.findByCode('50101')
    const code = await repo.getNextL3Code(parent!.code)
    const id = await repo.createL3({
      code, name: '测试L3', parentId: parent!.id,
      subjectType: 'expense',
    })

    await repo.toggleActive(id, false)
    const sub = await repo.findById(id)
    expect(sub!.isActive).toBe(0)

    await repo.toggleActive(id, true)
    const sub2 = await repo.findById(id)
    expect(sub2!.isActive).toBe(1)
  })

  it('should not allow toggling system subjects', async () => {
    const sysSub = await repo.findByCode('50101')
    await repo.toggleActive(sysSub!.id, false)
    // Should have no effect (is_system = 1 check in WHERE)
    const sub = await repo.findById(sysSub!.id)
    expect(sub!.isActive).toBe(1) // unchanged
  })

  it('should return tree structure via findAll', async () => {
    const all = await repo.findAll()
    // Verify ordering
    const l1s = all.filter(s => s.level === 1)
    const l2s = all.filter(s => s.level === 2)
    expect(l1s.length).toBeGreaterThan(15)
    expect(l2s.length).toBeGreaterThan(50)
  })

  it('should pad 3-digit codes to 5 digits for L3 generation', async () => {
    // Code 101 (现金) → prefix "10100"
    const parent = await repo.findByCode('10100')
    const code = await repo.getNextL3Code(parent!.code)
    expect(code).toMatch(/^10100\d{3}$/)
  })
})
