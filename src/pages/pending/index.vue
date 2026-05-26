<template>
  <div class="page-pending">
    <div class="toolbar">
      <el-button type="primary" size="small" @click="doSelected" :disabled="selectedIds.length === 0">
        确认执行 ({{ selectedIds.length }})
      </el-button>
      <el-button type="warning" size="small" @click="generate">重新生成</el-button>
    </div>

    <div v-for="item in list" :key="item.id" class="card" @click="toggleSelect(item.id)">
      <div class="card-row">
        <div :class="['checkbox', selectedIds.includes(item.id) ? 'checked' : '']">
          <span v-if="selectedIds.includes(item.id)">✓</span>
        </div>
        <div class="cr-left">
          <span :class="['cr-badge', item.itemType]">{{ typeName(item.itemType) }}</span>
          <span class="cr-desc">{{ item.description }}</span>
        </div>
        <span class="cr-amount">¥{{ item.amount.toFixed(2) }}</span>
      </div>
      <div class="card-footer">
        <span class="cr-date">到期: {{ item.dueDate }}</span>
      </div>
    </div>

    <div v-if="list.length === 0" class="empty">
      <span class="empty-text">没有待处理事项</span>
    </div>

    <div v-if="list.length > 0" class="bottom-bar">
      <el-button type="default" size="small" @click="doDismissAll">稍后提醒</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {  onShow  } from '@/uni-shim'
import { getDatabase } from '@/database/factory'
import { PendingService } from '@/services/pending.service'
import type { PendingItem } from '@/types'

const list = ref<PendingItem[]>([])
const selectedIds = ref<number[]>([])

function typeName(t: string): string {
  const map: Record<string, string> = { depreciation: '折旧', amortization: '摊销', recurring: '循环' }
  return map[t] || t
}

function toggleSelect(id: number) {
  const idx = selectedIds.value.indexOf(id)
  if (idx >= 0) {
    selectedIds.value.splice(idx, 1)
  } else {
    selectedIds.value.push(id)
  }
}

async function load() {
  const db = await getDatabase()
  const svc = new PendingService(db)
  list.value = await svc.getAll()
  selectedIds.value = []
}

async function generate() {
  const db = await getDatabase()
  const svc = new PendingService(db)
  await svc.generateAll()
  await load()
  uni.showToast({ title: '已重新生成' })
}

async function doSelected() {
  if (selectedIds.value.length === 0) return
  const db = await getDatabase()
  const svc = new PendingService(db)
  for (const id of selectedIds.value) {
    const item = list.value.find(i => i.id === id)
    if (item) await svc.execute(item)
  }
  await load()
  uni.showToast({ title: `已执行 ${selectedIds.value.length} 项`, icon: 'success' })
}

async function doDismissAll() {
  uni.showToast({ title: '已关闭，下次打开 App 时提醒', icon: 'none' })
}

onShow(() => load())
</script>

<style lang="scss" scoped>
.page-pending { padding: 10px; padding-bottom: 60px; }
.toolbar { display: flex; gap: 6px; margin-bottom: 10px; }
.card { background: #FDFCF9; border-radius: 6px; padding: 12px; margin-bottom: 5px; }
.card-row { display: flex; align-items: center; gap: 6px; }
.checkbox { width: 20px; height: 20px; border-radius: 4px; border: 1px solid #E0DBD3; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.checkbox.checked { background: #C44536; border-color: #C44536; color: #fff; font-size: 11px; }
.cr-left { flex: 1; display: flex; align-items: center; gap: 5px; min-width: 0; }
.cr-badge { font-size: 10px; padding: 1px 5px; border-radius: 4px; color: #fff; }
.cr-badge.depreciation { background: #C44536; }
.cr-badge.amortization { background: #FF9500; }
.cr-badge.recurring { background: #2D7D7A; }
.cr-desc { font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cr-amount { font-size: 14px; font-weight: 500; font-family: monospace; flex-shrink: 0; }
.card-footer { display: flex; justify-content: space-between; margin-top: 4px; padding-left: 26px; }
.cr-date { font-size: 11px; color: #9E9790; }
.empty { text-align: center; padding: 40px 0; }
.empty-text { font-size: 14px; color: #9E9790; }
.bottom-bar { text-align: center; margin-top: 15px; }
</style>
