<template>
  <div class="page-tx-detail">
    <div v-if="tx" class="card">
      <div class="header-row">
        <span class="tx-type">{{ typeName }}</span>
        <span class="tx-date">{{ tx.txDate }}</span>
      </div>
      <div class="amount-row">
        <span :class="['amount', isExpense ? 'red' : 'green']">¥{{ Math.abs(tx.amount).toFixed(2) }}</span>
      </div>
      <div class="info-grid">
        <div class="info-item"><span class="label">科目</span><span class="val">{{ tx.subjectName }}</span></div>
        <div class="info-item" v-if="tx.accountName"><span class="label">账户</span><span class="val">{{ tx.accountName }}</span></div>
        <div class="info-item" v-if="tx.toAccountName"><span class="label">对方账户</span><span class="val">{{ tx.toAccountName }}</span></div>
        <div class="info-item" v-if="tx.note"><span class="label">备注</span><span class="val">{{ tx.note }}</span></div>
      </div>
      <div class="reconcile-row">
        <span class="rec-label">对账状态</span>
        <span :class="['rec-status', tx.isReconciled ? 'rec-yes' : 'rec-no']">
          {{ tx.isReconciled ? '已对账' : '未对账' }}
        </span>
        <el-button size="small" @click="toggleReconciled" :loading="recLoading">
          {{ tx.isReconciled ? '取消对账' : '标记已对账' }}
        </el-button>
      </div>
    </div>

    <div class="section" v-if="entries.length">
      <div class="section-title">会计分录</div>
      <div v-for="je in entries" :key="je.id" class="entry-row">
        <span :class="['dir', je.direction]">{{ je.direction === 'debit' ? '借' : '贷' }}</span>
        <span class="entry-subject">科目#{{ je.subjectId }}</span>
        <span class="entry-amount">¥{{ je.amount.toFixed(2) }}</span>
      </div>
    </div>

    <div class="section" v-if="history.length">
      <div class="section-title">编辑历史</div>
      <div v-for="h in history" :key="h.id" class="history-item">
        <span class="h-time">{{ h.createdAt }}</span>
        <span class="h-reason">{{ h.changeReason === 'user_edit' ? '用户编辑' : h.changeReason }}</span>
      </div>
    </div>

    <div class="action-bar">
      <el-button type="warning" @click="editTx">编辑</el-button>
      <el-button type="error" @click="deleteTx">删除</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {  onLoad  } from '@/uni-shim'
import { getDatabase } from '@/database/factory'
import { TransactionRepository, type TransactionDetail } from '@/repositories/transaction-repo'
import type { JournalEntry, EditHistory } from '@/types'

const tx = ref<TransactionDetail | null>(null)
const entries = ref<JournalEntry[]>([])
const history = ref<EditHistory[]>([])
const recLoading = ref(false)
const isExpense = computed(() => ['expense','salary','asset_purchase','loan_repay','prepaid_amortize','credit_card_spend'].includes(tx.value?.txType || ''))
const typeName = computed(() => {
  const map: Record<string, string> = {
    income:'收入', expense:'支出', transfer:'转账', salary:'发工资',
    investment_buy:'投资买入', investment_sell:'投资卖出', valuation_adjust:'估值调整',
    loan_receive:'借款', loan_repay:'还款', prepaid_amortize:'预付摊提',
    asset_purchase:'购置固定资产', asset_dispose:'资产处置',
    credit_card_spend:'信用卡消费', credit_card_repay:'信用卡还款'
  }
  return map[tx.value?.txType || ''] || tx.value?.txType || ''
})

async function load(id: number) {
  const db = await getDatabase()
  const repo = new TransactionRepository(db)
  tx.value = (await repo.findDetails({ limit: 1, offset: 0 }))[0] || null
  // Find by id directly
  const t = await repo.findById(id)
  if (t) {
    entries.value = await repo.getJournalEntries(id)
    history.value = await db.query<EditHistory>(
      'SELECT * FROM edit_history WHERE transaction_id = ? ORDER BY created_at DESC', [id]
    )
    // Reload detail
    const all = await repo.findDetails({ limit: 1000 })
    tx.value = all.find(d => d.id === id) || null
  }
}

function editTx() {
  if (!tx.value) return
  uni.navigateTo({ url: `/pages/transactions/add?type=${tx.value.txType}&id=${tx.value.id}` })
}

async function toggleReconciled() {
  if (!tx.value) return
  recLoading.value = true
  try {
    const db = await getDatabase()
    const newState = tx.value.isReconciled ? 0 : 1
    await db.execute('UPDATE transactions SET is_reconciled = ? WHERE id = ?', [newState, tx.value.id])
    tx.value.isReconciled = newState
    uni.showToast({ title: newState ? '已标记对账' : '已取消对账', icon: 'success' })
  } finally {
    recLoading.value = false
  }
}

function deleteTx() {
  if (!tx.value) return
  uni.showModal({ title: '确认删除', content: '删除后分录将一并移除，确定？', success: async (r) => {
    if (r.confirm) {
      const db = await getDatabase()
      const repo = new TransactionRepository(db)
      const entries = await repo.getJournalEntries(tx.value!.id)
      for (const je of entries) {
        await db.execute('DELETE FROM journal_entries WHERE id = ?', [je.id])
      }
      await repo.softDelete(tx.value!.id)
      await repo.recordEditHistory(tx.value!.id, 'user_delete', { deleted: { old: false, new: true } })
      uni.showToast({ title: '已删除' })
      setTimeout(() => uni.navigateBack(), 1000)
    }
  }})
}

onLoad((opt) => {
  if (opt?.id) load(Number(opt.id))
})
</script>

<style lang="scss" scoped>
.page-tx-detail { padding: 10px; }
.card { background: #FDFCF9; border-radius: 8px; padding: 15px; margin-bottom: 10px; border: 1px solid #EDE8E0; }
.reconcile-row { display: flex; align-items: center; gap: 8px; margin-top: 10px; padding-top: 8px; border-top: 1px solid #EDE8E0; }
.rec-label { font-size: 12px; color: #6B6560; }
.rec-status { font-size: 12px; font-weight: 500; }
.rec-yes { color: #2D7D7A; }
.rec-no { color: #E08900; }
.header-row { display: flex; justify-content: space-between; margin-bottom: 6px; }
.tx-type { font-size: 13px; color: #6B6560; font-weight: 500; }
.tx-date { font-size: 12px; color: #9E9790; }
.amount-row { text-align: center; margin: 10px 0; }
.amount { font-family: 'DM Mono', monospace; font-size: 22px; font-weight: 500; }
.red { color: #C44536; }
.green { color: #2D7D7A; }
.info-grid { margin-top: 10px; }
.info-item { display: flex; padding: 4px 0; border-bottom: 1px solid #EDE8E0; }
.label { width: 70px; font-size: 12px; color: #9E9790; }
.val { font-size: 13px; color: #1C1915; }
.section { background: #FDFCF9; border-radius: 6px; padding: 12px; margin-bottom: 8px; border: 1px solid #EDE8E0; }
.section-title { font-family: 'Noto Serif SC', serif; font-size: 13px; font-weight: 700; margin-bottom: 6px; color: #1C1915; }
.entry-row { display: flex; align-items: center; padding: 4px 0; font-size: 12px; }
.dir { width: 25px; font-weight: 600; }
.dir.debit { color: #C44536; }
.dir.credit { color: #2D7D7A; }
.entry-subject { flex: 1; color: #6B6560; }
.entry-amount { font-family: 'DM Mono', monospace; font-weight: 500; }
.history-item { display: flex; justify-content: space-between; padding: 3px 0; font-size: 11px; color: #9E9790; }
.action-bar { display: flex; gap: 8px; margin-top: 10px; }
</style>
