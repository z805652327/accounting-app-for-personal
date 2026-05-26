<template>
  <div class="page-deleted">
    <div class="header">
      <span class="header-desc">最近 30 天内删除的交易，可恢复或彻底删除</span>
    </div>

    <div v-if="loading" class="loading">加载中...</div>

    <div v-else-if="deletedList.length === 0" class="empty">
      <span class="empty-text">暂无已删除的交易</span>
    </div>

    <div v-else class="list">
      <div v-for="tx in deletedList" :key="tx.id" class="item">
        <div class="item-left">
          <span class="item-subject">{{ tx.subjectName }}</span>
          <span class="item-meta">{{ tx.txDate }} · {{ tx.accountName || '—' }}</span>
        </div>
        <div class="item-right">
          <span class="item-amount">¥{{ Math.abs(tx.amount).toFixed(2) }}</span>
          <div class="item-actions">
            <span class="action-restore" @click="doRestore(tx.id)">恢复</span>
            <span class="action-delete" @click="doPermanentDelete(tx.id)">彻底删除</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="deletedList.length > 0" class="batch-bar">
      <el-button type="warning" size="small" @click="doClearAll" :loading="clearing">
        清空所有已删除交易
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {  onShow  } from '@/uni-shim'
import { getDatabase } from '@/database/factory'
import { TransactionRepository, type TransactionDetail } from '@/repositories/transaction-repo'

const deletedList = ref<TransactionDetail[]>([])
const loading = ref(false)
const clearing = ref(false)

async function load() {
  loading.value = true
  try {
    const db = await getDatabase()
    const repo = new TransactionRepository(db)
    deletedList.value = await repo.findDeleted()
  } finally {
    loading.value = false
  }
}

async function doRestore(id: number) {
  const db = await getDatabase()
  const repo = new TransactionRepository(db)
  await repo.restore(id)
  uni.showToast({ title: '已恢复', icon: 'success' })
  await load()
}

async function doPermanentDelete(id: number) {
  const res = await uni.showModal({
    title: '确认彻底删除',
    content: '彻底删除后不可恢复，该交易的分录和编辑历史也将一并清除。确认吗？',
    confirmText: '确认删除',
    cancelText: '取消',
  })
  if (!res.confirm) return

  const db = await getDatabase()
  const repo = new TransactionRepository(db)
  await repo.permanentDelete(id)
  uni.showToast({ title: '已彻底删除', icon: 'success' })
  await load()
}

async function doClearAll() {
  const res = await uni.showModal({
    title: '确认清空',
    content: '将彻底删除最近删除列表中的所有交易。此操作不可撤销。',
    confirmText: '确认清空',
    cancelText: '取消',
  })
  if (!res.confirm) return

  clearing.value = true
  try {
    const db = await getDatabase()
    const repo = new TransactionRepository(db)
    for (const tx of deletedList.value) {
      await repo.permanentDelete(tx.id)
    }
    uni.showToast({ title: '已清空', icon: 'success' })
    await load()
  } finally {
    clearing.value = false
  }
}

onShow(() => load())
</script>

<style lang="scss" scoped>
.page-deleted { padding: 10px; }
.header { padding: 8px 0 10px; }
.header-desc { font-size: 12px; color: #9E9790; }
.loading { text-align: center; padding: 30px; color: #9E9790; }
.empty { text-align: center; padding: 40px 0; }
.empty-text { font-size: 14px; color: #9E9790; }

.item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 10px; background: #FDFCF9; border-radius: 6px; margin-bottom: 6px;
}
.item-subject { font-size: 14px; font-weight: 500; }
.item-meta { font-size: 11px; color: #9E9790; margin-top: 2px; }
.item-amount { font-size: 14px; font-weight: 500; color: #6B6560; }
.item-actions { display: flex; gap: 8px; margin-top: 4px; justify-content: flex-end; }
.action-restore { font-size: 12px; color: #C44536; }
.action-delete { font-size: 12px; color: #C44536; }
.batch-bar { margin-top: 15px; text-align: center; }
</style>
