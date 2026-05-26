import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getDatabase } from '@/database/factory'
import { AccountRepository, type AccountWithBalance } from '@/repositories/account-repo'
import { SubjectResolver } from '@/services/subject-resolver'
import type { Account, AccountType } from '@/types'

export const useAccountStore = defineStore('accounts', () => {
  const accounts = ref<AccountWithBalance[]>([])
  const loading = ref(false)

  async function load() {
    loading.value = true
    try {
      const db = await getDatabase()
      const repo = new AccountRepository(db)
      accounts.value = await repo.getAllWithBalances()
    } finally {
      loading.value = false
    }
  }

  async function create(data: {
    name: string
    accountType: AccountType
    subjectId: number
    bankName?: string
    cardLastFour?: string
    notes?: string
    creditLimit?: number
    initialBalance?: number
  }) {
    const db = await getDatabase()
    const repo = new AccountRepository(db)
    const resolve = new SubjectResolver(db)
    await resolve.preload()

    const subjectCode = await repo.getNextSubjectCode(data.subjectId)
    const id = await repo.create({
      name: data.name,
      subjectCode,
      accountType: data.accountType,
      subjectId: data.subjectId,
      bankName: data.bankName,
      cardLastFour: data.cardLastFour,
      notes: data.notes,
      creditLimit: data.creditLimit,
    })

    // Create initial balance journal entry if set
    const bal = data.initialBalance
    if (bal && bal !== 0) {
      const isAsset = !['credit_card', 'payable', 'loan'].includes(data.accountType)
      const absAmount = Math.abs(bal)

      const equitySubjectId = await resolve.id('30100')

      // Use last day of previous month so the balance appears as 期初 in reports
      const prevMonthEnd = new Date()
      prevMonthEnd.setDate(0)
      const openingDate = prevMonthEnd.toISOString().slice(0, 10)

      const accDirection = isAsset ? 'debit' : 'credit'
      const equityDirection = isAsset ? 'credit' : 'debit'

      const txId = await db.insert(
        `INSERT INTO transactions (tx_type, tx_date, amount, subject_id, account_id, note)
         VALUES (?, ?, ?, ?, ?, '期初余额')`,
        [isAsset ? 'income' : 'expense', openingDate, absAmount, data.subjectId, id]
      )
      await db.insert(
        `INSERT INTO journal_entries (transaction_id, account_id, subject_id, direction, amount, entry_date)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [txId, id, data.subjectId, accDirection, absAmount, openingDate]
      )
      await db.insert(
        `INSERT INTO journal_entries (transaction_id, subject_id, direction, amount, entry_date)
         VALUES (?, ?, ?, ?, ?)`,
        [txId, equitySubjectId, equityDirection, absAmount, openingDate]
      )
    }

    await load()
    return id
  }

  async function update(id: number, data: Partial<Account>) {
    const db = await getDatabase()
    const repo = new AccountRepository(db)
    await repo.update(id, data)
    await load()
  }

  async function deleteAccount(accountId: number, transferToAccountId?: number) {
    const db = await getDatabase()
    const repo = new AccountRepository(db)
    const account = accounts.value.find(a => a.id === accountId)
    if (!account) throw new Error('账户不存在')

    const balance = account.balance
    if (balance !== 0 && transferToAccountId) {
      const today = new Date().toISOString().slice(0, 10)
      await repo.transferBalance(accountId, transferToAccountId, Math.abs(balance), today, account.subjectId, balance)
    }
    await repo.softDelete(accountId)
    await load()
  }

  function getById(id: number): AccountWithBalance | undefined {
    return accounts.value.find(a => a.id === id)
  }

  const assetAccounts = ref<AccountWithBalance[]>([])
  const liabilityAccounts = ref<AccountWithBalance[]>([])

  return {
    accounts, loading, load, create, update, deleteAccount, getById,
    assetAccounts, liabilityAccounts,
  }
})
