<template>
  <div class="dashboard">
    <!-- Hero Net Worth Card — Sumi Ink aesthetic -->
    <div class="hero">
      <div class="hero-content">
        <div class="hero-top">
          <div class="hero-label-group">
            <span class="hero-label-cn">净资产</span>
            <span class="hero-label-en">Net Worth</span>
          </div>
          <div class="hero-period-tag">{{ year }}.{{ String(month).padStart(2, '0') }}</div>
        </div>
        <div class="hero-amount-row">
          <span class="hero-currency">¥</span>
          <span class="hero-amount">{{ netAssetText }}</span>
        </div>
        <div class="hero-rule"></div>
        <div class="hero-legend">
          <div class="hero-legend-item">
            <div class="hl-dot income-dot"></div>
            <span>收入 {{ incomeText }}</span>
          </div>
          <div class="hero-legend-item">
            <div class="hl-dot expense-dot"></div>
            <span>支出 {{ expenseText }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Income / Expense Bar Comparison -->
    <div class="flow-section" style="animation-delay: 0.1s">
      <div class="flow-card" @click="goPage('/pages/transactions/search?type=income')">
        <div class="flow-card-top">
          <div class="flow-icon-wrap income">
            <span class="flow-icon">↓</span>
          </div>
          <div class="flow-label-area">
            <span class="flow-label">收入</span>
            <span class="flow-amount income">{{ incomeText }}</span>
          </div>
        </div>
        <div class="flow-bar-track">
          <div class="flow-bar-fill income" :style="{ width: incomeBarPercent + '%' }"></div>
        </div>
      </div>
      <div class="flow-card" @click="goPage('/pages/transactions/search?type=expense')">
        <div class="flow-card-top">
          <div class="flow-icon-wrap expense">
            <span class="flow-icon">↑</span>
          </div>
          <div class="flow-label-area">
            <span class="flow-label">支出</span>
            <span class="flow-amount expense">{{ expenseText }}</span>
          </div>
        </div>
        <div class="flow-bar-track">
          <div class="flow-bar-fill expense" :style="{ width: expenseBarPercent + '%' }"></div>
        </div>
      </div>
    </div>

    <!-- Budget Ring -->
    <div
      v-if="budgetCap > 0"
      class="budget-section"
      style="animation-delay: 0.2s"
      @click="goPage('/pages/settings/budget')"
    >
      <div class="budget-ring-outer">
        <div class="budget-ring" :style="{ background: budgetConic }">
          <div class="budget-ring-inner">
            <span class="budget-ring-pct">{{ budgetPercent }}%</span>
            <span class="budget-ring-label">已用</span>
          </div>
        </div>
      </div>
      <div class="budget-details">
        <div class="budget-header-row">
          <span class="budget-title">本月预算</span>
          <span :class="['budget-status', budgetPercent > 80 ? 'status-warn' : '']">
            {{ budgetStatusText }}
          </span>
        </div>
        <div class="budget-amount-row">
          <span class="budget-used">{{ budgetUsedText }}</span>
          <span class="budget-sep">/</span>
          <span class="budget-total">{{ budgetCapText }}</span>
        </div>
        <div class="budget-bar-mini">
          <div
            :class="['budget-bar-mini-fill', budgetPercent > 80 ? 'fill-warn' : '']"
            :style="{ width: Math.min(budgetPercent, 100) + '%' }"
          ></div>
        </div>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="actions-section" style="animation-delay: 0.3s">
      <div class="actions-row">
        <div class="action-btn primary-expense" @click="goAdd('expense')">
          <div class="action-btn-circle">
            <span class="action-btn-symbol">−</span>
          </div>
          <span class="action-btn-text">记支出</span>
        </div>
        <div class="action-btn primary-income" @click="goAdd('income')">
          <div class="action-btn-circle">
            <span class="action-btn-symbol">+</span>
          </div>
          <span class="action-btn-text">记收入</span>
        </div>
        <div class="action-btn secondary" @click="goAdd('transfer')">
          <div class="action-btn-circle secondary-circle">
            <span class="action-btn-symbol secondary-symbol">⇄</span>
          </div>
          <span class="action-btn-text">转账</span>
        </div>
      </div>
      <div class="quicklinks-row">
        <div class="ql-chip" @click="goPage('/pages/transactions/add?type=salary')">工资</div>
        <div class="ql-chip" @click="goPage('/pages/transactions/add?type=investment_buy')">买入</div>
        <div class="ql-chip" @click="goPage('/pages/transactions/add?type=investment_sell')">卖出</div>
        <div class="ql-chip" @click="goPage('/pages/transactions/add?type=loan_repay')">还款</div>
      </div>
    </div>

    <!-- Recent Transactions -->
    <div class="tx-section" style="animation-delay: 0.4s">
      <div class="tx-header">
        <span class="tx-header-title">最近交易</span>
        <div class="tx-header-action" @click="goPage('/pages/transactions/search')">
          <span class="tx-header-action-text">查看全部</span>
          <span class="tx-header-action-arrow">→</span>
        </div>
      </div>

      <div class="tx-list">
        <div
          v-for="(tx, idx) in txStore.recentTxns"
          :key="tx.id"
          class="tx-row"
          :style="{ animationDelay: (0.5 + idx * 0.06) + 's' }"
          @click="viewTx(tx)"
        >
          <div class="tx-row-left">
            <div class="tx-subject-line">
              <span :class="['tx-type-dot', isExpense(tx) ? 'dot-expense' : 'dot-income']">
                {{ isExpense(tx) ? '支' : '收' }}
              </span>
              <span class="tx-subject-name">{{ tx.subjectName }}</span>
              <span v-if="isAboutToArchive(tx.txDate)" class="tx-archiving-badge">即将归档</span>
            </div>
            <span class="tx-meta">
              {{ tx.accountName }}{{ tx.note ? ' · ' + tx.note : '' }}
            </span>
            <div v-if="tx.tags && tx.tags.length" class="tx-tags">
              <span v-for="tag in tx.tags" :key="tag.id" class="tx-tag" :style="{ background: tag.color + '20', color: tag.color }">{{ tag.name }}</span>
            </div>
          </div>
          <span :class="['tx-row-amount', isExpense(tx) ? 'amount-expense' : 'amount-income']">
            {{ isExpense(tx) ? '−' : '+' }}¥{{ formatAmount(tx.amount) }}
          </span>
        </div>

        <!-- Empty state -->
        <div v-if="txStore.recentTxns.length === 0" class="tx-empty">
          <div class="tx-empty-decoration">
            <span class="tx-empty-decoration-text">0</span>
          </div>
          <span class="tx-empty-title">暂无交易记录</span>
          <span class="tx-empty-hint">点击上方按钮开始记下第一笔账</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import {  onShow  } from '@/uni-shim'
import { useSubjectStore } from '@/stores/subjects'
import { useAccountStore } from '@/stores/accounts'
import { useTransactionStore } from '@/stores/transactions'
import { BalanceCalculator } from '@/services/balance-calculator'
import { getDatabase } from '@/database/factory'

const subjectStore = useSubjectStore()
const accountStore = useAccountStore()
const txStore = useTransactionStore()

const now = new Date()
const year = now.getFullYear()
const month = now.getMonth() + 1

const incomeTotal = ref(0)
const expenseTotal = ref(0)
const netAssets = ref(0)
const budgetCap = ref(0)
const budgetUsed = ref(0)

/* ── Computed ── */
const netAssetText = computed(() => formatAmount(netAssets.value))
const incomeText = computed(() => '¥' + formatAmount(incomeTotal.value))
const expenseText = computed(() => '¥' + formatAmount(expenseTotal.value))
const budgetCapText = computed(() => '¥' + formatAmount(budgetCap.value))
const budgetUsedText = computed(() => '¥' + formatAmount(budgetUsed.value))

const budgetPercent = computed(() =>
  budgetCap.value > 0 ? Math.round((budgetUsed.value / budgetCap.value) * 100) : 0
)

const budgetStatusText = computed(() => {
  if (budgetPercent.value >= 100) return '已超支'
  if (budgetPercent.value > 80) return '即将超支'
  return '预算充足'
})

const maxFlow = computed(() => Math.max(incomeTotal.value, expenseTotal.value, 1))

const incomeBarPercent = computed(() =>
  Math.round((incomeTotal.value / maxFlow.value) * 100)
)
const expenseBarPercent = computed(() =>
  Math.round((expenseTotal.value / maxFlow.value) * 100)
)

const budgetConic = computed(() => {
  const pct = Math.min(budgetPercent.value, 100)
  const color = pct > 80 ? '#C44536' : '#2D7D7A'
  return `conic-gradient(${color} 0% ${pct}%, #E8E4DC ${pct}% 100%)`
})

/* ── Helpers ── */
function isExpense(tx: any) {
  return [
    'expense', 'asset_purchase',
    'loan_repay', 'prepaid_amortize', 'credit_card_spend',
  ].includes(tx.txType)
}

function formatAmount(n: number): string {
  return Math.abs(n).toFixed(2)
}

function isAboutToArchive(txDate: string): boolean {
  const d = new Date(txDate)
  const now = new Date()
  const days = Math.floor((now.getTime() - d.getTime()) / 86400000)
  return days >= 55 && days < 60
}

function goAdd(type: string) {
  uni.navigateTo({ url: '/pages/transactions/add?type=' + type })
}

function goPage(url: string) {
  uni.navigateTo({ url })
}

function viewTx(tx: any) {
  uni.navigateTo({ url: `/pages/transactions/detail?id=${tx.id}` })
}

/* ── Lifecycle ── */
onShow(async () => {
  try {
  await Promise.all([subjectStore.load(), accountStore.load()])
  txStore.loadRecent()

  const db = await getDatabase()
  // Attach tags to recent transactions for display
  const allTags = await db.query<{ id: number; name: string; color: string }>('SELECT id, name, color FROM tags')
  const allTxTags = await db.query<{ transaction_id: number; tag_id: number }>('SELECT transaction_id, tag_id FROM transaction_tags')
  for (const tx of txStore.recentTxns) {
    const tagIds = allTxTags.filter(tt => tt.transaction_id === tx.id).map(tt => tt.tag_id)
    ;(tx as any).tags = allTags.filter(t => tagIds.includes(t.id))
  }

  const calc = new BalanceCalculator(db)
  const balances = await calc.calculate(year, month)

  incomeTotal.value = balances
    .filter(b => b.subjectType === 'income')
    .reduce((s, b) => s + Math.max(0, b.closingBalance), 0)

  expenseTotal.value = balances
    .filter(b => b.subjectType === 'expense')
    .reduce((s, b) => s + Math.max(0, b.closingBalance), 0)

  const assetTotal = balances
    .filter(b => b.subjectType === 'asset')
    .reduce((s, b) => s + b.closingBalance, 0)
  const liabilityTotal = balances
    .filter(b => b.subjectType === 'liability')
    .reduce((s, b) => s + b.closingBalance, 0)
  netAssets.value = assetTotal - liabilityTotal

  const overall = await db.queryOne<{ monthlyCap: number }>(
    'SELECT monthly_cap FROM budget_overall WHERE is_active = 1 LIMIT 1'
  )
  budgetCap.value = overall?.monthlyCap ?? 0
  budgetUsed.value = expenseTotal.value
  } catch (e) { console.error('Dashboard load error:', e) }
})
</script>

<style lang="scss" scoped>
/* ═══════════════════════════════════════
   Dashboard — Wealth Ledger Aesthetic
   ═══════════════════════════════════════ */

/* ── Page container ── */
.dashboard {
  padding: 0 16px 80px;
  max-width: 500px;
  margin: 0 auto;
}

/* ── Animations ── */
@keyframes fadeSlideUp {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.92);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.hero,
.flow-section,
.budget-section,
.actions-section,
.tx-section {
  animation: fadeSlideUp 0.6s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.tx-row {
  animation: fadeSlideUp 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
}

/* ═══════════════════════════════════════
   HERO CARD — Sumi Ink
   ═══════════════════════════════════════ */
.hero {
  position: relative;
  margin: 16px 0 14px;
  border-radius: 12px;
  overflow: hidden;
  min-height: 180px;
  background: #1C1915 linear-gradient(160deg, #1C1915 0%, #2D2A26 60%, #3D3A35 100%) !important;
}

.hero-content {
  position: relative;
  padding: 28px 24px 24px;
  z-index: 1;
}

.hero-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 14px;
}

.hero-label-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.hero-label-cn {
  font-family: 'Noto Serif SC', serif;
  font-size: 16px;
  font-weight: 600;
  color: rgba(252, 250, 247, 0.7);
  letter-spacing: 0.08em;
}

.hero-label-en {
  font-size: 11px;
  color: rgba(252, 250, 247, 0.35);
  font-weight: 400;
  letter-spacing: 0.06em;
}

.hero-period-tag {
  font-family: 'DM Mono', monospace;
  font-size: 12px;
  color: #C44536;
  background: rgba(196, 69, 54, 0.12);
  border: 1px solid rgba(196, 69, 54, 0.2);
  border-radius: 4px;
  padding: 3px 10px;
  line-height: 1.4;
}

.hero-amount-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 20px;
}

.hero-currency {
  font-family: 'Noto Serif SC', serif;
  font-size: 22px;
  color: #C44536;
  font-weight: 500;
}

.hero-amount {
  font-family: 'DM Mono', monospace;
  font-size: 40px;
  font-weight: 400;
  color: #FCFAF7;
  letter-spacing: -0.02em;
  line-height: 1.05;
}

.hero-rule {
  width: 100%;
  height: 1px;
  background: rgba(252, 250, 247, 0.08);
  margin-bottom: 14px;
}

.hero-legend {
  display: flex;
  align-items: center;
  gap: 20px;
}

.hero-legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: rgba(252, 250, 247, 0.55);
}

.hl-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.income-dot { background: #5EC4BA; }
.expense-dot { background: #D6685B; }

/* ═══════════════════════════════════════
   INCOME / EXPENSE FLOW BARS
   ═══════════════════════════════════════ */
.flow-section {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.flow-card {
  flex: 1;
  background: #FDFCF9;
  border-radius: 12px;
  padding: 18px 16px 16px;
  border: 1px solid #EDE8E0;
  transition: all 180ms ease;
  &:active { transform: scale(0.97); box-shadow: 0 1px 4px rgba(28,25,21,0.04); }
}
.flow-card-top { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.flow-icon-wrap {
  width: 42px; height: 42px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  &.income { background: #EDF6F5; .flow-icon { color: #2D7D7A; } }
  &.expense { background: #FDF4F2; .flow-icon { color: #C44536; } }
}
.flow-icon { font-size: 20px; font-weight: 700; font-family: 'DM Mono', monospace; }
.flow-label-area { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.flow-label { font-size: 14px; color: #6B6560; }
.flow-amount { font-family: 'DM Mono', monospace; font-size: 20px; font-weight: 500; letter-spacing: -0.02em;
  &.income { color: #2D7D7A; }
  &.expense { color: #C44536; }
}
.flow-bar-track { height: 4px; background: #E8E4DC; border-radius: 2px; overflow: hidden; }
.flow-bar-fill { height: 100%; border-radius: 2px; transition: width 0.8s cubic-bezier(0.22, 1, 0.36, 1);
  &.income { background: #2D7D7A; }
  &.expense { background: #C44536; }
}

/* ═══════════════════════════════════════
   BUDGET SECTION
   ═══════════════════════════════════════ */
.budget-section {
  background: #FDFCF9; border-radius: 12px;
  box-shadow: 0 1px 4px rgba(28,25,21,0.04); border: 1px solid #EDE8E0;
  display: flex; align-items: center; gap: 20px; padding: 20px;
  margin-bottom: 14px; transition: all 180ms ease; cursor: pointer;
  &:active { transform: scale(0.98); }
}
.budget-ring-outer { flex-shrink: 0; }
.budget-ring { width: 80px; height: 80px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: background 0.5s ease; }
.budget-ring-inner { width: 56px; height: 56px; border-radius: 50%; background: #FDFCF9; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.budget-ring-pct { font-family: 'DM Mono', monospace; font-size: 20px; font-weight: 500; color: #1C1915; line-height: 1.2; }
.budget-ring-label { font-size: 11px; color: #9E9790; }
.budget-details { flex: 1; min-width: 0; }
.budget-header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.budget-title { font-size: 15px; font-weight: 600; color: #1C1915; }
.budget-status { font-size: 12px; color: #2D7D7A; font-weight: 500;
  &.status-warn { color: #C44536; }
}
.budget-amount-row { display: flex; align-items: baseline; gap: 4px; margin-bottom: 8px; }
.budget-used { font-family: 'DM Mono', monospace; font-size: 16px; font-weight: 500; color: #1C1915; }
.budget-sep { font-size: 13px; color: #9E9790; }
.budget-total { font-family: 'DM Mono', monospace; font-size: 14px; color: #6B6560; }
.budget-bar-mini { height: 4px; background: #E8E4DC; border-radius: 2px; overflow: hidden; }
.budget-bar-mini-fill { height: 100%; border-radius: 2px; background: #2D7D7A; transition: width 0.6s ease;
  &.fill-warn { background: #C44536; }
}

/* ═══════════════════════════════════════
   QUICK ACTIONS
   ═══════════════════════════════════════ */
.actions-section {
  margin-bottom: 14px;
}

.actions-row {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.action-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: all 180ms ease;

  &:active {
    transform: scale(0.93);
  }
}

.action-btn-circle {
  width: 64px; height: 64px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 180ms ease;
}

.action-btn-symbol {
  font-family: 'DM Mono', monospace;
  font-size: 26px; font-weight: 500; color: #ffffff;
  line-height: 1;
}

.primary-expense .action-btn-circle {
  background: #C44536;
  box-shadow: 0 2px 8px rgba(196, 69, 54, 0.25);
}

.primary-income .action-btn-circle {
  background: #2D7D7A;
  box-shadow: 0 2px 8px rgba(45, 125, 122, 0.25);
}

.secondary-circle {
  background: #E8E4DC;
  box-shadow: 0 1px 4px rgba(15, 27, 45, 0.06);
}

.secondary-symbol {
  color: #6B6560;
}

.action-btn-text { font-size: 13px; color: #6B6560; font-weight: 500; }
.quicklinks-row { display: flex; gap: 8px; flex-wrap: wrap; }
.ql-chip {
  background: #FDFCF9; border: 1px solid #E0DBD3; border-radius: 20px;
  padding: 8px 18px; font-size: 13px; color: #6B6560;
  cursor: pointer; transition: all 180ms ease;
  &:active { background: #E8E4DC; transform: scale(0.96); }
}

/* ═══════════════════════════════════════
   RECENT TRANSACTIONS
   ═══════════════════════════════════════ */
.tx-section {
  background: #FDFCF9; border-radius: 6px; box-shadow: 0 1px 4px rgba(28,25,21,0.04); border: 1px solid #EDE8E0;
  overflow: hidden;
}

.tx-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 14px 0;
  margin-bottom: 4px;
}

.tx-header-title {
  font-family: 'Noto Serif SC', serif;
  font-size: 18px; font-weight: 700; color: #1C1915; letter-spacing: 0.02em;
}

.tx-header-action {
  display: flex;
  align-items: center;
  gap: 3px;
  cursor: pointer;
  padding: 3px 6px;
  border-radius: 4px;
  transition: background 180ms ease;

  &:active {
    background: #E8E4DC;
  }
}

.tx-header-action-text {
  font-size: 14px; color: #A83A2D;
  font-weight: 500;
}

.tx-header-action-arrow {
  font-size: 10px;
  color: #A83A2D;
  transition: transform 180ms ease;
}

.tx-header-action:active .tx-header-action-arrow {
  transform: translateX(2px);
}

/* ── Transaction row ── */
.tx-list {
  padding: 0 0 4px;
}

.tx-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 11px 14px;
  cursor: pointer;
  transition: all 180ms ease;
  border-bottom: 1px solid #EDE8E0;

  &:last-child {
    border-bottom: none;
  }

  &:active {
    background: #F7F4EE;
  }
}

.tx-row-left {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tx-subject-line { display: flex; align-items: center; gap: 8px; }
.tx-type-dot {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 6px;
  font-size: 13px; font-weight: 600; font-family: 'Noto Serif SC', serif; flex-shrink: 0;
  &.dot-income { background: #EDF6F5; color: #2D7D7A; }
  &.dot-expense { background: #FDF4F2; color: #C44536; }
}
.tx-subject-name { font-size: 16px; font-weight: 500; color: #1C1915; }
.tx-archiving-badge { font-size: 10px; color: #E08900; background: #FFF5EB; padding: 2px 8px; border-radius: 10px; flex-shrink: 0; }

.tx-meta { font-size: 12px; color: #9E9790; margin-left: 36px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tx-tags { display: flex; gap: 4px; margin-left: 36px; margin-top: 4px; flex-wrap: wrap; }
.tx-tag { font-size: 10px; padding: 2px 8px; border-radius: 6px; }

.tx-row-amount {
  font-family: 'DM Mono', monospace;
  font-size: 18px; font-weight: 500; letter-spacing: -0.02em; flex-shrink: 0; margin-left: 12px;

  &.amount-income { color: #2D7D7A; }
  &.amount-expense { color: #C44536; }
}

/* ── Empty state ── */
.tx-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 28px 14px;
}

.tx-empty-decoration {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #E8E4DC;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 10px;
}

.tx-empty-decoration-text {
  font-family: 'DM Mono', monospace;
  font-size: 16px;
  font-weight: 500;
  color: #9E9790;
}

.tx-empty-title {
  font-size: 14px;
  color: #6B6560;
  margin-bottom: 4px;
}

.tx-empty-hint {
  font-size: 12px;
  color: #9E9790;
}
</style>
