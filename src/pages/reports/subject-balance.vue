<template>
  <div class="page-report">
    <div class="rpt-header">
      <span class="rpt-title">科目余额表</span>
      <span class="rpt-date">{{ periodStr }}</span>
    </div>

    <div class="period-bar">
      <picker mode="date" :value="periodStr" fields="month" @change="onPeriodChange">
        <div class="period-btn">{{ periodStr }}</div>
      </picker>
    </div>

    <div class="sb-table">
      <div class="sb-header">
        <span class="col-code">编码</span>
        <span class="col-name">科目名称</span>
        <span class="col-amount">期初</span>
        <span class="col-amount">借方</span>
        <span class="col-amount">贷方</span>
        <span class="col-amount">期末</span>
      </div>
      <div v-for="row in balances" :key="row.subjectId" :class="['sb-row', 'lv' + row.level]" @click="drillDown(row)">
        <span class="col-code">{{ row.subjectCode }}</span>
        <span class="col-name">{{ row.subjectName }}</span>
        <span class="col-amount">{{ formatAmount(row.openingBalance) }}</span>
        <span class="col-amount">{{ formatAmount(row.debitAmount) }}</span>
        <span class="col-amount">{{ formatAmount(row.creditAmount) }}</span>
        <span class="col-amount">{{ formatAmount(row.closingBalance) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {  onShow  } from '@/uni-shim'
import { getDatabase } from '@/database/factory'
import { BalanceCalculator } from '@/services/balance-calculator'

const balances = ref<any[]>([])
const periodStr = ref('')
let loaded = false

function drillDown(row: any) {
  const id = Number(row.subjectId)
  uni.navigateTo({ url: `/pages/reports/subject-detail?id=${id}` })
}

onShow(async () => {
  if (!periodStr.value) {
    periodStr.value = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`
  }
  // Only auto-reload on first show; month picker triggers manual reloads
  if (!loaded) {
    loaded = true
    await loadData()
  }
})

function onPeriodChange(e: any) {
  periodStr.value = e.detail.value
  loadData()
}

async function loadData() {
  try {
    const [y, m] = periodStr.value.split('-').map(Number)
    const db = await getDatabase()
    const calc = new BalanceCalculator(db)
    balances.value = await calc.calculate(y, m)
  } catch (e: any) {
    uni.showToast({ title: '加载失败', icon: 'none' })
  }
}

function formatAmount(n: number): string { return (n || 0).toFixed(2) }
</script>

<style lang="scss" scoped>
.page-report { padding: 10px; }
.rpt-header { text-align: center; margin-bottom: 10px; }
.rpt-title { font-size: 18px; font-weight: bold; }
.rpt-date { font-size: 13px; color: #6B6560; }
.period-bar { margin-bottom: 10px; text-align: center; }
.period-btn { display: inline-block; background: #C44536; color: #fff; padding: 4px 16px; border-radius: 20px; font-size: 14px; }
.sb-table {
  background: #FDFCF9; border-radius: 6px; overflow: hidden; font-size: 11px;
}
.sb-header, .sb-row { display: flex; padding: 8px 4px; }
.sb-header { background: #E8E4DC; font-weight: bold; }
.lv1 { background: #FDFCF9; font-weight: bold; }
.lv2 { padding-left: 5px; }
.lv3 { padding-left: 10px; color: #6B6560; }
.col-code { width: 50px; flex-shrink: 0; }
.col-name { flex: 1; }
.col-amount { width: 55px; text-align: right; font-family: monospace; }
</style>
