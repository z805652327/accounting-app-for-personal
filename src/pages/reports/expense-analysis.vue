<template>
  <div class="page-report">
    <div class="period-bar">
      <picker mode="date" :value="periodStr" fields="month" @change="onChange">
        <div class="period-btn">{{ periodStr }}</div>
      </picker>
      <div class="summary-legend">
        <span class="dot fixed"></span>固定支出
        <span class="dot variable"></span>弹性支出
      </div>
    </div>

    <div class="summary-card">
      <div class="s-row"><span>总支出</span><span>¥{{ totalExpense.toFixed(2) }}</span></div>
      <div class="s-row fixed"><span>固定支出</span><span>¥{{ fixedExpense.toFixed(2) }} ({{ fixedPct }}%)</span></div>
      <div class="s-row variable"><span>弹性支出</span><span>¥{{ variableExpense.toFixed(2) }} ({{ variablePct }}%)</span></div>
    </div>

    <div class="bar-chart">
      <div class="bar-track">
        <div class="bar-fixed" :style="{flex: fixedExpense}"></div>
        <div class="bar-variable" :style="{flex: variableExpense || 1}"></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">固定支出明细</div>
      <div v-for="item in fixedDetails" :key="item.name" class="detail-item">
        <span class="d-name">{{ item.name }}</span>
        <span class="d-amount">¥{{ item.amount.toFixed(2) }}</span>
      </div>
      <div v-if="fixedDetails.length === 0" class="empty">暂无数据</div>
    </div>

    <div class="section">
      <div class="section-title">弹性支出明细</div>
      <div v-for="item in variableDetails" :key="item.name" class="detail-item">
        <span class="d-name">{{ item.name }}</span>
        <span class="d-amount">¥{{ item.amount.toFixed(2) }}</span>
      </div>
      <div v-if="variableDetails.length === 0" class="empty">暂无数据</div>
    </div>

    <div class="section" v-if="trend.length > 0">
      <div class="section-title">近6月趋势</div>
      <div class="trend-table">
        <div class="trend-header">
          <span class="th-period">月份</span>
          <span class="th-fixed">固定</span>
          <span class="th-variable">弹性</span>
          <span class="th-total">合计</span>
        </div>
        <div v-for="t in trend" :key="t.period" class="trend-row">
          <span class="tr-period">{{ t.period }}</span>
          <div class="tr-bar-cell">
            <div class="tr-bar-fixed" :style="{ width: t.fixedBar + '%' }"></div>
            <span class="tr-val">¥{{ t.fixed.toFixed(0) }}</span>
          </div>
          <div class="tr-bar-cell">
            <div class="tr-bar-variable" :style="{ width: t.variableBar + '%' }"></div>
            <span class="tr-val">¥{{ t.variable.toFixed(0) }}</span>
          </div>
          <span class="tr-total">¥{{ t.total.toFixed(0) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {  onLoad  } from '@/uni-shim'
import { getDatabase } from '@/database/factory'
import { ReportGenerator } from '@/services/report-generator'

const periodStr = ref('')
const totalExpense = ref(0)
const fixedExpense = ref(0)
const variableExpense = ref(0)
const fixedDetails = ref<{name:string;amount:number}[]>([])
const variableDetails = ref<{name:string;amount:number}[]>([])

const fixedPct = ref(0)
const variablePct = ref(0)
const trend = ref<{ period: string; fixed: number; variable: number; total: number; fixedBar: number; variableBar: number }[]>([])

async function loadTrend() {
  const [y, m] = periodStr.value.split('-').map(Number)
  if (!y || !m) return
  const db = await getDatabase()
  const gen = new ReportGenerator(db)
  const months: { period: string; fixed: number; variable: number }[] = []

  // Last 6 months
  for (let i = 5; i >= 0; i--) {
    let my = m - i
    let yy = y
    while (my < 1) { my += 12; yy-- }
    const stmt = await gen.generateIncomeStatement(yy, my)
    months.push({ period: `${yy}-${String(my).padStart(2, '0')}`, fixed: stmt.fixedExpense, variable: stmt.variableExpense })
  }

  const maxVal = Math.max(...months.map(m => Math.max(m.fixed, m.variable)), 1)
  trend.value = months.map(m => ({
    ...m,
    total: m.fixed + m.variable,
    fixedBar: Math.round(m.fixed / maxVal * 100),
    variableBar: Math.round(m.variable / maxVal * 100),
  }))
}

async function load() {
  const [y, m] = periodStr.value.split('-').map(Number)
  const db = await getDatabase()
  const gen = new ReportGenerator(db)
  const stmt = await gen.generateIncomeStatement(y, m)

  totalExpense.value = stmt.totalExpense
  fixedExpense.value = stmt.fixedExpense
  variableExpense.value = stmt.variableExpense
  fixedPct.value = totalExpense.value > 0 ? Math.round(fixedExpense.value / totalExpense.value * 100) : 0
  variablePct.value = totalExpense.value > 0 ? Math.round(variableExpense.value / totalExpense.value * 100) : 0

  fixedDetails.value = stmt.expenses
    .filter(e => ['501','502','507','508'].includes(e.category) && e.level >= 2)
    .map(e => ({ name: e.name, amount: e.amount }))
  variableDetails.value = stmt.expenses
    .filter(e => !['501','502','507','508'].includes(e.category) && e.level >= 2)
    .map(e => ({ name: e.name, amount: e.amount }))
}

function onChange(e: any) { periodStr.value = e.detail.value; load(); loadTrend() }

onLoad((opt) => {
  periodStr.value = opt?.period || `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`
  load()
  loadTrend()
})
</script>

<style lang="scss" scoped>
.page-report { padding: 10px; }
.period-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; background: #FDFCF9; border-radius: 6px; padding: 10px; }
.period-btn { background: #C44536; color: #fff; padding: 4px 16px; border-radius: 20px; font-size: 14px; display: inline-block; }
.summary-legend { display: flex; gap: 8px; font-size: 11px; color: #6B6560; }
.dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 2px; }
.dot.fixed { background: #C44536; }
.dot.variable { background: #FF9500; }
.summary-card { background: #FDFCF9; border-radius: 6px; padding: 12px; margin-bottom: 10px; }
.s-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 14px; }
.s-row.fixed { color: #C44536; }
.s-row.variable { color: #FF9500; }
.bar-chart { margin-bottom: 10px; }
.bar-track { display: flex; height: 16px; border-radius: 8px; overflow: hidden; background: #E8E4DC; }
.bar-fixed { background: #C44536; }
.bar-variable { background: #FF9500; }
.section { background: #FDFCF9; border-radius: 6px; padding: 10px; margin-bottom: 8px; }
.section-title { font-size: 14px; font-weight: bold; margin-bottom: 6px; }
.detail-item { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; border-bottom: 1px solid #EDE8E0; }
.d-amount { font-weight: bold; }
.empty { text-align: center; color: #9E9790; padding: 15px; font-size: 13px; }
.trend-table { margin-top: 5px; }
.trend-header, .trend-row { display: flex; align-items: center; gap: 5px; padding: 4px 0; }
.trend-header { font-size: 11px; color: #9E9790; border-bottom: 1px solid #EDE8E0; }
.th-period, .tr-period { width: 60px; font-size: 11px; }
.tr-bar-cell { flex: 1; position: relative; height: 15px; display: flex; align-items: center; }
.tr-bar-fixed { position: absolute; left: 0; top: 0; height: 100%; background: #C44536; opacity: 0.2; border-radius: 2px; }
.tr-bar-variable { position: absolute; left: 0; top: 0; height: 100%; background: #FF9500; opacity: 0.2; border-radius: 2px; }
.tr-val { position: relative; z-index: 1; font-size: 10px; font-family: monospace; padding-left: 3px; }
.tr-total { font-size: 11px; font-family: monospace; text-align: right; }
.trend-row { border-bottom: 1px solid #EDE8E0; font-size: 12px; }
.trend-header { display: flex; }
.th-fixed, .th-variable { flex: 1; }
</style>
