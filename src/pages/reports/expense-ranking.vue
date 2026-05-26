<template>
  <div class="page-report">
    <div class="period-bar">
      <picker mode="date" :value="periodStr" fields="month" @change="onChange">
        <div class="period-btn">{{ periodStr }}</div>
      </picker>
    </div>

    <div class="summary-card">
      <div class="s-row"><span>总支出</span><span>¥{{ totalExpense.toFixed(2) }}</span></div>
    </div>

    <div class="ranking-list">
      <div v-for="(item, i) in ranking" :key="item.name" class="rank-item">
        <span :class="['rank-num', i < 3 ? 'top' : '']">{{ i + 1 }}</span>
        <div class="rank-info">
          <span class="rank-name">{{ item.name }}</span>
          <div class="rank-bar-track">
            <div class="rank-bar-fill" :style="{width: item.pct + '%'}"></div>
          </div>
        </div>
        <div class="rank-right">
          <span class="rank-amount">¥{{ item.amount.toFixed(2) }}</span>
          <span class="rank-pct">{{ item.pct }}%</span>
        </div>
      </div>
      <div v-if="ranking.length === 0" class="empty">暂无数据</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {  onLoad  } from '@/uni-shim'
import { getDatabase } from '@/database/factory'
import { ReportGenerator } from '@/services/report-generator'

const periodStr = ref('')
const expenses = ref<{name:string;amount:number;category:string}[]>([])
const totalExpense = computed(() => expenses.value.reduce((s, e) => s + e.amount, 0))

const ranking = computed(() => {
  const total = totalExpense.value || 1
  const sorted = [...expenses.value].sort((a, b) => b.amount - a.amount)
  return sorted.map(e => ({ ...e, pct: Math.round(e.amount / total * 100) }))
})

async function load() {
  const [y, m] = periodStr.value.split('-').map(Number)
  const db = await getDatabase()
  const gen = new ReportGenerator(db)
  const stmt = await gen.generateIncomeStatement(y, m)
  expenses.value = stmt.expenses
    .filter(e => e.level === 2 && e.amount > 0)
    .map(e => ({ name: e.name, amount: e.amount, category: e.category }))
}

function onChange(e: any) { periodStr.value = e.detail.value; load() }

onLoad((opt) => {
  periodStr.value = opt?.period || `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`
  load()
})
</script>

<style lang="scss" scoped>
.page-report { padding: 10px; }
.period-bar { margin-bottom: 10px; text-align: center; }
.period-btn { display: inline-block; background: #C44536; color: #fff; padding: 4px 16px; border-radius: 20px; font-size: 14px; }
.summary-card { background: #FDFCF9; border-radius: 6px; padding: 12px; margin-bottom: 10px; }
.s-row { display: flex; justify-content: space-between; font-size: 15px; font-weight: bold; }
.ranking-list { background: #FDFCF9; border-radius: 6px; padding: 5px 10px; }
.rank-item { display: flex; align-items: center; padding: 8px 0; border-bottom: 1px solid #EDE8E0; }
.rank-num { width: 20px; font-size: 13px; font-weight: bold; color: #9E9790; }
.rank-num.top { color: #FF9500; }
.rank-info { flex: 1; margin: 0 6px; }
.rank-name { font-size: 13px; display: block; margin-bottom: 3px; }
.rank-bar-track { height: 5px; background: #E8E4DC; border-radius: 3px; overflow: hidden; }
.rank-bar-fill { height: 100%; background: #C44536; border-radius: 3px; }
.rank-right { text-align: right; }
.rank-amount { font-size: 13px; font-weight: bold; display: block; }
.rank-pct { font-size: 10px; color: #9E9790; }
.empty { text-align: center; color: #9E9790; padding: 30px; font-size: 14px; }
</style>
