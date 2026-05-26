<template>
  <div class="page-recon">
    <div class="card">
      <div class="card-title">数据对账</div>
      <span class="desc">检查所有交易的借贷是否平衡，识别异常分录。</span>
      <el-button type="primary" @click="runCheck" :loading="checking">开始检查</el-button>
    </div>

    <div v-if="result" class="card result-card">
      <div class="result-row">
        <span>交易总数</span>
        <span>{{ result.txCount }}</span>
      </div>
      <div class="result-row">
        <span>分录总数</span>
        <span>{{ result.jeCount }}</span>
      </div>
      <div :class="['result-row', result.balanced ? 'green' : 'red']">
        <span>借贷平衡</span>
        <span>{{ result.balanced ? '✓ 平衡' : '✗ 不平衡' }}</span>
      </div>
      <div v-if="!result.balanced" class="error-detail">
        <span>借方总额: ¥{{ result.totalDebit.toFixed(2) }}</span>
        <span>贷方总额: ¥{{ result.totalCredit.toFixed(2) }}</span>
        <span>差额: ¥{{ Math.abs(result.totalDebit - result.totalCredit).toFixed(2) }}</span>
      </div>
      <div class="result-row" v-if="result.unreconciled !== undefined">
        <span>未对账交易</span>
        <span>{{ result.unreconciled }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { getDatabase } from '@/database/factory'

const checking = ref(false)
const result = ref<any>(null)

async function runCheck() {
  checking.value = true
  try {
    const db = await getDatabase()
    const txCount = await db.queryOne<{cnt: number}>('SELECT COUNT(*) as cnt FROM transactions WHERE is_deleted = 0')
    const jeCount = await db.queryOne<{cnt: number}>('SELECT COUNT(*) as cnt FROM journal_entries')
    const totals = await db.queryOne<{dr: number | null, cr: number | null}>(
      `SELECT
        SUM(CASE WHEN direction = 'debit' THEN amount ELSE 0 END) as dr,
        SUM(CASE WHEN direction = 'credit' THEN amount ELSE 0 END) as cr
       FROM journal_entries`
    )
    const unreconciled = await db.queryOne<{cnt: number}>(
      'SELECT COUNT(*) as cnt FROM transactions WHERE is_reconciled = 0 AND is_deleted = 0'
    )

    result.value = {
      txCount: txCount?.cnt ?? 0,
      jeCount: jeCount?.cnt ?? 0,
      totalDebit: totals?.dr ?? 0,
      totalCredit: totals?.cr ?? 0,
      balanced: Math.abs((totals?.dr ?? 0) - (totals?.cr ?? 0)) < 0.01,
      unreconciled: unreconciled?.cnt ?? 0,
    }
  } finally {
    checking.value = false
  }
}
</script>

<style lang="scss" scoped>
.page-recon { padding: 10px; }
.card { background: #FDFCF9; border-radius: 6px; padding: 12px; margin-bottom: 8px; }
.card-title { font-size: 15px; font-weight: bold; margin-bottom: 6px; }
.desc { font-size: 13px; color: #6B6560; margin-bottom: 8px; line-height: 1.5; }
.result-card { }
.result-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 14px; border-bottom: 1px solid #EDE8E0; }
.result-row.green { color: #2D7D7A; }
.result-row.red { color: #C44536; }
.error-detail { margin-top: 6px; padding: 6px; background: #FFF3E0; border-radius: 4px; font-size: 12px; color: #E65100; }
.error-detail text { display: block; padding: 2px 0; }
</style>
