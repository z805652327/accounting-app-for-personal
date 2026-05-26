<template>
  <div class="page-yec">
    <div class="card">
      <div class="card-title">年末结账</div>
      <span class="desc">将本年累计结余（302）结转到期初净资产（301），使 302 归零重新开始累计。</span>
    </div>

    <div class="card">
      <div class="form-row">
        <span class="label">结转月份（YYYY-MM）</span>
        <el-input v-model="period" placeholder="如：2026-12" />
      </div>
      <el-button type="primary" size="small" @click="loadData">查询</el-button>
    </div>

    <div class="card" v-if="surplus !== null">
      <div class="info-row"><span>期间 {{ period }} 本期结余(302)</span><span>¥{{ surplus.toFixed(2) }}</span></div>
      <div class="info-row"><span>结转后 期初净资产(301)</span><span>¥{{ (currentEquity + surplus).toFixed(2) }}</span></div>
      <div class="info-row"><span>结转后 本期结余(302)</span><span>¥0.00</span></div>
    </div>

    <el-button type="warning" :loading="loading" @click="doClose" class="mt-20">执行年末结账</el-button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {  onShow  } from '@/uni-shim'
import { getDatabase } from '@/database/factory'
import { BalanceCalculator } from '@/services/balance-calculator'

const loading = ref(false)
const surplus = ref<number | null>(null)
const currentEquity = ref(0)
const period = ref(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`)

async function loadData() {
  const [y, m] = period.value.split('-').map(Number)
  if (!y || !m) { uni.showToast({ title: '请输入有效月份', icon: 'none' }); return }

  const db = await getDatabase()
  const calc = new BalanceCalculator(db)
  const balances = await calc.calculate(y, m)

  const income = balances.filter(b => b.subjectType === 'income').reduce((s, b) => s + b.closingBalance, 0)
  const expense = balances.filter(b => b.subjectType === 'expense').reduce((s, b) => s + b.closingBalance, 0)
  surplus.value = Math.round((income - expense) * 100) / 100

  const equityBal = balances.find(b => b.subjectCode === '30100')
  currentEquity.value = equityBal?.closingBalance ?? 0
}

onShow(() => loadData())

async function doClose() {
  if (surplus.value === null || Math.abs(surplus.value) < 0.01) {
    uni.showToast({ title: '结余为 0，无需结转', icon: 'none' })
    return
  }
  loading.value = true
  try {
    const db = await getDatabase()
    const now = new Date()
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

    // Look up actual DB IDs (code != auto-increment id)
    const subjectIds = await db.query<{code: string; id: number}>(
      "SELECT code, id FROM accounting_subjects WHERE code IN ('30100','30200')"
    )
    const eq301Id = subjectIds.find(s => s.code === '30100')?.id || 29
    const eq302Id = subjectIds.find(s => s.code === '30200')?.id || 30
    // Migrate old entries
    await db.execute('UPDATE journal_entries SET subject_id = ? WHERE subject_id = 30100', [eq301Id])
    await db.execute('UPDATE journal_entries SET subject_id = ? WHERE subject_id = 30200', [eq302Id])

    // Generate closing entry: Dr/Cr 302 → Cr/Dr 301
    const txId = await db.insert(
      `INSERT INTO transactions (tx_type, tx_date, amount, subject_id, note)
       VALUES ('transfer', ?, ?, ?, '年末结账')`,
      [dateStr, Math.abs(surplus.value), eq302Id]
    )

    if (surplus.value >= 0) {
      // Dr 302 (本期结余) → Cr 301 (期初净资产)
      await db.insert(
        `INSERT INTO journal_entries (transaction_id, subject_id, direction, amount, entry_date)
         VALUES (?, ?, 'debit', ?, ?)`,
        [txId, eq302Id, surplus.value, dateStr]
      )
      await db.insert(
        `INSERT INTO journal_entries (transaction_id, subject_id, direction, amount, entry_date)
         VALUES (?, ?, 'credit', ?, ?)`,
        [txId, eq301Id, surplus.value, dateStr]
      )
    } else {
      await db.insert(
        `INSERT INTO journal_entries (transaction_id, subject_id, direction, amount, entry_date)
         VALUES (?, ?, 'debit', ?, ?)`,
        [txId, eq301Id, -surplus.value, dateStr]
      )
      await db.insert(
        `INSERT INTO journal_entries (transaction_id, subject_id, direction, amount, entry_date)
         VALUES (?, ?, 'credit', ?, ?)`,
        [txId, eq302Id, -surplus.value, dateStr]
      )
    }

    const { TransactionRepository } = await import('@/repositories/transaction-repo')
    const repo = new TransactionRepository(db)
    await repo.recordEditHistory(txId, 'year_end_close', { yearEndClose: { old: false, new: true } })
    uni.showToast({ title: '年末结账完成' })
    surplus.value = 0
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
.page-yec { padding: 10px; }
.card { background: #FDFCF9; border-radius: 6px; padding: 12px; margin-bottom: 8px; }
.card-title { font-size: 15px; font-weight: bold; margin-bottom: 6px; }
.desc { font-size: 13px; color: #6B6560; line-height: 1.6; }
.form-row { margin-bottom: 8px; }
.label { font-size: 13px; color: #6B6560; margin-bottom: 4px; display: block; }
.info-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 14px; border-bottom: 1px solid #EDE8E0; }
.mt-20 { margin-top: 10px; }
</style>
