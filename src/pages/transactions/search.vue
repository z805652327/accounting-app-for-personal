<template>
  <div class="page-search">
    <div class="filters">
      <div class="filter-row">
        <el-input v-model="filters.startDate" placeholder="开始日期" class="filter-input" />
        <span class="sep">-</span>
        <el-input v-model="filters.endDate" placeholder="结束日期" class="filter-input" />
      </div>
      <div class="filter-row">
        <el-input v-model="filters.subjectName" readonly placeholder="科目" @focus="pickSubject()" />
        <el-input v-model="filters.accountName" readonly placeholder="账户" @focus="pickAccount()" class="filter-input" />
        <el-button type="primary" size="small" @click="doSearch">搜索</el-button>
      </div>
    </div>

    <div class="section">
      <div class="section-title" v-if="results.length">共 {{ results.length }} 条结果</div>
      <div v-for="tx in results" :key="tx.id" class="tx-item" @click="viewTx(tx)">
        <div class="tx-left">
          <span class="tx-subject">{{ tx.subjectName }}</span>
          <span class="tx-meta">{{ tx.txDate }} {{ txTypeName(tx.txType) }}{{ tx.note ? ' - ' + tx.note : '' }}</span>
        </div>
        <span :class="['tx-amount', isOutTx(tx) ? 'red' : 'green']">
          {{ isOutTx(tx) ? '-' : '+' }}¥{{ Math.abs(tx.amount).toFixed(2) }}
        </span>
      </div>
      <div v-if="results.length === 0 && searched" class="empty">无匹配结果</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import {  onShow  } from '@/uni-shim'
import { useSubjectStore } from '@/stores/subjects'
import { useAccountStore } from '@/stores/accounts'
import { useTransactionStore } from '@/stores/transactions'
import type { TransactionDetail } from '@/repositories/transaction-repo'

const subjectStore = useSubjectStore()
const accountStore = useAccountStore()
const txStore = useTransactionStore()

const searched = ref(false)
const results = ref<TransactionDetail[]>([])

const filters = reactive({
  startDate: '',
  endDate: '',
  subjectId: 0,
  subjectName: '',
  accountId: 0,
  accountName: '',
})

function txTypeName(t: string): string {
  const map: Record<string, string> = { income:'收入', expense:'支出', transfer:'转账', salary:'工资',
    investment_buy:'买入', investment_sell:'卖出', loan_receive:'借款', loan_repay:'还款',
    asset_purchase:'购置', credit_card_spend:'消费', credit_card_repay:'还款' }
  return map[t] || t
}

function isOutTx(tx: TransactionDetail): boolean {
  return ['expense','salary','asset_purchase','loan_repay','prepaid_amortize','credit_card_spend','investment_buy'].includes(tx.txType)
}

function pickSubject() {
  const items = subjectStore.subjects.filter(s => s.level === 2).map(s => `${s.code} ${s.name}`)
  uni.showActionSheet({ itemList: items, success: (res) => {
    if (res.tapIndex >= 0) {
      const sub = subjectStore.subjects.filter(s => s.level === 2)[res.tapIndex]
      filters.subjectId = sub.id
      filters.subjectName = items[res.tapIndex]
    }
  }})
}

function pickAccount() {
  const items = accountStore.accounts.map(a => `${a.name} (¥${a.balance.toFixed(0)})`)
  uni.showActionSheet({ itemList: items, success: (res) => {
    if (res.tapIndex >= 0) {
      const acc = accountStore.accounts[res.tapIndex]
      filters.accountId = acc.id
      filters.accountName = items[res.tapIndex]
    }
  }})
}

async function doSearch() {
  searched.value = true
  results.value = await txStore.search({
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined,
    subjectId: filters.subjectId || undefined,
    accountId: filters.accountId || undefined,
  })
}

function viewTx(tx: TransactionDetail) {
  uni.navigateTo({ url: `/pages/transactions/detail?id=${tx.id}` })
}

onShow(() => {
  subjectStore.load()
  accountStore.load()
})
</script>

<style lang="scss" scoped>
.page-search { padding: 10px; }
.filters {
  background: #FDFCF9; border-radius: 6px; padding: 10px;
  margin-bottom: 10px; border: 1px solid #EDE8E0;
}
.filter-row { display: flex; gap: 6px; align-items: center; margin-bottom: 6px; }
.sep { color: #9E9790; font-size: 14px; }
.filter-input { flex: 1; }
.section-title { font-size: 12px; color: #6B6560; margin-bottom: 6px; font-weight: 500; }
.tx-item {
  display: flex; justify-content: space-between; align-items: center;
  background: #FDFCF9; border-radius: 6px; padding: 10px;
  margin-bottom: 4px; border: 1px solid #EDE8E0; cursor: pointer;
}
.tx-item:active { background: #F7F4EE; }
.tx-left { display: flex; flex-direction: column; gap: 2px; flex: 1; }
.tx-subject { font-size: 13px; color: #1C1915; font-weight: 500; }
.tx-meta { font-size: 11px; color: #9E9790; }
.tx-amount { font-family: 'DM Mono', monospace; font-size: 13px; font-weight: 500; }
.red { color: #C44536; }
.green { color: #2D7D7A; }
.empty { text-align: center; color: #9E9790; padding: 30px; font-size: 14px; }
</style>
