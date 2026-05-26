<template>
  <div class="page-detail">
    <div class="summary-card">
      <div class="title">{{ account?.name || '账户详情' }}</div>
      <div :class="['balance', (account?.balance ?? 0) >= 0 ? 'positive' : 'negative']">
        ¥{{ formatAmount(account?.balance ?? 0) }}
      </div>
      <div class="meta">类型：{{ typeName(account?.accountType || '') }}</div>
      <div v-if="warnings.length > 0" class="warnings">
        <div v-for="w in warnings" :key="w" class="warn-item">{{ w }}</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">交易记录</div>
      <div v-for="tx in transactions" :key="tx.id" class="tx-item" @click="viewTx(tx)">
        <div class="tx-left">
          <span class="tx-subject">{{ tx.subjectName }}</span>
          <span class="tx-type-tag">{{ txTypeName(tx.txType) }}</span>
        </div>
        <span :class="['tx-amount', isOutTx(tx) ? 'red' : 'green']">
          {{ isOutTx(tx) ? '-' : '+' }}¥{{ Math.abs(tx.amount).toFixed(2) }}
        </span>
      </div>
      <div v-if="transactions.length === 0" class="empty">暂无交易</div>
    </div>

    <div class="delete-bar">
      <el-button type="error" plain @click="confirmDelete">删除账户</el-button>
    </div>

    <!-- Transfer picker popup -->
    <el-dialog v-model="showTransferPicker" @close="showTransferPicker = false">
      <div class="popup-content">
        <div class="popup-title">选择余额转入账户</div>
        <div class="popup-hint">账户 {{ account?.name }} 当前余额 ¥{{ formatAmount(account?.balance ?? 0) }}，请选择转入目标</div>
        <div class="target-list">
          <div
            v-for="acc in transferTargets"
            :key="acc.id"
            class="target-item"
            @click="doDelete(acc.id)"
          >
            <div class="target-left">
              <span class="target-name">{{ acc.name }}</span>
              <span class="target-type">{{ typeName(acc.accountType) }}</span>
            </div>
            <span :class="['target-balance', acc.balance >= 0 ? 'positive' : 'negative']">
              ¥{{ formatAmount(acc.balance) }}
            </span>
          </div>
        </div>
        <div class="popup-actions">
          <el-button @click="showTransferPicker = false">取消</el-button>
          <el-button type="warning" @click="doDelete()">不转移，直接删除</el-button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {  onLoad  } from '@/uni-shim'
import { getDatabase } from '@/database/factory'
import { TransactionRepository, type TransactionDetail } from '@/repositories/transaction-repo'
import { useAccountStore } from '@/stores/accounts'

const accountStore = useAccountStore()
const account = ref<any>(null)
const transactions = ref<TransactionDetail[]>([])
const showTransferPicker = ref(false)

const typeLabels: Record<string, string> = {
  cash: '现金', checking: '活期账户', fixed_deposit: '定期存款',
  money_market: '货币基金', receivable: '应收款', investment: '投资资产',
  fixed_asset: '固定资产', prepaid: '待摊费用', deposit: '押金/保证金',
  credit_card: '信用卡', payable: '应付款', loan: '借款'
}

function typeName(t: string) { return typeLabels[t] || t }

const warnings = computed(() => {
  const w: string[] = []
  if (!account.value) return w
  const bal = account.value.balance ?? 0
  if (account.value.accountType === 'credit_card' && account.value.creditLimit && Math.abs(bal) > account.value.creditLimit) {
    w.push(`信用卡额度 ¥${account.value.creditLimit}，当前欠款 ¥${Math.abs(bal).toFixed(0)}，已超额 ¥${(Math.abs(bal) - account.value.creditLimit).toFixed(0)}`)
  }
  if (['cash','checking'].includes(account.value.accountType) && bal < 0) {
    w.push('现金/存款账户余额为负，请核对账目')
  }
  return w
})
function formatAmount(n: number) { return Math.abs(n).toFixed(2) }

function txTypeName(t: string): string {
  const map: Record<string, string> = { income:'收入', expense:'支出', transfer:'转账', salary:'工资',
    investment_buy:'买入', investment_sell:'卖出', loan_receive:'借款', loan_repay:'还款',
    asset_purchase:'购置', credit_card_spend:'消费', credit_card_repay:'还款' }
  return map[t] || t
}

function isOutTx(tx: TransactionDetail): boolean {
  return ['expense','salary','asset_purchase','loan_repay','prepaid_amortize','credit_card_spend','investment_buy'].includes(tx.txType)
}

function viewTx(tx: TransactionDetail) {
  uni.navigateTo({ url: `/pages/transactions/detail?id=${tx.id}` })
}

// Accounts eligible for balance transfer (same type category, excluding self)
const transferTargets = computed(() => {
  if (!account.value) return []
  const isAsset = !['credit_card','payable','loan'].includes(account.value.accountType)
  return accountStore.accounts.filter(a =>
    a.id !== account.value.id &&
    a.isActive &&
    (isAsset ? !['credit_card','payable','loan'].includes(a.accountType)
            : ['credit_card','payable','loan'].includes(a.accountType))
  )
})

function confirmDelete() {
  const bal = account.value?.balance ?? 0
  const name = account.value?.name || ''
  if (bal !== 0) {
    // Has balance — show transfer picker
    if (transferTargets.value.length === 0) {
      uni.showModal({
        title: '删除账户',
        content: `账户「${name}」当前余额 ¥${formatAmount(bal)}，但无其他同类型账户可转入。确定直接删除吗？余额将清零。`,
        success: (res) => { if (res.confirm) doDelete() }
      })
    } else {
      showTransferPicker.value = true
    }
  } else {
    // No balance — simple confirm
    uni.showModal({
      title: '删除账户',
      content: `确定要删除账户「${name}」吗？`,
      success: (res) => { if (res.confirm) doDelete() }
    })
  }
}

async function doDelete(transferToId?: number) {
  try {
    uni.showLoading({ title: '处理中...' })
    await accountStore.deleteAccount(account.value.id, transferToId)
    uni.hideLoading()
    uni.showToast({ title: '删除成功', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 1000)
  } catch (e: any) {
    uni.hideLoading()
    uni.showToast({ title: '删除失败: ' + (e.message || '未知错误'), icon: 'none' })
  }
}

onLoad(async (opt) => {
  if (opt?.id) {
    account.value = accountStore.getById(Number(opt.id))
    const db = await getDatabase()
    const repo = new TransactionRepository(db)
    transactions.value = await repo.findDetails({ accountId: Number(opt.id), limit: 50 })
  }
})
</script>

<style lang="scss" scoped>
.page-detail { padding: 10px; }
.summary-card {
  background: #FDFCF9; border-radius: 8px; padding: 20px;
  text-align: center; margin-bottom: 10px; border: 1px solid #EDE8E0;
  .title { font-size: 14px; color: #6B6560; font-weight: 500; }
  .balance { font-family: 'DM Mono', monospace; font-size: 24px; font-weight: 500; margin: 8px 0; }
  .positive { color: #2D7D7A; }
  .negative { color: #C44536; }
  .meta { font-size: 12px; color: #9E9790; }
}
.section { background: #FDFCF9; border-radius: 6px; padding: 12px; border: 1px solid #EDE8E0; }
.section-title {
  font-family: 'Noto Serif SC', serif;
  font-size: 13px; font-weight: 700; color: #1C1915; margin-bottom: 6px;
}
.tx-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 8px 0; border-bottom: 1px solid #EDE8E0; cursor: pointer;
}
.tx-item:last-child { border-bottom: none; }
.tx-left { display: flex; flex-direction: column; gap: 2px; }
.tx-subject { font-size: 13px; color: #1C1915; font-weight: 500; }
.tx-type-tag { font-size: 10px; color: #9E9790; }
.tx-amount { font-family: 'DM Mono', monospace; font-size: 13px; font-weight: 500; }
.red { color: #C44536; }
.green { color: #2D7D7A; }
.empty { text-align: center; color: #9E9790; padding: 20px; font-size: 13px; }
.warnings { margin-top: 6px; }
.warn-item { font-size: 11px; color: #C44536; background: #FDF4F2; padding: 5px 8px; border-radius: 4px; margin-bottom: 3px; }
.delete-bar { margin-top: 20px; padding-bottom: 20px; }

/* Transfer picker popup */
.popup-content { padding: 15px; }
.popup-title { font-family: 'Noto Serif SC', serif; font-size: 16px; font-weight: 700; margin-bottom: 8px; text-align: center; color: #1C1915; }
.popup-hint { font-size: 12px; color: #9E9790; margin-bottom: 12px; text-align: center; }
.target-list { max-height: 250px; overflow-y: auto; }
.target-item {
  display: flex; justify-content: space-between; align-items: center;
  background: #F7F4EE; border-radius: 6px; padding: 12px; margin-bottom: 4px; cursor: pointer;
}
.target-item:active { background: #EDE8E0; }
.target-left { display: flex; flex-direction: column; }
.target-name { font-size: 14px; font-weight: 600; color: #1C1915; }
.target-type { font-size: 10px; color: #9E9790; margin-top: 2px; }
.target-balance { font-family: 'DM Mono', monospace; font-size: 13px; font-weight: 500; }
.positive { color: #2D7D7A; }
.negative { color: #C44536; }
.popup-actions { display: flex; gap: 8px; margin-top: 15px; }
</style>
