<template>
  <div class="page-report">
    <div class="rpt-header">
      <span class="rpt-title">利润表</span>
      <span class="rpt-date">{{ data?.period || '加载中...' }}</span>
    </div>

    <div class="rpt-section">
      <div class="rpt-section-title">收入</div>
      <template v-for="item in incomeItems" :key="item.code">
        <div v-if="item.isL1" class="rpt-l1-header">
          <span class="rpt-label">{{ item.name }}</span>
          <span class="rpt-amount">{{ formatAmount(item.amount) }}</span>
        </div>
        <div v-else class="rpt-row">
          <span class="rpt-label indent">{{ item.name }}</span>
          <span class="rpt-amount">{{ formatAmount(item.amount) }}</span>
        </div>
      </template>
      <div class="rpt-total">
        <span>收入合计</span>
        <span>{{ formatAmount(data?.totalIncome || 0) }}</span>
      </div>
    </div>

    <div class="rpt-section">
      <div class="rpt-section-title">支出</div>

      <!-- Fixed Expenses -->
      <div class="rpt-group-header">固定支出</div>
      <template v-for="item in expenseItems" :key="item.code">
        <div v-if="item.isL1 && item.expenseType === 'fixed'" class="rpt-l1-header">
          <span class="rpt-label">{{ item.name }}</span>
          <span class="rpt-amount">{{ formatAmount(item.amount) }}</span>
        </div>
      </template>
      <div v-for="item in fixedExpenseItems" :key="item.name" class="rpt-row">
        <span class="rpt-label indent">{{ item.name }}</span>
        <span class="rpt-amount">{{ formatAmount(item.amount) }}</span>
      </div>

      <!-- Variable Expenses -->
      <div class="rpt-group-header">弹性支出</div>
      <div v-for="item in variableExpenseItems" :key="item.name" class="rpt-row">
        <span class="rpt-label indent">{{ item.name }}</span>
        <span class="rpt-amount">{{ formatAmount(item.amount) }}</span>
      </div>

      <!-- Mixed/unclassified -->
      <div v-if="otherExpenseItems.length > 0" class="rpt-group-header">其他支出</div>
      <div v-for="item in otherExpenseItems" :key="item.name" class="rpt-row">
        <span class="rpt-label indent">{{ item.name }}</span>
        <span class="rpt-amount">{{ formatAmount(item.amount) }}</span>
      </div>

      <div class="rpt-total">
        <span>支出合计</span>
        <span>{{ formatAmount(data?.totalExpense || 0) }}</span>
      </div>
    </div>

    <div class="rpt-summary">
      <div class="summary-row"><span>固定支出</span><span>{{ formatAmount(data?.fixedExpense || 0) }}</span></div>
      <div class="summary-row"><span>弹性支出</span><span>{{ formatAmount(data?.variableExpense || 0) }}</span></div>
      <div class="summary-row total"><span>本月结余</span><span>{{ formatAmount(data?.netSurplus || 0) }}</span></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {  onLoad  } from '@/uni-shim'
import { getDatabase } from '@/database/factory'
import { ReportGenerator } from '@/services/report-generator'

const data = ref<any>(null)

onLoad(async (opt) => {
  const period = opt?.period || ''
  const [y, m] = period.split('-').map(Number)
  const year = y || new Date().getFullYear()
  const month = m || new Date().getMonth() + 1
  try {
    const db = await getDatabase()
    const gen = new ReportGenerator(db)
    data.value = await gen.generateIncomeStatement(year, month)
  } catch (e: any) {
    uni.showToast({ title: '生成报表失败', icon: 'none' })
  }
})

const incomeItems = computed(() => {
  if (!data.value?.incomes) return []
  const result: any[] = []
  let currentL1 = ''
  for (const item of data.value.incomes) {
    if (item.level === 1) {
      result.push({ ...item, isL1: true, indent: false })
      currentL1 = item.name
    } else {
      result.push({ ...item, isL1: false, indent: true, name: '  ' + item.name })
    }
  }
  return result
})

const expenseItems = computed(() => {
  if (!data.value?.expenses) return []
  const result: any[] = []
  let currentL1 = ''
  for (const item of data.value.expenses) {
    if (item.level === 1) {
      result.push({ ...item, isL1: true, indent: false })
      currentL1 = item.name
    } else {
      result.push({ ...item, isL1: false, indent: true, name: '  ' + item.name })
    }
  }
  return result
})

// Split expense items by type for grouped display
const fixedExpenseItems = computed(() => expenseItems.value.filter((e: any) => e.expenseType === 'fixed' && !e.isL1))
const variableExpenseItems = computed(() => expenseItems.value.filter((e: any) => e.expenseType === 'variable' && !e.isL1))
const otherExpenseItems = computed(() => expenseItems.value.filter((e: any) => e.expenseType !== 'fixed' && e.expenseType !== 'variable' && !e.isL1))

// L1 expense headers
const l1ExpenseHeaders = computed(() => expenseItems.value.filter((e: any) => e.isL1))

function formatAmount(n: number): string { return '¥' + (n || 0).toFixed(2) }
</script>

<style lang="scss" scoped>
.page-report { padding: 10px; }
.rpt-header { text-align: center; margin-bottom: 12px; }
.rpt-title { font-size: 18px; font-weight: bold; }
.rpt-date { font-size: 12px; color: #9E9790; display: block; }
.rpt-section { background: #FDFCF9; border-radius: 6px; padding: 12px; margin-bottom: 8px; }
.rpt-section-title { font-size: 15px; font-weight: bold; margin-bottom: 6px; border-bottom: 1px solid #EDE8E0; padding-bottom: 4px; }
.rpt-group-header { font-size: 13px; font-weight: bold; color: #C44536; padding: 5px 0; margin-top: 3px; }
.rpt-row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #EDE8E0; }
.rpt-label { font-size: 13px; color: #1C1915; }
.rpt-label.indent { padding-left: 15px; color: #6B6560; }
.rpt-l1-header { display: flex; justify-content: space-between; padding: 6px 0; font-weight: 700; font-size: 14px; color: #1C1915; border-bottom: 1px solid #E0DBD3; }
.rpt-amount { font-size: 13px; color: #1C1915; font-family: monospace; }
.rpt-total { display: flex; justify-content: space-between; padding: 7px 0 0; font-weight: bold; font-size: 14px; border-top: 1px solid #EDE8E0; margin-top: 4px; }
.rpt-summary { background: #1C1915; border-radius: 6px; padding: 12px; color: #fff; }
.summary-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; color: rgba(255,255,255,0.7); }
.summary-row.total { font-size: 15px; font-weight: bold; color: #fff; border-top: 1px solid rgba(252,250,247,0.15); margin-top: 4px; padding-top: 7px; }
</style>
