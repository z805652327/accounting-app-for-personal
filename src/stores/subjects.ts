import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getDatabase } from '@/database/factory'
import { SubjectRepository } from '@/repositories/subject-repo'
import type { AccountingSubject } from '@/types'

export interface SubjectTreeNode extends AccountingSubject {
  children: SubjectTreeNode[]
}

export const useSubjectStore = defineStore('subjects', () => {
  const subjects = ref<AccountingSubject[]>([])
  const loading = ref(false)

  const accounts = ref<{ id: number; name: string; subjectCode: string; subjectId: number }[]>([])

  const tree = computed<SubjectTreeNode[]>(() => {
    const map = new Map<number, SubjectTreeNode>()
    const roots: SubjectTreeNode[] = []

    for (const s of subjects.value) {
      map.set(s.id, { ...s, children: [] })
    }
    // Attach container-type L3 accounts to their parent subjects
    for (const acc of accounts.value) {
      const parent = map.get(acc.subjectId)
      if (parent) {
        parent.children.push({
          id: -acc.id, // negative ID to distinguish from real subjects
          code: acc.subjectCode,
          name: acc.name,
          level: 3,
          parentId: acc.subjectId,
          subjectType: parent.subjectType,
          expenseType: null,
          cashFlowCategory: null,
          isSystem: false,
          isActive: true,
          sortOrder: 0,
          children: [],
        })
      }
    }
    for (const node of map.values()) {
      if (node.parentId) {
        const parent = map.get(node.parentId)
        if (parent) parent.children.push(node)
      } else {
        roots.push(node)
      }
    }
    return roots
  })

  async function load() {
    loading.value = true
    try {
      const db = await getDatabase()
      const repo = new SubjectRepository(db)
      subjects.value = await repo.findAll()
      accounts.value = []
    } finally {
      loading.value = false
    }
  }

  // Load with accounts tree (for subject management page)
  async function loadWithAccounts() {
    loading.value = true
    try {
      const db = await getDatabase()
      const repo = new SubjectRepository(db)
      subjects.value = await repo.findAll()
      const accRows = await db.query<{ id: number; name: string; subject_code: string; subject_id: number }>(
        'SELECT id, name, subject_code, subject_id FROM accounts WHERE is_active = 1 ORDER BY subject_code'
      )
      accounts.value = accRows.map(r => ({
        id: r.id, name: r.name, subjectCode: r.subject_code, subjectId: r.subject_id,
      }))
    } finally {
      loading.value = false
    }
  }

  function getById(id: number): AccountingSubject | undefined {
    return subjects.value.find(s => s.id === id)
  }

  function getByCode(code: string): AccountingSubject | undefined {
    return subjects.value.find(s => s.code === code)
  }

  function getChildren(parentId: number): AccountingSubject[] {
    return subjects.value.filter(s => s.parentId === parentId)
  }

  function getL2Subjects(): AccountingSubject[] {
    return subjects.value.filter(s => s.level === 2)
  }

  function getL1Subjects(): AccountingSubject[] {
    return subjects.value.filter(s => s.level === 1)
  }

  return { subjects, loading, tree, load, loadWithAccounts, getById, getByCode, getChildren, getL2Subjects, getL1Subjects }
})
