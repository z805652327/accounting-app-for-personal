import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getDatabase } from '@/database/factory'
import { TransactionRepository, type TransactionDetail } from '@/repositories/transaction-repo'
import { JournalEntryBuilder } from '@/services/journal-entry-builder'

export const useTransactionStore = defineStore('transactions', () => {
  const recentTxns = ref<TransactionDetail[]>([])
  const loading = ref(false)

  async function loadRecent(limit = 20) {
    loading.value = true
    try {
      const db = await getDatabase()
      const repo = new TransactionRepository(db)
      recentTxns.value = await repo.findDetails({ limit })
    } finally {
      loading.value = false
    }
  }

  async function create(input: Parameters<JournalEntryBuilder['process']>[0] & { tagIds?: number[] }) {
    const db = await getDatabase()
    const builder = new JournalEntryBuilder(db)
    const result = await builder.process(input)
    // Save tag associations
    if (input.tagIds && input.tagIds.length > 0) {
      for (const tagId of input.tagIds) {
        await db.execute(
          'INSERT OR IGNORE INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?)',
          [result.transactionId, tagId]
        )
      }
    }
    await loadRecent()
    return result
  }

  async function updateTx(id: number, input: Parameters<JournalEntryBuilder['process']>[0] & { tagIds?: number[] }) {
    const db = await getDatabase()
    const builder = new JournalEntryBuilder(db)
    await builder.update(id, input)
    // Update tags: delete old, insert new
    if (input.tagIds) {
      await db.execute('DELETE FROM transaction_tags WHERE transaction_id = ?', [id])
      for (const tagId of input.tagIds) {
        await db.execute(
          'INSERT OR IGNORE INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?)',
          [id, tagId]
        )
      }
    }
    await loadRecent()
  }

  async function search(filters: {
    startDate?: string
    endDate?: string
    subjectId?: number
    accountId?: number
    txType?: string
  }) {
    const db = await getDatabase()
    const repo = new TransactionRepository(db)
    return repo.findDetails(filters)
  }

  async function softDelete(id: number) {
    const db = await getDatabase()
    const repo = new TransactionRepository(db)
    await repo.softDelete(id)
    await loadRecent()
  }

  return { recentTxns, loading, loadRecent, create, updateTx, search, softDelete }
})
