<template>
  <div class="page-report">
    <div class="rpt-header">
      <span class="rpt-title">预算执行报告</span>
      <span class="rpt-date">{{ periodStr }}</span>
    </div>

    <!-- Overall Budget -->
    <div class="section" v-if="budgetCap > 0">
      <div class="section-title">总预算执行</div>
      <div class="summary-grid">
        <div class="sg-item"><span class="sg-label">预算</span><span class="sg-val">¥{{ budgetCap }}</span></div>
        <div class="sg-item"><span class="sg-label">实际</span><span :class="['sg-val', budgetUsed > budgetCap ? 'over' : '']">¥{{ budgetUsed }}</span></div>
        <div class="sg-item"><span class="sg-label">结余</span><span :class="['sg-val', budgetRemaining >= 0 ? 'green' : 'red']">¥{{ budgetRemaining }}</span></div>
        <div class="sg-item"><span class="sg-label">执行率</span><span :class="['sg-val', budgetPct > 100 ? 'over' : budgetPct > 80 ? 'warn' : '']">{{ budgetPct }}%</span></div>
      </div>
      <div class="progress-bar-outer">
        <div :class="['progress-bar-inner', budgetPct > 100 ? 'over' : budgetPct > 80 ? 'warn' : '']" :style="{ width: Math.min(budgetPct, 100) + '%' }"></div>
      </div>
    </div>

    <!-- Threshold Violations -->
    <div class="section" v-if="violations.length > 0">
      <div class="section-title">超阈值科目</div>
      <div v-for="v in violations" :key="v.name" class="violation-item">
        <span class="v-name">{{ v.name }}</span>
        <div class="v-bar-outer">
          <div class="v-bar-inner over" :style="{ width: Math.min(v.pct, 100) + '%' }"></div>
        </div>
        <span class="v-amount">¥{{ v.actual }} / ¥{{ v.limit }} ({{ v.pct }}%)</span>
      </div>
    </div>
    <div v-else class="section">
      <div class="section-title">超阈值科目</div>
      <span class="empty">本月无超阈值科目</span>
    </div>

    <!-- 6-Month Budget Trend -->
    <div class="section" v-if="trendData.length > 0">
      <div class="section-title">近6月预算执行趋势</div>
      <div class="trend-table">
        <div class="t-row t-header">
          <span class="t-period">月份</span>
          <span class="t-bar-cell">执行率</span>
          <span class="t-amount">实际</span>
        </div>
        <div v-for="t in trendData" :key="t.period" class="t-row">
          <span class="t-period">{{ t.period }}</span>
          <div class="t-bar-cell">
            <div :class="['t-bar', t.pct > 100 ? 'over' : t.pct > 80 ? 'warn' : '']" :style="{ width: Math.min(t.pct, 100) + '%' }"></div>
            <span class="t-pct">{{ t.pct }}%</span>
          </div>
          <span class="t-amount">¥{{ t.actual }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {  onLoad  } from '@/uni-shim'
import { getDatabase } from '@/database/factory'
import { BalanceCalculator } from '@/services/balance-calculator'
import { useSubjectStore } from '@/stores/subjects'

const periodStr = ref('')
const budgetCap = ref(0)
const budgetUsed = ref(0)
const violations = ref<{ name: string; actual: number; limit: number; pct: number }[]>([])
const trendData = ref<{ period: string; actual: number; cap: number; pct: number }[]>([])

const budgetRemaining = ref(0)
const budgetPct = ref(0)

async function load(period?: string) {
  periodStr.value = period || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  const [y, m] = periodStr.value.split('-').map(Number)
  if (!y || !m) return

  const db = await getDatabase()
  const calc = new BalanceCalculator(db)
  const balances = await calc.calculate(y, m)

  // Total expense this month
  const expense = balances.filter(b => b.subjectType === 'expense').reduce((s, b) => s + b.closingBalance, 0)
  budgetUsed.value = Math.round(expense * 100) / 100

  // Overall budget
  const overall = await db.queryOne<{ monthlyCap: number }>('SELECT monthly_cap FROM budget_overall WHERE is_active = 1 LIMIT 1')
  budgetCap.value = overall?.monthlyCap ?? 0
  budgetRemaining.value = Math.round((budgetCap.value - budgetUsed.value) * 100) / 100
  budgetPct.value = budgetCap.value > 0 ? Math.round(budgetUsed.value / budgetCap.value * 100) : 0

  // Threshold violations
  const subjectStore = useSubjectStore()
  await subjectStore.load()
  const thresholds = await db.query<{ subjectId: number; amount: number }>(
    'SELECT subject_id, amount FROM budget_thresholds WHERE is_active = 1'
  )
  const vList: { name: string; actual: number; limit: number; pct: number }[] = []
  for (const th of thresholds) {
    const actual = balances.filter(b => b.subjectType === 'expense')
      .filter(b => b.subjectId === th.subjectId || subjectStore.getChildren(th.subjectId).some(c => c.id === b.subjectId))
      .reduce((s, b) => s + b.closingBalance, 0)
    if (actual > th.amount) {
      const sub = subjectStore.getById(th.subjectId)
      vList.push({
        name: sub?.name || `#${th.subjectId}`,
        actual: Math.round(actual * 100) / 100,
        limit: th.amount,
        pct: Math.round(actual / th.amount * 100),
      })
    }
  }
  violations.value = vList

  // 6-month trend
  const gen = new (await import('@/services/report-generator')).ReportGenerator(db)
  const months: { period: string; actual: number; cap: number }[] = []
  for (let i = 5; i >= 0; i--) {
    let my = m - i
    let yy = y
    while (my < 1) { my += 12; yy-- }
    const stmt = await gen.generateIncomeStatement(yy, my)
    const cap = await db.queryOne<{ monthlyCap: number }>(
      `SELECT monthly_cap FROM budget_overall WHERE is_active = 1 AND active_month LIKE ?`,
      [`${yy}${String(my).padStart(2, '0')}%`]
    )
    months.push({
      period: `${yy}-${String(my).padStart(2, '0')}`,
      actual: stmt.totalExpense,
      cap: cap?.monthlyCap ?? 0,
    })
  }
  trendData.value = months.map(m => ({
    ...m,
    pct: m.cap > 0 ? Math.round(m.actual / m.cap * 100) : 0,
  }))
}

onLoad((opt) => load(opt?.period as string))
</script>

<style lang="scss" scoped>
.page-report { padding: 10px; }
.rpt-header { text-align: center; margin-bottom: 12px; }
.rpt-title { font-size: 18px; font-weight: bold; }
.rpt-date { font-size: 12px; color: #9E9790; display: block; }
.section { background: #FDFCF9; border-radius: 6px; padding: 12px; margin-bottom: 8px; }
.section-title { font-size: 14px; font-weight: bold; margin-bottom: 6px; }
.summary-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; }
.sg-item { flex: 1; min-width: 70px; text-align: center; }
.sg-label { font-size: 11px; color: #9E9790; display: block; }
.sg-val { font-size: 16px; font-weight: bold; font-family: monospace; }
.sg-val.over { color: #C44536; }
.sg-val.warn { color: #FF9500; }
.sg-val.green { color: #2D7D7A; }
.sg-val.red { color: #C44536; }
.progress-bar-outer { height: 5px; background: #EDE8E0; border-radius: 3px; overflow: hidden; }
.progress-bar-inner { height: 100%; border-radius: 3px; background: #2D7D7A; transition: width 0.6s; }
.progress-bar-inner.warn { background: #FF9500; }
.progress-bar-inner.over { background: #C44536; }
.violation-item { display: flex; align-items: center; gap: 6px; padding: 5px 0; border-bottom: 1px solid #EDE8E0; }
.v-name { font-size: 13px; width: 80px; }
.v-bar-outer { flex: 1; height: 3px; background: #EDE8E0; border-radius: 2px; overflow: hidden; }
.v-bar-inner { height: 100%; border-radius: 2px; }
.v-bar-inner.over { background: #C44536; }
.v-amount { font-size: 11px; color: #C44536; font-family: monospace; }
.empty { font-size: 12px; color: #9E9790; display: block; padding: 5px 0; }
.trend-table { margin-top: 5px; }
.t-row { display: flex; align-items: center; gap: 5px; padding: 5px 0; border-bottom: 1px solid #EDE8E0; }
.t-header { font-size: 11px; color: #9E9790; }
.t-period { width: 60px; font-size: 12px; }
.t-bar-cell { flex: 1; position: relative; height: 14px; display: flex; align-items: center; }
.t-bar { position: absolute; left: 0; top: 0; height: 100%; background: #2D7D7A; opacity: 0.3; border-radius: 2px; }
.t-bar.warn { background: #FF9500; }
.t-bar.over { background: #C44536; }
.t-pct { position: relative; z-index: 1; font-size: 11px; font-family: monospace; padding-left: 3px; }
.t-amount { font-size: 11px; font-family: monospace; }
</style>
