<template>
  <div class="page-export">
    <!-- Transaction Export -->
    <div class="section">
      <div class="section-title">交易明细导出</div>
      <div class="card">
        <div class="form-row">
          <span class="label">开始日期</span>
          <el-input v-model="startDate" placeholder="YYYY-MM-DD" />
        </div>
        <div class="form-row">
          <span class="label">结束日期</span>
          <el-input v-model="endDate" placeholder="YYYY-MM-DD" />
        </div>
        <div class="form-row">
          <span class="label">格式</span>
          <div class="fmt-row">
            <span :class="['fmt-chip', fmt === 'csv' && 'active']" @click="fmt = 'csv'">CSV (≤10k行)</span>
            <span :class="['fmt-chip', fmt === 'xlsx' && 'active']" @click="fmt = 'xlsx'">Excel (≤65k行)</span>
            <span :class="['fmt-chip', fmt === 'json' && 'active']" @click="fmt = 'json'">JSON (全量备份)</span>
          </div>
        </div>
        <el-button type="primary" @click="doExportTx" :loading="loading">导出交易</el-button>
      </div>
    </div>

    <!-- Report Export -->
    <div class="section">
      <div class="section-title">报表导出 (Excel)</div>
      <div class="card">
        <div class="form-row">
          <span class="label">月份</span>
          <el-input v-model="rptMonth" placeholder="YYYY-MM" />
        </div>
        <div class="btn-stack">
          <el-button @click="doExportReport('balance')">资产负债表</el-button>
          <el-button @click="doExportReport('income')">利润表</el-button>
          <el-button @click="doExportReport('indicators')">财务指标</el-button>
        </div>
      </div>
    </div>

    <!-- Export path (Capacitor/Android only) -->
    <div class="section" v-if="isCapacitor">
      <div class="section-title">导出路径</div>
      <div class="card">
        <div class="form-row">
          <span class="label">保存目录</span>
          <el-input v-model="exportPath" placeholder="/Download/FinBook" />
          <span class="hint">文件将保存到内部存储的此目录下</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { uni } from '@/uni-shim'
import { ref, onMounted } from 'vue'
import { getDatabase } from '@/database/factory'
import { ExcelExportService } from '@/services/excel-export.service'

const isCapacitor = ref(false)
const exportPath = ref('/Download/FinBook')

onMounted(() => {
  try { isCapacitor.value = !!(window as any).Capacitor?.isNativePlatform() }
  catch { isCapacitor.value = false }
})

async function checkPin(): Promise<boolean> {
  const db = await getDatabase()
  const row = await db.queryOne<{value: string}>("SELECT value FROM app_settings WHERE key = 'app_pin'")
  if (!row?.value) return true // no PIN set
  return new Promise<boolean>((resolve) => {
    uni.showModal({
      title: '导出需要验证密码',
      content: '请输入您设置的应用锁密码以继续',
      editable: true,
      placeholderText: '6位数字密码',
      success: (res: any) => {
        if (res.confirm && res.content === row.value) {
          resolve(true)
        } else {
          uni.showToast({ title: '密码错误或已取消', icon: 'none' })
          resolve(false)
        }
      },
    })
  })
}

const startDate = ref('')
const endDate = ref('')
const rptMonth = ref('')
const fmt = ref('csv')
const loading = ref(false)

async function downloadBlob(data: Uint8Array | string, filename: string, mime: string) {
  // Capacitor/Android: request permission, save to ExternalStorage
  if (isCapacitor.value) {
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem')
      try { await Filesystem.requestPermissions() } catch {}
      const content = typeof data === 'string' ? data : new Uint8Array(data)
      const fp = exportPath.value.replace(/\/$/, '') + '/' + filename
      try {
        await Filesystem.writeFile({ path: fp, data: typeof content === 'string' ? content : new Uint8Array(content), directory: Directory.ExternalStorage, recursive: true })
        uni.showToast({ title: '已保存到: ' + fp })
        return
      } catch (e1: any) {
        console.warn('ExternalStorage failed:', e1.message)
        try {
          await Filesystem.writeFile({ path: filename, data: typeof content === 'string' ? content : new Uint8Array(content), directory: Directory.Data })
          uni.showToast({ title: '已保存到应用数据目录' })
          return
        } catch {}
        throw e1
      }
    } catch (e: any) {
      uni.showToast({ title: '保存失败: ' + (e.message || '未知错误'), icon: 'none' })
      return
    }
  }
  // Desktop/Browser: download via blob
  const blob = typeof data === 'string'
    ? new Blob(['﻿' + data], { type: mime })
    : new Blob([data], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

async function doExportTx() {
  if (!await checkPin()) return
  loading.value = true
  try {
    const db = await getDatabase()
    const svc = new ExcelExportService(db)
    const opts = {
      format: fmt.value as 'csv' | 'xlsx',
      startDate: startDate.value || undefined,
      endDate: endDate.value || undefined,
    }

    if (fmt.value === 'json') {
      // Full JSON backup
      const subjects = await db.query('SELECT * FROM accounting_subjects')
      const accounts = await db.query('SELECT * FROM accounts')
      const transactions = await db.query(
        "SELECT * FROM transactions WHERE is_deleted = 0 ORDER BY tx_date"
      )
      const entries = await db.query('SELECT * FROM journal_entries ORDER BY entry_date')
      const amortization = await db.query('SELECT * FROM amortization_schedules')
      const depreciation = await db.query('SELECT * FROM depreciation_configs')
      const budgets = await db.query('SELECT * FROM budget_overall')
      const thresholds = await db.query('SELECT * FROM budget_thresholds')
      const indicators = await db.query('SELECT * FROM user_indicators')
      const savedReports = await db.query('SELECT * FROM saved_reports')

      const data = {
        exportedAt: new Date().toISOString(),
        subjects, accounts, transactions, journalEntries: entries,
        amortizationSchedules: amortization, depreciationConfigs: depreciation,
        budgets, budgetThresholds: thresholds,
        userIndicators: indicators, savedReports,
      }
      downloadBlob(JSON.stringify(data, null, 2), 'accounting_full_backup.json', 'application/json')
    } else if (fmt.value === 'csv') {
      const csv = await svc.exportTransactionsCSV(opts)
      downloadBlob(csv, `transactions_${startDate.value || 'all'}.csv`, 'text/csv;charset=utf-8')
    } else {
      const xlsx = await svc.exportTransactionsXLSX(opts)
      downloadBlob(xlsx, `transactions_${startDate.value || 'all'}.xlsx`, 'application/vnd.ms-excel')
    }
    uni.showToast({ title: '导出成功', icon: 'success' })
  } finally {
    loading.value = false
  }
}

async function doExportReport(type: string) {
  if (!await checkPin()) return
  const month = rptMonth.value || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  const [y, m] = month.split('-').map(Number)
  if (!y || !m) {
    uni.showToast({ title: '请输入有效月份', icon: 'none' })
    return
  }

  loading.value = true
  try {
    const db = await getDatabase()
    const svc = new ExcelExportService(db)

    let data: Uint8Array
    let filename: string
    if (type === 'balance') {
      data = await svc.exportBalanceSheet(y, m)
      filename = `balance_sheet_${month}.xlsx`
    } else if (type === 'income') {
      data = await svc.exportIncomeStatement(y, m)
      filename = `income_statement_${month}.xlsx`
    } else {
      data = await svc.exportIndicators(y, m)
      filename = `indicators_${month}.xlsx`
    }
    downloadBlob(data, filename, 'application/vnd.ms-excel')
    uni.showToast({ title: '导出成功', icon: 'success' })
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
.page-export { padding: 15px; }
.section { margin-bottom: 15px; }
.section-title { font-size: 14px; font-weight: bold; margin-bottom: 6px; }
.card { background: #FDFCF9; border-radius: 6px; padding: 15px; }
.form-row { margin-bottom: 12px; }
.label { font-size: 13px; color: #6B6560; margin-bottom: 4px; display: block; }
.fmt-row { display: flex; gap: 6px; flex-wrap: wrap; }
.fmt-chip {
  font-size: 12px; padding: 5px 12px; border-radius: 10px;
  background: #F2EFE9; color: #6B6560; transition: all 0.2s;
}
.fmt-chip.active { background: #C44536; color: #fff; }
.btn-stack { display: flex; flex-direction: column; gap: 6px; }
.hint { font-size: 11px; color: #9E9790; margin-top: 4px; display: block; }
</style>
