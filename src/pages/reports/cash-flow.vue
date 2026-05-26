<template>
  <div class="page-report">
    <div class="rpt-header">
      <span class="rpt-title">现金流量表</span>
      <span class="rpt-date">{{ data?.period || '加载中...' }}</span>
    </div>

    <div class="cf-section">
      <div class="cf-title">一、经营活动现金流</div>
      <div v-for="item in data?.operatingInflows || []" :key="item.name" class="cf-row">
        <span>{{ item.name }}</span><span class="green">+{{ formatAmount(item.amount) }}</span>
      </div>
      <div v-for="item in data?.operatingOutflows || []" :key="item.name" class="cf-row">
        <span>{{ item.name }}</span><span class="red">-{{ formatAmount(item.amount) }}</span>
      </div>
      <div class="cf-total"><span>经营活动净额</span><span>{{ formatAmount(data?.operatingNet || 0) }}</span></div>
    </div>

    <div class="cf-section">
      <div class="cf-title">二、投资活动现金流</div>
      <div v-for="item in data?.investingInflows || []" :key="item.name" class="cf-row">
        <span>{{ item.name }}</span><span class="green">+{{ formatAmount(item.amount) }}</span>
      </div>
      <div v-for="item in data?.investingOutflows || []" :key="item.name" class="cf-row">
        <span>{{ item.name }}</span><span class="red">-{{ formatAmount(item.amount) }}</span>
      </div>
      <div class="cf-total"><span>投资活动净额</span><span>{{ formatAmount(data?.investingNet || 0) }}</span></div>
    </div>

    <div class="cf-section">
      <div class="cf-title">三、筹资活动现金流</div>
      <div v-for="item in data?.financingInflows || []" :key="item.name" class="cf-row">
        <span>{{ item.name }}</span><span class="green">+{{ formatAmount(item.amount) }}</span>
      </div>
      <div v-for="item in data?.financingOutflows || []" :key="item.name" class="cf-row">
        <span>{{ item.name }}</span><span class="red">-{{ formatAmount(item.amount) }}</span>
      </div>
      <div class="cf-total"><span>筹资活动净额</span><span>{{ formatAmount(data?.financingNet || 0) }}</span></div>
    </div>

    <div class="cf-summary">
      <div class="cf-row"><span>现金净增加额</span><span>{{ formatAmount(data?.netIncrease || 0) }}</span></div>
      <div class="cf-row"><span>期初现金余额</span><span>{{ formatAmount(data?.openingCash || 0) }}</span></div>
      <div class="cf-row total"><span>期末现金余额</span><span>{{ formatAmount(data?.closingCash || 0) }}</span></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
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
    data.value = await gen.generateCashFlow(year, month)
  } catch (e: any) {
    uni.showToast({ title: '生成报表失败', icon: 'none' })
  }
})

function formatAmount(n: number): string { return '¥' + (n || 0).toFixed(2) }
</script>

<style lang="scss" scoped>
.page-report { padding: 10px; }
.rpt-header { text-align: center; margin-bottom: 15px; }
.rpt-title { font-size: 18px; font-weight: bold; }
.rpt-date { font-size: 13px; color: #6B6560; display: block; margin-top: 4px; }
.cf-section { margin-bottom: 12px; background: #FDFCF9; border-radius: 6px; padding: 10px; }
.cf-title { font-size: 14px; font-weight: bold; color: #C44536; margin-bottom: 6px; }
.cf-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
.cf-total { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; font-weight: bold; border-top: 1px solid #ddd; margin-top: 4px; }
.cf-summary { background: #FDFCF9; border-radius: 6px; padding: 10px; }
.total { font-size: 15px; font-weight: bold; color: #C44536; border-top: 1px solid #007AFF; margin-top: 4px; padding-top: 8px; }
.green { color: #2D7D7A; }
.red { color: #C44536; }
</style>
