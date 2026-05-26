<template>
  <div class="page-report">
    <div class="rpt-header">
      <span class="rpt-title">资产负债表</span>
      <span class="rpt-date">{{ data?.date || '加载中...' }}</span>
    </div>

    <div class="rpt-section">
      <div class="rpt-section-title">资产</div>
      <div v-for="item in data?.assets || []" :key="item.name" class="rpt-row">
        <span class="rpt-label">{{ item.name }}</span>
        <span class="rpt-amount">{{ formatAmount(item.amount) }}</span>
      </div>
      <div class="rpt-total">
        <span class="rpt-label">资产合计</span>
        <span class="rpt-amount">{{ formatAmount(data?.totalAssets || 0) }}</span>
      </div>
    </div>

    <div class="rpt-section">
      <div class="rpt-section-title">负债</div>
      <div v-for="item in data?.liabilities || []" :key="item.name" class="rpt-row">
        <span class="rpt-label">{{ item.name }}</span>
        <span class="rpt-amount">{{ formatAmount(item.amount) }}</span>
      </div>
      <div class="rpt-total">
        <span class="rpt-label">负债合计</span>
        <span class="rpt-amount">{{ formatAmount(data?.totalLiabilities || 0) }}</span>
      </div>
    </div>

    <div class="rpt-section">
      <div class="rpt-section-title">净资产</div>
      <div v-for="item in data?.equity || []" :key="item.name" class="rpt-row">
        <span class="rpt-label">{{ item.name }}</span>
        <span class="rpt-amount">{{ formatAmount(item.amount) }}</span>
      </div>
      <div class="rpt-total">
        <span class="rpt-label">净资产合计</span>
        <span class="rpt-amount">{{ formatAmount(data?.totalEquity || 0) }}</span>
      </div>
    </div>

    <div class="rpt-check">
      <span :class="['check-icon', data?.isBalanced ? 'balanced' : 'unbalanced']">
        {{ data?.isBalanced ? '✓' : '✗' }}
      </span>
      <span>资产 = 负债 + 净资产</span>
    </div>

    <div class="rpt-notes">
      <span class="notes-title">注释</span>
      <span>※ 期末总资产 = 期初净资产 + 本期累计结余</span>
      <span>※ 固定资产以净值列示（原值 - 累计折旧）</span>
      <span>※ 如果期初净资产为 0，说明未进行资产初始化</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {  onShow  } from '@/uni-shim'
import { getDatabase } from '@/database/factory'
import { ReportGenerator } from '@/services/report-generator'

const data = ref<any>(null)
let initPeriod = ''

onShow(async () => {
  // Use current period on first load; subsequent shows refetch with same period
  if (!initPeriod) {
    const now = new Date()
    initPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }
  try {
    const [y, m] = initPeriod.split('-').map(Number)
    const db = await getDatabase()
    const gen = new ReportGenerator(db)
    data.value = await gen.generateBalanceSheet(y, m)
  } catch (e: any) {
    console.error('Balance sheet error:', e)
    uni.showToast({ title: '生成报表失败', icon: 'none' })
  }
})

function formatAmount(n: number): string {
  return '¥' + (n || 0).toFixed(2)
}
</script>

<style lang="scss" scoped>
.page-report { padding: 10px; }
.rpt-header { text-align: center; margin-bottom: 15px; }
.rpt-title { font-size: 18px; font-weight: bold; }
.rpt-date { font-size: 13px; color: #6B6560; display: block; margin-top: 4px; }
.rpt-section { margin-bottom: 12px; }
.rpt-section-title {
  font-size: 14px; font-weight: bold; color: #C44536;
  padding: 8px 0; border-bottom: 1px solid #007AFF; margin-bottom: 4px;
}
.rpt-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
.rpt-total {
  display: flex; justify-content: space-between; padding: 8px 0;
  font-size: 15px; font-weight: bold; border-top: 1px solid #ddd; margin-top: 4px;
}
.rpt-amount { font-family: monospace; }
.rpt-notes { background: #FDFCF9; border-radius: 6px; padding: 10px; font-size: 11px; color: #9E9790; line-height: 1.8; }
.notes-title { font-size: 12px; font-weight: bold; color: #6B6560; display: block; margin-bottom: 4px; }
.rpt-check {
  text-align: center; padding: 10px; font-size: 12px; color: #6B6560;
  .check-icon { font-size: 14px; margin-right: 4px; }
  .balanced { color: #2D7D7A; }
  .unbalanced { color: #C44536; }
}
</style>
