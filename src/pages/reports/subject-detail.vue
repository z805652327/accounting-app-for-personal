<template>
  <div class="page-subject-detail">
    <div class="summary-card">
      <span class="subj-code">{{ subject?.code || '' }}</span>
      <span class="subj-name">{{ subject?.name || '科目明细' }}</span>
      <span class="subj-balance">余额: ¥{{ balance.toFixed(2) }}</span>
    </div>

    <div class="toolbar">
      <el-input v-model="month" placeholder="YYYY-MM" class="month-input" />
      <el-button type="primary" size="small" @click="loadData">查询</el-button>
    </div>

    <div v-if="transactions.length" class="section">
      <div class="section-title">相关交易 ({{ transactions.length }})</div>
      <div v-for="tx in transactions" :key="tx.id" class="tx-item" @click="viewTx(tx)">
        <div class="tx-left">
          <span class="tx-date-sm">{{ tx.txDate }}</span>
          <span class="tx-desc">{{ tx.subjectName }}{{ tx.note ? ' - ' + tx.note : '' }}</span>
        </div>
        <span :class="['tx-amount', tx.txType === 'income' || tx.txType === 'salary' ? 'green' : 'red']">
          ¥{{ Math.abs(tx.amount).toFixed(2) }}
        </span>
      </div>
    </div>
    <div v-else class="empty">暂无交易数据</div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {  onLoad  } from '@/uni-shim'
import { getDatabase } from '@/database/factory'
import { TransactionRepository, type TransactionDetail } from '@/repositories/transaction-repo'
import { SubjectRepository } from '@/repositories/subject-repo'
import { BalanceCalculator } from '@/services/balance-calculator'
import type { AccountingSubject } from '@/types'

const subject = ref<AccountingSubject | null>(null)
const transactions = ref<TransactionDetail[]>([])
const balance = ref(0)
const month = ref('')

async function loadData() {
  const db = await getDatabase()
  const repo = new TransactionRepository(db)
  const subRepo = new SubjectRepository(db)
  const [y, m] = (month.value || new Date().toISOString().slice(0, 7)).split('-').map(Number)

  const calc = new BalanceCalculator(db)
  const allBalances = await calc.calculate(y, m)
  const subBal = allBalances.find(b => b.subjectId === subject.value?.id)
  balance.value = subBal?.closingBalance ?? 0

  const periodStart = `${y}-${String(m).padStart(2, '0')}-01`
  const periodEnd = m === 12 ? `${y+1}-01-01` : `${y}-${String(m+1).padStart(2, '0')}-01`

  // Collect all matching transaction IDs through journal_entries
  let subjectIds = [subject.value?.id]
  if (subject.value?.level === 2) {
    const children = await subRepo.findAll()
    const l3Ids = children.filter(s => s.level === 3 && s.parentId === subject.value?.id).map(s => s.id)
    subjectIds = [...subjectIds, ...l3Ids]
  }

  if (subjectIds.length > 0) {
    const placeholders = subjectIds.map(() => '?').join(',')
    transactions.value = await db.query<TransactionDetail>(
      `SELECT DISTINCT t.*, s.name as subjectName, a1.name as accountName, a2.name as toAccountName
       FROM transactions t
       JOIN journal_entries je ON je.transaction_id = t.id
       LEFT JOIN accounting_subjects s ON t.subject_id = s.id
       LEFT JOIN accounts a1 ON t.account_id = a1.id
       LEFT JOIN accounts a2 ON t.to_account_id = a2.id
       WHERE t.is_deleted = 0
         AND je.subject_id IN (${placeholders})
         AND je.entry_date >= ? AND je.entry_date < ?
       ORDER BY t.tx_date DESC, t.id DESC
       LIMIT 200`,
      [...subjectIds, periodStart, periodEnd]
    )
  } else {
    transactions.value = []
  }
}

function viewTx(tx: TransactionDetail) {
  uni.navigateTo({ url: `/pages/transactions/detail?id=${tx.id}` })
}

onLoad(async (opt) => {
  console.log('subject-detail onLoad, opt:', opt)
  if (opt?.id) {
    try {
      const db = await getDatabase()
      const repo = new SubjectRepository(db)
      subject.value = await repo.findById(Number(opt.id))
      console.log('subject loaded:', subject.value?.code, subject.value?.name, 'level:', subject.value?.level)
      month.value = new Date().toISOString().slice(0, 7)
      await loadData()
      console.log('transactions found:', transactions.value.length)
    } catch (e) {
      console.error('subject-detail error:', e)
    }
  }
})
</script>

<style lang="scss" scoped>
.page-subject-detail { padding: 10px; }
.summary-card { background: #FDFCF9; border-radius: 8px; padding: 15px; text-align: center; margin-bottom: 10px; }
.subj-code { font-size: 12px; color: #9E9790; display: block; }
.subj-name { font-size: 17px; font-weight: bold; display: block; margin: 4px 0; }
.subj-balance { font-size: 14px; color: #C44536; }
.toolbar { display: flex; gap: 6px; align-items: center; margin-bottom: 8px; }
.month-input { flex: 1; }
.section { background: #FDFCF9; border-radius: 6px; padding: 10px; }
.section-title { font-size: 14px; font-weight: bold; margin-bottom: 6px; }
.tx-item { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #EDE8E0; }
.tx-left { display: flex; flex-direction: column; gap: 2px; flex: 1; }
.tx-date-sm { font-size: 11px; color: #9E9790; }
.tx-desc { font-size: 13px; }
.tx-amount { font-size: 13px; font-weight: bold; }
.red { color: #C44536; }
.green { color: #2D7D7A; }
.empty { text-align: center; color: #9E9790; padding: 30px; font-size: 14px; }
</style>
