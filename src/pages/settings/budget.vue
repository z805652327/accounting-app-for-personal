<template>
  <div class="page-budget">
    <!-- Enable/Disable toggle -->
    <div class="enable-toggle" @click="toggleEnabled">
      <span>{{ budgetEnabled ? '预算已开启' : '预算已关闭' }}</span>
      <span :class="['toggle-switch', { on: budgetEnabled }]">{{ budgetEnabled ? 'ON' : 'OFF' }}</span>
    </div>

    <template v-if="budgetEnabled">
      <!-- Progress Overview -->
      <div class="section">
        <div class="progress-card">
          <div class="progress-header">
            <span class="progress-title">本月预算</span>
            <span :class="['progress-status', statusColor]">{{ statusText }}</span>
          </div>
          <div class="progress-amounts">
            <span class="progress-used">¥{{ usedFormatted }}</span>
            <span class="progress-sep">/</span>
            <span class="progress-cap">¥{{ capFormatted }}</span>
          </div>
          <div class="progress-bar-outer">
            <div
              :class="['progress-bar-inner', pct > 100 ? 'over' : pct > 80 ? 'warn' : '']"
              :style="{ width: Math.min(pct, 100) + '%' }"
            ></div>
          </div>
          <div class="progress-remaining">
            <span v-if="pct <= 100">剩余 ¥{{ remainingFormatted }} · 日均 ¥{{ dailyFormatted }}</span>
            <span v-else class="over-text">已超支 ¥{{ overFormatted }}</span>
          </div>
        </div>
      </div>

      <!-- Monthly cap setting -->
      <div class="section">
        <div class="section-title">月度总额预算</div>
        <div class="card row-inline">
          <el-input v-model="monthlyCap" type="number" placeholder="月度支出上限" class="flex-input">
            <template #prefix>¥</template>
          </el-input>
          <el-button type="primary" size="small" @click="saveOverall" :loading="savingCap">保存</el-button>
        </div>
      </div>

      <!-- Thresholds -->
      <div class="section">
        <div class="section-title">科目预警线</div>
        <div v-for="item in thresholdStatuses" :key="item.id" class="card threshold-row">
          <div class="th-info">
            <span class="th-name">{{ item.subjectName }}</span>
            <div class="th-bar-outer">
              <div
                :class="['th-bar-inner', item.overPct > 100 ? 'th-over' : item.overPct > 80 ? 'th-warn' : '']"
                :style="{ width: Math.min(item.overPct, 100) + '%' }"
              ></div>
            </div>
            <span :class="['th-amount', item.overPct > 100 ? 'txt-red' : item.overPct > 80 ? 'txt-yellow' : '']">
              ¥{{ item.actual.toFixed(0) }} / ¥{{ item.threshold.toFixed(0) }}
              <span v-if="item.overPct > 100">超 ¥{{ (item.actual - item.threshold).toFixed(0) }}</span>
            </span>
          </div>
          <span name="close" color="#C44536" size="14px" @click="delThreshold(item.id)"></span>
        </div>
        <div v-if="thresholds.length === 0" class="empty">暂无科目预警线</div>

        <div class="add-row">
          <picker :value="subjectPickerIdx" :range="subjectPickerLabels" @change="onPickerChange" class="picker-flex">
            <div class="picker-display">{{ selectedSubjectLabel || '选择科目' }}</div>
          </picker>
          <el-input v-model="newThresholdAmount" type="number" placeholder="限额" class="input-sm" />
          <el-button type="primary" size="small" @click="addThreshold" :loading="savingTh">添加</el-button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {  onShow  } from '@/uni-shim'
import { getDatabase } from '@/database/factory'
import { BalanceCalculator } from '@/services/balance-calculator'
import { useSubjectStore } from '@/stores/subjects'
import type { BudgetOverall, BudgetThreshold, AccountingSubject } from '@/types'

const subjectStore = useSubjectStore()

const budgetEnabled = ref(false)
const monthlyCap = ref('')
const thresholds = ref<BudgetThreshold[]>([])
const savingCap = ref(false)
const savingTh = ref(false)
const newThresholdAmount = ref('')
const selectedSubjectId = ref(0)
const selectedSubjectLabel = ref('')
const subjectPickerIdx = ref(0)

// Actual expenses (computed on load)
const actualExpenses = ref<Map<number, number>>(new Map())

const capNum = computed(() => Number(monthlyCap.value) || 0)
const usedNum = computed(() => actualExpenses.value.get(0) ?? 0)
const pct = computed(() => capNum.value > 0 ? Math.round(usedNum.value / capNum.value * 100) : 0)

const usedFormatted = computed(() => usedNum.value.toFixed(2))
const capFormatted = computed(() => capNum.value.toFixed(2))
const remainingFormatted = computed(() => Math.max(0, capNum.value - usedNum.value).toFixed(2))
const overFormatted = computed(() => Math.max(0, usedNum.value - capNum.value).toFixed(2))

const statusText = computed(() => {
  if (pct.value >= 100) return '已超支'
  if (pct.value > 80) return '即将超支'
  return '预算充足'
})
const statusColor = computed(() => {
  if (pct.value >= 100) return 'txt-red'
  if (pct.value > 80) return 'txt-yellow'
  return 'txt-green'
})

const daysLeft = computed(() => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() + 1
})
const dailyFormatted = computed(() => {
  if (daysLeft.value <= 0) return '0.00'
  return Math.max(0, (capNum.value - usedNum.value) / daysLeft.value).toFixed(2)
})

// Threshold status with actual spending
const thresholdStatuses = computed(() => {
  return thresholds.value.map(t => {
    const actual = actualExpenses.value.get(t.subjectId) ?? 0
    const overPct = t.amount > 0 ? Math.round(actual / t.amount * 100) : 0
    const sub = subjectStore.subjects.find(s => s.id === t.subjectId)
    return {
      ...t,
      subjectName: sub ? sub.name : `#${t.subjectId}`,
      actual,
      overPct,
    }
  })
})

// Subject picker
const expenseSubjects = computed(() =>
  subjectStore.subjects.filter(s =>
    s.subjectType === 'expense' && (s.level === 2 || s.level === 3)
  )
)
const subjectPickerLabels = computed(() =>
  expenseSubjects.value.map(s => `${s.code} ${s.name}`)
)

function onPickerChange(e: any) {
  subjectPickerIdx.value = e.detail.value
  const sub = expenseSubjects.value[e.detail.value]
  if (sub) {
    selectedSubjectId.value = sub.id
    selectedSubjectLabel.value = `${sub.code} ${sub.name}`
  }
}

async function load() {
  const db = await getDatabase()
  await subjectStore.load()

  const overall = await db.queryOne<BudgetOverall>(
    'SELECT * FROM budget_overall WHERE is_active = 1 LIMIT 1'
  )
  budgetEnabled.value = !!(overall && overall.monthlyCap > 0)
  if (overall) monthlyCap.value = String(overall.monthlyCap)
  thresholds.value = await db.query<BudgetThreshold>(
    'SELECT * FROM budget_thresholds WHERE is_active = 1'
  )

  // Calculate actual expenses
  const now = new Date()
  const calc = new BalanceCalculator(db)
  const balances = await calc.calculate(now.getFullYear(), now.getMonth() + 1)

  const actualMap = new Map<number, number>()
  // Total expense
  const totalExpense = balances
    .filter(b => b.subjectType === 'expense')
    .reduce((s, b) => s + b.closingBalance, 0)
  actualMap.set(0, Math.round(totalExpense * 100) / 100)

  // Per-threshold actuals — roll up from all expense subjects
  for (const th of thresholds.value) {
    const sub = subjectStore.subjects.find(s => s.id === th.subjectId)
    if (!sub) continue
    // Sum expenses under this subject (including children)
    const childIds = getDescendantIds(sub)
    const total = balances
      .filter(b => childIds.includes(b.subjectId) && b.subjectType === 'expense')
      .reduce((s, b) => s + b.closingBalance, 0)
    actualMap.set(th.subjectId, Math.round(total * 100) / 100)
  }
  actualExpenses.value = actualMap
}

function getDescendantIds(sub: AccountingSubject): number[] {
  const ids = [sub.id]
  for (const child of subjectStore.subjects.filter(s => s.parentId === sub.id)) {
    ids.push(...getDescendantIds(child))
  }
  return ids
}

async function toggleEnabled() {
  if (budgetEnabled.value) {
    const db = await getDatabase()
    await db.execute("UPDATE budget_overall SET is_active = 0")
    budgetEnabled.value = false
  } else {
    budgetEnabled.value = true
    // Will be saved with saveOverall
    monthlyCap.value = '5000'
  }
}

async function saveOverall() {
  savingCap.value = true
  try {
    const db = await getDatabase()
    const val = Number(monthlyCap.value)
    const existing = await db.queryOne<BudgetOverall>(
      'SELECT * FROM budget_overall WHERE is_active = 1 LIMIT 1'
    )
    const now = new Date()
    const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
    if (existing) {
      await db.execute('UPDATE budget_overall SET monthly_cap = ?, active_month = ?, is_active = 1 WHERE id = ?',
        [val, ym, existing.id])
    } else {
      await db.insert(
        'INSERT INTO budget_overall (monthly_cap, active_month, is_active) VALUES (?, ?, 1)',
        [val, ym]
      )
    }
    budgetEnabled.value = val > 0
    uni.showToast({ title: '已保存', icon: 'success' })
    await load()
  } finally {
    savingCap.value = false
  }
}

async function addThreshold() {
  if (!selectedSubjectId.value || !newThresholdAmount.value) {
    uni.showToast({ title: '请选择科目并输入限额', icon: 'none' })
    return
  }
  savingTh.value = true
  try {
    // Validate: if L3, sum of sibling L3s + new <= parent L2 threshold
    const sub = subjectStore.subjects.find(s => s.id === selectedSubjectId.value)
    if (sub && sub.level === 3 && sub.parentId) {
      const parentTh = thresholds.value.find(t => t.subjectId === sub.parentId)
      if (parentTh) {
        const siblingTotal = thresholds.value
          .filter(t => {
            const s = subjectStore.subjects.find(x => x.id === t.subjectId)
            return s && s.parentId === sub.parentId && t.id !== parentTh.id
          })
          .reduce((sum, t) => sum + t.amount, 0)
        if (siblingTotal + Number(newThresholdAmount.value) > parentTh.amount) {
          uni.showToast({ title: `L3阈值总额(${siblingTotal + Number(newThresholdAmount.value)})超过父级(${parentTh.amount})`, icon: 'none' })
          savingTh.value = false
          return
        }
      }
    }
    const db = await getDatabase()
    await db.insert(
      'INSERT INTO budget_thresholds (subject_id, amount, is_active) VALUES (?, ?, 1)',
      [selectedSubjectId.value, Number(newThresholdAmount.value)]
    )
    newThresholdAmount.value = ''
    selectedSubjectId.value = 0
    selectedSubjectLabel.value = ''
    uni.showToast({ title: '已添加', icon: 'success' })
    await load()
  } finally {
    savingTh.value = false
  }
}

async function delThreshold(id: number) {
  const db = await getDatabase()
  await db.execute('UPDATE budget_thresholds SET is_active = 0 WHERE id = ?', [id])
  await load()
}

onShow(() => load())
</script>

<style lang="scss" scoped>
.page-budget { padding: 10px; }
.enable-toggle {
  display: flex; justify-content: space-between; align-items: center;
  background: #FDFCF9; border-radius: 6px; padding: 12px; margin-bottom: 10px; font-size: 14px;
}
.toggle-switch { font-size: 11px; padding: 2px 10px; border-radius: 10px; background: #EDE8E0; color: #9E9790; }
.toggle-switch.on { background: #2D7D7A; color: #fff; }

/* Progress */
.progress-card {
  background: linear-gradient(135deg, #1C1915, #2D2A26);
  border-radius: 8px; padding: 16px; margin-bottom: 10px; color: #fff;
}
.progress-header { display: flex; justify-content: space-between; margin-bottom: 6px; }
.progress-title { font-size: 13px; opacity: 0.7; }
.progress-status { font-size: 12px; font-weight: 500; }
.progress-amounts { display: flex; align-items: baseline; gap: 4px; margin-bottom: 10px; }
.progress-used { font-size: 22px; font-weight: 500; }
.progress-sep { font-size: 14px; opacity: 0.4; }
.progress-cap { font-size: 14px; opacity: 0.5; }
.progress-bar-outer { height: 5px; background: rgba(252,250,247,0.15); border-radius: 3px; overflow: hidden; margin-bottom: 6px; }
.progress-bar-inner { height: 100%; border-radius: 3px; background: #2D7D7A; transition: width 0.6s; }
.progress-bar-inner.warn { background: #FF9500; }
.progress-bar-inner.over { background: #C44536; }
.progress-remaining { font-size: 11px; opacity: 0.6; }
.over-text { color: #C44536; }

.txt-green { color: #2D7D7A; }
.txt-yellow { color: #FF9500; }
.txt-red { color: #C44536; }

.section { margin-bottom: 15px; }
.section-title { font-size: 14px; font-weight: bold; margin-bottom: 6px; }
.card { background: #FDFCF9; border-radius: 6px; padding: 12px; }
.row-inline { display: flex; gap: 6px; align-items: center; }
.flex-input { flex: 1; }

.threshold-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; }
.th-info { flex: 1; min-width: 0; }
.th-name { font-size: 13px; margin-bottom: 3px; display: block; }
.th-bar-outer { height: 3px; background: #EDE8E0; border-radius: 2px; overflow: hidden; margin-bottom: 2px; }
.th-bar-inner { height: 100%; border-radius: 2px; background: #2D7D7A; transition: width 0.6s; }
.th-bar-inner.th-warn { background: #FF9500; }
.th-bar-inner.th-over { background: #C44536; }
.th-amount { font-size: 11px; color: #9E9790; }

.empty { text-align: center; color: #9E9790; padding: 15px; font-size: 13px; }
.add-row { display: flex; gap: 6px; align-items: center; margin-top: 8px; }
.picker-flex { flex: 1; }
.picker-display {
  font-size: 13px; color: #1C1915; background: #F2EFE9;
  border-radius: 4px; padding: 7px 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.input-sm { width: 70px; flex-shrink: 0; }
</style>
