import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { TestDatabase } from './setup'
import { SubjectResolver } from '@/services/subject-resolver'

describe('SubjectResolver', () => {
  let db: TestDatabase
  let resolve: SubjectResolver

  beforeEach(async () => {
    db = new TestDatabase()
    await db.init()
    resolve = new SubjectResolver(db)
  })

  afterEach(async () => await db.close())

  it('should resolve a known subject code to its DB ID', async () => {
    const id = await resolve.id('50101') // 房租
    expect(id).toBeGreaterThan(0)
  })

  it('should throw for unknown subject code', async () => {
    await expect(resolve.id('99999')).rejects.toThrow('科目编码 99999 不存在')
  })

  it('should cache results after first lookup', async () => {
    const id1 = await resolve.id('40101')
    const id2 = await resolve.id('40101')
    expect(id1).toBe(id2)
  })

  it('should resolve all preset subjects after preload', async () => {
    await resolve.preload()
    const ids = await Promise.all([
      resolve.id('10100'), resolve.id('10200'), resolve.id('10201'),
      resolve.id('12101'), resolve.id('13100'), resolve.id('15101'),
      resolve.id('20100'), resolve.id('22101'),
      resolve.id('30100'), resolve.id('30200'), resolve.id('30300'),
      resolve.id('40101'), resolve.id('40201'), resolve.id('40301'),
      resolve.id('50101'), resolve.id('50201'), resolve.id('50301'),
      resolve.id('50401'), resolve.id('50501'), resolve.id('50601'),
      resolve.id('50701'), resolve.id('50801'), resolve.id('50901'),
    ])
    for (const id of ids) {
      expect(id).toBeGreaterThan(0)
    }
  })

  it('should handle numeric string codes', async () => {
    const id = await resolve.id('50101')
    // Passing the same value as a number should also work
    const id2 = await resolve.id(50101)
    expect(id).toBe(id2)
  })

  it('should clear cache', async () => {
    await resolve.preload()
    resolve.clear()
    // After clear, should still work (re-fetch from DB)
    const id = await resolve.id('50101')
    expect(id).toBeGreaterThan(0)
  })
})
