<template>
  <div class="page-security">
    <div class="card">
      <div class="card-title">应用锁</div>
      <div class="toggle-row">
        <span>启动时需要密码</span>
        <el-switch v-model="enabled" @change="toggle" />
      </div>
      <div v-if="enabled" class="pin-section">
        <el-input v-model="pin" type="password" :placeholder="hasPin ? '输入新密码（留空不变）' : '设置6位数字密码'" maxlength="6" />
        <el-input v-model="pinConfirm" type="password" placeholder="再次输入密码确认" maxlength="6" class="mt-12" />
        <el-button type="primary" size="small" @click="savePin" class="mt-12">保存密码</el-button>
      </div>
    </div>

    <div class="card">
      <div class="card-title">数据安全</div>
      <div class="form-row">
        <span class="label">保存路径</span>
        <el-input v-model="backupPath" placeholder="/Download/FinBook" size="small" />
      </div>
      <el-button type="warning" size="small" @click="exportBackup">导出数据库备份</el-button>
      <el-button type="info" size="small" @click="importBackup" class="mt-12">导入数据库备份</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {  onShow  } from '@/uni-shim'
import { getDatabase } from '@/database/factory'

const enabled = ref(false)
const hasPin = ref(false)
const pin = ref('')
const pinConfirm = ref('')
const backupPath = ref('/Download/FinBook')

onShow(async () => {
  const db = await getDatabase()
  const row = await db.queryOne<{value: string}>("SELECT value FROM app_settings WHERE key = 'app_pin'")
  hasPin.value = !!row?.value
  enabled.value = !!row?.value
})

async function toggle(val: boolean) {
  const db = await getDatabase()
  if (!val) {
    await db.execute("DELETE FROM app_settings WHERE key = 'app_pin'")
    pin.value = ''
    hasPin.value = false
    uni.showToast({ title: '已关闭应用锁' })
  }
}

async function savePin() {
  if (pin.value && !/^\d{6}$/.test(pin.value)) {
    uni.showToast({ title: '密码需为6位数字', icon: 'none' })
    return
  }
  if (pin.value && pin.value !== pinConfirm.value) {
    uni.showToast({ title: '两次输入密码不一致', icon: 'none' })
    return
  }
  if (!pin.value && hasPin.value) {
    uni.showToast({ title: '密码未修改' })
    return
  }
  const db = await getDatabase()
  await db.execute("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('app_pin', ?)", [pin.value])
  hasPin.value = true
  pinConfirm.value = ''
  uni.showToast({ title: '密码已保存' })
}

async function exportBackup() {
  const db = await getDatabase()
  const tables = ['accounting_subjects', 'accounts', 'transactions', 'journal_entries',
    'amortization_schedules', 'depreciation_configs', 'investment_valuations',
    'investment_lots', 'budget_overall', 'budget_thresholds', 'pending_items']
  const data: Record<string, any[]> = {}
  for (const t of tables) {
    data[t] = await db.query<any>(`SELECT * FROM ${t}`)
  }
  const json = JSON.stringify(data, null, 2)
  const filename = `backup_${new Date().toISOString().slice(0, 10)}.json`

  // Capacitor/Android: request permissions, then save to file system
  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem')

    // Request storage permission first
    try {
      const perm = await Filesystem.requestPermissions()
      console.log('Storage permission:', perm?.publicStorage)
    } catch {}

    const dir = backupPath.value.replace(/\/$/, '')
    let saved = false

    // Primary: ExternalStorage (public Downloads folder, needs permission)
    try {
      await Filesystem.writeFile({
        path: `${dir}/${filename}`, data: json,
        directory: Directory.ExternalStorage, recursive: true,
      })
      uni.showToast({ title: '已保存到 ' + dir + '/' + filename })
      saved = true
    } catch (e1: any) {
      console.warn('ExternalStorage failed:', e1.message)
    }

    // Fallback: app Documents
    if (!saved) {
      try {
        await Filesystem.writeFile({
          path: filename, data: json, directory: Directory.Documents,
        })
        uni.showToast({ title: '已保存到应用文档: ' + filename })
        saved = true
      } catch (e2: any) {
        console.warn('Documents failed:', e2.message)
      }
    }

    // Last resort: app Data
    if (!saved) {
      await Filesystem.writeFile({
        path: filename, data: json, directory: Directory.Data,
      })
      uni.showToast({ title: '已保存到应用数据目录' })
    }
    return
  } catch (e: any) {
    console.error('Export error:', e.message)
  }

  // Desktop/Browser fallback
  try {
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    uni.showToast({ title: '备份已导出' })
  } catch (e: any) {
    uni.showToast({ title: '导出失败: ' + (e.message || '未知') })
  }
}

async function importBackup() {
  uni.showToast({ title: '请使用设置页的导入功能', icon: 'none' })
}
</script>

<style lang="scss" scoped>
.page-security { padding: 10px; }
.card { background: #FDFCF9; border-radius: 6px; padding: 12px; margin-bottom: 8px; }
.card-title { font-size: 15px; font-weight: bold; margin-bottom: 8px; }
.toggle-row { display: flex; justify-content: space-between; align-items: center; }
.pin-section { margin-top: 8px; }
.mt-12 { margin-top: 6px; }
.form-row { margin-bottom: 8px; }
.label { font-size: 12px; color: #6B6560; margin-bottom: 4px; display: block; }
</style>
