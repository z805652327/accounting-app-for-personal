<template>
  <div class="page-settings">
    <div class="page-header">
      <span class="page-title">设置</span>
    </div>
    <div v-if="showSetup" class="setup-banner" @click="nav({path:'/pages/setup/index'})">
      <span class="setup-text">检测到尚未完成资产初始化，点击完成首次设置 ›</span>
    </div>
    <div class="section-label">功能</div>
    <div v-for="item in settings" :key="item.path" class="s-item" @click="nav(item)">
      <span>{{ item.name }}</span>
      <span name="arrow-right"></span>
    </div>
    <div class="section-label">系统</div>
    <div v-for="item in sysSettings" :key="item.path" class="s-item" @click="nav(item)">
      <span>{{ item.name }}</span>
      <span name="arrow-right"></span>
    </div>

    <div class="section-label">数据管理</div>
    <div class="s-item" @click="changeDbPath" v-if="dbPath">
      <div>
        <span>存储位置</span>
        <span class="s-item-hint" style="display:block;word-break:break-all">{{ dbPath }}</span>
      </div>
      <span style="font-size:11px;color:#9E9790">更改 ›</span>
    </div>
    <div class="s-item s-item-danger" @click="resetApp">
      <span>恢复出厂设置</span>
      <span class="s-item-hint">清空全部数据，不可恢复</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import {  onShow  } from '@/uni-shim'
import { getDatabase } from '@/database/factory'
import { SetupService } from '@/services/setup.service'
import { ref } from 'vue'

const showSetup = ref(false)
const dbPath = ref('')

const settings = [
  { name: '科目管理', path: '/pages/settings/subjects' },
  { name: '折旧管理', path: '/pages/settings/depreciation' },
  { name: '摊销管理', path: '/pages/settings/amortization' },
  { name: '预算管理', path: '/pages/settings/budget' },
  { name: '待处理事项', path: '/pages/pending/index' },
  { name: '导出数据', path: '/pages/settings/export' },
  { name: '导入数据', path: '/pages/settings/import' },
  { name: '定期记账', path: '/pages/settings/recurring' },
  { name: '标签管理', path: '/pages/settings/tags' },
  { name: '最近删除', path: '/pages/settings/recently-deleted' },
  { name: '自定义指标', path: '/pages/settings/indicators' },
  { name: '自定义报表', path: '/pages/settings/saved-reports' },
]

const sysSettings = [
  { name: '资产初始化', path: '/pages/setup/index' },
  { name: '数据对账', path: '/pages/settings/reconciliation' },
  { name: '年末结账', path: '/pages/settings/year-end-close' },
  { name: '编辑历史', path: '/pages/settings/edit-history' },
  { name: '安全设置', path: '/pages/settings/security' },
]

onShow(async () => {
  const db = await getDatabase()
  const svc = new SetupService(db)
  showSetup.value = !(await svc.isSetupComplete())
  // Show current DB path (Electron only)
  const edb = (window as any).electronDB
  if (edb) { dbPath.value = await edb.getDbPath() }
})
function nav(item: any) {
  if (item.path) uni.navigateTo({ url: item.path })
  else uni.showToast({ title: '敬请期待', icon: 'none' })
}
async function changeDbPath() {
  const edb = (window as any).electronDB
  if (!edb) { uni.showToast({ title: '此功能仅支持桌面端' }); return }
  const newPath = await edb.selectDbPath()
  if (newPath) {
    dbPath.value = newPath
    uni.showToast({ title: '存储位置已更新，重启生效' })
  }
}

async function resetApp() {
  // First confirmation
  const res1 = await uni.showModal({
    title: '恢复出厂设置',
    content: '此操作将清空全部数据（账户、交易、科目、预算、标签等），且不可恢复！确定要继续吗？',
    confirmText: '下一步',
    cancelText: '取消',
  })
  if (!res1.confirm) return

  // Second confirmation
  const res2 = await uni.showModal({
    title: '再次确认',
    content: '所有数据将被永久删除。建议先导出备份。确认清空吗？',
    confirmText: '确认清空',
    cancelText: '取消',
  })
  if (!res2.confirm) return

  // Third confirmation — type the word
  const res3 = await uni.showModal({
    title: '最终确认',
    content: '请输入"确认清空"以执行此操作',
    confirmText: '确认清空',
    cancelText: '取消',
  })
  if (!res3.confirm) return

  // Execute reset
  try {
    const db = await getDatabase()
    // Drop all user data tables
    const tables = [
      'transactions', 'journal_entries', 'edit_history', 'transaction_tags',
      'accounts', 'amortization_schedules', 'depreciation_configs',
      'investment_lots', 'investment_valuations',
      'budget_overall', 'budget_thresholds',
      'tags', 'user_indicators', 'saved_reports',
      'recurring_rules', 'split_transactions',
    ]
    for (const t of tables) {
      await db.execute(`DELETE FROM ${t}`)
    }
    // Reset user-created subjects (keep preset subjects)
    await db.execute(`DELETE FROM accounting_subjects WHERE is_system = 0`)
    // Reset app settings except db_version
    await db.execute(`DELETE FROM app_settings WHERE key != 'db_version'`)
    uni.showToast({ title: '已恢复出厂设置' })
    // Reload the page
    setTimeout(() => location.reload(), 1500)
  } catch (e: any) {
    uni.showToast({ title: '操作失败: ' + (e.message || '未知错误') })
  }
}
</script>

<style lang="scss" scoped>
.page-settings { padding: 18px; }
.page-header { margin-bottom: 18px; }
.page-title { font-family: 'Noto Serif SC', serif; font-size: 22px; font-weight: 700; color: #1C1915; display: block; }
.setup-banner {
  background: linear-gradient(135deg, #E08900, #C44536);
  color: #fff; border-radius: 6px; padding: 12px; margin-bottom: 10px;
  text-align: center; cursor: pointer;
}
.setup-text { font-size: 14px; font-weight: bold; }
.section-label {
  font-size: 11px; color: #9E9790; padding: 5px 2px; margin-top: 5px;
  font-weight: 500; letter-spacing: 0.04em;
}
.s-item {
  display: flex; justify-content: space-between; align-items: center;
  background: #FDFCF9; border-radius: 6px; padding: 14px 12px;
  margin-bottom: 4px; font-size: 14px; color: #1C1915;
  border: 1px solid #EDE8E0; cursor: pointer;
  transition: background 0.15s;
}
.s-item:active { background: #F7F4EE; }
.s-item .stub-icon { color: #9E9790; font-size: 12px; }
.s-item-danger { border-color: #C44536; }
.s-item-danger span:first-child { color: #C44536; }
.s-item-hint { font-size: 11px; color: #9E9790; }
</style>
