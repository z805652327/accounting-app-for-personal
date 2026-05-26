<template>
  <div class="page-reports">
    <div class="period-picker">
      <span class="period-label">会计期间</span>
      <picker mode="date" :value="periodStr" fields="month" @change="onPeriodChange">
        <div class="period-value">{{ periodStr }}</div>
      </picker>
    </div>

    <div class="rpt-section">
      <div class="section-title">财务报表</div>
      <div v-for="rpt in mainReports" :key="rpt.path" class="rpt-card" @click="nav(rpt)">
        <div class="rpt-info">
          <span class="rpt-name">{{ rpt.name }}</span>
          <span class="rpt-desc">{{ rpt.desc }}</span>
        </div>
        <span name="arrow-right"></span>
      </div>
    </div>

    <div class="rpt-section">
      <div class="section-title">辅助报表</div>
      <div v-for="rpt in auxReports" :key="rpt.path" class="rpt-card" @click="nav(rpt)">
        <div class="rpt-info">
          <span class="rpt-name">{{ rpt.name }}</span>
        </div>
        <span name="arrow-right"></span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { uni } from '@/uni-shim'
import { ref } from 'vue'

const now = new Date()
const periodStr = ref(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)

function onPeriodChange(e: any) {
  periodStr.value = e.detail.value
}

const mainReports = [
  { name: '资产负债表', desc: '期末资产、负债、净资产状况', path: '/pages/reports/balance-sheet' },
  { name: '利润表', desc: '月度收入、支出、结余', path: '/pages/reports/income-statement' },
  { name: '现金流量表', desc: '经营/投资/筹资现金流', path: '/pages/reports/cash-flow' },
]

const auxReports = [
  { name: '科目余额表', path: '/pages/reports/subject-balance' },
  { name: '固定vs弹性分析', path: '/pages/reports/expense-analysis' },
  { name: '消费排行榜', path: '/pages/reports/expense-ranking' },
  { name: '预算执行报告', path: '/pages/reports/budget-report' },
  { name: '辅助报表（趋势·环比·分布）', path: '/pages/reports/auxiliary' },
]

function nav(rpt: any) {
  uni.navigateTo({ url: `${rpt.path}?period=${periodStr.value}` })
}
</script>

<style lang="scss" scoped>
.page-reports { padding: 10px; }
.period-picker {
  display: flex; justify-content: space-between; align-items: center;
  background: #FDFCF9; border-radius: 6px; padding: 12px;
  margin-bottom: 15px; border: 1px solid #EDE8E0;
}
.period-label { font-size: 13px; color: #6B6560; font-weight: 500; }
.period-value { font-size: 14px; font-weight: 600; color: #1C1915; }
.section-title {
  font-size: 12px; color: #9E9790; margin-bottom: 8px;
  padding-left: 5px; font-weight: 500; letter-spacing: 0.04em;
}
.rpt-section { margin-bottom: 15px; }
.rpt-card {
  display: flex; justify-content: space-between; align-items: center;
  background: #FDFCF9; border-radius: 6px; padding: 12px;
  margin-bottom: 4px; border: 1px solid #EDE8E0;
  cursor: pointer; transition: background 0.15s;
}
.rpt-card:active { background: #F7F4EE; }
.rpt-info { display: flex; flex-direction: column; }
.rpt-name { font-size: 14px; font-weight: 600; color: #1C1915; }
.rpt-desc { font-size: 11px; color: #9E9790; margin-top: 2px; }
.rpt-card .stub-icon { color: #9E9790; }
</style>
