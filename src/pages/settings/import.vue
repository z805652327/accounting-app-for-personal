<template>
  <div class="page-import">
    <div class="card">
      <span class="desc">选择 JSON 备份文件导入。重复交易将列出供您选择保留或跳过。</span>
      <el-button type="primary" @click="pickFile" :loading="loading">选择文件并导入</el-button>
    </div>

    <!-- Progress -->
    <div v-if="progress.total > 0" class="progress-card">
      <span class="progress-text">正在导入：{{ progress.current }} / {{ progress.total }} 笔</span>
      <div class="progress-bar-outer">
        <div class="progress-bar-inner" :style="{ width: progressPct + '%' }"></div>
      </div>
    </div>

    <!-- Import Report -->
    <div v-if="report" class="report-card">
      <div class="report-title">导入报告</div>
      <div class="report-row"><span>新增交易</span><span class="r-green">{{ report.added }}</span></div>
      <div class="report-row"><span>跳过（重复）</span><span class="r-yellow">{{ report.skipped }}</span></div>
      <div class="report-row"><span>失败</span><span class="r-red">{{ report.failed }}</span></div>
      <div v-if="report.duplicates.length > 0" class="dup-section">
        <span class="dup-title">重复交易：</span>
        <div v-for="(dup, i) in report.duplicates" :key="i" class="dup-item">
          {{ dup.txDate }} · ¥{{ dup.amount.toFixed(2) }} · {{ dup.note || '—' }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { uni } from '@/uni-shim'
import { ref, computed } from 'vue'
import { getDatabase } from '@/database/factory'

const loading = ref(false)
const progress = ref({ current: 0, total: 0 })
const progressPct = computed(() => progress.value.total > 0 ? Math.round(progress.value.current / progress.value.total * 100) : 0)
const report = ref<{
  added: number; skipped: number; failed: number;
  duplicates: { txDate: string; amount: number; note: string }[]
} | null>(null)

/** Build fingerprint for dedup: date + amount + note + type */
function fingerprint(tx: any): string {
  return `${tx.txDate}|${tx.amount}|${tx.note || ''}|${tx.txType}`
}

async function pickFile() {
  loading.value = true
  try {
    const paths = await new Promise<string[]>((resolve) => {
      uni.chooseImage({ count: 1, success: (res) => resolve(res.tempFilePaths as string[]) })
    })
    const file = paths[0]
    if (!file) return

    const resp = await fetch(file)
    const data = await resp.json()

    if (!data.transactions || !Array.isArray(data.transactions)) {
      uni.showToast({ title: '文件格式无效：缺少 transactions 字段', icon: 'none' })
      return
    }

    const db = await getDatabase()

    // Pre-fetch existing fingerprints for dedup
    const existing = await db.query<{ txDate: string; amount: number; note: string | null; txType: string }>(
      'SELECT tx_date, amount, note, tx_type FROM transactions WHERE is_deleted = 0'
    )
    const existingPrints = new Set(existing.map(fingerprint))

    // Pre-fetch existing subjects and accounts for conflict detection
    const existingSubjects = await db.query<{ id: number; code: string; name: string }>('SELECT id, code, name FROM accounting_subjects')
    const existingAccounts = await db.query<{ id: number; name: string }>('SELECT id, name FROM accounts')
    const subjectCodeSet = new Set(existingSubjects.map(s => s.code))
    const accountNameSet = new Set(existingAccounts.map(a => a.name))

    // Detect conflicts
    const conflicts: string[] = []
    if (data.transactions) {
      const seenCodes = new Set<string>()
      for (const tx of data.transactions) {
        if (tx.subjectCode && !subjectCodeSet.has(tx.subjectCode) && !seenCodes.has(tx.subjectCode)) {
          seenCodes.add(tx.subjectCode)
          conflicts.push(`科目编码 ${tx.subjectCode} 不存在`)
        }
      }
    }
    if (data.accounts && Array.isArray(data.accounts)) {
      const seenNames = new Set<string>()
      for (const acc of data.accounts) {
        if (acc.name && accountNameSet.has(acc.name) && !seenNames.has(acc.name)) {
          seenNames.add(acc.name)
          conflicts.push(`账户 "${acc.name}" 已存在，将合并导入`)
        }
      }
    }

    // Warn about conflicts
    if (conflicts.length > 0) {
      const res = await new Promise<boolean>(resolve => {
        uni.showModal({
          title: `检测到 ${conflicts.length} 个冲突`,
          content: conflicts.slice(0, 5).join('\n') + (conflicts.length > 5 ? `\n...及其他 ${conflicts.length - 5} 项` : '') + '\n\n科目编码不存在的交易将跳过。账户同名将合并到已有账户。确认继续？',
          success: (r) => resolve(!!r.confirm),
        })
      })
      if (!res) {
        loading.value = false
        return
      }
    }

    let added = 0, skipped = 0, failed = 0
    const duplicates: { txDate: string; amount: number; note: string }[] = []
    progress.value = { current: 0, total: data.transactions.length }

    for (let i = 0; i < data.transactions.length; i++) {
      progress.value.current = i + 1
      const tx = data.transactions[i]

      // Validate required fields
      if (!tx.txType || !tx.txDate || tx.amount === undefined) {
        failed++
        continue
      }

      // Dedup check
      const fp = fingerprint(tx)
      if (existingPrints.has(fp)) {
        skipped++
        duplicates.push({ txDate: tx.txDate, amount: tx.amount, note: tx.note || '' })
        continue
      }

      try {
        // Validate subject exists (resolve code→id if needed)
        let subjectId = tx.subjectId
        if (tx.subjectCode && !subjectId) {
          const sub = await db.queryOne<{ id: number }>(
            'SELECT id FROM accounting_subjects WHERE code = ?', [tx.subjectCode]
          )
          if (sub) subjectId = sub.id
          else {
            failed++
            continue
          }
        }

        const txId = await db.insert(
          `INSERT INTO transactions (tx_type, tx_date, amount, subject_id, l3_subject_id, account_id, to_account_id, to_subject_id, note)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [tx.txType, tx.txDate, tx.amount, subjectId || 0,
           tx.l3SubjectId || null, tx.accountId || null,
           tx.toAccountId || null, tx.toSubjectId || null, tx.note || null]
        )

        // Import journal entries for this transaction
        if (data.journalEntries && Array.isArray(data.journalEntries)) {
          const txEntries = data.journalEntries.filter((je: any) =>
            je.transactionId === tx.id || je.transactionId === i
          )
          for (const je of txEntries) {
            await db.insert(
              `INSERT INTO journal_entries (transaction_id, account_id, subject_id, l3_subject_id, direction, amount, entry_date)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [txId, je.accountId || null, je.subjectId || 0,
               je.l3SubjectId || null, je.direction || 'debit',
               je.amount || 0, je.entryDate || tx.txDate]
            )
          }
        }

        existingPrints.add(fp)
        added++
      } catch {
        failed++
      }
    }

    report.value = { added, skipped, failed, duplicates }
    uni.showToast({ title: `新增 ${added}，跳过 ${skipped}，失败 ${failed}` })
  } catch (e: any) {
    uni.showToast({ title: '导入失败: ' + (e.message || e), icon: 'none' })
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
.page-import { padding: 15px; }
.card { background: #FDFCF9; border-radius: 6px; padding: 15px; margin-bottom: 10px; }
.desc { font-size: 13px; color: #6B6560; margin-bottom: 12px; line-height: 1.6; display: block; }
.report-card { background: #FDFCF9; border-radius: 6px; padding: 15px; }
.report-title { font-size: 15px; font-weight: bold; margin-bottom: 8px; }
.report-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; border-bottom: 1px solid #EDE8E0; }
.r-green { color: #2D7D7A; }
.r-yellow { color: #FF9500; }
.r-red { color: #C44536; }
.dup-section { margin-top: 8px; }
.dup-title { font-size: 12px; color: #9E9790; }
.dup-item { font-size: 11px; color: #9E9790; padding: 3px 0; }
.progress-card { background: #FDFCF9; border-radius: 6px; padding: 10px 15px; margin-bottom: 10px; }
.progress-text { font-size: 12px; color: #6B6560; margin-bottom: 5px; display: block; }
.progress-bar-outer { height: 4px; background: #EDE8E0; border-radius: 2px; overflow: hidden; }
.progress-bar-inner { height: 100%; background: #C44536; border-radius: 2px; transition: width 0.3s; }
</style>
