<template>
  <div class="page-report">
    <!-- Net Asset Trend -->
    <div class="section" v-if="netAssetTrend.length > 0">
      <div class="section-title">净资产趋势（近6月）</div>
      <div class="trend-chart">
        <div v-for="t in netAssetTrend" :key="t.period" class="tc-col">
          <div class="tc-bar-wrap">
            <div class="tc-bar" :style="{ height: t.barH + '%' }"></div>
          </div>
          <span class="tc-label">{{ t.period.slice(5) }}</span>
          <span class="tc-val">¥{{ t.amount.toFixed(0) }}</span>
        </div>
      </div>
    </div>

    <!-- Month-over-Month / Year-over-Year -->
    <div class="section" v-if="yoyData.length > 0">
      <div class="section-title">环比/同比分析</div>
      <div class="yoy-grid">
        <div class="yoy-header">
          <span class="yoy-period">月份</span>
          <span class="yoy-val">收入</span>
          <span class="yoy-val">支出</span>
          <span class="yoy-val">结余</span>
          <span class="yoy-chg">环比</span>
        </div>
        <div v-for="d in yoyData" :key="d.period" class="yoy-row">
          <span class="yoy-period">{{ d.period.slice(5) }}</span>
          <span class="yoy-val">¥{{ d.income.toFixed(0) }}</span>
          <span class="yoy-val">¥{{ d.expense.toFixed(0) }}</span>
          <span :class="['yoy-val', d.surplus >= 0 ? 'green' : 'red']">¥{{ d.surplus.toFixed(0) }}</span>
          <span :class="['yoy-chg', d.mom >= 0 ? 'green' : 'red']">{{ d.mom >= 0 ? '+' : '' }}{{ d.mom }}%</span>
        </div>
      </div>
    </div>

    <!-- Account Balance Distribution -->
    <div class="section" v-if="accountDist.length > 0">
      <div class="section-title">账户余额分布</div>
      <div v-for="a in accountDist" :key="a.name" class="dist-item">
        <span class="dist-name">{{ a.name }}</span>
        <div class="dist-bar-outer">
          <div class="dist-bar-inner" :style="{ width: a.pct + '%', background: a.color }"></div>
        </div>
        <span class="dist-val">¥{{ a.balance.toFixed(0) }} ({{ a.pct }}%)</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {  onLoad  } from '@/uni-shim'
import { getDatabase } from '@/database/factory'
import { ReportGenerator } from '@/services/report-generator'

const netAssetTrend = ref<{ period: string; amount: number; barH: number }[]>([])
const yoyData = ref<{ period: string; income: number; expense: number; surplus: number; mom: number }[]>([])
const accountDist = ref<{ name: string; balance: number; pct: number; color: string }[]>([])

onLoad(async () => {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  const db = await getDatabase()
  const gen = new ReportGenerator(db)

  // Net asset trend (6 months)
  const months: { period: string; net: number }[] = []
  for (let i = 5; i >= 0; i--) {
    let my = m - i
    let yy = y
    while (my < 1) { my += 12; yy-- }
    const bs = await gen.generateBalanceSheet(yy, my)
    months.push({ period: `${yy}-${String(my).padStart(2, '0')}`, net: bs.totalEquity })
  }
  const maxNet = Math.max(...months.map(m => Math.abs(m.net)), 1)
  netAssetTrend.value = months.map(m => ({
    ...m,
    amount: m.net,
    barH: Math.round(Math.abs(m.net) / maxNet * 100),
  }))

  // Month-over-month analysis (6 months)
  const yoy: { period: string; income: number; expense: number; surplus: number; mom: number }[] = []
  for (let i = 5; i >= 0; i--) {
    let my = m - i
    let yy = y
    while (my < 1) { my += 12; yy-- }
    const stmt = await gen.generateIncomeStatement(yy, my)
    const prev = yoy.length > 0 ? yoy[yoy.length - 1] : null
    yoy.push({
      period: `${yy}-${String(my).padStart(2, '0')}`,
      income: stmt.totalIncome,
      expense: stmt.totalExpense,
      surplus: stmt.netSurplus,
      mom: prev && prev.surplus !== 0 ? Math.round((stmt.netSurplus - prev.surplus) / Math.abs(prev.surplus) * 100) : 0,
    })
  }
  yoyData.value = yoy

  // Account balance distribution
  const accounts = await db.query<{ name: string }>(
    'SELECT a.name, SUM(CASE WHEN je.direction="debit" THEN je.amount ELSE -je.amount END) as balance FROM accounts a LEFT JOIN journal_entries je ON a.id = je.account_id WHERE a.is_active = 1 GROUP BY a.id'
  )
  const absTotal = accounts.reduce((s: number, a: any) => s + Math.abs(a.balance || 0), 0)
  const colors = ['#007AFF', '#34C759', '#FF9500', '#DC2626', '#5856D6', '#FF2D55', '#AF52DE', '#5AC8FA']
  accountDist.value = accounts
    .filter((a: any) => Math.abs(a.balance || 0) > 0)
    .map((a: any, i: number) => ({
      name: a.name,
      balance: Math.round((a.balance || 0) * 100) / 100,
      pct: absTotal > 0 ? Math.round(Math.abs(a.balance || 0) / absTotal * 100) : 0,
      color: colors[i % colors.length],
    }))
})
</script>

<style lang="scss" scoped>
.page-report { padding: 10px; }
.section { background: #FDFCF9; border-radius: 6px; padding: 12px; margin-bottom: 8px; }
.section-title { font-size: 14px; font-weight: bold; margin-bottom: 7px; }
.trend-chart { display: flex; gap: 6px; align-items: flex-end; height: 100px; }
.tc-col { flex: 1; display: flex; flex-direction: column; align-items: center; }
.tc-bar-wrap { flex: 1; width: 100%; display: flex; align-items: flex-end; justify-content: center; }
.tc-bar { width: 60%; min-height: 2px; background: #C44536; border-radius: 2px 2px 0 0; transition: height 0.6s; }
.tc-label { font-size: 9px; color: #9E9790; margin-top: 2px; }
.tc-val { font-size: 8px; color: #6B6560; font-family: monospace; }
.yoy-grid { margin-top: 3px; }
.yoy-header, .yoy-row { display: flex; gap: 4px; padding: 3px 0; font-size: 11px; border-bottom: 1px solid #EDE8E0; }
.yoy-header { color: #9E9790; font-size: 10px; }
.yoy-period, .yoy-val, .yoy-chg { flex: 1; text-align: right; font-family: monospace; }
.yoy-period { text-align: left; }
.green { color: #2D7D7A; }
.red { color: #C44536; }
.dist-item { display: flex; align-items: center; gap: 5px; padding: 5px 0; border-bottom: 1px solid #EDE8E0; }
.dist-name { width: 70px; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dist-bar-outer { flex: 1; height: 8px; background: #EDE8E0; border-radius: 4px; overflow: hidden; }
.dist-bar-inner { height: 100%; border-radius: 4px; transition: width 0.6s; }
.dist-val { font-size: 10px; font-family: monospace; color: #6B6560; }
</style>
